'use client'
// v2-email-fix
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, clearSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface LigneCommande {
  id: string
  commande_id: string
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
  heure_retrait?: string
  telephone?: string
  email?: string
  lignes_commande: LigneCommande[]
}

function formatHeure(h: string): string {
  const time = h.includes('T') ? h.split('T')[1] : h
  const [hh, mm] = time.substring(0, 5).split(':')
  return `${hh}h${mm}`
}

function formatZone(zone?: string): string {
  if (!zone) return 'RDC'
  const z = zone.toLowerCase()
  if (z === 'etage' || z === 'étage') return 'ÉTAGE'
  if (z === 'terrasse') return 'TERRASSE'
  return 'RDC'
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
  if (isUrgent) return { background: '#2a1500', border: '2px solid #D4A843', borderRadius: 16, padding: 24 }
  if (cmd.type === 'a_emporter') return { background: '#1B5E20', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 24 }
  return { background: '#B71C1C', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 24 }
}

function renderCard(
  cmd: Commande,
  urgents: Set<string>,
  toggleUrgent: (id: string) => void,
  marquerPrete: (cmd: Commande) => void,
  isAjoutApres: (l: LigneCommande, at: string) => boolean,
) {
  const displayNum = cmd.type === 'a_emporter'
    ? `E${cmd.numero_commande}`
    : `T${cmd.table_numero ?? ''}`
  return (
    <div key={cmd.id} style={{ ...cardStyle(cmd, urgents), display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Numéro + Type */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 48, fontWeight: 700, color: '#EFC050', lineHeight: 1 }}>{displayNum}</div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, color: cmd.type === 'a_emporter' ? '#F5F5F5' : '#888', fontWeight: cmd.type === 'a_emporter' ? 700 : 400 }}>
            {cmd.type === 'sur_place'
              ? formatZone(cmd.zone)
              : (cmd.nom_client ? cmd.nom_client.toUpperCase() : '')}
          </div>
        </div>
      </div>

      {/* Heure retrait (à emporter uniquement) */}
      {cmd.type === 'a_emporter' && cmd.heure_retrait && (
        <div style={{ fontSize: 22, fontWeight: 900, color: '#F57F17', fontFamily: 'monospace', letterSpacing: 2 }}>
          ⏰ {formatHeure(cmd.heure_retrait)}
        </div>
      )}

      {/* Articles */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, flex: 1 }}>
        {cmd.lignes_commande.map(l => (
          <div key={l.id} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#D4A843', fontWeight: 700, fontSize: 16 }}>×{l.quantite}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#F5F5F5', textTransform: 'uppercase', flex: 1 }}>{l.article_nom}</span>
              {l.taille && <span style={{ fontSize: 13, color: '#F5F5F5', fontWeight: 700, background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: 4 }}>{l.taille}</span>}
              {isAjoutApres(l, cmd.created_at) && (
                <span style={{ fontSize: 10, background: '#D4A843', color: '#000', fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>AJOUT</span>
              )}
            </div>
            {l.commentaire && (
              <div style={{ fontSize: 12, color: '#ef5350', marginTop: 2, paddingLeft: 28 }}>⚠ {l.commentaire}</div>
            )}
          </div>
        ))}
      </div>

      {/* Notes */}
      {cmd.notes && (
        <div style={{ background: 'rgba(183,28,28,0.3)', border: '1px solid rgba(183,28,28,0.5)', borderRadius: 6, padding: 8, fontSize: 12, color: '#ef9090' }}>
          ⚠️ {cmd.notes}
        </div>
      )}

      {/* Boutons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button
          onClick={() => toggleUrgent(cmd.id)}
          style={{ flex: 1, padding: '0 8px', minHeight: 48, borderRadius: 8, background: urgents.has(cmd.id) ? '#D4A843' : 'rgba(212,168,67,0.2)', border: '1px solid #D4A843', color: urgents.has(cmd.id) ? '#000' : '#D4A843', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
        >
          {urgents.has(cmd.id) ? '⚠️ URGENT ✓' : '⚠️ URGENT'}
        </button>
        <button
          onClick={() => marquerPrete(cmd)}
          style={{ flex: 1, padding: '0 8px', minHeight: 48, background: '#2E7D32', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          ✅ PRÊTE
        </button>
      </div>
    </div>
  )
}

const CATS_PAS_CUISINE = [
  'boissons', 'vins', 'vins blancs', 'vins rouges', 'vins rosés',
  'pétillants', 'apéritifs', 'digestifs', 'boisson', 'vin',
  'bières', 'softs', 'eaux'
]

export default function CuisinePage() {
  const router = useRouter()
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading, setLoading] = useState(true)
  const [urgents, setUrgents] = useState<Set<string>>(new Set())
  const [soundOn, setSoundOn] = useState(true)
  const [dateFiltre, setDateFiltre] = useState(() => new Date().toISOString().split('T')[0])
  const prevCountRef = useRef(0)

  const todayStr = new Date().toISOString().split('T')[0]

  const fetchCommandes = useCallback(async (date?: string) => {
    const jour = date ?? dateFiltre
    const isAujourdhui = jour === todayStr
    try {
      const session = getSession()
      if (!session) { router.replace('/login'); return }

      const statutFilter = isAujourdhui
        ? ['en_cours', 'en_preparation']
        : ['en_cours', 'en_preparation', 'pret_encaisser', 'encaissee', 'annulee']

      // À emporter : date_retrait si renseigné, sinon fallback sur created_at
      const emporterQ = supabase
        .from('commandes')
        .select('*, lignes_commande(*)')
        .eq('type', 'a_emporter')
        .in('statut', statutFilter)
        .or(`date_retrait.eq.${jour},and(date_retrait.is.null,created_at.gte.${jour}T00:00:00,created_at.lte.${jour}T23:59:59)`)
        .order('heure_retrait', { ascending: true, nullsFirst: false })

      // Sur place : filtrer par created_at
      const surPlaceQ = supabase
        .from('commandes')
        .select('*, lignes_commande(*)')
        .eq('type', 'sur_place')
        .gte('created_at', jour + 'T00:00:00')
        .lte('created_at', jour + 'T23:59:59')
        .in('statut', statutFilter)
        .order('created_at')

      const [{ data: emporterData, error: err1 }, { data: surPlaceData, error: err2 }] =
        await Promise.all([emporterQ, surPlaceQ])

      if (err1) throw err1
      if (err2) throw err2

      const data = [...(emporterData ?? []), ...(surPlaceData ?? [])]

      const result: Commande[] = []

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const cmd of (data ?? []) as any[]) {
        const allLignes: LigneCommande[] = (cmd.lignes_commande ?? [])

        let lignes: LigneCommande[]
        if (cmd.type === 'a_emporter') {
          lignes = allLignes.filter(l => {
            const nomCat = (l.categorie_nom ?? '').toLowerCase()
            if (!nomCat) return true
            return !CATS_PAS_CUISINE.some(c => nomCat.includes(c))
          })
        } else {
          if (isAujourdhui) {
            lignes = allLignes.filter(l => l.statut === 'envoye_cuisine' && l.pour_cuisine === true)
          } else {
            lignes = allLignes.filter(l => l.pour_cuisine !== false)
          }
        }

        if (lignes.length === 0) continue

        result.push({
          id: cmd.id,
          numero_commande: cmd.numero_commande,
          type: cmd.type,
          statut: cmd.statut,
          created_at: cmd.created_at,
          table_numero: cmd.table_numero,
          zone: cmd.zone,
          nom_client: cmd.nom_client ?? cmd.nom,
          notes: cmd.notes,
          heure_retrait: cmd.heure_retrait,
          telephone: cmd.telephone,
          email: cmd.email,
          lignes_commande: lignes,
        })
      }

      // Tri : à emporter par heure_retrait, sur place par created_at
      const aEmporter = result
        .filter(c => c.type === 'a_emporter')
        .sort((a, b) => {
          const hA = (a.heure_retrait ?? '').includes('T') ? (a.heure_retrait ?? '').split('T')[1] : (a.heure_retrait ?? '')
          const hB = (b.heure_retrait ?? '').includes('T') ? (b.heure_retrait ?? '').split('T')[1] : (b.heure_retrait ?? '')
          return hA.localeCompare(hB)
        })
      const surPlace = result
        .filter(c => c.type === 'sur_place')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      setCommandes([...aEmporter, ...surPlace])
    } catch (err) {
      console.error('Cuisine fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [router, dateFiltre, todayStr])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    fetchCommandes()
  }, [router, fetchCommandes])

  useEffect(() => {
    const channel = supabase.channel('cuisine-realtime-v4')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'commandes' }, () => { fetchCommandes() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'commandes' }, () => { fetchCommandes() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lignes_commande' }, () => { fetchCommandes() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lignes_commande' }, () => { fetchCommandes() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchCommandes])

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
      const ligneIds = cmd.lignes_commande.map(l => l.id)
      if (ligneIds.length > 0) {
        await supabase.from('lignes_commande').update({ statut: 'pret' }).in('id', ligneIds)
      }
      await supabase.from('commandes').update({ statut: 'pret_encaisser' }).eq('id', cmd.id)
      if (cmd.table_numero) {
        await supabase
          .from('tables_restaurant')
          .update({ statut: 'pret_encaisser' })
          .eq('numero', cmd.table_numero)
      }
      console.log('[marquerPrete] cmd complet:', JSON.stringify({ id: cmd.id, type: cmd.type, email: cmd.email, nom_client: cmd.nom_client, statut: cmd.statut }))
      if (cmd.type === 'a_emporter' && cmd.email) {
        try {
          const emailRes = await fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: cmd.email,
              subject: 'Votre commande est prête ! — Roma Pizzeria Restaurant',
              html: `
                <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #FBF6EE;">
                  <h1 style="color: #B71C1C;">Roma Pizzeria Restaurant</h1>
                  <h2>Votre commande est prête ! 🍕</h2>
                  <p>Bonjour <strong>${cmd.nom_client || ''}</strong>,</p>
                  <p>Votre commande <strong>#${cmd.numero_commande}</strong> est prête. Vous pouvez venir la récupérer dès maintenant !</p>
                  <p>Nous vous attendons au <strong>20 place Jacques du Bellay, Savigné-sur-Lathan</strong>.</p>
                  <p>À bientôt,<br><strong>L'équipe Roma Pizzeria Restaurant</strong></p>
                </div>
              `
            })
          })
          const emailJson = await emailRes.json()
          console.log('[email prete]', emailRes.status, emailJson)
        } catch (e) { console.error('[email prete] exception:', e) }
      } else {
        console.log('[marquerPrete] email non envoyé — email:', cmd.email, 'type:', cmd.type)
      }
      await fetchCommandes()
      const nomClient = cmd.nom_client || `Table ${cmd.table_numero}`
      const message = cmd.type === 'a_emporter'
        ? `📦 Commande E${cmd.numero_commande} prête — ${nomClient} (retrait ${cmd.heure_retrait ? cmd.heure_retrait.substring(0, 5).replace(':', 'h') : ''})`
        : `🍽 Table ${cmd.table_numero} prête — ${nomClient}`
      console.log('[ntfy] Envoi notification:', message)
      try {
        const response = await fetch('https://ntfy.sh/roma-cuisine-andrei-2024', {
          method: 'POST',
          body: message,
          headers: {
            'Title': 'Commande prete - Roma',
            'Priority': 'high',
            'Tags': 'white_check_mark'
          }
        })
        console.log('[ntfy] Réponse:', response.status, response.ok)
        if (!response.ok) {
          const errText = await response.text()
          console.error('[ntfy] Erreur:', errText)
        }
      } catch (ntfyErr) {
        console.error('[ntfy] Exception:', ntfyErr)
      }
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

  // Tri final : urgents en premier, puis ordre tel que fetchCommandes a déjà trié
  const commandesTri = [...commandes].sort((a, b) => {
    const aUrgent = urgents.has(a.id) ? 0 : 1
    const bUrgent = urgents.has(b.id) ? 0 : 1
    return aUrgent - bUrgent
  })
  const commandesEmporter = commandesTri.filter(c => c.type === 'a_emporter')
  const commandesSurPlace = commandesTri.filter(c => c.type === 'sur_place')

  return (
    <div style={{ background: '#FBF6EE', minHeight: '100vh', color: '#1A1A1A', overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{ height: 48, background: '#1B5E20', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'serif', fontSize: 22, fontStyle: 'italic', color: '#D4A843', fontWeight: 700 }}>Roma</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase' }}>Cuisine</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

      {/* Sélecteur de date */}
      <div style={{ background: '#F0EBE0', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#555', letterSpacing: 1, textTransform: 'uppercase' }}>📅 Jour :</span>
        <input
          type="date"
          value={dateFiltre}
          onChange={e => {
            const d = e.target.value
            setDateFiltre(d)
            setLoading(true)
            fetchCommandes(d)
          }}
          style={{
            background: '#fff', border: '1px solid #E0D5C5', borderRadius: 6,
            color: '#1A1A1A', padding: '5px 10px', fontSize: 13, cursor: 'pointer',
          }}
        />
        {dateFiltre !== todayStr && (
          <button
            onClick={() => {
              setDateFiltre(todayStr)
              setLoading(true)
              fetchCommandes(todayStr)
            }}
            style={{ fontSize: 12, color: '#1B5E20', background: 'rgba(27,94,32,0.08)', border: '1px solid rgba(27,94,32,0.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
          >
            ← Aujourd&apos;hui
          </button>
        )}
        {dateFiltre !== todayStr && (
          <span style={{ fontSize: 11, color: '#B71C1C', background: 'rgba(183,28,28,0.06)', border: '1px solid rgba(183,28,28,0.2)', borderRadius: 4, padding: '3px 8px' }}>
            📋 Vue historique
          </span>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ color: '#555' }}>Chargement...</div>
        ) : commandesTri.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 80, color: '#555', fontSize: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{dateFiltre === todayStr ? '✅' : '📋'}</div>
            <div>{dateFiltre === todayStr ? 'Aucune commande en préparation' : 'Aucune commande ce jour-là'}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16 }}>
            {/* Colonne GAUCHE : À emporter */}
            <div style={{ width: '50%' }}>
              <h2 style={{ color: '#4caf50', fontSize: 14, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>📦 À emporter ({commandesEmporter.length})</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {commandesEmporter.map(cmd => renderCard(cmd, urgents, toggleUrgent, marquerPrete, isAjoutApres))}
              </div>
              {commandesEmporter.length === 0 && <div style={{ color: '#555', fontSize: 14 }}>Aucune commande à emporter</div>}
            </div>
            {/* Colonne DROITE : Sur place */}
            <div style={{ width: '50%' }}>
              <h2 style={{ color: '#ef5350', fontSize: 14, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>🍽 Sur place ({commandesSurPlace.length})</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {commandesSurPlace.map(cmd => renderCard(cmd, urgents, toggleUrgent, marquerPrete, isAjoutApres))}
              </div>
              {commandesSurPlace.length === 0 && <div style={{ color: '#555', fontSize: 14 }}>Aucune commande sur place</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// rebuild-1781777875
