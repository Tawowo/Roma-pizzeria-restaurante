'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface KPI {
  reservationsAujourdHui: number
  commandesEnCours: number
  caJour: number
  totalClients: number
  tablesOccupees: number
  totalTables: number
  enCuisine: number
}

interface DayBar {
  date: string
  label: string
  count: number
}

interface Toast {
  id: number
  message: string
  type: 'reservation' | 'commande'
}

interface CommandeAlerte {
  id: string
  numero: string
  created_at: string
  table_numero?: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [kpi, setKpi] = useState<KPI>({ reservationsAujourdHui: 0, commandesEnCours: 0, caJour: 0, totalClients: 0, tablesOccupees: 0, totalTables: 0, enCuisine: 0 })
  const [bars, setBars] = useState<DayBar[]>([])
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [toastId, setToastId] = useState(0)
  const [alertes, setAlertes] = useState<CommandeAlerte[]>([])

  const addToast = useCallback((message: string, type: 'reservation' | 'commande') => {
    const id = Date.now() + Math.random()
    setToastId(prev => prev + 1)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      const [{ count: resCount }, { data: cmdData }, { data: caData }, { count: clientCount }] = await Promise.all([
        supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('date_reservation', today),
        supabase.from('commandes').select('id, numero, statut, created_at, table_numero').in('statut', ['en_attente', 'en_preparation']),
        supabase.from('commandes').select('total').eq('statut', 'payee').gte('created_at', today + 'T00:00:00').lte('created_at', today + 'T23:59:59'),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
      ])

      const ca = caData ? caData.reduce((sum, c) => sum + (c.total || 0), 0) : 0
      const allActive = cmdData ?? []
      const enPrep = allActive.filter(c => c.statut === 'en_preparation')
      const tablesOccupees = new Set(allActive.filter(c => c.table_numero).map(c => c.table_numero)).size

      // Alertes : en_preparation depuis > 30 min
      const now = Date.now()
      const nouvAlertes = enPrep.filter(c => (now - new Date(c.created_at).getTime()) > 30 * 60 * 1000)
      setAlertes(nouvAlertes)

      let totalTables = 12
      try {
        const { count } = await supabase.from('tables_restaurant').select('*', { count: 'exact', head: true })
        if (count !== null) totalTables = count
      } catch { /* table may not exist */ }

      setKpi({
        reservationsAujourdHui: resCount ?? 0,
        commandesEnCours: allActive.length,
        caJour: ca,
        totalClients: clientCount ?? 0,
        tablesOccupees,
        totalTables,
        enCuisine: enPrep.length,
      })

      const days: DayBar[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const { count } = await supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('date_reservation', dateStr)
        days.push({ date: dateStr, label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }), count: count ?? 0 })
      }
      setBars(days)
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role !== 'monica') { router.replace('/reservations'); return }
    fetchData()
  }, [router, fetchData])

  useEffect(() => {
    const resChannel = supabase.channel('dashboard-res')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reservations' }, () => {
        addToast('Nouvelle réservation reçue', 'reservation')
        fetchData()
      })
      .subscribe()

    const cmdChannel = supabase.channel('dashboard-cmd')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'commandes' }, () => {
        addToast('Nouvelle commande reçue', 'commande')
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(resChannel)
      supabase.removeChannel(cmdChannel)
    }
  }, [addToast, fetchData])

  const maxBar = Math.max(...bars.map(b => b.count), 1)

  const kpiCards = [
    { label: "Réservations aujourd'hui", value: kpi.reservationsAujourdHui, color: '#D4A843' },
    { label: 'Commandes en cours', value: kpi.commandesEnCours, color: '#B71C1C' },
    { label: 'CA du jour', value: `${kpi.caJour.toFixed(2)} €`, color: '#2E7D32' },
    { label: 'Total clients', value: kpi.totalClients, color: '#555555' },
    { label: 'Tables occupées', value: `${kpi.tablesOccupees} / ${kpi.totalTables}`, color: '#1B5E20' },
    { label: 'En cuisine', value: kpi.enCuisine, color: '#F57F17' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">Dashboard</h1>

      {loading ? (
        <div className="text-[#555555]">Chargement...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {kpiCards.map(card => (
              <div key={card.label} className="rounded-xl p-6 bg-white border border-[#E0D5C5] shadow-sm">
                <div className="text-3xl font-bold mb-1" style={{ color: card.color }}>{card.value}</div>
                <div className="text-sm text-[#555555]">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Alertes */}
          {alertes.length > 0 && (
            <div className="mb-8 rounded-xl p-5 bg-orange-50 border border-orange-200">
              <h2 className="font-semibold text-orange-700 mb-3">⚠️ Alertes cuisine ({alertes.length})</h2>
              <div className="space-y-2">
                {alertes.map(a => {
                  const mins = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 60000)
                  return (
                    <div key={a.id} className="flex items-center gap-3 text-sm text-orange-800">
                      <span className="font-bold">#{a.numero}</span>
                      {a.table_numero && <span>Table {a.table_numero}</span>}
                      <span>— en préparation depuis {mins} min</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Graphique 7 jours */}
          <div className="rounded-xl p-6 bg-white border border-[#E0D5C5] shadow-sm">
            <h2 className="text-base font-semibold mb-6 text-[#1A1A1A]">Réservations — 7 derniers jours</h2>
            <div className="flex items-end gap-3" style={{ height: 160 }}>
              {bars.map(bar => (
                <div key={bar.date} className="flex flex-col items-center flex-1 gap-1">
                  <div className="text-xs text-[#555555]">{bar.count}</div>
                  <div
                    className="w-full rounded-t transition-all bg-[#B71C1C]"
                    style={{ height: `${Math.max((bar.count / maxBar) * 120, 4)}px`, opacity: 0.8 }}
                  />
                  <div className="text-xs text-[#555555] text-center leading-tight">{bar.label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50" aria-live="polite">
        {toasts.map(t => (
          <div
            key={`${t.id}-${toastId}`}
            className="px-5 py-3 rounded-lg text-sm font-medium shadow-lg text-white"
            style={{ background: t.type === 'reservation' ? '#2E7D32' : '#B71C1C', minWidth: 240 }}
          >
            {t.type === 'reservation' ? '📅' : '🛒'} {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
