'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type StatutRes = 'en_attente' | 'confirmee' | 'annulee'

interface Reservation {
  id: string
  heure: string
  nom_client: string
  telephone: string
  nb_couverts: number
  zone: string
  notes: string
  statut: StatutRes
  date_reservation: string
}

interface FormData {
  nom_client: string
  telephone: string
  date_reservation: string
  heure: string
  nb_couverts: number
  zone: string
  notes: string
}

const STATUT_STYLES: Record<StatutRes, { bg: string; text: string; label: string }> = {
  en_attente: { bg: 'rgba(212,168,67,0.2)', text: '#D4A843', label: 'En attente' },
  confirmee: { bg: 'rgba(46,125,50,0.2)', text: '#4caf50', label: 'Confirmée' },
  annulee: { bg: 'rgba(183,28,28,0.2)', text: '#ef5350', label: 'Annulée' },
}

const CRENEAUX = ['12:00','12:30','13:00','13:30','14:00','19:00','19:30','20:00','20:30','21:00','21:30','22:00']

export default function ReservationsPage() {
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterStatut, setFilterStatut] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormData>({ nom_client: '', telephone: '', date_reservation: new Date().toISOString().split('T')[0], heure: '20:00', nb_couverts: 2, zone: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const fetchReservations = useCallback(async () => {
    try {
      let query = supabase.from('reservations').select('*').eq('date_reservation', filterDate).order('heure')
      if (filterStatut) query = query.eq('statut', filterStatut)
      const { data, error } = await query
      if (error) throw error
      setReservations(data ?? [])
    } catch (err) {
      console.error('Reservations fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [filterDate, filterStatut])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role === 'roberto') { router.replace('/cuisine'); return }
    fetchReservations()
  }, [router, fetchReservations])

  useEffect(() => {
    const channel = supabase.channel('reservations-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, fetchReservations)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchReservations])

  const updateStatut = async (id: string, statut: StatutRes) => {
    try {
      await supabase.from('reservations').update({ statut }).eq('id', id)
      await fetchReservations()
    } catch (err) {
      console.error('Update statut error:', err)
    }
  }

  const deleteReservation = async (id: string) => {
    if (!confirm('Supprimer cette réservation ?')) return
    try {
      await supabase.from('reservations').delete().eq('id', id)
      await fetchReservations()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      await supabase.from('reservations').insert([{ ...form, statut: 'en_attente' }])
      setShowModal(false)
      setForm({ nom_client: '', telephone: '', date_reservation: new Date().toISOString().split('T')[0], heure: '20:00', nb_couverts: 2, zone: '', notes: '' })
      await fetchReservations()
    } catch (err) {
      console.error('Create error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8" style={{ color: '#F5F5F5' }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Réservations</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg font-medium text-white text-sm"
          style={{ background: '#B71C1C' }}
        >
          + Nouvelle réservation
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-4 mb-6">
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm focus:outline-none"
          style={{ background: '#242424', border: '1px solid #333', color: '#F5F5F5' }}
        />
        <select
          value={filterStatut}
          onChange={e => setFilterStatut(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm focus:outline-none"
          style={{ background: '#242424', border: '1px solid #333', color: '#F5F5F5' }}
        >
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="confirmee">Confirmée</option>
          <option value="annulee">Annulée</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-500">Chargement...</div>
      ) : reservations.length === 0 ? (
        <div className="text-gray-500">Aucune réservation pour cette date.</div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: '#242424' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                {['Heure', 'Nom', 'Tél', 'Couverts', 'Zone', 'Notes', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservations.map(r => {
                const s = STATUT_STYLES[r.statut] ?? STATUT_STYLES.en_attente
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td className="px-4 py-3 font-mono">{r.heure}</td>
                    <td className="px-4 py-3 font-medium">{r.nom_client}</td>
                    <td className="px-4 py-3 text-gray-400">{r.telephone}</td>
                    <td className="px-4 py-3 text-center">{r.nb_couverts}</td>
                    <td className="px-4 py-3 text-gray-400">{r.zone}</td>
                    <td className="px-4 py-3 text-gray-400 max-w-32 truncate">{r.notes}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs font-medium" style={{ background: s.bg, color: s.text }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {r.statut !== 'confirmee' && (
                          <button onClick={() => updateStatut(r.id, 'confirmee')} className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(46,125,50,0.2)', color: '#4caf50' }}>✓</button>
                        )}
                        {r.statut !== 'annulee' && (
                          <button onClick={() => updateStatut(r.id, 'annulee')} className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(183,28,28,0.2)', color: '#ef5350' }}>✗</button>
                        )}
                        <button onClick={() => deleteReservation(r.id)} className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(100,100,100,0.2)', color: '#888' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-xl p-6" style={{ background: '#1A1A1A', border: '1px solid #333' }}>
            <h2 className="text-lg font-bold mb-5">Nouvelle réservation</h2>
            <div className="space-y-3">
              {[
                { label: 'Nom', key: 'nom_client', type: 'text' },
                { label: 'Téléphone', key: 'telephone', type: 'tel' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-400 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as unknown as Record<string, unknown>)[f.key] as string}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ background: '#242424', border: '1px solid #333', color: '#F5F5F5' }}
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Date</label>
                  <input type="date" value={form.date_reservation} onChange={e => setForm(prev => ({ ...prev, date_reservation: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ background: '#242424', border: '1px solid #333', color: '#F5F5F5' }} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Heure</label>
                  <select value={form.heure} onChange={e => setForm(prev => ({ ...prev, heure: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ background: '#242424', border: '1px solid #333', color: '#F5F5F5' }}>
                    {CRENEAUX.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Couverts</label>
                  <input type="number" min={1} max={20} value={form.nb_couverts} onChange={e => setForm(prev => ({ ...prev, nb_couverts: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ background: '#242424', border: '1px solid #333', color: '#F5F5F5' }} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Zone</label>
                  <input type="text" value={form.zone} onChange={e => setForm(prev => ({ ...prev, zone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ background: '#242424', border: '1px solid #333', color: '#F5F5F5' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none resize-none"
                  style={{ background: '#242424', border: '1px solid #333', color: '#F5F5F5' }} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg text-sm text-gray-400" style={{ background: '#242424', border: '1px solid #333' }}>Annuler</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#B71C1C' }}>
                {saving ? 'Enregistrement...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
