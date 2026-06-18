'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface CodePromo {
  id: string
  code: string
  type: 'pct' | 'montant'
  valeur: number
  usage_max?: number
  usage_count?: number
  date_expiration?: string
  actif: boolean
  visible_site?: boolean
}

interface FormPromo {
  code: string
  type: 'pct' | 'montant'
  valeur: string
  usage_max: string
  date_expiration: string
  visible_site: boolean
}

export default function PromotionsPage() {
  const router = useRouter()
  const [codes, setCodes] = useState<CodePromo[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormPromo>({ code: '', type: 'pct', valeur: '', usage_max: '', date_expiration: '', visible_site: false })
  const [saving, setSaving] = useState(false)
  const [formErreur, setFormErreur] = useState('')

  const fetchCodes = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('codes_promo').select('*').order('created_at', { ascending: false })
      if (error) { setErreur('Table codes_promo non configurée'); return }
      setCodes((data ?? []) as CodePromo[])
    } catch {
      setErreur('Impossible de charger les codes promo')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role !== 'monica') { router.replace('/dashboard'); return }
    fetchCodes()
  }, [router, fetchCodes])

  const toggleActif = async (id: string, actif: boolean) => {
    try {
      await supabase.from('codes_promo').update({ actif }).eq('id', id)
      await fetchCodes()
    } catch { /* skip */ }
  }

  const toggleVisibleSite = async (id: string, visible_site: boolean) => {
    try {
      await supabase.from('codes_promo').update({ visible_site }).eq('id', id)
      await fetchCodes()
    } catch { /* skip */ }
  }

  const supprimerCode = async (id: string) => {
    if (!confirm('Supprimer ce code promo ?')) return
    try {
      await supabase.from('codes_promo').delete().eq('id', id)
      await fetchCodes()
    } catch { /* skip */ }
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ code: '', type: 'pct', valeur: '', usage_max: '', date_expiration: '', visible_site: false })
    setFormErreur('')
    setShowModal(true)
  }

  const openEdit = (c: CodePromo) => {
    setEditingId(c.id)
    setForm({ code: c.code, type: c.type, valeur: String(c.valeur), usage_max: c.usage_max ? String(c.usage_max) : '', date_expiration: c.date_expiration ?? '', visible_site: c.visible_site ?? false })
    setFormErreur('')
    setShowModal(true)
  }

  const sauvegarderCode = async () => {
    if (!form.code.trim() || !form.valeur) return
    setSaving(true)
    setFormErreur('')
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        valeur: parseFloat(form.valeur),
        usage_max: form.usage_max ? parseInt(form.usage_max) : null,
        date_expiration: form.date_expiration || null,
        visible_site: form.visible_site,
      }
      let error
      if (editingId) {
        ({ error } = await supabase.from('codes_promo').update(payload).eq('id', editingId))
      } else {
        ({ error } = await supabase.from('codes_promo').insert([{ ...payload, actif: true }]))
      }
      if (error) { setFormErreur(`Erreur Supabase : ${error.message}`); return }
      setShowModal(false)
      setForm({ code: '', type: 'pct', valeur: '', usage_max: '', date_expiration: '', visible_site: false })
      setEditingId(null)
      await fetchCodes()
    } catch (e) {
      setFormErreur(e instanceof Error ? e.message : String(e))
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Promotions</h1>
        <button onClick={openCreate}
          className="px-4 py-2 bg-[#B71C1C] text-white rounded-lg text-sm font-medium hover:bg-[#C62828]">
          + Créer un code
        </button>
      </div>

      {erreur && <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg">{erreur}</div>}

      {loading ? <div className="text-[#555]">Chargement...</div> : codes.length === 0 ? (
        <div className="text-[#555]">Aucun code promo.</div>
      ) : (
        <div className="space-y-3">
          {codes.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-[#E0D5C5] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono font-bold text-lg text-[#1A1A1A]">{c.code}</span>
                    <span className="text-sm font-bold text-[#B71C1C]">{c.valeur}{c.type === 'pct' ? '%' : ' €'}</span>
                    <span className="text-xs text-[#555] bg-[#F0EBE0] px-2 py-0.5 rounded">{c.type === 'pct' ? 'Pourcentage' : 'Montant fixe'}</span>
                  </div>
                  <div className="text-xs text-[#555] flex gap-4 flex-wrap">
                    <span>Utilisé: <strong>{c.usage_count ?? 0} fois</strong></span>
                    {c.usage_max && <span>/ max {c.usage_max}</span>}
                    {c.date_expiration && <span>Expire: {c.date_expiration}</span>}
                    <span className={c.actif ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                      {c.actif ? '✓ Actif' : '✗ Inactif'}
                    </span>
                    {c.visible_site && <span className="text-blue-600 font-medium">👁 Visible site</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#555]">
                    <input type="checkbox" checked={c.actif} onChange={e => toggleActif(c.id, e.target.checked)} className="accent-[#1B5E20]" />
                    Actif
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#555]">
                    <input type="checkbox" checked={c.visible_site ?? false} onChange={e => toggleVisibleSite(c.id, e.target.checked)} className="accent-[#1565C0]" />
                    Vitrine
                  </label>
                  <button onClick={() => openEdit(c)} className="text-blue-500 hover:text-blue-700 text-xs">✏️ Modifier</button>
                  <button onClick={() => supprimerCode(c.id)} className="text-red-500 hover:text-red-700 text-xs">🗑 Supprimer</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{editingId ? 'Modifier le code' : 'Créer un code promo'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#555] mb-1">Code</label>
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="EX: PROMO20" className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
              </div>
              <div>
                <label className="block text-sm text-[#555] mb-1">Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'pct' | 'montant' }))}
                  className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="pct">Pourcentage (%)</option>
                  <option value="montant">Montant fixe (€)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#555] mb-1">Valeur</label>
                <input type="number" min="0" value={form.valeur} onChange={e => setForm(f => ({ ...f, valeur: e.target.value }))}
                  placeholder={form.type === 'pct' ? 'Ex: 15' : 'Ex: 10.00'}
                  className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#555] mb-1">Usage max (optionnel)</label>
                  <input type="number" min="1" value={form.usage_max} onChange={e => setForm(f => ({ ...f, usage_max: e.target.value }))}
                    className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-[#555] mb-1">Expiration (optionnel)</label>
                  <input type="date" value={form.date_expiration} onChange={e => setForm(f => ({ ...f, date_expiration: e.target.value }))}
                    className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="visible_site" checked={form.visible_site ?? false}
                  onChange={e => setForm(prev => ({ ...prev, visible_site: e.target.checked }))}
                  className="accent-[#1565C0]" />
                <label htmlFor="visible_site" className="text-sm text-[#555]">Visible sur le site (bandeau vitrine)</label>
              </div>
            </div>
            {formErreur && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formErreur}</div>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-[#E0D5C5] text-[#555] rounded-lg text-sm">Annuler</button>
              <button onClick={sauvegarderCode} disabled={saving || !form.code || !form.valeur}
                className="flex-1 py-2 bg-[#B71C1C] text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? '...' : (editingId ? 'Enregistrer' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
