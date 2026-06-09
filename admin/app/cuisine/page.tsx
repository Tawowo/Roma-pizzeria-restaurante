'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface LigneCommande {
  id: string
  article_nom: string
  quantite: number
  taille?: string
  commentaire?: string
  ajout_apres?: boolean
  created_at?: string
}

interface Commande {
  id: string
  numero: string
  type: 'sur_place' | 'a_emporter'
  statut: string
  created_at: string
  table_numero?: number
  zone?: string
  nom_client?: string
  notes?: string
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

function timerColor(createdAt: string): string {
  const min = elapsed(createdAt)
  if (min < 10) return '#4caf50'
  if (min < 20) return '#D4A843'
  return '#ef5350'
}

function isAjoutApres(ligne: LigneCommande, commandeCreatedAt: string): boolean {
  if (ligne.ajout_apres) return true
  if (ligne.created_at) {
    const diff = new Date(ligne.created_at).getTime() - new Date(commandeCreatedAt).getTime()
    return diff > 2 * 60 * 1000
  }
  return false
}

export default function CuisinePage() {
  const router = useRouter()
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading, setLoading] = useState(true)
  const tick = useTimer()

  const fetchCommandes = useCallback(async () => {
    try {
      const session = getSession()
      if (!session) { router.replace('/login'); return }
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
  }, [router])

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
    <div style={{ background: '#0A0A0A', minHeight: '100vh', color: '#F5F5F5' }}>
      {/* Header minimal */}
      <div style={{ height: 48, background: '#1B5E20', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'serif', fontSize: 22, fontStyle: 'italic', color: '#D4A843', fontWeight: 700 }}>Roma</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase' }}>Cuisine</span>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 12 }}
        >
          ← Dashboard
        </button>
      </div>

      <div style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ color: '#555' }}>Chargement...</div>
        ) : commandes.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 80, color: '#555', fontSize: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div>Aucune commande en préparation</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {commandes.map(cmd => (
              <div key={cmd.id} style={{ background: cardBg(cmd.created_at), borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Numéro + Type */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 56, fontWeight: 700, color: '#EFC050', lineHeight: 1 }}>#{cmd.numero}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: '#888', marginBottom: 4 }}>
                      {cmd.type === 'sur_place'
                        ? `TABLE ${cmd.table_numero ?? ''} — ${(cmd.zone ?? 'RDC').toUpperCase()}`
                        : `À EMPORTER${cmd.nom_client ? ' — ' + cmd.nom_client.toUpperCase() : ''}`}
                    </div>
                  </div>
                </div>

                {/* Nom client */}
                {cmd.nom_client && (
                  <div style={{ fontSize: 20, color: '#F5F5F5', fontWeight: 600 }}>{cmd.nom_client}</div>
                )}

                {/* Heure + Timer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#666' }}>
                    {new Date(cmd.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ fontSize: 24, fontFamily: 'monospace', color: timerColor(cmd.created_at), fontWeight: 700 }}>
                    ⏱ {formatElapsed(cmd.created_at)}
                  </span>
                </div>

                {/* Articles */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, flex: 1 }}>
                  {cmd.lignes_commande.map(l => (
                    <div key={l.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#D4A843', fontWeight: 700, fontSize: 18 }}>×{l.quantite}</span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: '#F5F5F5', textTransform: 'uppercase', flex: 1 }}>{l.article_nom}</span>
                        {l.taille && <span style={{ fontSize: 12, color: '#888', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>{l.taille}</span>}
                        {isAjoutApres(l, cmd.created_at) && (
                          <span style={{ fontSize: 11, background: '#D4A843', color: '#000', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>AJOUT</span>
                        )}
                      </div>
                      {l.commentaire && (
                        <div style={{ fontSize: 13, color: '#ef5350', marginTop: 2, paddingLeft: 32 }}>⚠ {l.commentaire}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Notes spéciales */}
                {cmd.notes && (
                  <div style={{ background: 'rgba(183,28,28,0.3)', border: '1px solid rgba(183,28,28,0.5)', borderRadius: 8, padding: 10, fontSize: 13, color: '#ef9090' }}>
                    ⚠️ {cmd.notes}
                  </div>
                )}

                {/* Bouton Prête */}
                <button
                  onClick={() => marquerPrete(cmd.id)}
                  style={{ width: '100%', padding: '14px', background: '#2E7D32', border: 'none', borderRadius: 10, color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer' }}
                >
                  ✅ PRÊTE
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
