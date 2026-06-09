'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type Periode = 'jour' | 'semaine' | 'mois'

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

function getRange(periode: Periode): { start: string; end: string; days: number } {
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  if (periode === 'jour') return { start: end, end, days: 1 }
  if (periode === 'semaine') {
    const s = new Date(now)
    s.setDate(now.getDate() - 6)
    return { start: s.toISOString().split('T')[0], end, days: 7 }
  }
  const s = new Date(now)
  s.setDate(now.getDate() - 29)
  return { start: s.toISOString().split('T')[0], end, days: 30 }
}

function getMoisPrecedent(): { start: string; end: string } {
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  return {
    start: lastMonth.toISOString().split('T')[0],
    end: lastMonthEnd.toISOString().split('T')[0],
  }
}

export default function FinancesPage() {
  const router = useRouter()
  const [periode, setPeriode] = useState<Periode>('semaine')
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading, setLoading] = useState(true)
  const [bars, setBars] = useState<DayBar[]>([])
  const [hourBars, setHourBars] = useState<HourBar[]>([])
  const [catBars, setCatBars] = useState<CatBar[]>([])
  const [caPrec, setCaPrec] = useState(0)

  const fetchData = useCallback(async (p: Periode) => {
    setLoading(true)
    try {
      const { start, end, days } = getRange(p)
      const { data: cmdData, error: cmdErr } = await supabase
        .from('commandes').select('id, total, created_at')
        .eq('statut', 'payee').gte('created_at', start + 'T00:00:00').lte('created_at', end + 'T23:59:59')
      if (cmdErr) throw cmdErr
      setCommandes(cmdData ?? [])

      // Barres par jour
      const daysArr: DayBar[] = []
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date()
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

      // Mois précédent pour comparaison
      const { start: ps, end: pe } = getMoisPrecedent()
      const { data: prevData } = await supabase.from('commandes').select('total').eq('statut', 'payee')
        .gte('created_at', ps + 'T00:00:00').lte('created_at', pe + 'T23:59:59')
      setCaPrec((prevData ?? []).reduce((s, c) => s + (c.total || 0), 0))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role !== 'monica') { router.replace('/dashboard'); return }
    fetchData(periode)
  }, [router, fetchData, periode])

  const ca = commandes.reduce((s, c) => s + (c.total || 0), 0)
  const nbCmd = commandes.length
  const ticketMoyen = nbCmd > 0 ? ca / nbCmd : 0
  const articleCounts: Record<string, number> = {}
  commandes.forEach(c => { articleCounts['total'] = (articleCounts['total'] ?? 0) + (c.total || 0) })

  const maxBar = Math.max(...bars.map(b => b.ca), 1)
  const maxHour = Math.max(...hourBars.map(b => b.ca), 1)
  const maxCat = Math.max(...catBars.map(b => b.ca), 1)

  const caCurrentMonth = periode === 'mois' ? ca : 0
  const evolution = caPrec > 0 && caCurrentMonth > 0 ? ((caCurrentMonth - caPrec) / caPrec * 100).toFixed(1) : null

  const exportCSV = () => {
    const header = 'ID,Date,Total\n'
    const rows = commandes.map(c => `${c.id},${c.created_at},${c.total}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `roma-finances-${periode}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Finances</h1>
        <button onClick={exportCSV} className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-[#E0D5C5] text-[#555] hover:bg-[#F0EBE0]">
          ↓ Exporter CSV
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {([['jour', "Aujourd'hui"], ['semaine', 'Cette semaine'], ['mois', 'Ce mois']] as [Periode, string][]).map(([val, label]) => (
          <button key={val} onClick={() => setPeriode(val)}
            className={`px-5 py-2 rounded-lg text-sm font-medium border transition-all ${periode === val ? 'bg-[#B71C1C] text-white border-[#B71C1C]' : 'bg-white text-[#555] border-[#E0D5C5] hover:bg-[#F0EBE0]'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-[#555]">Chargement...</div> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5]">
              <div className="text-3xl font-bold text-green-700 mb-1">{ca.toFixed(2)} €</div>
              <div className="text-sm text-[#555]">CA total</div>
              {evolution !== null && (
                <div className={`text-xs font-bold mt-1 ${parseFloat(evolution) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {parseFloat(evolution) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(evolution))}% vs mois préc.
                </div>
              )}
            </div>
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5]">
              <div className="text-3xl font-bold text-[#D4A843] mb-1">{nbCmd}</div>
              <div className="text-sm text-[#555]">Commandes</div>
            </div>
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5]">
              <div className="text-3xl font-bold text-[#1A1A1A] mb-1">{ticketMoyen.toFixed(2)} €</div>
              <div className="text-sm text-[#555]">Ticket moyen</div>
            </div>
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5]">
              <div className="text-xl font-bold text-[#B71C1C] mb-1">{caPrec.toFixed(2)} €</div>
              <div className="text-sm text-[#555]">Mois précédent</div>
            </div>
          </div>

          {/* Graphique CA par jour */}
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

          {/* Heures de pointe */}
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

          {/* CA par catégorie */}
          {catBars.length > 0 && (
            <div className="rounded-xl p-6 bg-white border border-[#E0D5C5]">
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
        </>
      )}
    </div>
  )
}
