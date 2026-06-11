'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, clearSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface LigneCommande {
  id: string
  article_nom: string
  quantite: number
  taille?: string
  commentaire?: string
  statut?: string
  ajout_apres?: boolean
  created_at?: string
  pour_cuisine?: boolean
  categorie_nom?: string
}

interface Commande {
  id: string
  numero_commande?: number
  type: 'sur_place' | 'a_emporter'
  statut: string
  created_at: string
  table_numero?: number
  zone?: string
  nom_client?: string
  notes?: string
  lignes_commande: LigneCommande[]
}

const CATEGORIES_PAS_CUISINE = [
  'boissons', 'vins', 'vins blancs', 'vins rouges', 'vins rosés',
  'pétillants', 'apéritifs', 'digestifs', 'boisson', 'vin',
  'bières', 'softs', 'eaux'
]

const BOISSONS_NOMS = ['coca', 'pepsi', 'eau', 'bière', 'sprite', 'fanta', 'jus', 'limonade', 'café', 'thé', 'prosecco', 'lambrusco', 'chianti', 'vermentino', 'chiaretto', 'montepulciano', 'limoncello', 'disarano', 'aperol', 'garonne']

function isArticleCuisine(l: LigneCommande): boolean {
  if ('pour_cuisine' in l && l.pour_cuisine === false) return false
  const catNom = (l.categorie_nom ?? '').toLowerCase()
  if (catNom && CATEGORIES_PAS_CUISINE.some(c => catNom.includes(c))) return false
  const nomArt = l.article_nom.toLowerCase()
  if (BOISSONS_NOMS.some(b => nomArt.includes(b))) return false
  return true
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

function cardStyle(cmd: Commande, urgents: Set<string>): React.CSSProperties {
  const isUrgent = urgents.has(cmd.id)
  const isEmporter = cmd.type === 'a_emporter'

  if (isUrgent) return { background: '#2a1500', border: '2px solid #D4A843', borderRadius: 16, padding: 24 }
  if (isEmporter) return { background: '#1a1500', border: '1px solid #F57F17', borderRadius: 16, padding: 24 }
  return { background: cardBg(cmd.created_at), border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }
}

export default function CuisinePage() {
  const router = useRouter()
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading, setLoading] = useState(true)
  const [urgents, setUrgents] = useState<Set<string>>(new Set())
  const [soundOn, setSoundOn] = useState(true)
  const prevCountRef = useRef(0)
  const tick = useTimer()

  const fetchCommandes = useCallback(async () => {
    try {
      const session = getSession()
      if (!session) { router.replace('/login'); return }
      const { data, error } = await supabase
        .from('commandes')
        .select('*, lignes_commande(*)')
        .in('statut', ['en_cours', 'en_preparation'])
        .order('created_at')
      if (error) throw error

      // Filtrer les lignes : exclure boissons/vins, garder uniquement envoye_cuisine (ou sans statut)
      const commandesFiltrees = (data ?? []).map((cmd: Commande) => ({
        ...cmd,
        lignes_commande: cmd.lignes_commande.filter((l: LigneCommande) => {
          if (!isArticleCuisine(l)) return false
          if (l.statut && l.statut !== 'envoye_cuisine') return false
          return true
        })
      })).filter((cmd: Commande) => cmd.lignes_commande.length > 0)

      setCommandes(commandesFiltrees)
    } catch (err) {
      console.error('Cuisine fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    fetchCommandes()
  }, [router, fetchCommandes])

  useEffect(() => {
    const channel = supabase.channel('cuisine-realtime-v3')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'commandes' }, () => { fetchCommandes() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'commandes' }, () => { fetchCommandes() })
      // Écouter les nouvelles lignes (ajout articles sur table occupée)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lignes_commande' }, () => { fetchCommandes() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchCommandes])

  // Bip à chaque nouveau ticket
  useEffect(() => {
    if (soundOn && commandes.length > prevCountRef.current) {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = 800
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
        osc.start(); osc.stop(ctx.currentTime + 0.3)
      } catch { /* audio may not be available */ }
    }
    prevCountRef.current = commandes.length
  }, [commandes.length, soundOn])

  const marquerPrete = async (cmd: Commande) => {
    try {
      // Mark all cuisine lines as pret
      const ligneIds = cmd.lignes_commande
        .filter(l => isArticleCuisine(l))
        .map(l => l.id)
      if (ligneIds.length > 0) {
        await supabase.from('lignes_commande').update({ statut: 'pret' }).in('id', ligneIds)
      }
      await supabase.from('commandes').update({ statut: 'pret_encaisser' }).eq('id', cmd.id)
      // Mettre la table en orange (pret_encaisser)
      if (cmd.table_numero) {
        await supabase
          .from('tables_restaurant')
          .update({ statut: 'pret_encaisser' })
          .eq('numero', cmd.table_numero)
      }
      await fetchCommandes()
    } catch (err) {
      console.error('Update error:', err)
    }
  }

  const toggleUrgent = (id: string) => {
    setUrgents(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filtrer les commandes (exclure boissons/vins) et trier (urgents en premier)
  // Lignes visibles: envoye_cuisine, ou pas de statut (rétrocompatibilité), exclure pret/servi
  // Les lignes sont déjà filtrées dans fetchCommandes — on affiche tout ce qui est dans cmd.lignes_commande
  const lignesCuisine = (cmd: Commande) => cmd.lignes_commande

  const commandesFiltrees = commandes.filter(cmd =>
    cmd.lignes_commande.length > 0
  )

  const commandesTri = [...commandesFiltrees].sort((a, b) => {
    const aUrgent = urgents.has(a.id) ? 0 : 1
    const bUrgent = urgents.has(b.id) ? 0 : 1
    if (aUrgent !== bUrgent) return aUrgent - bUrgent
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  // tick used to force re-render for timers
  void tick

  return (
    <div style={{ background: '#0A0A0A', minHeight: '100vh', color: '#F5F5F5' }}>
      {/* Header */}
      <div style={{ height: 48, background: '#1B5E20', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'serif', fontSize: 22, fontStyle: 'italic', color: '#D4A843', fontWeight: 700 }}>Roma</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase' }}>Cuisine</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Toggle son */}
          <button
            onClick={() => setSoundOn(v => !v)}
            style={{ padding: '4px 10px', background: soundOn ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.1)', border: `1px solid ${soundOn ? '#D4A843' : 'rgba(255,255,255,0.2)'}`, borderRadius: 6, color: soundOn ? '#D4A843' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 11 }}
          >
            {soundOn ? '🔔 Son ON' : '🔕 Son OFF'}
          </button>
          <button onClick={() => router.push('/reservations')}
            style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 11 }}>
            📅 Réservations
          </button>
          <button onClick={() => router.push('/commandes')}
            style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 11 }}>
            🛒 Commandes
          </button>
          <button onClick={() => { clearSession(); router.push('/login') }}
            style={{ padding: '4px 10px', background: 'rgba(183,28,28,0.3)', border: '1px solid rgba(183,28,28,0.5)', borderRadius: 6, color: 'rgba(255,100,100,0.9)', cursor: 'pointer', fontSize: 11 }}>
            🚪 Déconnexion
          </button>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ color: '#555' }}>Chargement...</div>
        ) : commandesTri.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 80, color: '#555', fontSize: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div>Aucune commande en préparation</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {commandesTri.map(cmd => (
              <div key={cmd.id} style={{ ...cardStyle(cmd, urgents), display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Numéro + Type */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 56, fontWeight: 700, color: '#EFC050', lineHeight: 1 }}>#{cmd.numero_commande}</div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: '#888' }}>
                      {cmd.type === 'sur_place'
                        ? `TABLE ${cmd.table_numero ?? ''} — ${(cmd.zone ?? 'RDC').toUpperCase()}`
                        : `À EMPORTER${cmd.nom_client ? ' — ' + cmd.nom_client.toUpperCase() : ''}`}
                    </div>
                    {cmd.type === 'a_emporter' && (
                      <span style={{ background: '#F57F17', color: '#000', fontWeight: 700, fontSize: 11, padding: '3px 8px', borderRadius: 4 }}>
                        📦 EMPORTER
                      </span>
                    )}
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

                {/* Articles (sans boissons/vins, envoye_cuisine seulement) */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, flex: 1 }}>
                  {lignesCuisine(cmd)
                    .map(l => (
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

                {/* Boutons URGENT + PRÊTE */}
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <button
                    onClick={() => toggleUrgent(cmd.id)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 8,
                      background: urgents.has(cmd.id) ? '#D4A843' : 'rgba(212,168,67,0.2)',
                      border: '1px solid #D4A843', color: urgents.has(cmd.id) ? '#000' : '#D4A843',
                      cursor: 'pointer', fontWeight: 700, fontSize: 14
                    }}
                  >
                    {urgents.has(cmd.id) ? '⚠️ URGENT ✓' : '⚠️ URGENT'}
                  </button>
                  <button
                    onClick={() => marquerPrete(cmd)}
                    style={{ flex: 1, padding: '10px', background: '#2E7D32', border: 'none', borderRadius: 8, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ✅ PRÊTE
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
