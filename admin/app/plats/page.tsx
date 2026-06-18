'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface PlatDuJour {
  id: string
  nom: string
  description: string
  prix: number
  date_debut: string
  date_fin: string
  actif: boolean
}

interface FormData {
  nom: string
  description: string
  prix: number
  date_debut: string
  date_fin: string
  actif: boolean
}

const emptyForm: FormData = { nom: '', description: '', prix: 0, date_debut: '', date_fin: '', actif: true }

export default function PlatsPage() {
  const router = useRouter()
  const [plats, setPlats] = useState<PlatDuJour[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchPlats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('plats_du_jour')
        .select('*')
        .order('actif', { ascending: false })
        .order('nom')
      if (error) throw error
      setPlats(data ?? [])
    } catch (err) {
      console.error('Plats fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role !== 'monica') { router.replace('/dashboard'); return }
    fetchPlats()
  }, [router, fetchPlats])

  const toggleActif = async (id: string, actif: boolean) => {
    try {
      await supabase.from('plats_du_jour').update({ actif: !actif }).eq('id', id)
      await fetchPlats()
    } catch (err) {
      console.error(err)
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (p: PlatDuJour) => {
    setEditingId(p.id)
    setForm({ nom: p.nom, description: p.description, prix: p.prix, date_debut: p.date_debut, date_fin: p.date_fin, actif: p.actif })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingId) {
        await supabase.from('plats_du_jour').update(form).eq('id', editingId)
      } else {
        await supabase.from('plats_du_jour').insert([form])
      }
      setShowModal(false)
      setForm(emptyForm)
      setEditingId(null)
      await fetchPlats()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8" style={{ color: '#F5F5F5' }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Plats du jour</h1>
        <button onClick={openCreate} className="px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: '#B71C1C' }}>
          + Nouveau plat
        </button>
      </div>

      {loading ? <div className="text-gray-500">Chargement...</div> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {plats.map(p => (
            <div key={p.id} className="rounded-xl p-5" style={{ background: '#242424', border: '1px solid #2a2a2a' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-base">{p.nom}</div>
                  <div className="text-xs text-gray-400 mt-1">{p.description}</div>
                </div>
                <span className="px-2 py-1 rounded text-xs ml-3 flex-shrink-0"
                  style={{ background: p.actif ? 'rgba(46,125,50,0.2)' : 'rgba(100,100,100,0.2)', color: p.actif ? '#4caf50' : '#666' }}>
                  {p.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div>
                  <span className="font-mono text-yellow-500 font-bold">{p.prix?.toFixed(2)} €</span>
                  {p.date_debut && <div className="text-xs text-gray-500 mt-1">{p.date_debut} → {p.date_fin || '...'}</div>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(p)}
                    className="px-3 py-1 rounded text-xs"
                    style={{ background: '#1B5E20', color: '#fff' }}
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={() => toggleActif(p.id, p.actif)}
                    className="px-3 py-1 rounded text-xs"
                    style={{ background: '#333', color: '#888' }}
                  >
                    {p.actif ? 'Désactiver' : 'Activer'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal créer/modifier */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-xl p-6" style={{ background: '#1A1A1A', border: '1px solid #333' }}>
            <h2 className="text-lg font-bold mb-4">{editingId ? 'Modifier le plat' : 'Nouveau plat du jour'}</h2>
            <div className="space-y-3">
              {[
                { label: 'Nom', key: 'nom', type: 'text' },
                { label: 'Description', key: 'description', type: 'text' },
                { label: 'Prix (€)', key: 'prix', type: 'number' },
                { label: 'Date début', key: 'date_debut', type: 'date' },
                { label: 'Date fin', key: 'date_fin', type: 'date' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-400 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={String((form as unknown as Record<string, unknown>)[f.key] ?? '')}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ background: '#242424', border: '1px solid #333', color: '#F5F5F5' }}
                  />
                </div>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.actif} onChange={e => setForm(prev => ({ ...prev, actif: e.target.checked }))} />
                <span className="text-sm text-gray-300">Actif</span>
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg text-sm text-gray-400" style={{ background: '#242424', border: '1px solid #333' }}>Annuler</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#B71C1C' }}>
                {saving ? '...' : (editingId ? 'Enregistrer' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
