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

export default function DashboardPage() {
  const router = useRouter()
  const [kpi, setKpi] = useState<KPI>({ reservationsAujourdHui: 0, commandesEnCours: 0, caJour: 0, totalClients: 0 })
  const [bars, setBars] = useState<DayBar[]>([])
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [toastId, setToastId] = useState(0)

  const addToast = useCallback((message: string, type: 'reservation' | 'commande') => {
    const id = Date.now() + Math.random()
    setToastId(prev => prev + 1)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      const [{ count: resCount }, { count: cmdCount }, { data: caData }, { count: clientCount }] = await Promise.all([
        supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('date_reservation', today),
        supabase.from('commandes').select('*', { count: 'exact', head: true }).in('statut', ['en_attente', 'en_preparation']),
        supabase.from('commandes').select('total').eq('statut', 'payee').gte('created_at', today + 'T00:00:00').lte('created_at', today + 'T23:59:59'),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
      ])

      const ca = caData ? caData.reduce((sum, c) => sum + (c.total || 0), 0) : 0

      setKpi({
        reservationsAujourdHui: resCount ?? 0,
        commandesEnCours: cmdCount ?? 0,
        caJour: ca,
        totalClients: clientCount ?? 0,
      })

      // 7 jours glissants
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
    { label: 'Réservations aujourd\'hui', value: kpi.reservationsAujourdHui, color: '#D4A843' },
    { label: 'Commandes en cours', value: kpi.commandesEnCours, color: '#B71C1C' },
    { label: 'CA du jour', value: `${kpi.caJour.toFixed(2)} €`, color: '#2E7D32' },
    { label: 'Total clients', value: kpi.totalClients, color: '#555' },
  ]

  return (
    <div className="p-8" style={{ color: '#F5F5F5' }}>
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

      {loading ? (
        <div className="text-gray-500">Chargement...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
            {kpiCards.map(card => (
              <div key={card.label} className="rounded-xl p-6" style={{ background: '#242424' }}>
                <div className="text-3xl font-bold mb-2" style={{ color: card.color }}>{card.value}</div>
                <div className="text-sm text-gray-400">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Graphique 7 jours */}
          <div className="rounded-xl p-6" style={{ background: '#242424' }}>
            <h2 className="text-base font-semibold mb-6 text-gray-300">Réservations — 7 derniers jours</h2>
            <div className="flex items-end gap-3" style={{ height: 160 }}>
              {bars.map(bar => (
                <div key={bar.date} className="flex flex-col items-center flex-1 gap-1">
                  <div className="text-xs text-gray-400">{bar.count}</div>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max((bar.count / maxBar) * 120, 4)}px`,
                      background: '#B71C1C',
                      opacity: 0.8,
                    }}
                  />
                  <div className="text-xs text-gray-500 text-center leading-tight">{bar.label}</div>
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
            className="px-5 py-3 rounded-lg text-sm font-medium shadow-lg"
            style={{
              background: t.type === 'reservation' ? '#2E7D32' : '#B71C1C',
              color: '#fff',
              minWidth: 240,
            }}
          >
            {t.type === 'reservation' ? '📅' : '🛒'} {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
