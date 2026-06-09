'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type StatutCmd = 'en_attente' | 'en_preparation' | 'prete' | 'payee' | 'annulee'
type TypeCmd = 'sur_place' | 'a_emporter'

interface Commande {
  id: string
  numero: string
  type: TypeCmd
  statut: StatutCmd
  total: number
  created_at: string
  table_numero?: number
}

const STATUT_LABELS: Record<StatutCmd, { label: string; bg: string; color: string }> = {
  en_attente: { label: 'En attente', bg: 'rgba(212,168,67,0.2)', color: '#D4A843' },
  en_preparation: { label: 'En cuisine', bg: 'rgba(33,150,243,0.2)', color: '#42a5f5' },
  prete: { label: 'Prête', bg: 'rgba(46,125,50,0.2)', color: '#4caf50' },
  payee: { label: 'Payée', bg: 'rgba(100,100,100,0.2)', color: '#888' },
  annulee: { label: 'Annulée', bg: 'rgba(183,28,28,0.2)', color: '#ef5350' },
}

const NEXT_STATUT: Partial<Record<StatutCmd, { statut: StatutCmd; label: string }>> = {
  en_attente: { statut: 'en_preparation', label: '→ En cuisine' },
  en_preparation: { statut: 'prete', label: '→ Prête' },
  prete: { statut: 'payee', label: '→ Encaisser' },
}

const TABLE_COLORS: Record<string, string> = {}

export default function CommandesPage() {
  const router = useRouter()
  const [onglet, setOnglet] = useState<TypeCmd>('sur_place')
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCommandes = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('commandes')
        .select('*')
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false })
      if (error) throw error
      setCommandes(data ?? [])
    } catch (err) {
      console.error('Commandes fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role === 'roberto') { router.replace('/cuisine'); return }
    fetchCommandes()
  }, [router, fetchCommandes])

  useEffect(() => {
    const channel = supabase.channel('commandes-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, fetchCommandes)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchCommandes])

  const updateStatut = async (id: string, statut: StatutCmd) => {
    try {
      await supabase.from('commandes').update({ statut }).eq('id', id)
      await fetchCommandes()
    } catch (err) {
      console.error('Update error:', err)
    }
  }

  const commandesFiltrees = commandes.filter(c => c.type === onglet)

  // Tables pour sur place
  const tables = Array.from({ length: 12 }, (_, i) => {
    const num = i + 1
    const cmd = commandes.filter(c => c.type === 'sur_place' && c.table_numero === num && !['payee', 'annulee'].includes(c.statut))
    const statut = cmd.length === 0 ? 'libre' : cmd[0].statut
    return { num, statut, commande: cmd[0] }
  })

  const tableColor = (statut: string) => {
    if (statut === 'libre') return '#1a1a1a'
    if (statut === 'en_attente') return '#3a2a0a'
    if (statut === 'en_preparation') return '#0a2a3a'
    if (statut === 'prete') return '#0a3a0a'
    return '#1a1a1a'
  }
  void TABLE_COLORS

  return (
    <div className="p-8" style={{ color: '#F5F5F5' }}>
      <h1 className="text-2xl font-bold mb-6">Commandes</h1>

      {/* Onglets */}
      <div className="flex gap-2 mb-6">
        {([['sur_place', '🍽 Sur place'], ['a_emporter', '🥡 À emporter']] as [TypeCmd, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setOnglet(val)}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: onglet === val ? '#B71C1C' : '#242424',
              color: onglet === val ? '#fff' : '#888',
              border: onglet === val ? '1px solid #B71C1C' : '1px solid #333',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500">Chargement...</div>
      ) : onglet === 'sur_place' ? (
        <>
          {/* Grille tables */}
          <div className="grid grid-cols-4 xl:grid-cols-6 gap-3 mb-8">
            {tables.map(t => (
              <div
                key={t.num}
                className="rounded-xl p-4 flex flex-col items-center gap-1"
                style={{ background: tableColor(t.statut), border: '1px solid #333' }}
              >
                <div className="text-2xl font-bold" style={{ color: t.statut === 'libre' ? '#555' : '#D4A843' }}>T{t.num}</div>
                <div className="text-xs" style={{ color: t.statut === 'libre' ? '#444' : STATUT_LABELS[t.statut as StatutCmd]?.color ?? '#888' }}>
                  {t.statut === 'libre' ? 'Libre' : STATUT_LABELS[t.statut as StatutCmd]?.label ?? t.statut}
                </div>
              </div>
            ))}
          </div>

          {/* Liste commandes sur place */}
          <CommandesListe commandes={commandesFiltrees} onUpdate={updateStatut} />
        </>
      ) : (
        <CommandesListe commandes={commandesFiltrees} onUpdate={updateStatut} />
      )}
    </div>
  )
}

function CommandesListe({ commandes, onUpdate }: { commandes: Commande[]; onUpdate: (id: string, statut: StatutCmd) => void }) {
  if (commandes.length === 0) return <div className="text-gray-500">Aucune commande.</div>

  return (
    <div className="space-y-3">
      {commandes.map(cmd => {
        const s = STATUT_LABELS[cmd.statut] ?? STATUT_LABELS.en_attente
        const next = NEXT_STATUT[cmd.statut]
        return (
          <div key={cmd.id} className="rounded-xl p-4 flex items-center justify-between" style={{ background: '#242424', border: '1px solid #2a2a2a' }}>
            <div className="flex items-center gap-4">
              <div className="text-xl font-bold" style={{ color: '#D4A843' }}>#{cmd.numero}</div>
              {cmd.table_numero && <div className="text-sm text-gray-400">Table {cmd.table_numero}</div>}
              <div className="text-sm text-gray-400">{new Date(cmd.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
              <span className="px-2 py-1 rounded text-xs" style={{ background: s.bg, color: s.color }}>{s.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="font-medium">{cmd.total?.toFixed(2)} €</div>
              {next && (
                <button
                  onClick={() => onUpdate(cmd.id, next.statut)}
                  className="px-3 py-1 rounded text-xs font-medium"
                  style={{ background: 'rgba(183,28,28,0.2)', color: '#ef9090', border: '1px solid rgba(183,28,28,0.3)' }}
                >
                  {next.label}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
