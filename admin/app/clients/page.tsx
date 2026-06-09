'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type NiveauFilter = '' | 'Bronze' | 'Argent' | 'Or'

interface Client {
  id: string
  nom: string
  telephone: string
  email?: string
  points: number
  note_interne?: string
  created_at: string
  date_naissance?: string
}

interface MouvementFidelite {
  id: string
  points: number
  motif: string
  created_at: string
}

interface BonFidelite {
  id: string
  valeur: number
  statut: string
  date_expiration: string
}

function niveauFidelite(points: number): { label: string; color: string } {
  if (points >= 150) return { label: 'Or', color: '#D4A843' }
  if (points >= 50) return { label: 'Argent', color: '#aaa' }
  return { label: 'Bronze', color: '#cd7f32' }
}

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [niveauFilter, setNiveauFilter] = useState<NiveauFilter>('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [mouvements, setMouvements] = useState<MouvementFidelite[]>([])
  const [bons, setBons] = useState<BonFidelite[]>([])
  const [note, setNote] = useState('')
  const [ajoutPoints, setAjoutPoints] = useState(0)
  const [ajoutMotif, setAjoutMotif] = useState('')
  const [saving, setSaving] = useState(false)
  const [anniversaires, setAnniversaires] = useState<Client[]>([])
  const [top5, setTop5] = useState<Client[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchClients = useCallback(async (q: string, niveau: NiveauFilter) => {
    setLoading(true)
    try {
      let query = supabase.from('clients').select('*').order('nom').limit(100)
      if (q) query = query.or(`nom.ilike.%${q}%,telephone.ilike.%${q}%`)
      const { data, error } = await query
      if (error) throw error
      let all = (data ?? []) as Client[]
      if (niveau) all = all.filter(c => niveauFidelite(c.points).label === niveau)
      setClients(all)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchExtras = useCallback(async () => {
    // Top 5
    try {
      const { data } = await supabase.from('clients').select('*').order('points', { ascending: false }).limit(5)
      setTop5((data ?? []) as Client[])
    } catch { /* skip */ }

    // Anniversaires ce mois
    try {
      const month = new Date().getMonth() + 1
      const { data } = await supabase.from('clients').select('*').not('date_naissance', 'is', null)
      const anniv = ((data ?? []) as Client[]).filter(c => {
        if (!c.date_naissance) return false
        const m = new Date(c.date_naissance).getMonth() + 1
        return m === month
      })
      setAnniversaires(anniv)
    } catch { /* date_naissance peut ne pas exister */ }
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role !== 'monica') { router.replace('/dashboard'); return }
    fetchClients('', '')
    fetchExtras()
  }, [router, fetchClients, fetchExtras])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchClients(search, niveauFilter), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, niveauFilter, fetchClients])

  const openClient = async (client: Client) => {
    setSelected(client)
    setNote(client.note_interne ?? '')
    setAjoutPoints(0)
    setAjoutMotif('')
    try {
      const [{ data: mvts }, { data: bonsData }] = await Promise.all([
        supabase.from('mouvements_fidelite').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('bons_fidelite').select('*').eq('client_id', client.id).eq('statut', 'actif'),
      ])
      setMouvements(mvts ?? [])
      setBons(bonsData ?? [])
    } catch { /* skip */ }
  }

  const saveNote = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await supabase.from('clients').update({ note_interne: note }).eq('id', selected.id)
      setSelected(prev => prev ? { ...prev, note_interne: note } : null)
    } catch { /* skip */ } finally { setSaving(false) }
  }

  const handleAjoutPoints = async () => {
    if (!selected || ajoutPoints === 0 || !ajoutMotif) return
    setSaving(true)
    try {
      await Promise.all([
        supabase.from('mouvements_fidelite').insert([{ client_id: selected.id, points: ajoutPoints, motif: ajoutMotif }]),
        supabase.from('clients').update({ points: selected.points + ajoutPoints }).eq('id', selected.id),
      ])
      const newPoints = selected.points + ajoutPoints
      setSelected(prev => prev ? { ...prev, points: newPoints } : null)
      setAjoutPoints(0)
      setAjoutMotif('')
      const { data } = await supabase.from('mouvements_fidelite').select('*').eq('client_id', selected.id).order('created_at', { ascending: false }).limit(5)
      setMouvements(data ?? [])
    } catch { /* skip */ } finally { setSaving(false) }
  }

  const exportCSV = () => {
    const header = 'Nom,Telephone,Points,Niveau,Email,Date inscription\n'
    const rows = clients.map(c => `"${c.nom}","${c.telephone}",${c.points},"${niveauFidelite(c.points).label}","${c.email ?? ''}","${c.created_at}"`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'clients-roma.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Clients</h1>
        <button onClick={exportCSV} className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-[#E0D5C5] text-[#555] hover:bg-[#F0EBE0]">
          ↓ Exporter CSV
        </button>
      </div>

      {/* Top 5 */}
      {top5.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-[#E0D5C5] p-4">
          <h3 className="font-semibold text-[#1A1A1A] mb-3">🏆 Top 5 clients</h3>
          <div className="flex gap-3 flex-wrap">
            {top5.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 bg-[#F0EBE0] rounded-lg px-3 py-2 cursor-pointer" onClick={() => openClient(c)}>
                <span className="text-[#D4A843] font-bold text-sm">#{i + 1}</span>
                <span className="text-sm font-medium">{c.nom}</span>
                <span className="text-xs font-bold" style={{ color: niveauFidelite(c.points).color }}>{c.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anniversaires */}
      {anniversaires.length > 0 && (
        <div className="mb-6 bg-yellow-50 rounded-xl border border-yellow-200 p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">🎂 Anniversaires ce mois ({anniversaires.length})</h3>
          <div className="flex gap-2 flex-wrap">
            {anniversaires.map(c => (
              <span key={c.id} className="text-sm bg-yellow-100 text-yellow-800 rounded px-2 py-1">{c.nom}</span>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-3 mb-6">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou téléphone..."
          className="flex-1 max-w-lg px-4 py-2 rounded-lg text-sm border border-[#E0D5C5] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
        <div className="flex gap-1">
          {(['', 'Bronze', 'Argent', 'Or'] as NiveauFilter[]).map(n => (
            <button key={n} onClick={() => setNiveauFilter(n)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${niveauFilter === n ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-[#555] border-[#E0D5C5]'}`}>
              {n || 'Tous'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Liste */}
        <div className="flex-1">
          {loading ? <div className="text-[#555]">Recherche...</div> : (
            <div className="space-y-2">
              {clients.map(c => {
                const niv = niveauFidelite(c.points)
                return (
                  <div key={c.id} onClick={() => openClient(c)}
                    className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all bg-white border ${selected?.id === c.id ? 'border-[#1B5E20] shadow-sm' : 'border-[#E0D5C5]'} hover:border-[#1B5E20]`}>
                    <div>
                      <div className="font-medium text-[#1A1A1A]">{c.nom}</div>
                      <div className="text-xs text-[#555]">{c.telephone}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: niv.color }}>{c.points} pts</div>
                      <div className="text-xs" style={{ color: niv.color }}>{niv.label}</div>
                    </div>
                  </div>
                )
              })}
              {clients.length === 0 && !loading && <div className="text-[#555]">Aucun client trouvé.</div>}
            </div>
          )}
        </div>

        {/* Panel détail */}
        {selected && (
          <div className="w-80 shrink-0 rounded-xl p-5 bg-white border border-[#E0D5C5] shadow-sm h-fit">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-bold text-lg text-[#1A1A1A]">{selected.nom}</div>
                <div className="text-sm text-[#555]">{selected.telephone}</div>
                {selected.email && <div className="text-xs text-[#555]">{selected.email}</div>}
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="rounded-lg p-3 mb-4 bg-[#F0EBE0]">
              <div className="text-2xl font-bold" style={{ color: niveauFidelite(selected.points).color }}>{selected.points} pts</div>
              <div className="text-xs" style={{ color: niveauFidelite(selected.points).color }}>Niveau {niveauFidelite(selected.points).label}</div>
            </div>

            {mouvements.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-[#555] mb-2 uppercase tracking-widest font-medium">Derniers mouvements</div>
                {mouvements.map(m => (
                  <div key={m.id} className="flex justify-between text-xs py-0.5">
                    <span className="text-[#555]">{m.motif}</span>
                    <span style={{ color: m.points >= 0 ? '#2E7D32' : '#B71C1C' }}>{m.points >= 0 ? '+' : ''}{m.points}</span>
                  </div>
                ))}
              </div>
            )}

            {bons.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-[#555] mb-2 uppercase tracking-widest font-medium">Bons actifs</div>
                {bons.map(b => (
                  <div key={b.id} className="text-xs flex justify-between">
                    <span className="text-[#D4A843] font-bold">{b.valeur} €</span>
                    <span className="text-[#555]">exp. {b.date_expiration}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-4">
              <div className="text-xs text-[#555] mb-2 uppercase tracking-widest font-medium">Ajuster points</div>
              <input type="number" value={ajoutPoints} onChange={e => setAjoutPoints(Number(e.target.value))} placeholder="Ex: +10 ou -5"
                className="w-full px-3 py-2 rounded-lg text-sm mb-2 border border-[#E0D5C5] focus:outline-none" />
              <input type="text" value={ajoutMotif} onChange={e => setAjoutMotif(e.target.value)} placeholder="Motif"
                className="w-full px-3 py-2 rounded-lg text-sm mb-2 border border-[#E0D5C5] focus:outline-none" />
              <button onClick={handleAjoutPoints} disabled={saving} className="w-full py-2 rounded-lg text-sm font-medium text-white bg-[#B71C1C] disabled:opacity-50">
                Enregistrer
              </button>
            </div>

            <div>
              <div className="text-xs text-[#555] mb-2 uppercase tracking-widest font-medium">Note interne</div>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm mb-2 resize-none border border-[#E0D5C5] focus:outline-none" />
              <button onClick={saveNote} disabled={saving} className="w-full py-2 rounded-lg text-sm bg-[#F0EBE0] text-[#555] hover:bg-[#E0D5C5]">
                Sauvegarder note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
