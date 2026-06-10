'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type Periode = 'jour' | 'hier' | 'semaine' | 'semaine_derniere' | 'mois' | 'mois_dernier' | 'annee' | 'custom'

interface Commande {
  id: string
  total: number
  created_at: string
}

interface LigneCategorie {
  article_nom: string
  quantite: number
  prix_unitaire: number
  categorie_nom?: string
}

interface DayBar {
  label: string
  date: string
  ca: number
}

interface HourBar {
  hour: number
  ca: number
}

interface CatBar {
  nom: string
  ca: number
}

interface MonthBar {
  label: string
  ca: number
}

interface Top10Item {
  nom: string
  qty: number
  ca: number
}

interface KPI {
  ca: number
  commandes: number
  ticketMoyen: number
}

function getRange(periode: Periode, customStart?: string, customEnd?: string): { start: string; end: string } {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  if (periode === 'jour') return { start: today, end: today }
  if (periode === 'hier') {
    const y = new Date(now)
    y.setDate(now.getDate() - 1)
    const yStr = y.toISOString().split('T')[0]
    return { start: yStr, end: yStr }
  }
  if (periode === 'semaine') {
    const s = new Date(now)
    s.setDate(now.getDate() - 6)
    return { start: s.toISOString().split('T')[0], end: today }
  }
  if (periode === 'semaine_derniere') {
    const dayOfWeek = now.getDay() || 7
    const lastMonday = new Date(now)
    lastMonday.setDate(now.getDate() - dayOfWeek - 6)
    const lastSunday = new Date(lastMonday)
    lastSunday.setDate(lastMonday.getDate() + 6)
    return { start: lastMonday.toISOString().split('T')[0], end: lastSunday.toISOString().split('T')[0] }
  }
  if (periode === 'mois') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: s.toISOString().split('T')[0], end: today }
  }
  if (periode === 'mois_dernier') {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const e = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] }
  }
  if (periode === 'annee') {
    return { start: `${now.getFullYear()}-01-01`, end: today }
  }
  if (periode === 'custom' && customStart && customEnd) {
    return { start: customStart, end: customEnd }
  }
  const s = new Date(now)
  s.setDate(now.getDate() - 6)
  return { start: s.toISOString().split('T')[0], end: today }
}

function getDaysBetween(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
}

export default function FinancesPage() {
  const router = useRouter()
  const [periode, setPeriode] = useState<Periode>('semaine')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading, setLoading] = useState(true)
  const [bars, setBars] = useState<DayBar[]>([])
  const [hourBars, setHourBars] = useState<HourBar[]>([])
  const [catBars, setCatBars] = useState<CatBar[]>([])
  const [monthBars, setMonthBars] = useState<MonthBar[]>([])
  const [top10, setTop10] = useState<Top10Item[]>([])
  const [range, setRange] = useState({ start: '', end: '' })

  // Compare mode
  const [compareMode, setCompareMode] = useState(false)
  const [period2, setPeriod2] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [kpi2, setKpi2] = useState<KPI>({ ca: 0, commandes: 0, ticketMoyen: 0 })

  // Export dropdown
  const [showExport, setShowExport] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async (p: Periode, cStart?: string, cEnd?: string) => {
    setLoading(true)
    try {
      const r = getRange(p, cStart, cEnd)
      setRange(r)
      const days = getDaysBetween(r.start, r.end)

      const { data: cmdData, error: cmdErr } = await supabase
        .from('commandes').select('id, total, created_at')
        .eq('statut', 'payee').gte('created_at', r.start + 'T00:00:00').lte('created_at', r.end + 'T23:59:59')
      if (cmdErr) throw cmdErr
      setCommandes(cmdData ?? [])

      // Barres par jour
      const daysArr: DayBar[] = []
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(r.end)
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const ca = (cmdData ?? []).filter(c => c.created_at.startsWith(dateStr)).reduce((s, c) => s + (c.total || 0), 0)
        daysArr.push({ date: dateStr, label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), ca })
      }
      setBars(daysArr)

      // Heures de pointe
      const hrs: HourBar[] = Array.from({ length: 16 }, (_, i) => ({ hour: i + 8, ca: 0 }))
      ;(cmdData ?? []).forEach(c => {
        const h = new Date(c.created_at).getHours()
        const idx = h - 8
        if (idx >= 0 && idx < 16) hrs[idx].ca += c.total || 0
      })
      setHourBars(hrs)

      // CA par catégorie
      const ids = (cmdData ?? []).map(c => c.id)
      if (ids.length > 0) {
        try {
          const { data: lgData } = await supabase
            .from('lignes_commande').select('article_nom, quantite, prix_unitaire, articles(categorie_nom:categories(nom))')
            .in('commande_id', ids)
          const catMap: Record<string, number> = {}
          ;(lgData ?? []).forEach((l: LigneCategorie) => {
            const cat = l.categorie_nom ?? 'Non catégorisé'
            catMap[cat] = (catMap[cat] ?? 0) + (l.prix_unitaire * l.quantite)
          })
          setCatBars(Object.entries(catMap).map(([nom, ca]) => ({ nom, ca })).sort((a, b) => b.ca - a.ca))
        } catch { /* skip */ }
      }

      // Top 10 articles depuis lignes_commande
      try {
        const { data: lignes } = await supabase
          .from('lignes_commande')
          .select('article_nom, quantite, prix_unitaire')
          .gte('created_at', r.start + 'T00:00:00')
          .lte('created_at', r.end + 'T23:59:59')
        if (lignes && lignes.length > 0) {
          const aggr: Record<string, { qty: number; ca: number }> = {}
          lignes.forEach(l => {
            if (!aggr[l.article_nom]) aggr[l.article_nom] = { qty: 0, ca: 0 }
            aggr[l.article_nom].qty += l.quantite
            aggr[l.article_nom].ca += l.quantite * l.prix_unitaire
          })
          const t10 = Object.entries(aggr)
            .sort((a, b) => b[1].qty - a[1].qty)
            .slice(0, 10)
            .map(([nom, s]) => ({ nom, qty: s.qty, ca: s.ca }))
          setTop10(t10)
        }
      } catch { /* skip */ }

      // Évolution mensuelle 12 mois
      const now = new Date()
      const months12: MonthBar[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const mStart = d.toISOString().split('T')[0]
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
        const { data: mData } = await supabase.from('commandes').select('total')
          .eq('statut', 'payee').gte('created_at', mStart + 'T00:00:00').lte('created_at', mEnd + 'T23:59:59')
        const mCA = (mData ?? []).reduce((s, c) => s + (c.total || 0), 0)
        months12.push({ label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), ca: mCA })
      }
      setMonthBars(months12)

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchKPI2 = useCallback(async () => {
    if (!period2.start || !period2.end) return
    try {
      const { data } = await supabase.from('commandes').select('total')
        .eq('statut', 'payee')
        .gte('created_at', period2.start + 'T00:00:00')
        .lte('created_at', period2.end + 'T23:59:59')
      const ca = (data ?? []).reduce((s, c) => s + (c.total || 0), 0)
      const nb = (data ?? []).length
      setKpi2({ ca, commandes: nb, ticketMoyen: nb > 0 ? ca / nb : 0 })
    } catch { /* skip */ }
  }, [period2])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role !== 'monica') { router.replace('/dashboard'); return }
    fetchData(periode, customStart, customEnd)
  }, [router, fetchData, periode, customStart, customEnd])

  useEffect(() => {
    if (compareMode && period2.start && period2.end) fetchKPI2()
  }, [compareMode, period2, fetchKPI2])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const caTotal = commandes.reduce((s, c) => s + (c.total || 0), 0)
  const nbCommandes = commandes.length
  const ticketMoyen = nbCommandes > 0 ? caTotal / nbCommandes : 0

  const maxBar = Math.max(...bars.map(b => b.ca), 1)
  const maxHour = Math.max(...hourBars.map(b => b.ca), 1)
  const maxCat = Math.max(...catBars.map(b => b.ca), 1)
  const maxMonth = Math.max(...monthBars.map(b => b.ca), 1)
  const maxTop10 = top10.length > 0 ? top10[0].qty : 1

  const exportCSV = () => {
    const header = 'ID,Date,Total\n'
    const rows = commandes.map(c => `${c.id},${c.created_at},${c.total}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `finances-roma-${range.start}.csv`; a.click()
    URL.revokeObjectURL(url)
    setShowExport(false)
  }

  const exportExcel = async () => {
    setShowExport(false)
    const XLSX = (await import('xlsx')).default
    const wb = XLSX.utils.book_new()

    const wsKPI = XLSX.utils.aoa_to_sheet([
      ['Finances Roma Pizzeria'],
      ['Période', `${range.start} → ${range.end}`],
      [],
      ['KPI', 'Valeur'],
      ['CA total', caTotal.toFixed(2) + '€'],
      ['Nb commandes', nbCommandes],
      ['Ticket moyen', ticketMoyen.toFixed(2) + '€'],
    ])
    XLSX.utils.book_append_sheet(wb, wsKPI, 'KPIs')

    const wsCA = XLSX.utils.aoa_to_sheet([
      ['Date', 'CA (€)'],
      ...bars.map(b => [b.date, b.ca.toFixed(2)])
    ])
    XLSX.utils.book_append_sheet(wb, wsCA, 'CA par jour')

    XLSX.writeFile(wb, `finances-roma-${range.start}.xlsx`)
  }

  const exportPDF = async () => {
    setShowExport(false)
    const jsPDF = (await import('jspdf')).default
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('Rapport Finances - Roma Pizzeria', 20, 20)
    doc.setFontSize(12)
    doc.text(`Période: ${range.start} → ${range.end}`, 20, 35)
    doc.setFontSize(10)
    doc.text(`CA total: ${caTotal.toFixed(2)}€`, 20, 50)
    doc.text(`Commandes: ${nbCommandes}`, 20, 60)
    doc.text(`Ticket moyen: ${ticketMoyen.toFixed(2)}€`, 20, 70)
    doc.save(`finances-roma-${range.start}.pdf`)
  }

  const PERIODE_OPTIONS: [Periode, string][] = [
    ['jour', "Aujourd'hui"],
    ['hier', 'Hier'],
    ['semaine', 'Cette semaine'],
    ['semaine_derniere', 'Semaine dernière'],
    ['mois', 'Ce mois'],
    ['mois_dernier', 'Mois dernier'],
    ['annee', 'Cette année'],
    ['custom', 'Personnalisé'],
  ]

  const growthPct = (a: number, b: number) => b > 0 ? ((a - b) / b * 100).toFixed(1) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Finances</h1>
        <div className="flex gap-2">
          <button onClick={() => setCompareMode(m => !m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${compareMode ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-[#555] border-[#E0D5C5] hover:bg-[#F0EBE0]'}`}>
            ⚖️ Comparer deux périodes
          </button>
          <div className="relative" ref={exportRef}>
            <button onClick={() => setShowExport(s => !s)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-[#E0D5C5] text-[#555] hover:bg-[#F0EBE0]">
              📥 Exporter ▾
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-[#E0D5C5] rounded-lg shadow-lg z-10 min-w-[140px]">
                <button onClick={exportExcel} className="block w-full text-left px-4 py-2 text-sm hover:bg-[#F0EBE0]">📊 Excel</button>
                <button onClick={exportPDF} className="block w-full text-left px-4 py-2 text-sm hover:bg-[#F0EBE0]">📄 PDF</button>
                <button onClick={exportCSV} className="block w-full text-left px-4 py-2 text-sm hover:bg-[#F0EBE0]">📋 CSV</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sélecteurs de période */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {PERIODE_OPTIONS.map(([val, label]) => (
          <button key={val} onClick={() => setPeriode(val)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${periode === val ? 'bg-[#B71C1C] text-white border-[#B71C1C]' : 'bg-white text-[#555] border-[#E0D5C5] hover:bg-[#F0EBE0]'}`}>
            {label}
          </button>
        ))}
      </div>

      {periode === 'custom' && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-white border border-[#E0D5C5] rounded-lg w-fit">
          <label className="text-sm text-[#555]">Du</label>
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
            className="px-3 py-1.5 text-sm border border-[#E0D5C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
          <label className="text-sm text-[#555]">au</label>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
            className="px-3 py-1.5 text-sm border border-[#E0D5C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B5E20]" />
        </div>
      )}

      {/* Comparaison de périodes */}
      {compareMode && (
        <div className="mb-6 p-4 bg-white border border-[#E0D5C5] rounded-xl">
          <h2 className="text-base font-semibold mb-3 text-[#1A1A1A]">Comparer deux périodes</h2>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <label className="text-sm text-[#555]">Période 2 — Du</label>
            <input type="date" value={period2.start} onChange={e => setPeriod2(p => ({ ...p, start: e.target.value }))}
              className="px-3 py-1.5 text-sm border border-[#E0D5C5] rounded-lg focus:outline-none" />
            <label className="text-sm text-[#555]">au</label>
            <input type="date" value={period2.end} onChange={e => setPeriod2(p => ({ ...p, end: e.target.value }))}
              className="px-3 py-1.5 text-sm border border-[#E0D5C5] rounded-lg focus:outline-none" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'CA total', v1: caTotal, v2: kpi2.ca, fmt: (v: number) => v.toFixed(2) + ' €' },
              { label: 'Commandes', v1: nbCommandes, v2: kpi2.commandes, fmt: (v: number) => String(v) },
              { label: 'Ticket moyen', v1: ticketMoyen, v2: kpi2.ticketMoyen, fmt: (v: number) => v.toFixed(2) + ' €' },
            ].map(({ label, v1, v2, fmt }) => {
              const g = growthPct(v1, v2)
              return (
                <div key={label} className="bg-[#F9F6F1] rounded-lg p-3">
                  <div className="text-xs text-[#555] mb-2">{label}</div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 text-center">
                      <div className="text-xs text-[#888] mb-1">Période 1</div>
                      <div className="font-bold text-[#1B5E20]">{fmt(v1)}</div>
                    </div>
                    <div className="text-[#CCC] pb-1">vs</div>
                    <div className="flex-1 text-center">
                      <div className="text-xs text-[#888] mb-1">Période 2</div>
                      <div className="font-bold text-[#555]">{fmt(v2)}</div>
                    </div>
                  </div>
                  {g !== null && (
                    <div className={`text-center text-xs font-bold mt-2 ${parseFloat(g) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {parseFloat(g) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(g))}%
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loading ? <div className="text-[#555]">Chargement...</div> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5]">
              <div className="text-3xl font-bold text-green-700 mb-1">{caTotal.toFixed(2)} €</div>
              <div className="text-sm text-[#555]">CA total</div>
            </div>
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5]">
              <div className="text-3xl font-bold text-[#D4A843] mb-1">{nbCommandes}</div>
              <div className="text-sm text-[#555]">Commandes</div>
            </div>
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5]">
              <div className="text-3xl font-bold text-[#1A1A1A] mb-1">{ticketMoyen.toFixed(2)} €</div>
              <div className="text-sm text-[#555]">Ticket moyen</div>
            </div>
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5]">
              <div className="text-sm text-[#555]">Période</div>
              <div className="text-sm font-medium text-[#1A1A1A] mt-1">{range.start} → {range.end}</div>
            </div>
          </div>

          {/* Graphique 1: CA par jour */}
          <div className="rounded-xl p-6 bg-white border border-[#E0D5C5] mb-6">
            <h2 className="text-base font-semibold mb-6 text-[#1A1A1A]">CA par jour</h2>
            <div className="flex items-end gap-2" style={{ height: 160 }}>
              {bars.map(bar => (
                <div key={bar.date} className="flex flex-col items-center flex-1 gap-1">
                  <div className="text-xs text-[#555]" style={{ fontSize: 10 }}>{bar.ca > 0 ? `${bar.ca.toFixed(0)}€` : ''}</div>
                  <div className="w-full rounded-t bg-[#2E7D32]" style={{ height: `${Math.max((bar.ca / maxBar) * 120, bar.ca > 0 ? 4 : 0)}px`, opacity: 0.8 }} />
                  <div className="text-[#555] text-center" style={{ fontSize: 9 }}>{bar.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Graphique 3: Évolution mensuelle 12 mois */}
          <div className="rounded-xl p-6 bg-white border border-[#E0D5C5] mb-6">
            <h2 className="text-base font-semibold mb-6 text-[#1A1A1A]">Évolution mensuelle (12 mois)</h2>
            <div className="flex items-end gap-1" style={{ height: 160 }}>
              {monthBars.map((bar, i) => (
                <div key={i} className="flex flex-col items-center flex-1 gap-1">
                  <div className="text-xs text-[#555]" style={{ fontSize: 9 }}>{bar.ca > 0 ? `${bar.ca.toFixed(0)}€` : ''}</div>
                  <div className="w-full rounded-t bg-[#1B5E20]" style={{ height: `${Math.max((bar.ca / maxMonth) * 120, bar.ca > 0 ? 4 : 0)}px`, opacity: 0.85 }} />
                  <div className="text-[#555] text-center" style={{ fontSize: 8 }}>{bar.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Graphique 4: Top 10 articles */}
          {top10.length > 0 && (
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5] mb-6">
              <h2 className="text-base font-semibold mb-4 text-[#1A1A1A]">Top 10 articles les plus vendus</h2>
              {top10.map(item => (
                <div key={item.nom} className="flex items-center gap-3 mb-2">
                  <div className="text-sm text-right w-40 truncate text-[#1A1A1A]">{item.nom}</div>
                  <div className="flex-1 bg-[#F0EBE0] rounded-full h-6 relative">
                    <div className="h-6 bg-[#B71C1C] rounded-full" style={{ width: `${(item.qty / maxTop10) * 100}%` }} />
                    <span className="absolute right-2 top-0 h-6 flex items-center text-xs font-medium text-[#555]">{item.qty}x</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Graphique 5: Heures de pointe */}
          <div className="rounded-xl p-6 bg-white border border-[#E0D5C5] mb-6">
            <h2 className="text-base font-semibold mb-6 text-[#1A1A1A]">Heures de pointe</h2>
            <div className="flex items-end gap-1" style={{ height: 120 }}>
              {hourBars.map(bar => (
                <div key={bar.hour} className="flex flex-col items-center flex-1 gap-1">
                  <div className="w-full rounded-t bg-[#B71C1C]" style={{ height: `${Math.max((bar.ca / maxHour) * 100, bar.ca > 0 ? 3 : 0)}px`, opacity: 0.7 }} />
                  <div className="text-[#555] text-center" style={{ fontSize: 9 }}>{bar.hour}h</div>
                </div>
              ))}
            </div>
          </div>

          {/* Graphique 2: CA par catégorie */}
          {catBars.length > 0 && (
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5] mb-6">
              <h2 className="text-base font-semibold mb-4 text-[#1A1A1A]">CA par catégorie</h2>
              <div className="space-y-3">
                {catBars.map(c => (
                  <div key={c.nom}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#1A1A1A]">{c.nom}</span>
                      <span className="font-bold text-[#1B5E20]">{c.ca.toFixed(2)} €</span>
                    </div>
                    <div className="w-full h-2 bg-[#F0EBE0] rounded-full">
                      <div className="h-2 bg-[#1B5E20] rounded-full" style={{ width: `${(c.ca / maxCat) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Graphique 6: Comparaison 2 périodes côte à côte */}
          {compareMode && (kpi2.ca > 0 || caTotal > 0) && (
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5] mb-6">
              <h2 className="text-base font-semibold mb-4 text-[#1A1A1A]">Comparaison CA — Barres côte à côte</h2>
              <div className="flex items-end gap-8 justify-center" style={{ height: 180 }}>
                {[
                  { label: 'Période 1', val: caTotal, color: '#1B5E20' },
                  { label: 'Période 2', val: kpi2.ca, color: '#B71C1C' },
                ].map(item => {
                  const maxV = Math.max(caTotal, kpi2.ca, 1)
                  return (
                    <div key={item.label} className="flex flex-col items-center gap-2 w-32">
                      <div className="text-sm font-bold" style={{ color: item.color }}>{item.val.toFixed(2)} €</div>
                      <div className="w-full rounded-t" style={{
                        height: `${Math.max((item.val / maxV) * 140, item.val > 0 ? 4 : 0)}px`,
                        backgroundColor: item.color, opacity: 0.85
                      }} />
                      <div className="text-sm text-[#555]">{item.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
