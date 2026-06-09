'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type Section = 'infos' | 'compteurs' | 'fidelite' | 'mdp'

interface ParamMap { [key: string]: string }

const INFO_KEYS = ['nom', 'telephone', 'adresse', 'message_fermeture']
const HERO_KEYS = ['hero_annees', 'hero_nb_pizzas', 'hero_familles']
const FIDELITE_KEYS = ['points_boisson', 'points_pizza_simple', 'points_pizza_premium']

const LABELS: Record<string, string> = {
  nom: 'Nom du restaurant',
  telephone: 'Téléphone',
  adresse: 'Adresse',
  message_fermeture: 'Message de fermeture',
  hero_annees: "Années d'expérience",
  hero_nb_pizzas: 'Pizzas créées',
  hero_familles: 'Familles servies',
  points_boisson: 'Points boisson',
  points_pizza_simple: 'Points pizza simple',
  points_pizza_premium: 'Points pizza premium',
}

interface ProfilAdmin { id: string; role: string; nom: string }

export default function ParametresPage() {
  const router = useRouter()
  const [section, setSection] = useState<Section>('infos')
  const [params, setParams] = useState<ParamMap>({})
  const [profils, setProfils] = useState<ProfilAdmin[]>([])
  const [mdp, setMdp] = useState<Record<string, string>>({})
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

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role !== 'monica') { router.replace('/dashboard'); return }
    fetchAll()
  }, [router, fetchAll])

  const saveParams = async (keys: string[]) => {
    setSaving(true)
    try {
      const upserts = keys.map(k => ({ cle: k, valeur: params[k] ?? '' }))
      await supabase.from('parametres').upsert(upserts, { onConflict: 'cle' })
      setSavedMsg('Sauvegardé ✓')
      setTimeout(() => setSavedMsg(''), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const saveMdp = async (profilId: string) => {
    const pw = mdp[profilId]
    if (!pw) return
    setSaving(true)
    try {
      await supabase.from('profils_admin').update({ mot_de_passe: pw }).eq('id', profilId)
      setSavedMsg('Mot de passe mis à jour ✓')
      setTimeout(() => setSavedMsg(''), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const sections: { key: Section; label: string }[] = [
    { key: 'infos', label: 'Infos restaurant' },
    { key: 'compteurs', label: 'Compteurs hero' },
    { key: 'fidelite', label: 'Fidélité' },
    { key: 'mdp', label: 'Mots de passe' },
  ]

  const renderForm = (keys: string[]) => (
    <div className="space-y-4">
      {keys.map(k => (
        <div key={k}>
          <label className="block text-xs text-gray-400 mb-1">{LABELS[k] ?? k}</label>
          <input
            type="text"
            value={params[k] ?? ''}
            onChange={e => setParams(prev => ({ ...prev, [k]: e.target.value }))}
            className="w-full max-w-md px-3 py-2 rounded-lg text-sm focus:outline-none"
            style={{ background: '#1a1a1a', border: '1px solid #333', color: '#F5F5F5' }}
          />
        </div>
      ))}
      <button onClick={() => saveParams(keys)} disabled={saving}
        className="px-6 py-2 rounded-lg text-sm font-medium text-white mt-2"
        style={{ background: '#B71C1C' }}>
        {saving ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </div>
  )

  return (
    <div className="p-8" style={{ color: '#F5F5F5' }}>
      <h1 className="text-2xl font-bold mb-6">Paramètres</h1>

      {/* Sections nav */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {sections.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: section === s.key ? '#B71C1C' : '#242424', color: section === s.key ? '#fff' : '#888', border: section === s.key ? '1px solid #B71C1C' : '1px solid #333' }}>
            {s.label}
          </button>
        ))}
      </div>

      {savedMsg && (
        <div className="mb-4 px-4 py-2 rounded-lg text-sm text-green-400 w-fit" style={{ background: 'rgba(46,125,50,0.15)', border: '1px solid rgba(46,125,50,0.3)' }}>
          {savedMsg}
        </div>
      )}

      {loading ? <div className="text-gray-500">Chargement...</div> : (
        <div className="max-w-lg">
          {section === 'infos' && renderForm(INFO_KEYS)}
          {section === 'compteurs' && renderForm(HERO_KEYS)}
          {section === 'fidelite' && renderForm(FIDELITE_KEYS)}
          {section === 'mdp' && (
            <div className="space-y-6">
              {profils.map(p => (
                <div key={p.id} className="rounded-xl p-5" style={{ background: '#242424', border: '1px solid #2a2a2a' }}>
                  <div className="font-medium mb-3">{p.nom} <span className="text-xs text-gray-500 ml-2">({p.role})</span></div>
                  <div className="flex gap-3">
                    <input
                      type="password"
                      value={mdp[p.id] ?? ''}
                      onChange={e => setMdp(prev => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="Nouveau mot de passe"
                      className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none"
                      style={{ background: '#1a1a1a', border: '1px solid #333', color: '#F5F5F5' }}
                    />
                    <button onClick={() => saveMdp(p.id)} disabled={saving || !mdp[p.id]}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                      style={{ background: '#B71C1C' }}>
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
