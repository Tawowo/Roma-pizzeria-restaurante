'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface Client {
  id: string
  nom: string
  telephone: string
  email?: string
  points: number
  note_interne?: string
  created_at: string
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
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [mouvements, setMouvements] = useState<MouvementFidelite[]>([])
  const [bons, setBons] = useState<BonFidelite[]>([])
  const [note, setNote] = useState('')
  const [ajoutPoints, setAjoutPoints] = useState(0)
  const [ajoutMotif, setAjoutMotif] = useState('')
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchClients = useCallback(async (q: string) => {
    setLoading(true)
    try {
      let query = supabase.from('clients').select('*').order('nom').limit(50)
      if (q) query = query.or(`nom.ilike.%${q}%,telephone.ilike.%${q}%`)
      const { data, error } = await query
      if (error) throw error
      setClients(data ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role !== 'monica') { router.replace('/dashboard'); return }
    fetchClients('')
  }, [router, fetchClients])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchClients(search), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, fetchClients])

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
    } catch (err) {
      console.error(err)
    }
  }

  const saveNote = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await supabase.from('clients').update({ note_interne: note }).eq('id', selected.id)
      setSelected(prev => prev ? { ...prev, note_interne: note } : null)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
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
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8" style={{ color: '#F5F5F5' }}>
      <h1 className="text-2xl font-bold mb-6">Clients</h1>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher par nom ou téléphone..."
        className="w-full max-w-lg px-4 py-3 rounded-lg text-sm mb-6 focus:outline-none"
        style={{ background: '#242424', border: '1px solid #333', color: '#F5F5F5' }}
      />

      <div className="flex gap-6">
        {/* Liste */}
        <div className="flex-1">
          {loading ? <div className="text-gray-500">Recherche...</div> : (
            <div className="space-y-2">
              {clients.map(c => {
                const niv = niveauFidelite(c.points)
                return (
                  <div
                    key={c.id}
                    onClick={() => openClient(c)}
                    className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all"
                    style={{ background: selected?.id === c.id ? '#2a2a2a' : '#1a1a1a', border: `1px solid ${selected?.id === c.id ? '#444' : '#2a2a2a'}` }}
                  >
                    <div>
                      <div className="font-medium">{c.nom}</div>
                      <div className="text-xs text-gray-400">{c.telephone}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: niv.color }}>{c.points} pts</div>
                      <div className="text-xs" style={{ color: niv.color }}>{niv.label}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Panel détail */}
        {selected && (
          <div className="w-80 flex-shrink-0 rounded-xl p-5" style={{ background: '#242424', border: '1px solid #333', height: 'fit-content' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-bold text-lg">{selected.nom}</div>
                <div className="text-sm text-gray-400">{selected.telephone}</div>
                {selected.email && <div className="text-xs text-gray-500">{selected.email}</div>}
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-600 hover:text-gray-300">✕</button>
            </div>

            {/* Points */}
            <div className="rounded-lg p-3 mb-4" style={{ background: '#1a1a1a' }}>
              <div className="text-2xl font-bold" style={{ color: niveauFidelite(selected.points).color }}>{selected.points} pts</div>
              <div className="text-xs" style={{ color: niveauFidelite(selected.points).color }}>Niveau {niveauFidelite(selected.points).label}</div>
            </div>

            {/* Mouvements */}
            {mouvements.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-widest">Derniers mouvements</div>
                <div className="space-y-1">
                  {mouvements.map(m => (
                    <div key={m.id} className="flex justify-between text-xs">
                      <span className="text-gray-400">{m.motif}</span>
                      <span style={{ color: m.points >= 0 ? '#4caf50' : '#ef5350' }}>{m.points >= 0 ? '+' : ''}{m.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bons */}
            {bons.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-widest">Bons actifs</div>
                {bons.map(b => (
                  <div key={b.id} className="text-xs flex justify-between">
                    <span className="text-yellow-500 font-bold">{b.valeur} €</span>
                    <span className="text-gray-500">exp. {b.date_expiration}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Ajout points */}
            <div className="mb-4">
              <div className="text-xs text-gray-400 mb-2 uppercase tracking-widest">Ajuster points</div>
              <input type="number" value={ajoutPoints} onChange={e => setAjoutPoints(Number(e.target.value))}
                placeholder="Ex: +10 ou -5"
                className="w-full px-3 py-2 rounded-lg text-sm mb-2 focus:outline-none"
                style={{ background: '#1a1a1a', border: '1px solid #333', color: '#F5F5F5' }} />
              <input type="text" value={ajoutMotif} onChange={e => setAjoutMotif(e.target.value)}
                placeholder="Motif"
                className="w-full px-3 py-2 rounded-lg text-sm mb-2 focus:outline-none"
                style={{ background: '#1a1a1a', border: '1px solid #333', color: '#F5F5F5' }} />
              <button onClick={handleAjoutPoints} disabled={saving} className="w-full py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#B71C1C' }}>
                Enregistrer
              </button>
            </div>

            {/* Note interne */}
            <div>
              <div className="text-xs text-gray-400 mb-2 uppercase tracking-widest">Note interne</div>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm mb-2 resize-none focus:outline-none"
                style={{ background: '#1a1a1a', border: '1px solid #333', color: '#F5F5F5' }} />
              <button onClick={saveNote} disabled={saving} className="w-full py-2 rounded-lg text-sm" style={{ background: '#333', color: '#888' }}>
                Sauvegarder note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
