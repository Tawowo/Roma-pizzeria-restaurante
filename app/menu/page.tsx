'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import type { AdminRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface Categorie {
  id: string
  nom: string
  actif: boolean
  ordre?: number
}

interface Article {
  id: string
  nom: string
  description: string
  prix: number
  disponible: boolean
  categorie_id: string
  promotion?: number
}

interface Formule {
  id: string
  nom: string
  description: string
  prix: number
  disponible: boolean
  promotion?: number
}

type Onglet = 'categories' | 'articles' | 'formules'

export default function MenuPage() {
  const router = useRouter()
  const [role, setRole] = useState<AdminRole | null>(null)
  const [onglet, setOnglet] = useState<Onglet>('categories')
  const [categories, setCategories] = useState<Categorie[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [formules, setFormules] = useState<Formule[]>([])
  const [filterCat, setFilterCat] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [editArticle, setEditArticle] = useState<Article | null>(null)
  const [editFormule, setEditFormule] = useState<Formule | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: cats }, { data: arts }, { data: forms }] = await Promise.all([
        supabase.from('categories').select('*').order('ordre'),
        supabase.from('articles').select('*').order('nom'),
        supabase.from('formules').select('*').order('nom'),
      ])
      setCategories(cats ?? [])
      setArticles(arts ?? [])
      setFormules(forms ?? [])
    } catch (err) {
      console.error('Menu fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    setRole(session.role)
    fetchAll()
  }, [router, fetchAll])

  const toggleCategorie = async (id: string, actif: boolean) => {
    if (role !== 'monica') return
    try {
      await supabase.from('categories').update({ actif: !actif }).eq('id', id)
      await fetchAll()
    } catch (err) {
      console.error(err)
    }
  }

  const deleteCategorie = async (id: string) => {
    if (!confirm('Supprimer cette catégorie ? Les articles associés ne seront pas supprimés.')) return
    try {
      await supabase.from('categories').delete().eq('id', id)
      await fetchAll()
    } catch (err) { console.error(err) }
  }

  const moveCategorie = async (id: string, direction: 'up' | 'down') => {
    const idx = categories.findIndex(c => c.id === id)
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === categories.length - 1)) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const a = categories[idx], b = categories[swapIdx]
    try {
      await Promise.all([
        supabase.from('categories').update({ ordre: b.ordre ?? swapIdx }).eq('id', a.id),
        supabase.from('categories').update({ ordre: a.ordre ?? idx }).eq('id', b.id),
      ])
      await fetchAll()
    } catch (err) { console.error(err) }
  }

  const toggleArticle = async (id: string, disponible: boolean) => {
    try {
      await supabase.from('articles').update({ disponible: !disponible }).eq('id', id)
      await fetchAll()
    } catch (err) {
      console.error(err)
    }
  }

  const deleteArticle = async (id: string) => {
    if (!confirm('Supprimer cet article ? Cette action est irréversible.')) return
    try {
      await supabase.from('articles').delete().eq('id', id)
      await fetchAll()
    } catch (err) { console.error(err) }
  }

  const saveArticle = async () => {
    if (!editArticle || role !== 'monica') return
    setSaving(true)
    setSaveErr(null)
    try {
      if (editArticle.id) {
        const { error } = await supabase.from('articles').update({
          nom: editArticle.nom,
          description: editArticle.description,
          prix: editArticle.prix,
          promotion: editArticle.promotion ?? 0,
          disponible: editArticle.disponible,
          categorie_id: editArticle.categorie_id,
        }).eq('id', editArticle.id)
        if (error) throw new Error(`UPDATE échoué : ${error.message}`)
      } else {
        if (!editArticle.categorie_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(editArticle.categorie_id)) {
          throw new Error('Veuillez sélectionner une catégorie valide')
        }
        const { error } = await supabase.from('articles').insert([editArticle])
        if (error) throw new Error(`INSERT échoué : ${error.message}`)
      }
      setEditArticle(null)
      await fetchAll()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[saveArticle]', msg)
      setSaveErr(msg)
    } finally {
      setSaving(false)
    }
  }

  const deleteFormule = async (id: string) => {
    if (!confirm('Supprimer cette formule ? Cette action est irréversible.')) return
    try {
      await supabase.from('formules').delete().eq('id', id)
      await fetchAll()
    } catch (err) { console.error(err) }
  }

  const saveFormule = async () => {
    if (!editFormule || role !== 'monica') return
    setSaving(true)
    setSaveErr(null)
    try {
      if (editFormule.id) {
        const { error } = await supabase.from('formules').update({
          nom: editFormule.nom,
          description: editFormule.description,
          prix: editFormule.prix,
          promotion: editFormule.promotion ?? 0,
          disponible: editFormule.disponible,
        }).eq('id', editFormule.id)
        if (error) throw new Error(`UPDATE échoué : ${error.message}`)
      } else {
        const { error } = await supabase.from('formules').insert([editFormule])
        if (error) throw new Error(`INSERT échoué : ${error.message}`)
      }
      setEditFormule(null)
      await fetchAll()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[saveFormule]', msg)
      setSaveErr(msg)
    } finally {
      setSaving(false)
    }
  }

  const filteredArticles = filterCat ? articles.filter(a => a.categorie_id === filterCat) : articles

  return (
    <div className="p-8" style={{ color: '#F5F5F5' }}>
      <h1 className="text-2xl font-bold mb-6">Menu</h1>

      {/* Onglets */}
      <div className="flex gap-2 mb-6">
        {(['categories', 'articles', 'formules'] as Onglet[]).map(o => (
          <button key={o} onClick={() => setOnglet(o)}
            className="px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all"
            style={{ background: onglet === o ? '#B71C1C' : '#242424', color: onglet === o ? '#fff' : '#888', border: onglet === o ? '1px solid #B71C1C' : '1px solid #333' }}>
            {o === 'categories' ? 'Catégories' : o === 'articles' ? 'Articles' : 'Formules'}
          </button>
        ))}
      </div>

      {loading ? <div className="text-gray-500">Chargement...</div> : (
        <>
          {onglet === 'categories' && (
            <div className="space-y-2">
              {categories.map((cat, idx) => (
                <div key={cat.id} className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#242424' }}>
                  <span className="font-medium">{cat.nom}</span>
                  <div className="flex items-center gap-2">
                    {role === 'monica' && (
                      <>
                        <button
                          onClick={() => moveCategorie(cat.id, 'up')}
                          disabled={idx === 0}
                          className="px-2 py-1 rounded text-xs disabled:opacity-30"
                          style={{ background: '#333', color: '#888' }}
                          title="Monter"
                        >↑</button>
                        <button
                          onClick={() => moveCategorie(cat.id, 'down')}
                          disabled={idx === categories.length - 1}
                          className="px-2 py-1 rounded text-xs disabled:opacity-30"
                          style={{ background: '#333', color: '#888' }}
                          title="Descendre"
                        >↓</button>
                      </>
                    )}
                    <button
                      onClick={() => toggleCategorie(cat.id, cat.actif)}
                      disabled={role !== 'monica'}
                      className="px-4 py-1 rounded-full text-xs font-medium"
                      style={{ background: cat.actif ? 'rgba(46,125,50,0.3)' : 'rgba(100,100,100,0.3)', color: cat.actif ? '#4caf50' : '#888' }}
                    >
                      {cat.actif ? 'Actif' : 'Inactif'}
                    </button>
                    {role === 'monica' && (
                      <button
                        onClick={() => deleteCategorie(cat.id)}
                        className="px-3 py-1 rounded text-xs"
                        style={{ background: 'rgba(183,28,28,0.2)', color: '#ef5350' }}
                        title="Supprimer"
                      >🗑️</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {onglet === 'articles' && (
            <>
              <div className="flex gap-3 mb-4">
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ background: '#242424', border: '1px solid #333', color: '#F5F5F5' }}>
                  <option value="">Toutes catégories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
                {role === 'monica' && (
                  <button
                    onClick={() => setEditArticle({ id: '', nom: '', description: '', prix: 0, disponible: true, categorie_id: filterCat || (categories[0]?.id ?? ''), promotion: 0 })}
                    className="px-4 py-2 rounded-lg text-sm text-white"
                    style={{ background: '#B71C1C' }}
                  >+ Article</button>
                )}
              </div>
              <div className="space-y-2">
                {filteredArticles.map(art => (
                  <div key={art.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl gap-2" style={{ background: '#242424' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-medium">{art.nom}</span>
                        {art.promotion && art.promotion > 0 && (
                          <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded font-medium">
                            -{art.promotion}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">{art.description}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-yellow-500">{art.prix?.toFixed(2)} €</span>
                      <button
                        onClick={() => toggleArticle(art.id, art.disponible)}
                        className="px-3 py-1 rounded-full text-xs min-h-[32px]"
                        style={{ background: art.disponible ? 'rgba(46,125,50,0.3)' : 'rgba(100,100,100,0.3)', color: art.disponible ? '#4caf50' : '#888' }}
                      >
                        {art.disponible ? 'Dispo' : 'Indispo'}
                      </button>
                      {role === 'monica' && (
                        <>
                          <button onClick={() => setEditArticle(art)} className="px-3 py-1 rounded text-xs min-h-[32px]" style={{ background: '#333', color: '#888' }}>✏️</button>
                          <button
                            onClick={() => deleteArticle(art.id)}
                            className="px-3 py-1 rounded text-xs min-h-[32px]"
                            style={{ background: 'rgba(183,28,28,0.2)', color: '#ef5350' }}
                          >🗑</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {onglet === 'formules' && (
            <>
              {role === 'monica' && (
                <button
                  onClick={() => setEditFormule({ id: '', nom: '', description: '', prix: 0, disponible: true, promotion: 0 })}
                  className="px-4 py-2 rounded-lg text-sm text-white mb-4"
                  style={{ background: '#B71C1C' }}
                >+ Formule</button>
              )}
              <div className="space-y-2">
                {formules.map(f => (
                  <div key={f.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl gap-2" style={{ background: '#242424' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-medium">{f.nom}</span>
                        {f.promotion && f.promotion > 0 && (
                          <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded font-medium">
                            -{f.promotion}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">{f.description}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-yellow-500">{f.prix?.toFixed(2)} €</span>
                      <button
                        onClick={() => { if (role !== 'monica') return; setEditFormule({ ...f, disponible: !f.disponible }); saveFormule() }}
                        className="px-3 py-1 rounded-full text-xs min-h-[32px]"
                        style={{ background: f.disponible ? 'rgba(46,125,50,0.3)' : 'rgba(100,100,100,0.3)', color: f.disponible ? '#4caf50' : '#888' }}
                      >
                        {f.disponible ? 'Dispo' : 'Indispo'}
                      </button>
                      {role === 'monica' && (
                        <>
                          <button onClick={() => setEditFormule(f)} className="px-3 py-1 rounded text-xs min-h-[32px]" style={{ background: '#333', color: '#888' }}>✏️</button>
                          <button
                            onClick={() => deleteFormule(f.id)}
                            className="px-3 py-1 rounded text-xs min-h-[32px]"
                            style={{ background: 'rgba(183,28,28,0.2)', color: '#ef5350' }}
                          >🗑</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Modal Article */}
      {editArticle && role === 'monica' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-xl p-6" style={{ background: '#1A1A1A', border: '1px solid #333' }}>
            <h2 className="text-lg font-bold mb-4">{editArticle.id ? 'Modifier' : 'Nouvel'} article</h2>
            {saveErr && <div className="mb-3 p-2 rounded text-xs text-red-400 bg-red-900/30 border border-red-800">⚠️ {saveErr}</div>}
            <div className="space-y-3">
              <InputField label="Nom" value={editArticle.nom} onChange={v => setEditArticle(prev => prev ? { ...prev, nom: v } : null)} />
              <InputField label="Description" value={editArticle.description} onChange={v => setEditArticle(prev => prev ? { ...prev, description: v } : null)} />
              <InputField label="Prix (€)" value={String(editArticle.prix)} type="number" onChange={v => setEditArticle(prev => prev ? { ...prev, prix: Number(v) } : null)} />
              <div>
                <label className="block text-xs text-[#555] mb-1">Promotion (%)</label>
                <input type="number" min={0} max={100}
                  value={editArticle.promotion ?? 0}
                  onChange={e => setEditArticle(prev => prev ? { ...prev, promotion: Number(e.target.value) } : prev)}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5]"
                  style={{ background: '#242424', color: '#F5F5F5' }}
                  placeholder="0 = pas de promotion"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Catégorie</label>
                <select value={editArticle.categorie_id} onChange={e => setEditArticle(prev => prev ? { ...prev, categorie_id: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ background: '#242424', border: '1px solid #333', color: '#F5F5F5' }}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditArticle(null)} className="flex-1 py-2 rounded-lg text-sm text-gray-400" style={{ background: '#242424', border: '1px solid #333' }}>Annuler</button>
              <button onClick={saveArticle} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#B71C1C' }}>
                {saving ? '...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Formule */}
      {editFormule && role === 'monica' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-xl p-6" style={{ background: '#1A1A1A', border: '1px solid #333' }}>
            <h2 className="text-lg font-bold mb-4">{editFormule.id ? 'Modifier' : 'Nouvelle'} formule</h2>
            {saveErr && <div className="mb-3 p-2 rounded text-xs text-red-400 bg-red-900/30 border border-red-800">⚠️ {saveErr}</div>}
            <div className="space-y-3">
              <InputField label="Nom" value={editFormule.nom} onChange={v => setEditFormule(prev => prev ? { ...prev, nom: v } : null)} />
              <InputField label="Description" value={editFormule.description} onChange={v => setEditFormule(prev => prev ? { ...prev, description: v } : null)} />
              <InputField label="Prix (€)" value={String(editFormule.prix)} type="number" onChange={v => setEditFormule(prev => prev ? { ...prev, prix: Number(v) } : null)} />
              <div>
                <label className="block text-xs text-[#555] mb-1">Promotion (%)</label>
                <input type="number" min={0} max={100}
                  value={editFormule.promotion ?? 0}
                  onChange={e => setEditFormule(prev => prev ? { ...prev, promotion: Number(e.target.value) } : prev)}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5]"
                  style={{ background: '#242424', color: '#F5F5F5' }}
                  placeholder="0 = pas de promotion"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditFormule(null)} className="flex-1 py-2 rounded-lg text-sm text-gray-400" style={{ background: '#242424', border: '1px solid #333' }}>Annuler</button>
              <button onClick={saveFormule} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#B71C1C' }}>
                {saving ? '...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InputField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
        style={{ background: '#242424', border: '1px solid #333', color: '#F5F5F5' }} />
    </div>
  )
}
