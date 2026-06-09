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
}

interface FormPromo {
  code: string
  type: 'pct' | 'montant'
  valeur: string
  usage_max: string
  date_expiration: string
}

export default function PromotionsPage() {
  const router = useRouter()
  const [codes, setCodes] = useState<CodePromo[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormPromo>({ code: '', type: 'pct', valeur: '', usage_max: '', date_expiration: '' })
  const [saving, setSaving] = useState(false)

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

  const supprimerCode = async (id: string) => {
    if (!confirm('Supprimer ce code promo ?')) return
    try {
      await supabase.from('codes_promo').delete().eq('id', id)
      await fetchCodes()
    } catch { /* skip */ }
  }

  const creerCode = async () => {
    if (!form.code.trim() || !form.valeur) return
    setSaving(true)
    try {
      await supabase.from('codes_promo').insert([{
        code: form.code.trim().toUpperCase(),
        type: form.type,
        valeur: parseFloat(form.valeur),
        usage_max: form.usage_max ? parseInt(form.usage_max) : null,
        date_expiration: form.date_expiration || null,
        actif: true,
      }])
      setShowModal(false)
      setForm({ code: '', type: 'pct', valeur: '', usage_max: '', date_expiration: '' })
      await fetchCodes()
    } catch { /* skip */ } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Promotions</h1>
        <button onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#B71C1C] text-white rounded-lg text-sm font-medium hover:bg-[#C62828]">
          + Créer un code
        </button>
      </div>

      {erreur && <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg">{erreur}</div>}

      {loading ? <div className="text-[#555]">Chargement...</div> : codes.length === 0 ? (
        <div className="text-[#555]">Aucun code promo.</div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E0D5C5] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F0EBE0]">
              <tr>
                {['Code', 'Type', 'Valeur', 'Usages', 'Expiration', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[#555] font-medium text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map(c => (
                <tr key={c.id} className="border-t border-[#E0D5C5]">
                  <td className="px-4 py-3 font-mono font-bold text-[#1A1A1A]">{c.code}</td>
                  <td className="px-4 py-3 text-[#555]">{c.type === 'pct' ? 'Pourcentage' : 'Montant fixe'}</td>
                  <td className="px-4 py-3 font-bold text-[#B71C1C]">{c.valeur}{c.type === 'pct' ? '%' : ' €'}</td>
                  <td className="px-4 py-3 text-[#555]">{c.usage_count ?? 0}{c.usage_max ? ` / ${c.usage_max}` : ''}</td>
                  <td className="px-4 py-3 text-[#555]">{c.date_expiration ?? '—'}</td>
                  <td className="px-4 py-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={c.actif} onChange={e => toggleActif(c.id, e.target.checked)} className="accent-[#1B5E20]" />
                      <span className={`text-xs font-medium ${c.actif ? 'text-green-700' : 'text-gray-400'}`}>{c.actif ? 'Actif' : 'Inactif'}</span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => supprimerCode(c.id)} className="text-red-500 hover:text-red-700 text-xs">🗑 Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Créer un code promo</h2>
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
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-[#E0D5C5] text-[#555] rounded-lg text-sm">Annuler</button>
              <button onClick={creerCode} disabled={saving || !form.code || !form.valeur}
                className="flex-1 py-2 bg-[#B71C1C] text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
