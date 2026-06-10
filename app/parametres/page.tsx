'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

type Section = 'infos' | 'compteurs' | 'fidelite' | 'tables' | 'mdp'

interface ParamMap { [key: string]: string }
interface TableResto { id: string; numero: number; nom?: string; zone: string; capacite: number; actif: boolean }
interface ProfilAdmin { id: string; role: string; nom: string }

const INFO_KEYS = ['nom', 'telephone', 'adresse', 'message_fermeture']
const HERO_KEYS = ['hero_annees', 'hero_nb_pizzas', 'hero_familles']
const FIDELITE_KEYS = ['points_boisson', 'points_pizza_simple', 'points_pizza_premium']

const FIDELITE_ARTICLES = [
  { cle: 'points_boisson', label: 'Boisson offerte', description: 'Points nécessaires pour une boisson gratuite' },
  { cle: 'points_pizza_simple', label: 'Pizza simple offerte', description: 'Points pour une pizza 33cm gratuite' },
  { cle: 'points_pizza_premium', label: 'Pizza premium offerte', description: 'Points pour une pizza Pala/Calzone gratuite' },
]

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
  const [newTable, setNewTable] = useState({ nom: '', capacite: 4, zone: 'rdc' })

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

  const handleChangerMdp = async (profilId: string, role: string) => {
    const session = getSession()
    if (!session) return

    const actuel = mdp[role + '_actuel'] || ''
    const nouveau = mdp[role + '_nouveau'] || ''
    const confirm = mdp[role + '_confirm'] || ''

    if (!actuel) { setSavedMsg('Mot de passe actuel requis'); return }
    if (nouveau !== confirm) { setSavedMsg('Les mots de passe ne correspondent pas'); return }
    if (nouveau.length < 6) { setSavedMsg('Mot de passe trop court (min 6 caractères)'); return }

    setSaving(true)
    try {
      const { data: profilData } = await supabase
        .from('profils_admin')
        .select('mot_de_passe_hash, mot_de_passe')
        .eq('id', profilId)
        .single()

      let valid = false
      if (profilData?.mot_de_passe_hash) {
        valid = await bcrypt.compare(actuel, profilData.mot_de_passe_hash)
      } else if (profilData?.mot_de_passe) {
        valid = actuel === profilData.mot_de_passe
      }

      if (!valid) { setSavedMsg('Mot de passe actuel incorrect'); setSaving(false); return }

      const hash = await bcrypt.hash(nouveau, 10)
      await supabase.from('profils_admin')
        .update({ mot_de_passe_hash: hash, mot_de_passe: null })
        .eq('id', profilId)

      setSavedMsg('Mot de passe mis à jour ✓')
      setMdp(prev => ({ ...prev, [role + '_actuel']: '', [role + '_nouveau']: '', [role + '_confirm']: '' }))
      setTimeout(() => setSavedMsg(''), 3000)
    } catch (err) {
      console.error(err)
      setSavedMsg('Erreur lors du changement de mot de passe')
    } finally { setSaving(false) }
  }

  const toggleTableActif = async (id: string, actif: boolean) => {
    try {
      await supabase.from('tables_restaurant').update({ actif }).eq('id', id)
      await fetchTables()
    } catch { /* skip */ }
  }

  const deleteTable = async (id: string) => {
    if (!confirm('Supprimer cette table ?')) return
    try {
      await supabase.from('tables_restaurant').delete().eq('id', id)
      await fetchTables()
    } catch { /* skip */ }
  }

  const addTable = async () => {
    if (!newTable.nom) return
    try {
      const maxNum = Math.max(...tables.map(t => t.numero), 0)
      await supabase.from('tables_restaurant').insert({
        numero: maxNum + 1,
        nom: newTable.nom,
        zone: newTable.zone,
        capacite: newTable.capacite,
        actif: true
      })
      setNewTable({ nom: '', capacite: 4, zone: 'rdc' })
      await fetchTables()
    } catch (err) { console.error(err) }
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
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm w-fit border ${savedMsg.includes('✓') ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {savedMsg}
        </div>
      )}

      {loading ? <div className="text-[#555]">Chargement...</div> : (
        <div className="max-w-2xl">
          {section === 'infos' && renderForm(INFO_KEYS)}
          {section === 'compteurs' && renderForm(HERO_KEYS)}

          {section === 'fidelite' && (
            <div>
              <div className="overflow-x-auto rounded-xl border border-[#E0D5C5] mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F0EBE0]">
                      <th className="px-4 py-2 text-left font-medium text-[#555]">Récompense</th>
                      <th className="px-4 py-2 text-left font-medium text-[#555]">Description</th>
                      <th className="px-4 py-2 text-center font-medium text-[#555]">Points nécessaires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIDELITE_ARTICLES.map(f => (
                      <tr key={f.cle} className="border-t border-[#E0D5C5]">
                        <td className="px-4 py-3 font-medium text-[#1A1A1A]">{f.label}</td>
                        <td className="px-4 py-3 text-[#555]">{f.description}</td>
                        <td className="px-4 py-3 text-center">
                          <input type="number" min={1} value={params[f.cle] || ''}
                            onChange={e => setParams(prev => ({ ...prev, [f.cle]: e.target.value }))}
                            className="w-24 px-2 py-1 border border-[#E0D5C5] rounded text-center focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mb-4 p-3 bg-[#F0EBE0] rounded-lg text-sm text-[#555]">
                💡 Un client qui dépense 40€ gagnera {Math.round(40 * 10)} points (base: 10 pts/€)
              </div>
              <button onClick={() => saveParams(FIDELITE_KEYS)} disabled={saving}
                className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-[#B71C1C] hover:bg-[#C62828] disabled:opacity-50">
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          )}

          {section === 'tables' && (
            <div>
              {/* Formulaire d'ajout */}
              <div className="mb-6 p-4 bg-white border border-[#E0D5C5] rounded-xl">
                <h3 className="font-semibold text-[#1A1A1A] mb-3">Ajouter une table</h3>
                <div className="flex gap-3 flex-wrap">
                  <input placeholder="Nom (ex: Table du fond)"
                    value={newTable.nom}
                    onChange={e => setNewTable(t => ({ ...t, nom: e.target.value }))}
                    className="flex-1 min-w-0 px-3 py-2 text-sm border border-[#E0D5C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
                  <input type="number" min={1} max={20} value={newTable.capacite}
                    onChange={e => setNewTable(t => ({ ...t, capacite: Number(e.target.value) }))}
                    className="w-20 px-3 py-2 text-sm border border-[#E0D5C5] rounded-lg text-center focus:outline-none" />
                  <span className="flex items-center text-sm text-[#555]">pers.</span>
                  <select value={newTable.zone} onChange={e => setNewTable(t => ({ ...t, zone: e.target.value }))}
                    className="px-3 py-2 text-sm border border-[#E0D5C5] rounded-lg focus:outline-none">
                    {ZONES.map(z => <option key={z} value={z}>{z === 'rdc' ? 'RDC' : z === 'etage' ? 'Étage' : 'Terrasse'}</option>)}
                  </select>
                  <button onClick={addTable} disabled={!newTable.nom}
                    className="px-4 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#2E7D32]">
                    + Ajouter
                  </button>
                </div>
              </div>

              {tablesErr ? (
                <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4">{tablesErr}</div>
              ) : tables.length === 0 ? (
                <div className="text-[#555]">Aucune table configurée.</div>
              ) : (
                ZONES.map(zone => {
                  const tablesZone = tables.filter(t => t.zone === zone)
                  if (tablesZone.length === 0) return null
                  return (
                    <div key={zone} className="mb-4">
                      <h3 className="font-semibold text-[#1A1A1A] capitalize mb-2">
                        {zone === 'rdc' ? '🏠 RDC' : zone === 'etage' ? '🏛 Étage' : '🌿 Terrasse'}
                      </h3>
                      {tablesZone.map(t => (
                        <div key={t.id} className="flex items-center gap-3 py-2 border-b border-[#E0D5C5]">
                          <span className="w-8 font-mono text-sm text-[#555]">#{t.numero}</span>
                          <input defaultValue={t.nom || `Table ${t.numero}`}
                            onBlur={async (e) => {
                              await supabase.from('tables_restaurant').update({ nom: e.target.value }).eq('id', t.id)
                            }}
                            className="flex-1 px-2 py-1 text-sm border border-[#E0D5C5] rounded focus:outline-none focus:ring-1 focus:ring-[#1B5E20]" />
                          <input type="number" defaultValue={t.capacite} min={1} max={20}
                            onBlur={async (e) => {
                              await supabase.from('tables_restaurant').update({ capacite: Number(e.target.value) }).eq('id', t.id)
                            }}
                            className="w-16 px-2 py-1 text-sm border border-[#E0D5C5] rounded text-center focus:outline-none" />
                          <span className="text-xs text-[#555]">pers.</span>
                          <label className="flex items-center gap-1 text-xs text-[#555]">
                            <input type="checkbox" checked={t.actif} onChange={e => toggleTableActif(t.id, e.target.checked)} />
                            Actif
                          </label>
                          <button onClick={() => deleteTable(t.id)} className="text-red-400 hover:text-red-600 text-sm">🗑</button>
                        </div>
                      ))}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {section === 'mdp' && (
            <div className="space-y-4">
              {profils.map(p => (
                <div key={p.id} className="border border-[#E0D5C5] rounded-xl p-4">
                  <h3 className="font-semibold mb-3 text-[#1A1A1A]">{p.nom} <span className="text-xs text-[#555] font-normal">({p.role})</span></h3>
                  <div className="space-y-2">
                    {(['actuel', 'nouveau', 'confirm'] as const).map(type => (
                      <div key={type}>
                        <label className="block text-xs text-[#555] mb-1">
                          {type === 'actuel' ? 'Mot de passe actuel' : type === 'nouveau' ? 'Nouveau mot de passe' : 'Confirmer le nouveau'}
                        </label>
                        <input type="password"
                          value={mdp[p.role + '_' + type] || ''}
                          onChange={e => setMdp(prev => ({ ...prev, [p.role + '_' + type]: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-[#E0D5C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
                      </div>
                    ))}
                    <button onClick={() => handleChangerMdp(p.id, p.role)} disabled={saving}
                      className="w-full py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium mt-2 hover:bg-[#2E7D32] disabled:opacity-50">
                      {saving ? 'Mise à jour...' : 'Changer le mot de passe'}
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
