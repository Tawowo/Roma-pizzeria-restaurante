'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type Section = 'infos' | 'compteurs' | 'fidelite' | 'tables' | 'mdp'

interface ParamMap { [key: string]: string }
interface TableResto { id: string; numero: number; zone: string; capacite: number; actif: boolean }
interface ProfilAdmin { id: string; role: string; nom: string }

const INFO_KEYS = ['nom', 'telephone', 'adresse', 'message_fermeture']
const HERO_KEYS = ['hero_annees', 'hero_nb_pizzas', 'hero_familles']
const FIDELITE_KEYS = ['points_boisson', 'points_pizza_simple', 'points_pizza_premium']

const LABELS: Record<string, string> = {
  nom: 'Nom du restaurant', telephone: 'Téléphone', adresse: 'Adresse',
  message_fermeture: 'Message de fermeture', hero_annees: "Années d'expérience",
  hero_nb_pizzas: 'Pizzas créées', hero_familles: 'Familles servies',
  points_boisson: 'Points boisson', points_pizza_simple: 'Points pizza simple',
  points_pizza_premium: 'Points pizza premium',
}

const ZONES = ['rdc', 'etage', 'terrasse']

export default function ParametresPage() {
  const router = useRouter()
  const [section, setSection] = useState<Section>('infos')
  const [params, setParams] = useState<ParamMap>({})
  const [profils, setProfils] = useState<ProfilAdmin[]>([])
  const [mdp, setMdp] = useState<Record<string, string>>({})
  const [tables, setTables] = useState<TableResto[]>([])
  const [tablesErr, setTablesErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const allKeys = [...INFO_KEYS, ...HERO_KEYS, ...FIDELITE_KEYS]
      const { data } = await supabase.from('parametres').select('cle, valeur').in('cle', allKeys)
      const map: ParamMap = {}
      ;(data ?? []).forEach((r: { cle: string; valeur: string }) => { map[r.cle] = r.valeur })
      setParams(map)

      const { data: profilsData } = await supabase.from('profils_admin').select('id, role, nom')
      setProfils(profilsData ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTables = useCallback(async () => {
    setTablesErr('')
    try {
      const { data, error } = await supabase.from('tables_restaurant').select('*').order('zone').order('numero')
      if (error) { setTablesErr('Table tables_restaurant non configurée'); return }
      setTables((data ?? []) as TableResto[])
    } catch {
      setTablesErr('Impossible de charger les tables')
    }
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role !== 'monica') { router.replace('/dashboard'); return }
    fetchAll()
    fetchTables()
  }, [router, fetchAll, fetchTables])

  const saveParams = async (keys: string[]) => {
    setSaving(true)
    try {
      const upserts = keys.map(k => ({ cle: k, valeur: params[k] ?? '' }))
      await supabase.from('parametres').upsert(upserts, { onConflict: 'cle' })
      setSavedMsg('Sauvegardé ✓')
      setTimeout(() => setSavedMsg(''), 2000)
    } catch (err) { console.error(err) } finally { setSaving(false) }
  }

  const saveMdp = async (profilId: string) => {
    const pw = mdp[profilId]
    if (!pw) return
    setSaving(true)
    try {
      await supabase.from('profils_admin').update({ mot_de_passe: pw }).eq('id', profilId)
      setSavedMsg('Mot de passe mis à jour ✓')
      setTimeout(() => setSavedMsg(''), 2000)
    } catch (err) { console.error(err) } finally { setSaving(false) }
  }

  const toggleTableActif = async (id: string, actif: boolean) => {
    try {
      await supabase.from('tables_restaurant').update({ actif }).eq('id', id)
      await fetchTables()
    } catch { /* skip */ }
  }

  const supprimerTable = async (id: string) => {
    if (!confirm('Supprimer cette table ?')) return
    try {
      await supabase.from('tables_restaurant').delete().eq('id', id)
      await fetchTables()
    } catch { /* skip */ }
  }

  const ajouterTable = async (zone: string) => {
    try {
      const tablesZone = tables.filter(t => t.zone === zone)
      const maxNum = tablesZone.length > 0 ? Math.max(...tablesZone.map(t => t.numero)) : 0
      await supabase.from('tables_restaurant').insert([{ numero: maxNum + 1, zone, capacite: 4, actif: true }])
      await fetchTables()
    } catch { /* skip */ }
  }

  const sections: { key: Section; label: string }[] = [
    { key: 'infos', label: 'Infos restaurant' },
    { key: 'compteurs', label: 'Compteurs hero' },
    { key: 'fidelite', label: 'Fidélité' },
    { key: 'tables', label: 'Tables' },
    { key: 'mdp', label: 'Mots de passe' },
  ]

  const renderForm = (keys: string[]) => (
    <div className="space-y-4">
      {keys.map(k => (
        <div key={k}>
          <label className="block text-xs text-[#555] mb-1">{LABELS[k] ?? k}</label>
          <input type="text" value={params[k] ?? ''} onChange={e => setParams(prev => ({ ...prev, [k]: e.target.value }))}
            className="w-full max-w-md px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
        </div>
      ))}
      <button onClick={() => saveParams(keys)} disabled={saving}
        className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-[#B71C1C] hover:bg-[#C62828] disabled:opacity-50">
        {saving ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </div>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">Paramètres</h1>

      <div className="flex gap-2 mb-8 flex-wrap">
        {sections.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium border transition-all ${section === s.key ? 'bg-[#B71C1C] text-white border-[#B71C1C]' : 'bg-white text-[#555] border-[#E0D5C5] hover:bg-[#F0EBE0]'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {savedMsg && (
        <div className="mb-4 px-4 py-2 rounded-lg text-sm text-green-700 bg-green-50 border border-green-200 w-fit">
          {savedMsg}
        </div>
      )}

      {loading ? <div className="text-[#555]">Chargement...</div> : (
        <div className="max-w-2xl">
          {section === 'infos' && renderForm(INFO_KEYS)}
          {section === 'compteurs' && renderForm(HERO_KEYS)}
          {section === 'fidelite' && renderForm(FIDELITE_KEYS)}

          {section === 'tables' && (
            <div>
              {tablesErr ? (
                <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4">{tablesErr}</div>
              ) : tables.length === 0 ? (
                <div className="text-[#555]">Aucune table configurée.</div>
              ) : (
                ZONES.map(zone => {
                  const tablesZone = tables.filter(t => t.zone === zone)
                  return (
                    <div key={zone} className="mb-6">
                      <h3 className="font-semibold text-[#1A1A1A] mb-3 capitalize">{zone === 'rdc' ? '🏠 RDC' : zone === 'etage' ? '🏛 Étage' : '🌿 Terrasse'}</h3>
                      <div className="space-y-2">
                        {tablesZone.map(t => (
                          <div key={t.id} className="flex items-center gap-4 bg-white border border-[#E0D5C5] rounded-lg p-3">
                            <span className="font-medium w-16">Table {t.numero}</span>
                            <span className="text-sm text-[#555]">{t.capacite} pers.</span>
                            <label className="flex items-center gap-1 text-sm">
                              <input type="checkbox" checked={t.actif} onChange={e => toggleTableActif(t.id, e.target.checked)} />
                              Actif
                            </label>
                            <button onClick={() => supprimerTable(t.id)} className="ml-auto text-red-500 hover:text-red-700 text-sm">🗑 Supprimer</button>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => ajouterTable(zone)} className="mt-2 text-sm text-[#1B5E20] hover:text-[#2E7D32] font-medium">
                        + Ajouter une table
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {section === 'mdp' && (
            <div className="space-y-6">
              {profils.map(p => (
                <div key={p.id} className="rounded-xl p-5 bg-white border border-[#E0D5C5]">
                  <div className="font-medium mb-3 text-[#1A1A1A]">{p.nom} <span className="text-xs text-[#555] ml-2">({p.role})</span></div>
                  <div className="flex gap-3">
                    <input type="password" value={mdp[p.id] ?? ''} onChange={e => setMdp(prev => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="Nouveau mot de passe"
                      className="flex-1 px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
                    <button onClick={() => saveMdp(p.id)} disabled={saving || !mdp[p.id]}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#B71C1C] disabled:opacity-50">
                      Changer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
