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

interface LigneCommande {
  article_nom: string
  quantite: number
  commande_id: string
}

interface DayBar {
  label: string
  date: string
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

export default function FinancesPage() {
  const router = useRouter()
  const [periode, setPeriode] = useState<Periode>('semaine')
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [lignes, setLignes] = useState<LigneCommande[]>([])
  const [loading, setLoading] = useState(true)
  const [bars, setBars] = useState<DayBar[]>([])

  const fetchData = useCallback(async (p: Periode) => {
    setLoading(true)
    try {
      const { start, end, days } = getRange(p)
      const { data: cmdData, error: cmdErr } = await supabase
        .from('commandes')
        .select('id, total, created_at')
        .eq('statut', 'payee')
        .gte('created_at', start + 'T00:00:00')
        .lte('created_at', end + 'T23:59:59')
      if (cmdErr) throw cmdErr
      setCommandes(cmdData ?? [])

      const ids = (cmdData ?? []).map(c => c.id)
      if (ids.length > 0) {
        const { data: lgData } = await supabase
          .from('lignes_commande')
          .select('article_nom, quantite, commande_id')
          .in('commande_id', ids)
        setLignes(lgData ?? [])
      } else {
        setLignes([])
      }

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

  // Article le plus commandé
  const articleCounts: Record<string, number> = {}
  lignes.forEach(l => { articleCounts[l.article_nom] = (articleCounts[l.article_nom] ?? 0) + l.quantite })
  const topArticle = Object.entries(articleCounts).sort((a, b) => b[1] - a[1])[0]

  const maxBar = Math.max(...bars.map(b => b.ca), 1)

  const exportCSV = () => {
    const header = 'ID,Date,Total\n'
    const rows = commandes.map(c => `${c.id},${c.created_at},${c.total}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roma-finances-${periode}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8" style={{ color: '#F5F5F5' }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Finances</h1>
        <button onClick={exportCSV} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#242424', border: '1px solid #333', color: '#888' }}>
          ↓ Exporter CSV
        </button>
      </div>

      {/* Sélecteur période */}
      <div className="flex gap-2 mb-6">
        {([['jour', "Aujourd'hui"], ['semaine', 'Cette semaine'], ['mois', 'Ce mois']] as [Periode, string][]).map(([val, label]) => (
          <button key={val} onClick={() => setPeriode(val)}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: periode === val ? '#B71C1C' : '#242424', color: periode === val ? '#fff' : '#888', border: periode === val ? '1px solid #B71C1C' : '1px solid #333' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-gray-500">Chargement...</div> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl p-6" style={{ background: '#242424' }}>
              <div className="text-3xl font-bold text-green-400 mb-1">{ca.toFixed(2)} €</div>
              <div className="text-sm text-gray-400">CA total</div>
            </div>
            <div className="rounded-xl p-6" style={{ background: '#242424' }}>
              <div className="text-3xl font-bold text-yellow-500 mb-1">{nbCmd}</div>
              <div className="text-sm text-gray-400">Commandes</div>
            </div>
            <div className="rounded-xl p-6" style={{ background: '#242424' }}>
              <div className="text-3xl font-bold" style={{ color: '#F5F5F5' }}>{ticketMoyen.toFixed(2)} €</div>
              <div className="text-sm text-gray-400">Ticket moyen</div>
            </div>
            <div className="rounded-xl p-6" style={{ background: '#242424' }}>
              <div className="text-xl font-bold text-red-400 mb-1 truncate">{topArticle ? topArticle[0] : '—'}</div>
              <div className="text-sm text-gray-400">Article top {topArticle ? `(×${topArticle[1]})` : ''}</div>
            </div>
          </div>

          {/* Graphique */}
          <div className="rounded-xl p-6" style={{ background: '#242424' }}>
            <h2 className="text-base font-semibold mb-6 text-gray-300">CA par jour</h2>
            <div className="flex items-end gap-2" style={{ height: 160 }}>
              {bars.map(bar => (
                <div key={bar.date} className="flex flex-col items-center flex-1 gap-1">
                  <div className="text-xs text-gray-400" style={{ fontSize: 10 }}>{bar.ca > 0 ? `${bar.ca.toFixed(0)}€` : ''}</div>
                  <div className="w-full rounded-t" style={{ height: `${Math.max((bar.ca / maxBar) * 120, bar.ca > 0 ? 4 : 0)}px`, background: '#2E7D32', opacity: 0.8 }} />
                  <div className="text-gray-500 text-center" style={{ fontSize: 9 }}>{bar.label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
