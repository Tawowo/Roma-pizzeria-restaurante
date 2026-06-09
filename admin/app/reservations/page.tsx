'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type StatutRes = 'en_attente' | 'confirmee' | 'annulee'
type Vue = 'liste' | 'calendrier'

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

const STATUT_STYLES: Record<StatutRes, { bg: string; text: string; label: string; tw: string }> = {
  en_attente: { bg: 'rgba(212,168,67,0.2)', text: '#D4A843', label: 'En attente', tw: 'bg-yellow-100 text-yellow-800' },
  confirmee: { bg: 'rgba(46,125,50,0.2)', text: '#4caf50', label: 'Confirmée', tw: 'bg-green-100 text-green-800' },
  annulee: { bg: 'rgba(183,28,28,0.2)', text: '#ef5350', label: 'Annulée', tw: 'bg-red-100 text-red-800' },
}

const CRENEAUX = ['12:00','12:30','13:00','13:30','14:00','14:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00']

function getWeek(base: Date): Date[] {
  const day = base.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(base)
  mon.setDate(base.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

export default function ReservationsPage() {
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterStatut, setFilterStatut] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormData>({ nom_client: '', telephone: '', date_reservation: new Date().toISOString().split('T')[0], heure: '20:00', nb_couverts: 2, zone: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [vue, setVue] = useState<Vue>('liste')
  const [weekBase, setWeekBase] = useState(new Date())
  const [smsModal, setSmsModal] = useState<Reservation | null>(null)

  const fetchReservations = useCallback(async () => {
    try {
      const week = getWeek(weekBase)
      const startDate = vue === 'calendrier' ? week[0].toISOString().split('T')[0] : filterDate
      const endDate = vue === 'calendrier' ? week[6].toISOString().split('T')[0] : filterDate

      let query = supabase.from('reservations').select('*').gte('date_reservation', startDate).lte('date_reservation', endDate).order('heure')
      if (filterStatut && vue === 'liste') query = query.eq('statut', filterStatut)
      const { data, error } = await query
      if (error) throw error
      setReservations(data ?? [])
    } catch (err) {
      console.error('Reservations fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [filterDate, filterStatut, vue, weekBase])

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
    try { await supabase.from('reservations').update({ statut }).eq('id', id); await fetchReservations() } catch { /* skip */ }
  }

  const deleteReservation = async (id: string) => {
    if (!confirm('Supprimer cette réservation ?')) return
    try { await supabase.from('reservations').delete().eq('id', id); await fetchReservations() } catch { /* skip */ }
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      await supabase.from('reservations').insert([{ ...form, statut: 'en_attente' }])
      setShowModal(false)
      setForm({ nom_client: '', telephone: '', date_reservation: new Date().toISOString().split('T')[0], heure: '20:00', nb_couverts: 2, zone: '', notes: '' })
      await fetchReservations()
    } catch { /* skip */ } finally { setSaving(false) }
  }

  const smsText = (r: Reservation) =>
    `Bonjour ${r.nom_client}, votre réservation chez Roma le ${r.date_reservation} à ${r.heure} pour ${r.nb_couverts} pers. est confirmée. À bientôt !`

  const week = getWeek(weekBase)

  // Détection conflits calendrier
  const conflits: string[] = []
  if (vue === 'calendrier') {
    const grouped: Record<string, Reservation[]> = {}
    reservations.forEach(r => {
      const key = `${r.date_reservation}-${r.heure}-${r.zone || 'sans-zone'}`
      grouped[key] = [...(grouped[key] ?? []), r]
    })
    Object.entries(grouped).forEach(([k, v]) => { if (v.length > 1) conflits.push(k) })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Réservations</h1>
        <div className="flex gap-2">
          {/* Toggle vue */}
          <div className="flex border border-[#E0D5C5] rounded-lg overflow-hidden">
            {(['liste', 'calendrier'] as Vue[]).map(v => (
              <button key={v} onClick={() => setVue(v)}
                className={`px-4 py-2 text-sm font-medium transition-all ${vue === v ? 'bg-[#1B5E20] text-white' : 'bg-white text-[#555]'}`}>
                {v === 'liste' ? '☰ Liste' : '📅 Calendrier'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded-lg font-medium text-white text-sm bg-[#B71C1C] hover:bg-[#C62828]">
            + Nouvelle
          </button>
        </div>
      </div>

      {vue === 'liste' ? (
        <>
          {/* Filtres */}
          <div className="flex gap-4 mb-6">
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] bg-white focus:outline-none" />
            <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] bg-white focus:outline-none">
              <option value="">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="confirmee">Confirmée</option>
              <option value="annulee">Annulée</option>
            </select>
          </div>

          {loading ? <div className="text-[#555]">Chargement...</div> :
            reservations.length === 0 ? <div className="text-[#555]">Aucune réservation pour cette date.</div> : (
              <div className="rounded-xl overflow-hidden bg-white border border-[#E0D5C5]">
                <table className="w-full text-sm">
                  <thead className="bg-[#F0EBE0]">
                    <tr>
                      {['Heure', 'Nom', 'Tél', 'Couverts', 'Zone', 'Notes', 'Statut', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[#555] font-medium text-xs uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map(r => {
                      const s = STATUT_STYLES[r.statut] ?? STATUT_STYLES.en_attente
                      return (
                        <tr key={r.id} className="border-t border-[#E0D5C5]">
                          <td className="px-4 py-3 font-mono font-bold text-[#1A1A1A]">{r.heure}</td>
                          <td className="px-4 py-3 font-medium text-[#1A1A1A]">{r.nom_client}</td>
                          <td className="px-4 py-3 text-[#555]">{r.telephone}</td>
                          <td className="px-4 py-3 text-center text-[#555]">{r.nb_couverts}</td>
                          <td className="px-4 py-3 text-[#555]">{r.zone}</td>
                          <td className="px-4 py-3 text-[#555] max-w-32 truncate">{r.notes}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.tw}`}>{s.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {r.statut !== 'confirmee' && (
                                <button onClick={() => updateStatut(r.id, 'confirmee')} className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">✓</button>
                              )}
                              {r.statut !== 'annulee' && (
                                <button onClick={() => updateStatut(r.id, 'annulee')} className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">✗</button>
                              )}
                              <button onClick={() => setSmsModal(r)} className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">SMS</button>
                              <button onClick={() => deleteReservation(r.id)} className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-500">🗑</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </>
      ) : (
        /* CALENDRIER */
        <div>
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d) }}
              className="px-3 py-1.5 border border-[#E0D5C5] rounded-lg text-sm text-[#555] bg-white hover:bg-[#F0EBE0]">← Semaine préc.</button>
            <span className="text-sm font-medium text-[#1A1A1A]">
              {week[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – {week[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d) }}
              className="px-3 py-1.5 border border-[#E0D5C5] rounded-lg text-sm text-[#555] bg-white hover:bg-[#F0EBE0]">Semaine suiv. →</button>
          </div>

          <div className="overflow-x-auto">
            <div className="grid text-sm" style={{ gridTemplateColumns: `80px repeat(7, minmax(120px, 1fr))` }}>
              {/* Header jours */}
              <div className="bg-[#F0EBE0] border border-[#E0D5C5] p-2 text-xs text-[#555] font-medium rounded-tl-lg"></div>
              {week.map(d => (
                <div key={d.toISOString()} className="bg-[#F0EBE0] border border-[#E0D5C5] p-2 text-center text-xs font-medium text-[#1A1A1A]">
                  <div className="font-bold">{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                  <div>{d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
                </div>
              ))}
              {/* Créneaux */}
              {CRENEAUX.map(creneau => (
                <>
                  <div key={`h-${creneau}`} className="border border-[#E0D5C5] p-2 text-xs text-[#555] font-mono bg-[#F0EBE0] flex items-center justify-center">{creneau}</div>
                  {week.map(d => {
                    const dateStr = d.toISOString().split('T')[0]
                    const resas = reservations.filter(r => r.date_reservation === dateStr && r.heure === creneau)
                    const conflit = resas.length > 1 || resas.some(r => {
                      const key = `${r.date_reservation}-${r.heure}-${r.zone || 'sans-zone'}`
                      return conflits.includes(key)
                    })
                    return (
                      <div key={`${d.toISOString()}-${creneau}`} className="border border-[#E0D5C5] p-1 min-h-[48px] bg-white">
                        {conflit && <div className="text-xs text-red-600 font-bold mb-0.5">⚠️ Conflit</div>}
                        {resas.map(r => (
                          <div key={r.id} className={`text-xs rounded px-1 py-0.5 mb-0.5 truncate ${STATUT_STYLES[r.statut]?.tw ?? ''}`}>
                            {r.nom_client} ({r.nb_couverts}p)
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal SMS */}
      {smsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Message SMS</h2>
              <button onClick={() => setSmsModal(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="bg-[#F0EBE0] rounded-lg p-4 text-sm text-[#1A1A1A] mb-4">{smsText(smsModal)}</div>
            <div className="flex gap-3">
              <button onClick={() => { navigator.clipboard.writeText(smsText(smsModal)); setSmsModal(null) }}
                className="flex-1 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-medium">
                📋 Copier le message
              </button>
              <button onClick={() => setSmsModal(null)} className="px-4 py-2 border border-[#E0D5C5] text-[#555] rounded-lg text-sm">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nouvelle réservation */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6 bg-white shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Nouvelle réservation</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-3">
              {[{ label: 'Nom', key: 'nom_client', type: 'text' }, { label: 'Téléphone', key: 'telephone', type: 'tel' }].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-[#555] mb-1">{f.label}</label>
                  <input type={f.type} value={(form as unknown as Record<string, unknown>)[f.key] as string}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#555] mb-1">Date</label>
                  <input type="date" value={form.date_reservation} onChange={e => setForm(prev => ({ ...prev, date_reservation: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-[#555] mb-1">Heure</label>
                  <select value={form.heure} onChange={e => setForm(prev => ({ ...prev, heure: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] focus:outline-none">
                    {CRENEAUX.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#555] mb-1">Couverts</label>
                  <input type="number" min={1} max={20} value={form.nb_couverts} onChange={e => setForm(prev => ({ ...prev, nb_couverts: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-[#555] mb-1">Zone</label>
                  <input type="text" value={form.zone} onChange={e => setForm(prev => ({ ...prev, zone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#555] mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] focus:outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg text-sm text-[#555] border border-[#E0D5C5]">Annuler</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-[#B71C1C] disabled:opacity-50">
                {saving ? 'Enregistrement...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
