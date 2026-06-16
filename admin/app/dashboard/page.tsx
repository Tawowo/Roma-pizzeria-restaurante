'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

/* ─── Types ─────────────────────────────────────────────── */
interface KPI {
  reservationsAujourdHui: number
  reservationsEnAttente: number
  reservationsConfirmees: number
  commandesEnCours: number
  commandesSurPlace: number
  commandesAEmporter: number
  caJour: number
  caHier: number
  totalClients: number
  tablesOccupees: number
  totalTables: number
  enCuisine: number
  caMois: number
  avisEnAttente: number
}

interface DayBar {
  date: string
  label: string
  count: number
}

interface CADay {
  date: string
  ca: number
}

interface PizzaTop {
  nom: string
  qte: number
}

interface CACat {
  categorie: string
  ca: number
}

interface HeurePeak {
  jour: number   // 0=lun … 6=dim
  heure: number  // 12 … 21
  count: number
}

interface Toast {
  id: number
  message: string
  type: 'reservation' | 'commande' | 'avis' | 'anniversaire'
}

interface CommandeAlerte {
  id: string
  numero: string
  created_at: string
  table_numero?: number
}

/* ─── KPI Card ───────────────────────────────────────────── */
interface KPICardProps {
  label: string
  value: string | number
  color: string
  badge?: string
  badgeColor?: string
  trend?: string
  trendUp?: boolean
}

function KPICard({ label, value, color, badge, badgeColor = '#B71C1C', trend, trendUp }: KPICardProps) {
  return (
    <div className="rounded-xl p-5 bg-white border border-[#E0D5C5] shadow-sm flex flex-col gap-1">
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-[#555555]">{label}</div>
      {badge && (
        <span
          className="mt-1 self-start px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
          style={{ background: badgeColor }}
        >
          {badge}
        </span>
      )}
      {trend && (
        <span className={`text-[11px] font-medium ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
          {trendUp ? '▲' : '▼'} {trend} vs hier
        </span>
      )}
    </div>
  )
}

/* ─── Donut SVG ─────────────────────────────────────────── */
function DonutChart({ data }: { data: CACat[] }) {
  const total = data.reduce((s, d) => s + d.ca, 0)
  if (total === 0) return <div className="text-xs text-gray-400 text-center py-8">Aucune donnée</div>

  const colors = ['#B71C1C', '#D4A843', '#2E7D32', '#1565C0', '#6A1B9A', '#E65100']
  let cumul = 0
  const cx = 60, cy = 60, r = 50, r2 = 28
  const arcs = data.map((d, i) => {
    const frac = d.ca / total
    const start = cumul
    cumul += frac
    const a1 = (start * 2 - 0.5) * Math.PI
    const a2 = (cumul * 2 - 0.5) * Math.PI
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2)
    const ix1 = cx + r2 * Math.cos(a1), iy1 = cy + r2 * Math.sin(a1)
    const ix2 = cx + r2 * Math.cos(a2), iy2 = cy + r2 * Math.sin(a2)
    const lg = frac > 0.5 ? 1 : 0
    return {
      d: `M${x1},${y1} A${r},${r} 0 ${lg} 1 ${x2},${y2} L${ix2},${iy2} A${r2},${r2} 0 ${lg} 0 ${ix1},${iy1} Z`,
      color: colors[i % colors.length],
      nom: d.categorie,
      ca: d.ca,
    }
  })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg viewBox="0 0 120 120" className="w-32 h-32 shrink-0">
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} />)}
      </svg>
      <div className="flex flex-col gap-1 text-xs">
        {arcs.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: a.color }} />
            <span className="text-[#333]">{a.nom}</span>
            <span className="text-[#777] ml-auto pl-2">{a.ca.toFixed(0)} €</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Heatmap grid ──────────────────────────────────────── */
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const HEURES = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

function HeatmapGrid({ data }: { data: HeurePeak[] }) {
  const maxV = Math.max(...data.map(d => d.count), 1)
  const getCount = (j: number, h: number) => data.find(d => d.jour === j && d.heure === h)?.count ?? 0
  const color = (v: number) => {
    if (v === 0) return '#F5F5F5'
    const pct = v / maxV
    if (pct < 0.3) return '#FFF9C4'
    if (pct < 0.6) return '#FFB300'
    return '#B71C1C'
  }
  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] border-separate border-spacing-1 mx-auto">
        <thead>
          <tr>
            <th className="w-6" />
            {JOURS.map(j => <th key={j} className="w-8 text-center text-[#555]">{j}</th>)}
          </tr>
        </thead>
        <tbody>
          {HEURES.map(h => (
            <tr key={h}>
              <td className="text-right pr-1 text-[#777]">{h}h</td>
              {JOURS.map((_, j) => {
                const v = getCount(j, h)
                return (
                  <td key={j} title={`${v} commande(s)`}>
                    <div className="w-8 h-5 rounded" style={{ background: color(v) }} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter()
  const [kpi, setKpi] = useState<KPI>({
    reservationsAujourdHui: 0, reservationsEnAttente: 0, reservationsConfirmees: 0,
    commandesEnCours: 0, commandesSurPlace: 0, commandesAEmporter: 0,
    caJour: 0, caHier: 0, totalClients: 0,
    tablesOccupees: 0, totalTables: 0, enCuisine: 0, caMois: 0, avisEnAttente: 0,
  })
  const [bars, setBars] = useState<DayBar[]>([])
  const [caLine, setCaLine] = useState<CADay[]>([])
  const [pizzaTop, setPizzaTop] = useState<PizzaTop[]>([])
  const [caCat, setCaCat] = useState<CACat[]>([])
  const [heatmap, setHeatmap] = useState<HeurePeak[]>([])
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [toastId, setToastId] = useState(0)
  const [alertes, setAlertes] = useState<CommandeAlerte[]>([])
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  /* Toast helper */
  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = Date.now() + Math.random()
    setToastId(prev => prev + 1)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    try {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]

      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      const firstOfMonth = new Date(today); firstOfMonth.setDate(1)
      const firstOfMonthStr = firstOfMonth.toISOString().split('T')[0]

      const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

      /* Parallel base fetches */
      const [
        { data: resasToday },
        { data: cmdData },
        { data: caJourData },
        { data: caHierData },
        { count: clientCount },
        { data: caMoisData },
        { count: avisCount },
        { data: ca30Data },
      ] = await Promise.all([
        supabase.from('reservations').select('id, statut').eq('date_reservation', todayStr),
        supabase.from('commandes').select('id, numero, statut, type, created_at, table_numero').in('Statut', ['en_attente', 'en_preparation']),
        supabase.from('commandes').select('total').eq('Statut', 'encaissee').gte('created_at', todayStr + 'T00:00:00').lte('created_at', todayStr + 'T23:59:59'),
        supabase.from('commandes').select('total').eq('Statut', 'encaissee').gte('created_at', yesterdayStr + 'T00:00:00').lte('created_at', yesterdayStr + 'T23:59:59'),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('commandes').select('total').eq('Statut', 'encaissee').gte('created_at', firstOfMonthStr + 'T00:00:00'),
        supabase.from('avis').select('*', { count: 'exact', head: true }).eq('statut', 'en_attente'),
        supabase.from('commandes').select('total, created_at').eq('Statut', 'encaissee').gte('created_at', thirtyDaysAgoStr + 'T00:00:00'),
      ])

      const caJour = (caJourData ?? []).reduce((s, c) => s + (c.total || 0), 0)
      const caHier = (caHierData ?? []).reduce((s, c) => s + (c.total || 0), 0)
      const caMois = (caMoisData ?? []).reduce((s, c) => s + (c.total || 0), 0)
      const allActive = cmdData ?? []
      const enPrep = allActive.filter(c => c.statut === 'en_preparation')
      const surPlace = allActive.filter(c => c.type === 'sur_place').length
      const aEmporter = allActive.filter(c => c.type === 'a_emporter').length
      const tablesOccupees = new Set(allActive.filter(c => c.table_numero).map(c => c.table_numero)).size

      const enAttente = (resasToday ?? []).filter(r => r.statut === 'en_attente').length
      const confirmees = (resasToday ?? []).filter(r => r.statut === 'confirmee').length

      /* Alertes cuisine > 30 min */
      const now = Date.now()
      const nouvAlertes = enPrep.filter(c => (now - new Date(c.created_at).getTime()) > 30 * 60 * 1000)
      setAlertes(nouvAlertes)

      /* Total tables */
      let totalTables = 12
      try {
        const { count } = await supabase.from('tables_restaurant').select('*', { count: 'exact', head: true })
        if (count !== null) totalTables = count
      } catch { /* table may not exist */ }

      setKpi({
        reservationsAujourdHui: (resasToday ?? []).length,
        reservationsEnAttente: enAttente,
        reservationsConfirmees: confirmees,
        commandesEnCours: allActive.length,
        commandesSurPlace: surPlace,
        commandesAEmporter: aEmporter,
        caJour,
        caHier,
        totalClients: clientCount ?? 0,
        tablesOccupees,
        totalTables,
        enCuisine: enPrep.length,
        caMois,
        avisEnAttente: avisCount ?? 0,
      })

      /* 7-day reservations bars */
      const days: DayBar[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const { count } = await supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('date_reservation', dateStr)
        days.push({ date: dateStr, label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }), count: count ?? 0 })
      }
      setBars(days)

      /* CA 30 days line */
      const caByDay: Record<string, number> = {}
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        caByDay[d.toISOString().split('T')[0]] = 0
      }
      ;(ca30Data ?? []).forEach(c => {
        const day = (c.created_at as string)?.split('T')[0]
        if (day && day in caByDay) caByDay[day] += (c.total as number) || 0
      })
      setCaLine(Object.entries(caByDay).map(([date, ca]) => ({ date, ca })))

      /* Top 5 articles */
      try {
        const { data: lignes } = await supabase.from('lignes_commande').select('article_nom, quantite')
        if (lignes) {
          const agg: Record<string, number> = {}
          lignes.forEach(l => {
            const nom = (l.article_nom as string) || 'Inconnu'
            agg[nom] = (agg[nom] || 0) + ((l.quantite as number) || 1)
          })
          const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 5)
          setPizzaTop(sorted.map(([nom, qte]) => ({ nom, qte })))
        }
      } catch { /* table may not exist */ }

      /* CA par catégorie */
      try {
        const { data: lignesCat } = await supabase.from('lignes_commande').select('categorie, prix_unitaire, quantite')
        if (lignesCat) {
          const aggCat: Record<string, number> = {}
          lignesCat.forEach(l => {
            const cat = (l.categorie as string) || 'Autre'
            aggCat[cat] = (aggCat[cat] || 0) + (((l.prix_unitaire as number) || 0) * ((l.quantite as number) || 1))
          })
          setCaCat(Object.entries(aggCat).map(([categorie, ca]) => ({ categorie, ca })))
        }
      } catch { /* table may not exist */ }

      /* Heatmap heures de pointe */
      try {
        const { data: cmdHeure } = await supabase.from('commandes').select('created_at').gte('created_at', thirtyDaysAgoStr + 'T00:00:00')
        if (cmdHeure) {
          const aggH: Record<string, number> = {}
          cmdHeure.forEach(c => {
            const d2 = new Date(c.created_at as string)
            const jour = (d2.getDay() + 6) % 7  // 0=lun
            const heure = d2.getHours()
            if (heure >= 12 && heure <= 21) {
              const key = `${jour}-${heure}`
              aggH[key] = (aggH[key] || 0) + 1
            }
          })
          setHeatmap(Object.entries(aggH).map(([k, count]) => {
            const [jour, heure] = k.split('-').map(Number)
            return { jour, heure, count }
          }))
        }
      } catch { /* table may not exist */ }

      /* Alertes anniversaires */
      try {
        const mm = String(today.getMonth() + 1).padStart(2, '0')
        const dd = String(today.getDate()).padStart(2, '0')
        const { data: anniv } = await supabase.from('clients').select('prenom, nom').like('date_naissance', `%-${mm}-${dd}`)
        if (anniv && anniv.length > 0) {
          anniv.forEach(c => addToast(`🎂 Aujourd'hui : ${c.prenom as string} fête son anniversaire`, 'anniversaire'))
        }
      } catch { /* ignore */ }

      /* Alerte avis en attente */
      if ((avisCount ?? 0) > 0) {
        addToast(`⭐ ${avisCount} avis en attente de validation`, 'avis')
      }

    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role !== 'monica') { router.replace('/reservations'); return }
    fetchData()
  }, [router, fetchData])

  useEffect(() => {
    const resChannel = supabase.channel('dashboard-res')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reservations' }, () => {
        addToast('📅 Nouvelle réservation reçue', 'reservation')
        fetchData()
      })
      .subscribe()

    const cmdChannel = supabase.channel('dashboard-cmd')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'commandes' }, (payload) => {
        const rec = payload.new as { type?: string; client_nom?: string }
        if (rec?.type === 'a_emporter' && rec?.client_nom) {
          addToast(`🍕 Nouvelle commande à emporter de ${rec.client_nom}`, 'commande')
        } else {
          addToast('🛒 Nouvelle commande reçue', 'commande')
        }
        fetchData()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'commandes' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(resChannel)
      supabase.removeChannel(cmdChannel)
    }
  }, [addToast, fetchData])

  /* Close export dropdown on outside click */
  useEffect(() => {
    if (!exportOpen) return
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportOpen])

  /* ── Export handlers ── */
  const handleExportCSV = useCallback(() => {
    const rows: (string | number)[][] = [
      ['KPI', 'Valeur'],
      ["Réservations aujourd'hui", kpi.reservationsAujourdHui],
      ['En attente', kpi.reservationsEnAttente],
      ['Confirmées', kpi.reservationsConfirmees],
      ['Commandes en cours', kpi.commandesEnCours],
      ['Sur place', kpi.commandesSurPlace],
      ['À emporter', kpi.commandesAEmporter],
      ['CA du jour (€)', kpi.caJour.toFixed(2)],
      ['CA hier (€)', kpi.caHier.toFixed(2)],
      ['CA ce mois (€)', kpi.caMois.toFixed(2)],
      ['Membres Club Roma', kpi.totalClients],
      ['Tables occupées', kpi.tablesOccupees],
      ['Total tables', kpi.totalTables],
      ['En cuisine', kpi.enCuisine],
      ['Avis en attente', kpi.avisEnAttente],
    ]
    const csv = rows.map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'dashboard-roma.csv'; a.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }, [kpi])

  const handleExportExcel = useCallback(async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const wsData: (string | number)[][] = [
      ['KPI', 'Valeur'],
      ["Réservations aujourd'hui", kpi.reservationsAujourdHui],
      ['En attente', kpi.reservationsEnAttente],
      ['Confirmées', kpi.reservationsConfirmees],
      ['Commandes en cours', kpi.commandesEnCours],
      ['Sur place', kpi.commandesSurPlace],
      ['À emporter', kpi.commandesAEmporter],
      ['CA du jour (€)', kpi.caJour],
      ['CA hier (€)', kpi.caHier],
      ['CA ce mois (€)', kpi.caMois],
      ['Membres Club Roma', kpi.totalClients],
      ['Tables occupées', kpi.tablesOccupees],
      ['Total tables', kpi.totalTables],
      ['En cuisine', kpi.enCuisine],
      ['Avis en attente', kpi.avisEnAttente],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'KPIs')
    if (caLine.length > 0) {
      const ws2 = XLSX.utils.aoa_to_sheet([['Date', 'CA (€)'], ...caLine.map(d => [d.date, d.ca])])
      XLSX.utils.book_append_sheet(wb, ws2, 'CA 30 jours')
    }
    XLSX.writeFile(wb, 'dashboard-roma.xlsx')
    setExportOpen(false)
  }, [kpi, caLine])

  const handleExportPDF = useCallback(async () => {
    const element = document.getElementById('dashboard-content')
    if (!element) return
    const html2canvas = (await import('html2canvas')).default
    const jsPDF = (await import('jspdf')).default
    const canvas = await html2canvas(element, { scale: 1.5, useCORS: true })
    const pdf = new jsPDF('p', 'mm', 'a4')
    const imgData = canvas.toDataURL('image/png')
    const imgWidth = 190
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight)
    pdf.save('dashboard-roma.pdf')
    setExportOpen(false)
  }, [])

  /* ── Chart helpers ── */
  const maxBar = Math.max(...bars.map(b => b.count), 1)

  const caLinePoints = (() => {
    if (caLine.length < 2) return ''
    const maxCA = Math.max(...caLine.map(d => d.ca), 1)
    const w = 500, h = 100
    return caLine.map((d, i) => `${(i / (caLine.length - 1)) * w},${h - (d.ca / maxCA) * h}`).join(' ')
  })()

  const maxPizza = Math.max(...pizzaTop.map(p => p.qte), 1)

  const trendCA = kpi.caHier > 0
    ? (((kpi.caJour - kpi.caHier) / kpi.caHier) * 100).toFixed(1) + '%'
    : null

  const sparkPoints = (() => {
    if (caLine.length < 2) return ''
    const last7 = caLine.slice(-7)
    const maxV = Math.max(...last7.map(d => d.ca), 1)
    const w = 56, h = 20
    return last7.map((d, i) => `${(i / (last7.length - 1)) * w},${h - (d.ca / maxV) * h}`).join(' ')
  })()

  const kpiCards: KPICardProps[] = [
    {
      label: "Réservations aujourd'hui",
      value: kpi.reservationsAujourdHui,
      color: '#D4A843',
      badge: `${kpi.reservationsEnAttente} en attente / ${kpi.reservationsConfirmees} confirmées`,
      badgeColor: kpi.reservationsEnAttente > 0 ? '#B71C1C' : '#2E7D32',
    },
    {
      label: 'Commandes en cours',
      value: kpi.commandesEnCours,
      color: '#B71C1C',
      badge: `${kpi.commandesSurPlace} sur place / ${kpi.commandesAEmporter} à emporter`,
      badgeColor: '#555555',
    },
    {
      label: 'CA du jour',
      value: `${kpi.caJour.toFixed(2)} €`,
      color: '#2E7D32',
      ...(trendCA ? { trend: trendCA, trendUp: kpi.caJour >= kpi.caHier } : {}),
    },
    {
      label: 'Membres Club Roma 🎁',
      value: kpi.totalClients,
      color: '#555555',
    },
    {
      label: 'Tables occupées',
      value: `${kpi.tablesOccupees} / ${kpi.totalTables}`,
      color: '#1B5E20',
    },
    {
      label: 'En cuisine',
      value: kpi.enCuisine,
      color: '#F57F17',
    },
    {
      label: 'CA ce mois',
      value: `${kpi.caMois.toFixed(2)} €`,
      color: '#1565C0',
    },
    {
      label: 'Avis en attente',
      value: kpi.avisEnAttente,
      color: kpi.avisEnAttente > 0 ? '#B71C1C' : '#555555',
      ...(kpi.avisEnAttente > 0 ? { badge: `${kpi.avisEnAttente} à valider`, badgeColor: '#B71C1C' } : {}),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Dashboard</h1>
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B71C1C] text-white text-sm font-medium hover:bg-[#9B1515] transition-colors"
          >
            📥 Exporter
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-white border border-[#E0D5C5] rounded-lg shadow-lg z-10 overflow-hidden">
              <button onClick={handleExportExcel} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#FFF8F0] text-[#1A1A1A]">📊 Excel</button>
              <button onClick={handleExportPDF} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#FFF8F0] text-[#1A1A1A]">📄 PDF</button>
              <button onClick={handleExportCSV} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#FFF8F0] text-[#1A1A1A]">📋 CSV</button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-[#555555]">Chargement...</div>
      ) : (
        <div id="dashboard-content">
          {/* 8 KPI Cards — 2 cols mobile, 4 cols desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {kpiCards.map((card, i) =>
              i === 6 && sparkPoints ? (
                <div key={card.label} className="rounded-xl p-5 bg-white border border-[#E0D5C5] shadow-sm flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                    <svg viewBox="0 0 56 20" className="w-14 h-5 shrink-0 mt-1">
                      <polyline points={sparkPoints} fill="none" stroke="#1565C0" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <div className="text-xs text-[#555555]">{card.label}</div>
                </div>
              ) : (
                <KPICard key={card.label} {...card} />
              )
            )}
          </div>

          {/* Alertes cuisine */}
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

          {/* Graphiques row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Réservations 7 jours */}
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5] shadow-sm">
              <h2 className="text-base font-semibold mb-4 text-[#1A1A1A]">Réservations — 7 derniers jours</h2>
              <div className="flex items-end gap-2" style={{ height: 140 }}>
                {bars.map(bar => (
                  <div key={bar.date} className="flex flex-col items-center flex-1 gap-1">
                    <div className="text-xs text-[#555555]">{bar.count}</div>
                    <div
                      className="w-full rounded-t transition-all bg-[#B71C1C]"
                      style={{ height: `${Math.max((bar.count / maxBar) * 100, 4)}px`, opacity: 0.8 }}
                    />
                    <div className="text-[10px] text-[#555555] text-center leading-tight">{bar.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CA 30 jours */}
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5] shadow-sm">
              <h2 className="text-base font-semibold mb-4 text-[#1A1A1A]">CA — 30 derniers jours</h2>
              {caLinePoints ? (
                <svg viewBox="0 0 500 100" className="w-full h-24" preserveAspectRatio="none">
                  <polyline points={caLinePoints} fill="none" stroke="#B71C1C" strokeWidth="2" />
                </svg>
              ) : (
                <div className="text-xs text-gray-400 py-8 text-center">Aucune donnée</div>
              )}
            </div>
          </div>

          {/* Graphiques row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top 5 articles */}
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5] shadow-sm">
              <h2 className="text-base font-semibold mb-4 text-[#1A1A1A]">Top 5 articles commandés</h2>
              {pizzaTop.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {pizzaTop.map(p => (
                    <div key={p.nom} className="flex items-center gap-3 text-sm">
                      <div className="w-28 truncate text-[#333] shrink-0">{p.nom}</div>
                      <div className="flex-1 bg-[#F5F0E8] rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#B71C1C] transition-all"
                          style={{ width: `${(p.qte / maxPizza) * 100}%` }}
                        />
                      </div>
                      <div className="text-[#555] w-6 text-right shrink-0">{p.qte}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-400 py-8 text-center">Aucune donnée</div>
              )}
            </div>

            {/* CA par catégorie */}
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5] shadow-sm">
              <h2 className="text-base font-semibold mb-4 text-[#1A1A1A]">Répartition CA par catégorie</h2>
              <DonutChart data={caCat} />
            </div>
          </div>

          {/* Graphique row 3 */}
          <div className="rounded-xl p-6 bg-white border border-[#E0D5C5] shadow-sm mb-6">
            <h2 className="text-base font-semibold mb-4 text-[#1A1A1A]">Heures de pointe — 30 derniers jours</h2>
            <HeatmapGrid data={heatmap} />
            <div className="flex items-center gap-4 mt-3 text-[10px] text-[#777]">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#F5F5F5] border border-gray-200" /> 0</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#FFF9C4]" /> Faible</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#FFB300]" /> Moyen</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#B71C1C]" /> Fort</span>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50" aria-live="polite">
        {toasts.map(t => {
          const bg =
            t.type === 'reservation' ? '#2E7D32' :
            t.type === 'commande' ? '#B71C1C' :
            t.type === 'anniversaire' ? '#D4A843' :
            '#1565C0'
          return (
            <div
              key={`${t.id}-${toastId}`}
              className="px-5 py-3 rounded-lg text-sm font-medium shadow-lg text-white"
              style={{ background: bg, minWidth: 260 }}
            >
              {t.message}
            </div>
          )
        })}
      </div>
    </div>
  )
}
