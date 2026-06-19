'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Client, Reservation, MouvementFidelite } from '@/lib/supabase'
import { useLang } from '@/lib/LanguageContext'

type Screen = 'home' | 'login' | 'create' | 'dashboard'

type CommandeEmporter = {
  id: string
  numero_commande: number
  created_at: string
  statut: string
  total: number
  heure_retrait?: string
  points_gagnes?: number
}

const NIVEAUX = [
  { min: 0, max: 5, label: 'Bronze', icon: '🥉', color: '#8D6E63', bg: '#EFEBE9' },
  { min: 6, max: 15, label: 'Argent', icon: '🥈', color: '#757575', bg: '#F5F5F5' },
  { min: 16, max: Infinity, label: 'Or', icon: '🏆', color: 'var(--verde)', bg: 'var(--verde-pale)' },
]

const RECOMPENSES = [
  { icon: '🥤', label: 'Boisson offerte', points: 8 },
  { icon: '🥗', label: 'Salade verte offerte', points: 16 },
  { icon: '🥗', label: 'Salade Caprésé offerte', points: 28 },
  { icon: '🍮', label: 'Dessert maison offert', points: 22 },
  { icon: '🍷', label: 'Verre de vin offert', points: 20 },
  { icon: '🍕', label: 'Pizza Margherita offerte', points: 32 },
  { icon: '🍕', label: 'Pizza Reine offerte', points: 40 },
  { icon: '🍕', label: 'Pizza 4 Fromages offerte', points: 40 },
  { icon: '🍕', label: 'Pizza Reggina offerte', points: 48 },
  { icon: '🍕', label: 'Pizza Bolognese offerte', points: 56 },
  { icon: '🍕', label: 'Pizza Valtellina offerte', points: 60 },
  { icon: '🎉', label: 'Menu Duo offert (2 pizzas)', points: 112 },
  { icon: '🎉', label: 'Formule Famille offerte', points: 220 },
]

function getNiveau(visites: number) {
  return NIVEAUX.find(n => visites >= n.min && visites <= n.max) ?? NIVEAUX[0]
}

function getInitiales(nom: string) {
  return nom.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

export default function ComptePage() {
  const { t } = useLang()
  const [screen, setScreen] = useState<Screen>('home')
  const [phone, setPhone] = useState('')
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [client, setClient] = useState<Client | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [mouvements, setMouvements] = useState<MouvementFidelite[]>([])
  const [commandes, setCommandes] = useState<CommandeEmporter[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [bonCode, setBonCode] = useState<string | null>(null)

  // Auto-connexion depuis localStorage
  useEffect(() => {
    const storedId = localStorage.getItem('roma_client_id')
    const storedTel = localStorage.getItem('roma_client_tel')
    if (storedId && storedTel) {
      supabase.from('clients').select('*').eq('id', storedId).single().then(({ data }) => {
        if (data) {
          setClient(data as Client)
          loadDashboard(data.id, data.telephone)
          setScreen('dashboard')
        }
      })
    }
  }, [])

  const loadDashboard = async (id: string, telephone: string) => {
    const [{ data: res }, { data: mvts }, { data: cmds }] = await Promise.all([
      supabase.from('reservations').select('*').eq('client_id', id).order('date_reservation', { ascending: false }).limit(5),
      supabase.from('mouvements_fidelite').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(20),
      supabase.from('commandes').select('id, numero_commande, created_at, statut, total, heure_retrait, points_gagnes')
        .eq('telephone', telephone).eq('type', 'a_emporter')
        .order('created_at', { ascending: false }).limit(10),
    ])
    setReservations(res ?? [])
    setMouvements(mvts ?? [])
    setCommandes(cmds ?? [])
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await supabase.from('clients').select('*').eq('telephone', phone.trim()).single()
      if (data) {
        const c = data as Client
        setClient(c)
        localStorage.setItem('roma_client_id', c.id)
        localStorage.setItem('roma_client_tel', c.telephone)
        localStorage.setItem('roma_client_nom', c.nom)
        localStorage.setItem('roma_client', JSON.stringify({ id: c.id, nom: c.nom, telephone: c.telephone, email: c.email ?? undefined, points: c.points ?? 0 }))
        await loadDashboard(c.id, c.telephone)
        setScreen('dashboard')
      } else {
        setError('Numéro inconnu. Souhaitez-vous créer un compte ?')
      }
    } catch {
      setError('Numéro inconnu. Souhaitez-vous créer un compte ?')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nom.trim() || !phone.trim()) return
    setLoading(true); setError('')
    try {
      const nomComplet = (prenom.trim() + ' ' + nom.trim()).trim()
      const { data, error: err } = await supabase.from('clients')
        .insert({ nom: nomComplet, telephone: phone.trim(), email: email.trim() || null })
        .select('*').single()
      if (err) throw err
      const c = data as Client
      setClient(c)
      localStorage.setItem('roma_client_id', c.id)
      localStorage.setItem('roma_client_tel', phone.trim())
      localStorage.setItem('roma_client_nom', c.nom)
      localStorage.setItem('roma_client', JSON.stringify({ id: c.id, nom: c.nom, telephone: phone.trim(), email: c.email ?? undefined, points: c.points ?? 0 }))
      setReservations([]); setMouvements([]); setCommandes([])
      setScreen('dashboard')
    } catch {
      setError("Une erreur est survenue. Vérifiez que ce numéro n'est pas déjà enregistré.")
    } finally {
      setLoading(false)
    }
  }

  const handleDeconnexion = () => {
    localStorage.removeItem('roma_client_id')
    localStorage.removeItem('roma_client_tel')
    localStorage.removeItem('roma_client_nom')
    localStorage.removeItem('roma_client')
    setClient(null); setScreen('home'); setPhone(''); setNom(''); setPrenom(''); setEmail('')
  }

  const handleDelete = async () => {
    if (!client) return
    setLoading(true)
    try {
      await supabase.from('clients').delete().eq('id', client.id)
      handleDeconnexion()
    } catch {
      setError('Erreur lors de la suppression.')
    } finally {
      setLoading(false)
    }
  }

  const handleUtiliserRecompense = async (r: typeof RECOMPENSES[0]) => {
    if (!client || client.points < r.points) return
    const code = 'ROMA-' + Math.random().toString(36).substring(2, 8).toUpperCase()
    try {
      const newPts = client.points - r.points
      await Promise.all([
        supabase.from('bons_fidelite').insert({ client_id: client.id, article_nom: r.label, points_utilises: r.points, code, statut: 'actif' }),
        supabase.from('clients').update({ points: newPts }).eq('id', client.id),
        supabase.from('mouvements_fidelite').insert({ client_id: client.id, points: -r.points, motif: `Récompense : ${r.label}` }),
      ])
      setClient(prev => prev ? { ...prev, points: newPts } : null)
      setBonCode(`${code} — ${r.label}`)
    } catch { /* skip */ }
  }

  const visites = client?.nb_visites ?? reservations.filter(r => r.statut === 'honoree').length
  const niveau = getNiveau(visites)
  const nextNiveau = NIVEAUX.find(n => n.min > visites)
  const nextRecompense = RECOMPENSES.find(r => r.points > (client?.points ?? 0))
  const maxPoints = nextRecompense?.points ?? RECOMPENSES[RECOMPENSES.length - 1].points

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bianco-w)', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ background: 'var(--nero)', padding: '0 clamp(20px,5vw,60px)', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: 22, color: 'white', fontWeight: 700 }}>Roma</span>
          <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 300, color: 'rgba(255,255,255,0.4)', letterSpacing: '3px', textTransform: 'uppercase' }}>Pizzeria</span>
        </Link>
        <span style={{ fontFamily: 'Jost', fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>🎁 Club Roma</span>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: screen === 'dashboard' ? 'flex-start' : 'center', justifyContent: 'center', padding: 'clamp(32px,5vw,64px) clamp(16px,4vw,32px)' }}>
        <div style={{ width: '100%', maxWidth: screen === 'dashboard' ? 920 : 480 }}>

          {/* HOME — 2 boutons */}
          {screen === 'home' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🍕</div>
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px,4vw,38px)', color: 'var(--nero)', marginBottom: 8 }}>{t('compte_titre')}</h1>
              <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 19, fontStyle: 'italic', color: 'var(--grigio)', marginBottom: 40 }}>Fidélité, réservations & récompenses</p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setScreen('login')} className="btn-primary" style={{ padding: '14px 32px', fontSize: 15 }}>
                  J&apos;ai déjà un compte
                </button>
                <button onClick={() => setScreen('create')} className="btn-verde" style={{ padding: '14px 32px', fontSize: 15 }}>
                  Créer mon compte
                </button>
              </div>
              <div style={{ marginTop: 48, background: 'var(--verde-pale)', borderRadius: 4, padding: 28, textAlign: 'left' }}>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: 'var(--nero)', marginBottom: 16 }}>Comment ça marche ?</h3>
                {[
                  { icon: '🍕', text: 'Commander à emporter avec votre compte → 1 point par euro dépensé' },
                  { icon: '📅', text: 'Réserver et honorer votre table → +5 points bonus' },
                  { icon: '⭐', text: 'Laisser un avis → +10 points (1 seul avis par compte)' },
                  { icon: '🎂', text: 'Votre anniversaire → +20 points cadeau automatique' },
                ].map(item => (
                  <div key={item.icon} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                    <p style={{ fontSize: 14, color: 'var(--nero-m)', fontFamily: 'Jost', lineHeight: 1.5 }}>{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LOGIN */}
          {screen === 'login' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, color: 'var(--nero)', marginBottom: 8 }}>Connexion</h1>
                <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontStyle: 'italic', color: 'var(--grigio)' }}>{t('compte_identifier')}</p>
              </div>
              <form onSubmit={handleLogin} style={{ background: 'white', border: '1px solid var(--grigio-l)', borderRadius: 4, padding: 'clamp(24px,5vw,40px)' }}>
                <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 8 }}>Téléphone *</label>
                <input type="tel" className="form-input" placeholder="06 XX XX XX XX" value={phone} onChange={e => setPhone(e.target.value)} required />
                {error && (
                  <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--rosso-pale)', border: '1px solid var(--rosso-l)', borderRadius: 3, fontSize: 13, color: 'var(--rosso)', fontFamily: 'Jost' }}>
                    {error}
                    <button type="button" onClick={() => { setError(''); setScreen('create') }} style={{ display: 'block', marginTop: 8, background: 'none', border: 'none', color: 'var(--verde)', cursor: 'pointer', fontFamily: 'Jost', fontSize: 13, textDecoration: 'underline', padding: 0 }}>
                      → Créer un compte
                    </button>
                  </div>
                )}
                <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: 20, padding: 14, opacity: loading ? 0.7 : 1 }}>
                  {loading ? t('chargement') : t('compte_btn')}
                </button>
                <button type="button" onClick={() => { setScreen('home'); setError('') }} style={{ display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Jost', fontSize: 13, color: 'var(--grigio)', textDecoration: 'underline' }}>← Retour</button>
              </form>
            </>
          )}

          {/* CREATE */}
          {screen === 'create' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, color: 'var(--nero)', marginBottom: 8 }}>Créer mon compte</h1>
                <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontStyle: 'italic', color: 'var(--grigio)' }}>Rejoignez le Club Roma et gagnez des points !</p>
              </div>
              <form onSubmit={handleCreate} style={{ background: 'white', border: '1px solid var(--grigio-l)', borderRadius: 4, padding: 'clamp(24px,5vw,40px)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 8 }}>Prénom *</label>
                    <input type="text" className="form-input" placeholder="Votre prénom" value={prenom} onChange={e => setPrenom(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 8 }}>Nom *</label>
                    <input type="text" className="form-input" placeholder="Votre nom" value={nom} onChange={e => setNom(e.target.value)} required />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 8 }}>Téléphone *</label>
                  <input type="tel" className="form-input" placeholder="06 XX XX XX XX" value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 8 }}>Email (facultatif)</label>
                  <input type="email" className="form-input" placeholder="email@exemple.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                {error && <div style={{ padding: '12px 16px', background: 'var(--rosso-pale)', borderRadius: 3, fontSize: 13, color: 'var(--rosso)', fontFamily: 'Jost', marginBottom: 16 }}>{error}</div>}
                <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: 14, opacity: loading ? 0.7 : 1 }}>
                  {loading ? '...' : '🎁 Créer mon compte et gagner des points'}
                </button>
                <button type="button" onClick={() => { setScreen('home'); setError('') }} style={{ display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Jost', fontSize: 13, color: 'var(--grigio)', textDecoration: 'underline' }}>← Retour</button>
              </form>
            </>
          )}

          {/* DASHBOARD */}
          {screen === 'dashboard' && client && (
            <>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--rosso)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Playfair Display, serif', fontSize: 20, color: 'white', fontWeight: 700, flexShrink: 0 }}>
                  {getInitiales(client.nom)}
                </div>
                <div>
                  <div style={{ fontFamily: 'Jost', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--verde)', marginBottom: 4 }}>Bienvenue</div>
                  <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(20px,3vw,30px)', color: 'var(--nero)' }}>{client.nom}</h1>
                </div>
                <div style={{ marginLeft: 'auto', background: niveau.bg, color: niveau.color, padding: '8px 16px', borderRadius: 20, fontSize: 13, fontFamily: 'Jost', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {niveau.icon} Membre {niveau.label}
                </div>
              </div>

              {/* Points card */}
              <div style={{ background: 'var(--hero-bg)', borderRadius: 4, padding: '28px 32px', marginBottom: 32, position: 'relative', overflow: 'hidden', border: '1px solid rgba(27,94,32,0.3)' }}>
                <div style={{ position: 'absolute', top: -24, right: -24, width: 120, height: 120, borderRadius: '50%', background: 'rgba(27,94,32,0.12)' }} />
                <div style={{ fontFamily: 'Jost', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Mes points</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 52, fontWeight: 600, color: 'var(--rosso)', lineHeight: 1, marginBottom: 16 }}>
                  {client.points}
                  <span style={{ fontFamily: 'Jost', fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,0.35)', marginLeft: 8 }}>pts</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 2, height: 6, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${Math.min(100, Math.round((client.points / maxPoints) * 100))}%`, background: 'linear-gradient(90deg, var(--verde), var(--rosso))', transition: 'width 0.8s ease', borderRadius: 2 }} />
                </div>
                <p style={{ fontFamily: 'Jost', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  {client.points} / {maxPoints} pts — {nextRecompense ? `Prochaine : ${nextRecompense.icon} ${nextRecompense.label} (encore ${nextRecompense.points - client.points} pts)` : 'Toutes débloquées 🎉'}
                </p>
                {nextNiveau && (
                  <p style={{ fontFamily: 'Jost', fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                    Niveau {nextNiveau.label} dans {nextNiveau.min - visites} visite{nextNiveau.min - visites > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Catalogue récompenses */}
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 8 }}>🎁 Mes récompenses</h2>
                <p style={{ fontSize: 13, color: 'var(--grigio)', fontFamily: 'Jost', marginBottom: 20 }}>Utilisez vos points pour obtenir des cadeaux à présenter au restaurant</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {RECOMPENSES.map(r => {
                    const unlocked = client.points >= r.points
                    const pct = Math.min(100, Math.round((client.points / r.points) * 100))
                    return (
                      <div key={r.label} style={{ background: 'white', border: `1px solid ${unlocked ? 'var(--verde)' : 'var(--grigio-l)'}`, borderRadius: 3, padding: 16, opacity: unlocked ? 1 : 0.75 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{r.icon}</div>
                        <div style={{ fontFamily: 'Jost', fontSize: 13, fontWeight: 600, color: 'var(--nero)', marginBottom: 4 }}>{r.label}</div>
                        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: unlocked ? 'var(--verde)' : 'var(--grigio)', marginBottom: 8 }}>{r.points} pts</div>
                        <div style={{ background: 'var(--grigio-l)', borderRadius: 2, height: 4, overflow: 'hidden', marginBottom: 10 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: unlocked ? 'var(--verde)' : 'var(--grigio)', borderRadius: 2 }} />
                        </div>
                        {unlocked ? (
                          <button onClick={() => handleUtiliserRecompense(r)} className="btn-verde" style={{ padding: '6px 14px', fontSize: 12, width: '100%' }}>
                            Utiliser ✓
                          </button>
                        ) : (
                          <div style={{ fontSize: 11, color: 'var(--grigio)', fontFamily: 'Jost' }}>
                            Encore {r.points - client.points} pts
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Bon de récompense */}
              {bonCode && (
                <div style={{ background: 'var(--verde-pale)', border: '2px solid var(--verde)', borderRadius: 4, padding: 24, marginBottom: 32, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                  <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: 'var(--verde)', marginBottom: 8 }}>Votre bon de récompense</h3>
                  <div style={{ fontFamily: 'Jost', fontSize: 22, fontWeight: 700, color: 'var(--nero)', letterSpacing: 2, padding: '12px 20px', background: 'white', borderRadius: 3, display: 'inline-block', marginBottom: 12 }}>{bonCode}</div>
                  <p style={{ fontSize: 13, color: 'var(--verde-m)', fontFamily: 'Jost' }}>Présentez ce code à Andreï lors de votre prochaine visite ✓</p>
                  <button onClick={() => setBonCode(null)} style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--grigio)', cursor: 'pointer', fontFamily: 'Jost', fontSize: 12, textDecoration: 'underline' }}>Fermer</button>
                </div>
              )}

              {/* Comment gagner des points */}
              <div style={{ background: 'var(--verde-pale)', borderRadius: 4, padding: 24, marginBottom: 32 }}>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: 'var(--nero)', marginBottom: 16 }}>Comment gagner des points</h3>
                {[
                  { icon: '🍕', text: 'Commander à emporter avec votre compte → 1 point par euro' },
                  { icon: '📅', text: 'Réserver et honorer votre table → +5 points bonus' },
                  { icon: '⭐', text: 'Laisser un avis → +10 points (1 seul avis par compte)' },
                  { icon: '🎂', text: 'Votre anniversaire → +20 points cadeau automatique' },
                ].map(item => (
                  <div key={item.icon} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                    <span>{item.icon}</span>
                    <p style={{ fontSize: 13, color: 'var(--nero-m)', fontFamily: 'Jost', lineHeight: 1.5 }}>{item.text}</p>
                  </div>
                ))}
              </div>

              {/* Réservations */}
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>Mes réservations</h2>
                {reservations.length === 0 ? (
                  <div style={{ background: 'white', border: '1px solid var(--grigio-l)', borderRadius: 4, padding: 24, textAlign: 'center' }}>
                    <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, fontStyle: 'italic', color: 'var(--grigio)' }}>Aucune réservation pour le moment</p>
                    <Link href="/#reserver" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none', marginTop: 12, fontSize: 13, padding: '10px 24px' }}>Réserver une table</Link>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {reservations.map(r => (
                      <div key={r.id} style={{ background: 'white', border: '1px solid var(--grigio-l)', borderRadius: 4, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, color: 'var(--nero)', marginBottom: 2 }}>
                            {new Date(r.date_reservation).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {r.heure_reservation}
                          </p>
                          <p style={{ fontFamily: 'Jost', fontSize: 12, color: 'var(--grigio)' }}>{r.nombre_couverts} personnes{r.zone ? ` · ${r.zone}` : ''}</p>
                        </div>
                        <span style={{
                          fontFamily: 'Jost', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 20, fontWeight: 500,
                          background: r.statut === 'confirmee' ? 'var(--verde-pale)' : r.statut === 'annulee' ? 'var(--rosso-pale)' : 'var(--bianco-c)',
                          color: r.statut === 'confirmee' ? 'var(--verde)' : r.statut === 'annulee' ? 'var(--rosso)' : 'var(--grigio)',
                        }}>
                          {r.statut === 'en_attente' ? 'En attente' : r.statut === 'confirmee' ? 'Confirmée' : r.statut === 'annulee' ? 'Annulée' : 'Honorée'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historique commandes à emporter */}
              {commandes.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>🍕 Mes commandes à emporter</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {commandes.map(cmd => {
                      const statutLabel: Record<string, string> = {
                        en_preparation: 'En préparation', pret_encaisser: 'Prête', encaissee: 'Récupérée', annulee: 'Annulée', en_cours: 'En cours', brouillon: 'En cours'
                      }
                      const statutColor: Record<string, string> = {
                        en_preparation: '#1B5E20', pret_encaisser: '#E65100', encaissee: '#555', annulee: '#B71C1C', en_cours: '#1B5E20', brouillon: '#888'
                      }
                      return (
                        <div key={cmd.id} style={{ background: 'white', border: '1px solid var(--grigio-l)', borderRadius: 4, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, color: 'var(--nero)', marginBottom: 2 }}>
                              Commande #{cmd.numero_commande}
                              {cmd.heure_retrait && <span style={{ fontSize: 13, color: 'var(--grigio)', marginLeft: 8 }}>à {cmd.heure_retrait}</span>}
                            </p>
                            <p style={{ fontFamily: 'Jost', fontSize: 12, color: 'var(--grigio)' }}>
                              {new Date(cmd.created_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
                              {cmd.points_gagnes ? <span style={{ color: '#1B5E20', marginLeft: 8 }}>+{cmd.points_gagnes} pts</span> : null}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: 'var(--nero)', marginBottom: 4 }}>{cmd.total?.toFixed(2)} €</div>
                            <span style={{ fontFamily: 'Jost', fontSize: 11, color: statutColor[cmd.statut] ?? '#555', fontWeight: 600 }}>
                              {statutLabel[cmd.statut] ?? cmd.statut}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Historique points */}
              {mouvements.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>{t('compte_historique')}</h2>
                  <div style={{ background: 'white', border: '1px solid var(--grigio-l)', borderRadius: 4, overflow: 'hidden' }}>
                    {mouvements.map((mv, i) => (
                      <div key={mv.id} style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < mouvements.length - 1 ? '1px solid var(--grigio-l)' : 'none', background: i % 2 === 0 ? 'white' : 'var(--bianco-w)' }}>
                        <div>
                          <p style={{ fontFamily: 'Jost', fontSize: 14, color: 'var(--nero)', marginBottom: 2 }}>{mv.motif}</p>
                          <p style={{ fontFamily: 'Jost', fontSize: 11, color: 'var(--grigio)' }}>{new Date(mv.created_at).toLocaleDateString('fr-FR')}</p>
                        </div>
                        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: mv.points >= 0 ? 'var(--verde)' : 'var(--rosso)' }}>
                          {mv.points >= 0 ? '+' : ''}{mv.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
                <Link href="/#reserver" className="btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>📅 Réserver une table</Link>
                <Link href="/#commander" className="btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>🍕 Commander à emporter</Link>
                <button onClick={handleDeconnexion} style={{ background: 'none', border: '1px solid var(--grigio-l)', color: 'var(--grigio)', padding: '10px 18px', borderRadius: 3, fontSize: 13, cursor: 'pointer', fontFamily: 'Jost' }}>{t('compte_deconnexion')}</button>
              </div>

              {/* RGPD Delete */}
              <div style={{ borderTop: '1px solid var(--grigio-l)', paddingTop: 24 }}>
                {!deleteConfirm ? (
                  <button onClick={() => setDeleteConfirm(true)} style={{ background: 'none', border: '1px solid var(--grigio-l)', color: 'var(--grigio)', padding: '8px 16px', borderRadius: 3, fontSize: 12, cursor: 'pointer', fontFamily: 'Jost' }}>
                    🗑 Supprimer mon compte (RGPD)
                  </button>
                ) : (
                  <div style={{ background: 'var(--rosso-pale)', border: '1px solid var(--rosso-l)', borderRadius: 4, padding: 20 }}>
                    <p style={{ fontSize: 14, color: 'var(--rosso)', fontFamily: 'Jost', marginBottom: 16 }}>
                      ⚠️ Êtes-vous sûr ? Cette action supprimera définitivement votre compte et vos points.
                    </p>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button onClick={handleDelete} disabled={loading} style={{ background: 'var(--rosso)', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 3, fontSize: 13, cursor: 'pointer', fontFamily: 'Jost', opacity: loading ? 0.7 : 1 }}>
                        {loading ? '...' : 'Confirmer'}
                      </button>
                      <button onClick={() => setDeleteConfirm(false)} style={{ background: 'none', border: '1px solid var(--grigio-l)', color: 'var(--grigio)', padding: '8px 16px', borderRadius: 3, fontSize: 13, cursor: 'pointer', fontFamily: 'Jost' }}>Annuler</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <footer style={{ background: 'var(--nero)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Jost', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>© 2026 Roma Pizzeria Restaurant</p>
      </footer>
    </div>
  )
}
