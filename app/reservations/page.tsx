'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'

type StatutRes = 'en_attente' | 'confirmee' | 'annulee'
type Vue = 'liste' | 'calendrier'

interface TableLibre {
  id: string
  numero: number
  zone: string
  capacite: number
}

interface Reservation {
  id: string
  heure_reservation: string
  nom: string
  telephone: string
  nombre_couverts: number
  zone_preference: string | null
  notes: string | null
  statut: StatutRes
  date_reservation: string
  client_id?: string | null
}

interface FormData {
  nom: string
  telephone: string
  date_reservation: string
  heure_reservation: string
  nombre_couverts: number
  zone_preference: string
  notes: string
  statut: StatutRes
}

const STATUT_STYLES: Record<StatutRes, { label: string; tw: string }> = {
  en_attente: { label: 'En attente', tw: 'bg-yellow-100 text-yellow-800' },
  confirmee:  { label: 'Confirmée',  tw: 'bg-green-100 text-green-800' },
  annulee:    { label: 'Annulée',    tw: 'bg-red-100 text-red-800' },
}

const STATUT_BLOC: Record<StatutRes, string> = {
  confirmee:  'bg-green-100 border-green-300 text-green-800',
  annulee:    'bg-red-100 border-red-300 text-red-800',
  en_attente: 'bg-yellow-100 border-yellow-300 text-yellow-800',
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

const emptyForm = (): FormData => ({
  nom: '', telephone: '',
  date_reservation: new Date().toISOString().split('T')[0],
  heure_reservation: '20:00',
  nombre_couverts: 2, zone_preference: '', notes: '', statut: 'en_attente',
})

function resaToForm(r: Reservation): FormData {
  return {
    nom: r.nom,
    telephone: r.telephone,
    date_reservation: r.date_reservation,
    heure_reservation: (r.heure_reservation ?? '').substring(0, 5),
    nombre_couverts: r.nombre_couverts,
    zone_preference: r.zone_preference ?? '',
    notes: r.notes ?? '',
    statut: r.statut,
  }
}

export default function ReservationsPage() {
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterStatut, setFilterStatut] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Reservation | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [vue, setVue] = useState<Vue>('liste')
  const [weekBase, setWeekBase] = useState(new Date())
  const [smsModal, setSmsModal] = useState<Reservation | null>(null)
  const [arrivedModal, setArrivedModal] = useState<Reservation | null>(null)
  const [tablesLibres, setTablesLibres] = useState<TableLibre[]>([])
  const [tableChoisie, setTableChoisie] = useState('')
  const [savingArrivee, setSavingArrivee] = useState(false)

  const fetchReservations = useCallback(async () => {
    try {
      const week = getWeek(weekBase)
      const startDate = vue === 'calendrier' ? week[0].toISOString().split('T')[0] : filterDate
      const endDate   = vue === 'calendrier' ? week[6].toISOString().split('T')[0] : filterDate

      let query = supabase.from('reservations').select('*')
        .gte('date_reservation', startDate)
        .lte('date_reservation', endDate)
        .order('heure_reservation')
      if (filterStatut && vue === 'liste') query = query.eq('statut', filterStatut)
      const { data, error } = await query
      if (error) throw error
      setReservations((data ?? []) as Reservation[])
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

  const openCreate = () => {
    setEditTarget(null)
    setForm(emptyForm())
    setShowModal(true)
  }

  const openEdit = (r: Reservation) => {
    setEditTarget(r)
    setForm(resaToForm(r))
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const heureFormatee = form.heure_reservation.length === 5
      ? form.heure_reservation + ':00'
      : form.heure_reservation.substring(0, 8)
    const payload = {
      nom: form.nom,
      telephone: form.telephone,
      date_reservation: form.date_reservation,
      heure_reservation: heureFormatee,
      nombre_couverts: form.nombre_couverts,
      zone_preference: form.zone_preference || null,
      notes: form.notes || null,
      statut: form.statut,
    }
    try {
      if (editTarget) {
        const { error } = await supabase.from('reservations').update(payload).eq('id', editTarget.id)
        if (error) { console.error('Update réservation:', error); return }
      } else {
        const { error } = await supabase.from('reservations').insert([{ ...payload, statut: 'en_attente' }])
        if (error) { console.error('Insert réservation:', error); return }
      }
      setShowModal(false)
      setForm(emptyForm())
      setEditTarget(null)
      await fetchReservations()
    } catch { /* skip */ } finally { setSaving(false) }
  }

  const ouvrirArrivee = async (r: Reservation) => {
    setArrivedModal(r)
    setTableChoisie('')
    const zone = r.zone_preference
    let q = supabase.from('tables_restaurant').select('id, numero, zone, capacite').eq('actif', true).eq('statut', 'libre')
    if (zone) q = (q as typeof q).eq('zone', zone)
    const { data } = await q.order('numero')
    setTablesLibres((data ?? []) as TableLibre[])
  }

  const confirmerArrivee = async () => {
    if (!arrivedModal || !tableChoisie) return
    setSavingArrivee(true)
    try {
      const table = tablesLibres.find(t => t.id === tableChoisie)
      if (!table) return
      await supabase.from('reservations').update({ statut: 'confirmee' }).eq('id', arrivedModal.id)
      await supabase.from('tables_restaurant').update({ statut: 'occupee' }).eq('id', table.id)
      await supabase.from('commandes').insert({
        nom: arrivedModal.nom,
        nom_client: arrivedModal.nom,
        type: 'sur_place',
        statut: 'en_attente',
        table_numero: table.numero,
        zone: table.zone,
        couverts: arrivedModal.nombre_couverts,
        total: 0,
      })
      setArrivedModal(null)
      await fetchReservations()
    } catch (err) {
      console.error('confirmerArrivee error:', err)
    } finally {
      setSavingArrivee(false)
    }
  }

  const smsText = (r: Reservation) =>
    `Bonjour ${r.nom}, votre réservation chez Roma le ${r.date_reservation} à ${(r.heure_reservation ?? '').substring(0, 5)} pour ${r.nombre_couverts} pers. est confirmée. À bientôt !`

  const exportPDFJour = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`Réservations du ${filterDate}`, 20, 20)
    doc.setFontSize(10)
    let y = 35
    reservations.forEach(r => {
      doc.text(`${(r.heure_reservation ?? '').substring(0,5)}  ${r.nom}  ${r.nombre_couverts}p  ${r.zone_preference || ''}  [${STATUT_STYLES[r.statut]?.label}]`, 20, y)
      y += 8
      if (y > 270) { doc.addPage(); y = 20 }
    })
    doc.save(`reservations-${filterDate}.pdf`)
  }

  const week = getWeek(weekBase)

  // Actions communes pour une réservation
  const ActionBtns = ({ r, compact = false }: { r: Reservation; compact?: boolean }) => (
    <div className={`flex gap-1 ${compact ? '' : 'flex-wrap'}`}>
      <button onClick={() => ouvrirArrivee(r)} className={`${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} rounded-lg bg-[#1B5E20] text-white font-medium whitespace-nowrap`}>✅{!compact && ' Client arrivé'}</button>
      {r.statut !== 'confirmee' && (
        <button onClick={() => updateStatut(r.id, 'confirmee')} className={`${compact ? 'px-2 py-1 text-xs' : 'flex-1 py-2 text-sm'} rounded-lg bg-green-100 text-green-700 font-medium`}>✓{!compact && ' Confirmer'}</button>
      )}
      {r.statut !== 'annulee' && (
        <button onClick={() => updateStatut(r.id, 'annulee')} className={`${compact ? 'px-2 py-1 text-xs' : 'flex-1 py-2 text-sm'} rounded-lg bg-red-100 text-red-700 font-medium`}>✗{!compact && ' Annuler'}</button>
      )}
      <button onClick={() => openEdit(r)} className={`${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} rounded-lg bg-blue-100 text-blue-700`}>✏️</button>
      <button onClick={() => setSmsModal(r)} className={`${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} rounded-lg bg-indigo-100 text-indigo-700`}>SMS</button>
      <button onClick={() => deleteReservation(r.id)} className={`${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} rounded-lg bg-gray-100 text-gray-500`}>🗑</button>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Réservations</h1>
        <div className="flex gap-2">
          <div className="flex border border-[#E0D5C5] rounded-lg overflow-hidden">
            <button onClick={() => setVue('liste')}
              className={`px-3 py-2 text-sm font-medium transition-all ${vue === 'liste' ? 'bg-[#1B5E20] text-white' : 'bg-white text-[#555]'}`}>
              ☰ Liste
            </button>
            <button onClick={() => setVue('calendrier')}
              className={`px-3 py-2 text-sm font-medium transition-all ${vue === 'calendrier' ? 'bg-[#1B5E20] text-white' : 'bg-white text-[#555]'}`}>
              📅 Calendrier
            </button>
          </div>
          <button onClick={openCreate} className="px-4 py-2 rounded-lg font-medium text-white text-sm bg-[#B71C1C] hover:bg-[#C62828]">
            + Nouvelle
          </button>
        </div>
      </div>

      {vue === 'liste' ? (
        <>
          <div className="flex flex-wrap gap-3 mb-6">
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] bg-white focus:outline-none" />
            <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] bg-white focus:outline-none">
              <option value="">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="confirmee">Confirmée</option>
              <option value="annulee">Annulée</option>
            </select>
            <button onClick={exportPDFJour}
              className="px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] bg-white text-[#555] hover:bg-[#F0EBE0]">
              📄 PDF du jour
            </button>
          </div>

          {loading ? <div className="text-[#555]">Chargement...</div> :
            reservations.length === 0 ? <div className="text-[#555]">Aucune réservation pour cette date.</div> : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {reservations.map(r => {
                    const s = STATUT_STYLES[r.statut] ?? STATUT_STYLES.en_attente
                    return (
                      <div key={r.id} className="bg-white rounded-xl border border-[#E0D5C5] p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-bold text-[#1A1A1A] text-lg">{(r.heure_reservation ?? '').substring(0, 5)}</span>
                            <span className="ml-2 font-medium text-[#1A1A1A]">{r.nom}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.tw}`}>{s.label}</span>
                        </div>
                        <div className="text-sm text-[#555] space-y-1">
                          <div>📞 {r.telephone} · {r.nombre_couverts} couverts · {r.zone_preference || 'Indifférent'}</div>
                          {r.notes && <div className="text-xs text-[#777]">📝 {r.notes}</div>}
                        </div>
                        <div className="mt-3">
                          <ActionBtns r={r} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block rounded-xl overflow-hidden bg-white border border-[#E0D5C5]">
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
                            <td className="px-4 py-3 font-mono font-bold text-[#1A1A1A]">{(r.heure_reservation ?? '').substring(0, 5)}</td>
                            <td className="px-4 py-3 font-medium text-[#1A1A1A]">{r.nom}</td>
                            <td className="px-4 py-3 text-[#555]">{r.telephone}</td>
                            <td className="px-4 py-3 text-center text-[#555]">{r.nombre_couverts}</td>
                            <td className="px-4 py-3 text-[#555]">{r.zone_preference}</td>
                            <td className="px-4 py-3 text-[#555] max-w-32 truncate">{r.notes}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.tw}`}>{s.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              <ActionBtns r={r} compact />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
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

          {/* Vue calendrier mobile */}
          <div className="md:hidden">
            {Object.entries(
              reservations.reduce((acc, r) => {
                if (!acc[r.date_reservation]) acc[r.date_reservation] = []
                acc[r.date_reservation].push(r)
                return acc
              }, {} as Record<string, Reservation[]>)
            ).sort().map(([date, resas]) => (
              <div key={date} className="mb-4">
                <h3 className="font-bold text-[#1A1A1A] mb-2 px-1">
                  {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                {resas.map(r => (
                  <div key={r.id} className="bg-white rounded-lg border border-[#E0D5C5] p-3 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-mono font-bold text-[#1A1A1A]">{(r.heure_reservation ?? '').substring(0, 5)}</span>
                      <span className="font-medium">{r.nom}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${STATUT_STYLES[r.statut]?.tw}`}>{STATUT_STYLES[r.statut]?.label}</span>
                    </div>
                    <div className="text-sm text-[#555] mb-2">{r.nombre_couverts} couverts · {r.zone_preference || 'Indifférent'}</div>
                    <ActionBtns r={r} compact />
                  </div>
                ))}
              </div>
            ))}
            {reservations.length === 0 && <div className="text-[#555] px-1">Aucune réservation cette semaine.</div>}
          </div>

          {/* Vue calendrier desktop */}
          <div className="hidden md:block overflow-x-auto">
            <div className="grid text-sm" style={{ gridTemplateColumns: `80px repeat(7, minmax(130px, 1fr))` }}>
              <div className="bg-[#F0EBE0] border border-[#E0D5C5] p-2 text-xs text-[#555] font-medium rounded-tl-lg"></div>
              {week.map(d => {
                const isToday = d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
                return (
                  <div key={d.toISOString()} className={`border border-[#E0D5C5] p-2 text-center text-xs font-medium ${isToday ? 'bg-[#1B5E20] text-white' : 'bg-[#F0EBE0] text-[#1A1A1A]'}`}>
                    <div className="font-bold">{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                    <div>{d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
                  </div>
                )
              })}
              {CRENEAUX.map(creneau => (
                <React.Fragment key={creneau}>
                  <div className="border border-[#E0D5C5] p-2 text-xs text-[#555] font-mono bg-[#F0EBE0] flex items-center justify-center">{creneau}</div>
                  {week.map(d => {
                    const dateStr = d.toISOString().split('T')[0]
                    const resas = reservations.filter(r =>
                      r.date_reservation === dateStr &&
                      (r.heure_reservation ?? '').substring(0, 5) === creneau
                    )
                    return (
                      <div key={`${dateStr}-${creneau}`} className="border border-[#E0D5C5] p-1 min-h-[52px] bg-white">
                        {resas.map(r => (
                          <div key={r.id}
                            className={`text-xs rounded border px-1.5 py-1 mb-0.5 cursor-pointer hover:opacity-80 ${STATUT_BLOC[r.statut] ?? STATUT_BLOC.en_attente}`}
                            onClick={() => openEdit(r)}
                            title="Cliquer pour modifier"
                          >
                            <div className="font-semibold truncate">{r.nom}</div>
                            <div className="opacity-75">{r.nombre_couverts}p{r.zone_preference ? ` · ${r.zone_preference}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </React.Fragment>
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

      {/* Modal Client arrivé */}
      {arrivedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">✅ Client arrivé</h2>
              <button onClick={() => setArrivedModal(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#555] mb-1">Client</label>
                <div className="px-3 py-2 rounded-lg text-sm bg-[#F0EBE0] text-[#1A1A1A] font-medium">{arrivedModal.nom}</div>
              </div>
              <div>
                <label className="block text-xs text-[#555] mb-1">Couverts</label>
                <div className="px-3 py-2 rounded-lg text-sm bg-[#F0EBE0] text-[#1A1A1A]">{arrivedModal.nombre_couverts} personne{arrivedModal.nombre_couverts > 1 ? 's' : ''}</div>
              </div>
              <div>
                <label className="block text-xs text-[#555] mb-1">Table à assigner {arrivedModal.zone_preference ? `(${arrivedModal.zone_preference})` : ''}</label>
                {tablesLibres.length === 0 ? (
                  <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">Aucune table libre{arrivedModal.zone_preference ? ` en ${arrivedModal.zone_preference}` : ''}</div>
                ) : (
                  <select value={tableChoisie} onChange={e => setTableChoisie(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]">
                    <option value="">— Choisir une table —</option>
                    {tablesLibres.map(t => (
                      <option key={t.id} value={t.id}>Table {t.numero} · {t.zone} · {t.capacite} pers.</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setArrivedModal(null)} className="flex-1 py-2 rounded-lg text-sm text-[#555] border border-[#E0D5C5]">Annuler</button>
              <button onClick={confirmerArrivee} disabled={!tableChoisie || savingArrivee}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-[#1B5E20] disabled:opacity-50">
                {savingArrivee ? 'En cours...' : 'Confirmer l\'arrivée'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Créer / Modifier réservation */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6 bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{editTarget ? 'Modifier la réservation' : 'Nouvelle réservation'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#555] mb-1">Nom</label>
                <input type="text" value={form.nom} onChange={e => setForm(prev => ({ ...prev, nom: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
              </div>
              <div>
                <label className="block text-xs text-[#555] mb-1">Téléphone</label>
                <input type="tel" value={form.telephone} onChange={e => setForm(prev => ({ ...prev, telephone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
              </div>
              <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#555] mb-1">Date</label>
                  <input type="date" value={form.date_reservation} onChange={e => setForm(prev => ({ ...prev, date_reservation: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5]" />
                </div>
                <div>
                  <label className="block text-xs text-[#555] mb-1">Heure</label>
                  <input type="time" value={form.heure_reservation} onChange={e => setForm(prev => ({ ...prev, heure_reservation: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5]" />
                </div>
              </div>
              <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#555] mb-1">Couverts</label>
                  <input type="number" min={1} max={20} value={form.nombre_couverts}
                    onChange={e => setForm(prev => ({ ...prev, nombre_couverts: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-[#555] mb-1">Zone</label>
                  <select value={form.zone_preference} onChange={e => setForm(prev => ({ ...prev, zone_preference: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5]">
                    <option value="">Indifférent</option>
                    <option value="rdc">RDC</option>
                    <option value="etage">Étage</option>
                    <option value="terrasse">Terrasse</option>
                  </select>
                </div>
              </div>
              {editTarget && (
                <div>
                  <label className="block text-xs text-[#555] mb-1">Statut</label>
                  <select value={form.statut} onChange={e => setForm(prev => ({ ...prev, statut: e.target.value as StatutRes }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5]">
                    <option value="en_attente">En attente</option>
                    <option value="confirmee">Confirmée</option>
                    <option value="annulee">Annulée</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-[#555] mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-[#E0D5C5] focus:outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg text-sm text-[#555] border border-[#E0D5C5]">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-[#B71C1C] disabled:opacity-50">
                {saving ? 'Enregistrement...' : (editTarget ? 'Enregistrer' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
