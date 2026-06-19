'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import { ALL_NAV_ITEMS } from '@/components/Sidebar'

type Section = 'infos' | 'compteurs' | 'fidelite' | 'tables' | 'mdp' | 'utilisateurs'

interface ParamMap { [key: string]: string }
interface TableResto { id: string; numero: number; nom?: string; zone: string; capacite: number; actif: boolean }

interface ProfilComplet {
  id: string
  role: string
  nom: string
  derniere_connexion?: string
  permissions: Record<string, boolean>
  code_acces?: string
}

interface NouveauProfil {
  nom: string
  role: string
  password: string
  confirmPassword: string
}

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
  const [mdp, setMdp] = useState<Record<string, string>>({})
  const [tables, setTables] = useState<TableResto[]>([])
  const [tablesErr, setTablesErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [newTable, setNewTable] = useState({ nom: '', capacite: 4, zone: 'rdc' })
  const [profilsComplets, setProfilsComplets] = useState<ProfilComplet[]>([])
  const [editingProfil, setEditingProfil] = useState<ProfilComplet | null>(null)
  const [nouveauProfil, setNouveauProfil] = useState<NouveauProfil>({ nom: '', role: 'andre', password: '', confirmPassword: '' })
  const [showAddProfil, setShowAddProfil] = useState(false)
  const [profilMsg, setProfilMsg] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const allKeys = [...INFO_KEYS, ...HERO_KEYS, ...FIDELITE_KEYS]
      const { data } = await supabase.from('parametres').select('cle, valeur').in('cle', allKeys)
      const map: ParamMap = {}
      ;(data ?? []).forEach((r: { cle: string; valeur: string }) => { map[r.cle] = r.valeur })
      setParams(map)

      const { data: profilsData } = await supabase.from('profils_admin').select('*').order('nom')
      setProfilsComplets((profilsData ?? []).map(p => ({ ...p, permissions: p.permissions ?? {} })))
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

  const handleChangerMdp = async (profilId: string) => {
    const session = getSession()
    if (!session) return

    const actuel = mdp[profilId + '_actuel'] || ''
    const nouveau = mdp[profilId + '_nouveau'] || ''
    const confirm = mdp[profilId + '_confirm'] || ''

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
      setMdp(prev => ({ ...prev, [profilId + '_actuel']: '', [profilId + '_nouveau']: '', [profilId + '_confirm']: '' }))
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

  const createProfil = async () => {
    if (!nouveauProfil.nom || !nouveauProfil.password) { setProfilMsg('Remplir tous les champs'); return }
    if (nouveauProfil.password !== nouveauProfil.confirmPassword) { setProfilMsg('Mots de passe différents'); return }
    try {
      const bcryptjs = await import('bcryptjs')
      const hash = await bcryptjs.default.hash(nouveauProfil.password, 10)
      await supabase.from('profils_admin').insert({
        nom: nouveauProfil.nom,
        role: nouveauProfil.role,
        code_acces: hash
      })
      setNouveauProfil({ nom: '', role: 'andre', password: '', confirmPassword: '' })
      setShowAddProfil(false)
      setProfilMsg('Profil créé ✓')
      await fetchAll()
    } catch (err) {
      console.error(err)
      setProfilMsg('Erreur lors de la création')
    }
  }

  const updateProfil = async (profilId: string, updates: Partial<ProfilComplet & { newPassword?: string }>) => {
    try {
      const updateData: Record<string, unknown> = {}
      if (updates.nom) updateData.nom = updates.nom
      if (updates.role) updateData.role = updates.role
      if (updates.permissions !== undefined) updateData.permissions = updates.permissions
      if (updates.newPassword) {
        const bcryptjs = await import('bcryptjs')
        updateData.code_acces = await bcryptjs.default.hash(updates.newPassword, 10)
      }
      await supabase.from('profils_admin').update(updateData).eq('id', profilId)
      setProfilMsg('Profil mis à jour ✓')
      await fetchAll()
      setEditingProfil(null)
    } catch (err) {
      console.error(err)
      setProfilMsg('Erreur lors de la mise à jour')
    }
  }

  const deleteProfil = async (profilId: string, profilNom: string) => {
    const session = getSession()
    if (session?.id === profilId) { setProfilMsg('Impossible de supprimer votre propre compte'); return }
    if (!confirm(`Supprimer le profil de ${profilNom} ? Cette action est irréversible.`)) return
    try {
      await supabase.from('profils_admin').delete().eq('id', profilId)
      setProfilMsg('Profil supprimé')
      await fetchAll()
    } catch (err) {
      console.error(err)
      setProfilMsg('Erreur lors de la suppression')
    }
  }

  const sections: { key: Section; label: string }[] = [
    { key: 'infos', label: 'Infos restaurant' },
    { key: 'compteurs', label: 'Compteurs hero' },
    { key: 'fidelite', label: 'Fidélité' },
    { key: 'tables', label: 'Tables' },
    { key: 'mdp', label: 'Mots de passe' },
    { key: 'utilisateurs', label: '👥 Utilisateurs' },
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

          {section === 'utilisateurs' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Gestion des utilisateurs</h2>
                <button onClick={() => setShowAddProfil(true)}
                  className="px-4 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium">
                  + Ajouter un profil
                </button>
              </div>

              {profilMsg && (
                <div className={`mb-3 px-4 py-2 rounded-lg text-sm ${profilMsg.includes('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {profilMsg}
                </div>
              )}

              {/* Liste des profils */}
              <div className="space-y-3 mb-6">
                {profilsComplets.filter((p, i, arr) => arr.findIndex(q => q.id === p.id) === i).map(p => (
                  <div key={p.id} className="border border-[#E0D5C5] rounded-xl p-4 bg-white">
                    {editingProfil?.id === p.id ? (
                      /* Mode édition */
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-[#555] mb-1">Nom</label>
                            <input value={editingProfil.nom}
                              onChange={e => setEditingProfil(prev => prev ? {...prev, nom: e.target.value} : prev)}
                              className="w-full px-3 py-2 text-sm border border-[#E0D5C5] rounded-lg" />
                          </div>
                          <div>
                            <label className="block text-xs text-[#555] mb-1">Rôle</label>
                            <select value={editingProfil.role}
                              onChange={e => setEditingProfil(prev => prev ? {...prev, role: e.target.value} : prev)}
                              className="w-full px-3 py-2 text-sm border border-[#E0D5C5] rounded-lg">
                              <option value="monica">Gérante</option>
                              <option value="andre">Serveur</option>
                              <option value="roberto">Cuisinier</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-[#555] mb-1">Nouveau mot de passe (laisser vide pour ne pas changer)</label>
                          <input type="password" placeholder="••••••••"
                            id={`newpw-${p.id}`}
                            className="w-full px-3 py-2 text-sm border border-[#E0D5C5] rounded-lg" />
                        </div>
                        {/* Permissions — non disponible pour Monica (accès total) */}
                        {editingProfil.role !== 'monica' && (
                          <div>
                            <label className="block text-xs text-[#555] mb-2 font-semibold">Accès aux pages</label>
                            <div className="grid grid-cols-2 gap-1.5 bg-[#F9F6F0] border border-[#E0D5C5] rounded-lg p-3">
                              {ALL_NAV_ITEMS.map(item => (
                                <label key={item.key} className="flex items-center gap-2 cursor-pointer text-xs text-[#333]">
                                  <input
                                    type="checkbox"
                                    checked={editingProfil.permissions?.[item.key] === true}
                                    onChange={e => setEditingProfil(prev => prev ? {
                                      ...prev,
                                      permissions: { ...prev.permissions, [item.key]: e.target.checked }
                                    } : prev)}
                                    className="accent-[#1B5E20]"
                                  />
                                  {item.icon} {item.label}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => {
                            const newPw = (document.getElementById(`newpw-${p.id}`) as HTMLInputElement)?.value
                            updateProfil(p.id, { nom: editingProfil.nom, role: editingProfil.role, permissions: editingProfil.permissions, newPassword: newPw || undefined })
                          }} className="flex-1 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium">
                            Enregistrer
                          </button>
                          <button onClick={() => setEditingProfil(null)}
                            className="px-4 py-2 border border-[#E0D5C5] text-[#555] rounded-lg text-sm">
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Mode affichage */
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-[#1A1A1A]">{p.nom}</div>
                          <div className="text-xs text-[#555] capitalize mt-0.5">
                            {p.role === 'monica' ? 'Gérante' : p.role === 'andre' ? 'Serveur' : 'Cuisinier'}
                            {p.derniere_connexion && (
                              <span className="ml-2">· Dernière connexion : {new Date(p.derniere_connexion).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingProfil({ ...p, permissions: p.permissions ?? {} })}
                            className="px-3 py-1.5 rounded-lg text-xs bg-[#F0EBE0] text-[#555] hover:bg-[#E0D5C5]">
                            ✏️ Modifier
                          </button>
                          {/* Ne peut pas supprimer son propre compte */}
                          {p.role !== 'monica' && (
                            <button onClick={() => deleteProfil(p.id, p.nom)}
                              className="px-3 py-1.5 rounded-lg text-xs bg-red-50 text-red-600 hover:bg-red-100">
                              🗑️ Supprimer
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Modal ajout nouveau profil */}
              {showAddProfil && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-lg font-bold">Nouveau profil</h2>
                      <button onClick={() => setShowAddProfil(false)} className="text-gray-400">✕</button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs text-[#555] mb-1">Nom / Prénom *</label>
                        <input value={nouveauProfil.nom}
                          onChange={e => setNouveauProfil(p => ({...p, nom: e.target.value}))}
                          className="w-full px-3 py-2 text-sm border border-[#E0D5C5] rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-xs text-[#555] mb-1">Rôle *</label>
                        <select
                          value={['monica','andre','roberto'].includes(nouveauProfil.role) ? nouveauProfil.role : '_autre'}
                          onChange={e => {
                            if (e.target.value === '_autre') setNouveauProfil(p => ({...p, role: ''}))
                            else setNouveauProfil(p => ({...p, role: e.target.value}))
                          }}
                          className="w-full px-3 py-2 text-sm border border-[#E0D5C5] rounded-lg">
                          <option value="monica">Gérant(e)</option>
                          <option value="andre">Serveur</option>
                          <option value="roberto">Cuisinier</option>
                          <option value="_autre">Autre...</option>
                        </select>
                        {!['monica','andre','roberto'].includes(nouveauProfil.role) && (
                          <input
                            value={nouveauProfil.role}
                            onChange={e => setNouveauProfil(p => ({...p, role: e.target.value}))}
                            placeholder="Ex: Caissier, Livraison..."
                            className="w-full px-3 py-2 text-sm border border-[#E0D5C5] rounded-lg mt-2"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-[#555] mb-1">Mot de passe *</label>
                        <input type="password" value={nouveauProfil.password}
                          onChange={e => setNouveauProfil(p => ({...p, password: e.target.value}))}
                          className="w-full px-3 py-2 text-sm border border-[#E0D5C5] rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-xs text-[#555] mb-1">Confirmer *</label>
                        <input type="password" value={nouveauProfil.confirmPassword}
                          onChange={e => setNouveauProfil(p => ({...p, confirmPassword: e.target.value}))}
                          className="w-full px-3 py-2 text-sm border border-[#E0D5C5] rounded-lg" />
                      </div>
                    </div>
                    {profilMsg && <p className="text-sm text-red-600 mt-2">{profilMsg}</p>}
                    <div className="flex gap-3 mt-5">
                      <button onClick={() => setShowAddProfil(false)} className="flex-1 py-2 border border-[#E0D5C5] text-[#555] rounded-lg text-sm">Annuler</button>
                      <button onClick={createProfil} className="flex-1 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium">Créer</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {section === 'mdp' && (
            <div className="space-y-4">
              {profilsComplets.filter((p, i, arr) => arr.findIndex(q => q.id === p.id) === i).map(p => (
                <div key={p.id} className="border border-[#E0D5C5] rounded-xl p-4">
                  <h3 className="font-semibold mb-3 text-[#1A1A1A]">{p.nom} <span className="text-xs text-[#555] font-normal">({p.role})</span></h3>
                  <div className="space-y-2">
                    {(['actuel', 'nouveau', 'confirm'] as const).map(type => (
                      <div key={type}>
                        <label className="block text-xs text-[#555] mb-1">
                          {type === 'actuel' ? 'Mot de passe actuel' : type === 'nouveau' ? 'Nouveau mot de passe' : 'Confirmer le nouveau'}
                        </label>
                        <input type="password"
                          value={mdp[p.id + '_' + type] || ''}
                          onChange={e => setMdp(prev => ({ ...prev, [p.id + '_' + type]: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-[#E0D5C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
                      </div>
                    ))}
                    <button onClick={() => handleChangerMdp(p.id)} disabled={saving}
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
