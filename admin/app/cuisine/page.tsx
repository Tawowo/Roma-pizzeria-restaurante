'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface LigneCommande {
  id: string
  article_nom: string
  quantite: number
}

interface Commande {
  id: string
  numero: string
  type: 'sur_place' | 'a_emporter'
  statut: string
  created_at: string
  table_numero?: number
  lignes_commande: LigneCommande[]
}

function useTimer() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])
  return tick
}

function elapsed(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
}

function formatElapsed(createdAt: string): string {
  const totalSeconds = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function cardBg(createdAt: string): string {
  const min = elapsed(createdAt)
  if (min < 10) return '#1a3a1a'
  if (min < 20) return '#3a2a0a'
  return '#3a0a0a'
}

export default function CuisinePage() {
  const router = useRouter()
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading, setLoading] = useState(true)
  const tick = useTimer()

  const fetchCommandes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('commandes')
        .select('*, lignes_commande(*)')
        .eq('statut', 'en_preparation')
        .order('created_at')
      if (error) throw error
      setCommandes(data ?? [])
    } catch (err) {
      console.error('Cuisine fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role !== 'roberto' && session.role !== 'monica') { router.replace('/reservations'); return }
    fetchCommandes()
  }, [router, fetchCommandes])

  useEffect(() => {
    const channel = supabase.channel('cuisine-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, fetchCommandes)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchCommandes])

  const marquerPrete = async (id: string) => {
    try {
      await supabase.from('commandes').update({ statut: 'prete' }).eq('id', id)
      await fetchCommandes()
    } catch (err) {
      console.error('Update error:', err)
    }
  }

  // tick used to force re-render for timers
  void tick

  return (
    <div style={{ background: '#0A0A0A', minHeight: '100vh', color: '#F5F5F5', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ fontFamily: 'serif', fontSize: 28, fontStyle: 'italic', color: '#D4A843' }}>Roma</div>
          <div style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#555' }}>Cuisine</div>
        </div>
        <button
          onClick={() => router.push('/login')}
          style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #333', borderRadius: 6, color: '#555', cursor: 'pointer', fontSize: 12 }}
        >
          ← Retour
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#555' }}>Chargement...</div>
      ) : commandes.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 80, color: '#555', fontSize: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div>Aucune commande en préparation</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {commandes.map(cmd => (
            <div key={cmd.id} style={{ background: cardBg(cmd.created_at), borderRadius: 16, padding: 24, border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Numéro */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 56, fontWeight: 700, color: '#D4A843', lineHeight: 1 }}>#{cmd.numero}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: '#888', marginBottom: 4 }}>
                    {cmd.type === 'sur_place' ? '🍽 TABLE' : '🥡 À EMPORTER'}
                  </div>
                  {cmd.type === 'sur_place' && cmd.table_numero && (
                    <div style={{ fontSize: 14, color: '#F5F5F5' }}>Table {cmd.table_numero}</div>
                  )}
                </div>
              </div>

              {/* Timer */}
              <div style={{ fontSize: 24, fontFamily: 'monospace', color: elapsed(cmd.created_at) > 20 ? '#ef5350' : elapsed(cmd.created_at) > 10 ? '#D4A843' : '#4caf50' }}>
                ⏱ {formatElapsed(cmd.created_at)}
              </div>

              {/* Articles */}
              <div style={{ flex: 1, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
                {cmd.lignes_commande.map(l => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}>
                    <span>{l.article_nom}</span>
                    <span style={{ color: '#D4A843', fontWeight: 700 }}>×{l.quantite}</span>
                  </div>
                ))}
              </div>

              {/* Bouton Prête */}
              <button
                onClick={() => marquerPrete(cmd.id)}
                style={{ width: '100%', padding: '14px', background: '#2E7D32', border: 'none', borderRadius: 10, color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s' }}
              >
                ✅ PRÊTE
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
