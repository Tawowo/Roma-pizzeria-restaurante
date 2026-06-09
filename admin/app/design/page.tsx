'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type Tab = 'textes' | 'couleurs' | 'photos' | 'horaires'

interface ParamMap { [key: string]: string }

type JourHoraire = {
  ferme: boolean
  debut_midi: string
  fin_midi: string
  debut_soir: string
  fin_soir: string
}

type HorairesMap = { [jour: string]: JourHoraire }

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const TEXTE_SECTIONS = [
  { title: 'Hero', keys: ['hero_titre', 'hero_sous_titre', 'hero_tagline', 'hero_btn1', 'hero_btn2'] },
  { title: 'Histoire', keys: ['histoire_roberto', 'histoire_monica', 'histoire_andre', 'citation_roberto'] },
  { title: 'Ambiance', keys: ['ambiance_rdc_titre', 'ambiance_rdc_desc', 'ambiance_etage_titre', 'ambiance_etage_desc', 'ambiance_terrasse_titre', 'ambiance_terrasse_desc'] },
  { title: 'Footer', keys: ['footer_description', 'footer_copyright'] },
  { title: 'Compteurs', keys: ['hero_annees', 'hero_nb_pizzas', 'hero_familles', 'hero_frais'] },
]

const TEXTE_LABELS: Record<string, string> = {
  hero_titre: 'Titre', hero_sous_titre: 'Sous-titre', hero_tagline: 'Tagline',
  hero_btn1: 'Bouton 1', hero_btn2: 'Bouton 2',
  histoire_roberto: 'Texte Roberto', histoire_monica: 'Texte Monica',
  histoire_andre: 'Texte André', citation_roberto: 'Citation Roberto',
  ambiance_rdc_titre: 'RDC Titre', ambiance_rdc_desc: 'RDC Description',
  ambiance_etage_titre: 'Étage Titre', ambiance_etage_desc: 'Étage Description',
  ambiance_terrasse_titre: 'Terrasse Titre', ambiance_terrasse_desc: 'Terrasse Description',
  footer_description: 'Description', footer_copyright: 'Copyright',
  hero_annees: "Années d'expérience", hero_nb_pizzas: 'Nb pizzas', hero_familles: 'Familles', hero_frais: 'Produits frais',
}

const COULEURS = [
  { cle: 'color_primary', label: 'Couleur principale', defaut: '#B71C1C' },
  { cle: 'color_secondary', label: 'Couleur secondaire', defaut: '#1B5E20' },
  { cle: 'color_bg', label: 'Fond', defaut: '#FBF6EE' },
  { cle: 'color_text', label: 'Texte', defaut: '#1A1A1A' },
]

const PHOTOS = [
  { cle: 'hero_bg', label: 'Hero background' },
  { cle: 'histoire_bg', label: 'Histoire background' },
  { cle: 'ambiance_rdc', label: 'Ambiance RDC' },
  { cle: 'ambiance_etage', label: 'Ambiance Étage' },
  { cle: 'ambiance_terrasse', label: 'Ambiance Terrasse' },
  { cle: 'reservation_bg', label: 'Réservation background' },
  { cle: 'photo_roberto', label: 'Photo Roberto' },
  { cle: 'photo_monica', label: 'Photo Monica' },
  { cle: 'photo_andre', label: 'Photo André' },
]

const DEFAULT_HORAIRE: JourHoraire = { ferme: false, debut_midi: '12:00', fin_midi: '14:30', debut_soir: '19:00', fin_soir: '22:30' }

export default function DesignPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('textes')
  const [params, setParams] = useState<ParamMap>({})
  const [horaires, setHoraires] = useState<HorairesMap>({})
  const [saving, setSaving] = useState<string>('')
  const [savedMsg, setSavedMsg] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchParams = useCallback(async () => {
    try {
      const { data } = await supabase.from('parametres').select('cle, valeur')
      const map: ParamMap = {}
      ;(data ?? []).forEach((r: { cle: string; valeur: string }) => { map[r.cle] = r.valeur })
      setParams(map)

      if (map['horaires_json']) {
        try { setHoraires(JSON.parse(map['horaires_json'])) } catch { setHoraires({}) }
      } else {
        const h: HorairesMap = {}
        JOURS.forEach(j => { h[j] = { ...DEFAULT_HORAIRE } })
        setHoraires(h)
      }
    } catch { /* skip */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role !== 'monica') { router.replace('/dashboard'); return }
    fetchParams()
  }, [router, fetchParams])

  const saveParam = async (cle: string, valeur: string) => {
    setSaving(cle)
    try {
      await supabase.from('parametres').upsert([{ cle, valeur }], { onConflict: 'cle' })
      setSavedMsg(`${cle} sauvegardé ✓`)
      setTimeout(() => setSavedMsg(''), 2000)
    } catch { /* skip */ } finally { setSaving('') }
  }

  const saveHoraires = async () => {
    setSaving('horaires')
    try {
      const json = JSON.stringify(horaires)
      await supabase.from('parametres').upsert([{ cle: 'horaires_json', valeur: json }], { onConflict: 'cle' })
      setParams(p => ({ ...p, horaires_json: json }))
      setSavedMsg('Horaires sauvegardés ✓')
      setTimeout(() => setSavedMsg(''), 2000)
    } catch { /* skip */ } finally { setSaving('') }
  }

  const updateHoraire = (jour: string, field: keyof JourHoraire, value: string | boolean) => {
    setHoraires(h => ({ ...h, [jour]: { ...(h[jour] ?? DEFAULT_HORAIRE), [field]: value } }))
  }

  const isTextArea = (cle: string) => ['histoire_roberto', 'histoire_monica', 'histoire_andre', 'citation_roberto', 'ambiance_rdc_desc', 'ambiance_etage_desc', 'ambiance_terrasse_desc', 'footer_description'].includes(cle)

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">Design du site</h1>

      <div className="flex gap-2 mb-8 flex-wrap">
        {(['textes', 'couleurs', 'photos', 'horaires'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium border capitalize transition-all ${tab === t ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-[#555] border-[#E0D5C5] hover:bg-[#F0EBE0]'}`}>
            {t === 'textes' ? '📝 Textes' : t === 'couleurs' ? '🎨 Couleurs' : t === 'photos' ? '📷 Photos' : '🕐 Horaires'}
          </button>
        ))}
      </div>

      {savedMsg && <div className="mb-4 px-4 py-2 rounded-lg text-sm text-green-700 bg-green-50 border border-green-200 w-fit">{savedMsg}</div>}

      {loading ? <div className="text-[#555]">Chargement...</div> : (
        <>
          {/* TEXTES */}
          {tab === 'textes' && (
            <div className="space-y-8">
              {TEXTE_SECTIONS.map(sec => (
                <div key={sec.title} className="bg-white rounded-xl border border-[#E0D5C5] p-6">
                  <h3 className="font-semibold text-[#1A1A1A] mb-4">{sec.title}</h3>
                  <div className="space-y-4">
                    {sec.keys.map(cle => (
                      <div key={cle}>
                        <label className="block text-xs text-[#555] mb-1">{TEXTE_LABELS[cle] ?? cle}</label>
                        {isTextArea(cle) ? (
                          <textarea value={params[cle] ?? ''} onChange={e => setParams(p => ({ ...p, [cle]: e.target.value }))} rows={3}
                            className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
                        ) : (
                          <input value={params[cle] ?? ''} onChange={e => setParams(p => ({ ...p, [cle]: e.target.value }))}
                            className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
                        )}
                        <button onClick={() => saveParam(cle, params[cle] ?? '')} disabled={saving === cle}
                          className="mt-1 px-4 py-1 text-xs bg-[#1B5E20] text-white rounded-lg disabled:opacity-50">
                          {saving === cle ? '...' : 'Sauvegarder'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* COULEURS */}
          {tab === 'couleurs' && (
            <div className="bg-white rounded-xl border border-[#E0D5C5] p-6 max-w-lg">
              <h3 className="font-semibold text-[#1A1A1A] mb-4">Palette de couleurs</h3>
              <div className="space-y-4">
                {COULEURS.map(c => (
                  <div key={c.cle} className="flex items-center gap-4">
                    <input type="color" value={params[c.cle] ?? c.defaut}
                      onChange={e => setParams(p => ({ ...p, [c.cle]: e.target.value }))}
                      className="w-12 h-10 rounded border border-[#E0D5C5] cursor-pointer" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#1A1A1A]">{c.label}</div>
                      <div className="text-xs text-[#555]">{params[c.cle] ?? c.defaut}</div>
                    </div>
                    <button onClick={() => saveParam(c.cle, params[c.cle] ?? c.defaut)} disabled={saving === c.cle}
                      className="px-4 py-1.5 text-xs bg-[#1B5E20] text-white rounded-lg disabled:opacity-50">
                      {saving === c.cle ? '...' : 'Sauvegarder'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PHOTOS */}
          {tab === 'photos' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PHOTOS.map(p => (
                <div key={p.cle} className="bg-white rounded-xl border border-[#E0D5C5] p-5">
                  <h4 className="font-medium text-[#1A1A1A] mb-3">{p.label}</h4>
                  {params[p.cle] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={params[p.cle]} alt={p.label} className="w-full h-32 object-cover rounded-lg mb-3 bg-[#F0EBE0]"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                  <input value={params[p.cle] ?? ''} onChange={e => setParams(pr => ({ ...pr, [p.cle]: e.target.value }))}
                    placeholder="URL de l'image..."
                    className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
                  <div className="flex gap-2">
                    <button onClick={() => saveParam(p.cle, params[p.cle] ?? '')} disabled={saving === p.cle}
                      className="flex-1 py-1.5 text-xs bg-[#1B5E20] text-white rounded-lg disabled:opacity-50">
                      {saving === p.cle ? '...' : 'Sauvegarder'}
                    </button>
                    <button onClick={() => { setParams(pr => ({ ...pr, [p.cle]: '' })); saveParam(p.cle, '') }}
                      className="px-3 py-1.5 text-xs border border-[#E0D5C5] text-[#555] rounded-lg">
                      Défaut
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* HORAIRES */}
          {tab === 'horaires' && (
            <div className="bg-white rounded-xl border border-[#E0D5C5] p-6 max-w-2xl">
              <h3 className="font-semibold text-[#1A1A1A] mb-4">Horaires d&apos;ouverture</h3>
              <div className="space-y-4">
                {JOURS.map(jour => {
                  const h = horaires[jour] ?? { ...DEFAULT_HORAIRE }
                  return (
                    <div key={jour} className="border border-[#E0D5C5] rounded-lg p-4">
                      <div className="flex items-center gap-4 mb-3">
                        <span className="font-medium text-[#1A1A1A] w-24">{jour}</span>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={h.ferme} onChange={e => updateHoraire(jour, 'ferme', e.target.checked)} className="accent-[#B71C1C]" />
                          Fermé
                        </label>
                      </div>
                      {!h.ferme && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-[#555] mb-1">Midi</div>
                            <div className="flex gap-2 items-center">
                              <input type="time" value={h.debut_midi} onChange={e => updateHoraire(jour, 'debut_midi', e.target.value)}
                                className="border border-[#E0D5C5] rounded px-2 py-1 text-xs w-24" />
                              <span className="text-[#555] text-xs">→</span>
                              <input type="time" value={h.fin_midi} onChange={e => updateHoraire(jour, 'fin_midi', e.target.value)}
                                className="border border-[#E0D5C5] rounded px-2 py-1 text-xs w-24" />
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-[#555] mb-1">Soir</div>
                            <div className="flex gap-2 items-center">
                              <input type="time" value={h.debut_soir} onChange={e => updateHoraire(jour, 'debut_soir', e.target.value)}
                                className="border border-[#E0D5C5] rounded px-2 py-1 text-xs w-24" />
                              <span className="text-[#555] text-xs">→</span>
                              <input type="time" value={h.fin_soir} onChange={e => updateHoraire(jour, 'fin_soir', e.target.value)}
                                className="border border-[#E0D5C5] rounded px-2 py-1 text-xs w-24" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <button onClick={saveHoraires} disabled={saving === 'horaires'}
                className="mt-4 px-6 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving === 'horaires' ? 'Sauvegarde...' : 'Sauvegarder les horaires'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
