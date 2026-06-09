'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { T, Lang } from '@/lib/i18n'
import type { Client, Reservation, MouvementFidelite } from '@/lib/supabase'

type Screen = 'phone' | 'create' | 'dashboard'

function getBadgeNiveau(visites: number): { label: string; icon: string; color: string; bg: string } {
  if (visites >= 16) return { label: 'Or', icon: '🥇', color: 'var(--oro)', bg: '#FFF8E1' }
  if (visites >= 6) return { label: 'Argent', icon: '🥈', color: '#757575', bg: '#F5F5F5' }
  return { label: 'Bronze', icon: '🥉', color: '#8D6E63', bg: '#EFEBE9' }
}

function getInitiales(nom: string): string {
  return nom.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

export default function ComptePage() {
  const [lang, setLang] = useState<Lang>('fr')
  const [screen, setScreen] = useState<Screen>('phone')
  const [phone, setPhone] = useState('')
  const [newNom, setNewNom] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [client, setClient] = useState<Client | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [mouvements, setMouvements] = useState<MouvementFidelite[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const t = T[lang]

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) return
    setLoading(true); setError('')
    try {
      const { data } = await supabase.from('client').select('*').eq('telephone', phone.trim()).single()
      if (data) {
        setClient(data as Client)
        await loadDashboard(data.id)
        setScreen('dashboard')
      } else {
        setScreen('create')
      }
    } catch {
      setScreen('create')
    } finally {
      setLoading(false)
    }
  }

  const loadDashboard = async (id: string) => {
    const [{ data: res }, { data: mvts }] = await Promise.all([
      supabase.from('reservation').select('*').eq('client_id', id).order('date_reservation', { ascending: false }).limit(5),
      supabase.from('mouvementfidelite').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(10),
    ])
    setReservations(res ?? [])
    setMouvements(mvts ?? [])
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNom.trim()) return
    setLoading(true); setError('')
    try {
      const { data, error: err } = await supabase
        .from('client')
        .insert({ nom: newNom.trim(), telephone: phone.trim(), email: newEmail.trim() || null, points_fidelite: 0 })
        .select('*').single()
      if (err) throw err
      setClient(data as Client)
      setReservations([]); setMouvements([])
      setScreen('dashboard')
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!client) return
    setLoading(true)
    try {
      await supabase.from('client').delete().eq('id', client.id)
      setScreen('phone'); setClient(null); setPhone(''); setDeleteConfirm(false)
    } catch {
      setError('Erreur lors de la suppression.')
    } finally {
      setLoading(false)
    }
  }

  const visites = reservations.filter(r => r.statut === 'honoree').length
  const niveau = getBadgeNiveau(visites)
  const MAX_POINTS = 500
  const progressPct = client ? Math.min(100, Math.round((client.points_fidelite / MAX_POINTS) * 100)) : 0

  const statutLabel: Record<string, string> = {
    en_attente: 'En attente', confirmee: 'Confirmée', annulee: 'Annulée', honoree: 'Honorée'
  }
  const statutColor: Record<string, string> = {
    en_attente: 'var(--oro)', confirmee: 'var(--verde)', annulee: 'var(--rosso)', honoree: 'var(--verde-m)'
  }
  const statutBg: Record<string, string> = {
    en_attente: '#FFF8E1', confirmee: 'var(--verde-pale)', annulee: 'var(--rosso-pale)', honoree: 'var(--verde-pale)'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bianco-w)', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ background: 'var(--nero)', padding: '0 clamp(20px,5vw,60px)', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(212,168,67,0.2)' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: 22, color: 'var(--oro)', fontWeight: 700 }}>Roma</span>
          <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 300, color: 'rgba(255,255,255,0.5)', letterSpacing: '3px', textTransform: 'uppercase' }}>Pizzeria</span>
        </Link>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['fr', 'it', 'en'] as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{ background: lang === l ? 'var(--rosso)' : 'transparent', border: `1px solid ${lang === l ? 'var(--rosso)' : 'rgba(255,255,255,0.2)'}`, color: '#fff', padding: '3px 8px', borderRadius: 2, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>{l}</button>
          ))}
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: screen === 'dashboard' ? 'flex-start' : 'center', justifyContent: 'center', padding: 'clamp(40px,6vw,80px) clamp(20px,5vw,40px)' }}>
        <div style={{ width: '100%', maxWidth: screen === 'dashboard' ? '900px' : '480px' }}>

          {/* PHONE SCREEN */}
          {screen === 'phone' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <span className="badge badge-rosso" style={{ marginBottom: 16, display: 'inline-block' }}>Fidélité</span>
                <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px,4vw,38px)', color: 'var(--nero)', marginBottom: 12 }}>{t.compte_title}</h1>
                <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontStyle: 'italic', color: 'var(--grigio)' }}>Retrouvez vos réservations et vos points fidélité</p>
              </div>
              <form onSubmit={handlePhoneSubmit} style={{ background: 'white', border: '1px solid var(--grigio-l)', borderRadius: 4, padding: 'clamp(24px,5vw,40px)' }}>
                <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 8 }}>{t.compte_phone_label}</label>
                <input type="tel" className="form-input" placeholder={t.compte_phone_ph} value={phone} onChange={e => setPhone(e.target.value)} required />
                {error && <p style={{ fontSize: 13, color: 'var(--rosso)', marginTop: 10, padding: '10px 14px', background: 'var(--rosso-pale)', borderRadius: 3 }}>{error}</p>}
                <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: 20, padding: 14, opacity: loading ? 0.7 : 1 }}>
                  {loading ? '...' : t.compte_phone_submit}
                </button>
              </form>
            </>
          )}

          {/* CREATE SCREEN */}
          {screen === 'create' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(24px,4vw,36px)', color: 'var(--nero)', marginBottom: 10 }}>{t.compte_new_title}</h1>
                <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, fontStyle: 'italic', color: 'var(--grigio)' }}>{t.compte_not_found}</p>
              </div>
              <form onSubmit={handleCreate} style={{ background: 'white', border: '1px solid var(--grigio-l)', borderRadius: 4, padding: 'clamp(24px,5vw,40px)' }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 8 }}>Téléphone</label>
                  <input type="tel" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 8 }}>{t.compte_new_nom}</label>
                  <input type="text" className="form-input" placeholder="Votre nom" value={newNom} onChange={e => setNewNom(e.target.value)} required />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 8 }}>{t.compte_new_email}</label>
                  <input type="email" className="form-input" placeholder="email@exemple.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                </div>
                {error && <p style={{ fontSize: 13, color: 'var(--rosso)', marginBottom: 12, padding: '10px 14px', background: 'var(--rosso-pale)', borderRadius: 3 }}>{error}</p>}
                <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: 14, opacity: loading ? 0.7 : 1 }}>
                  {loading ? '...' : t.compte_new_submit}
                </button>
                <button type="button" onClick={() => setScreen('phone')} style={{ display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Jost', fontSize: 13, color: 'var(--grigio)', textDecoration: 'underline' }}>← Retour</button>
              </form>
            </>
          )}

          {/* DASHBOARD */}
          {screen === 'dashboard' && client && (
            <>
              {/* Header client */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--rosso)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Playfair Display, serif', fontSize: 22, color: 'white', fontWeight: 700, flexShrink: 0 }}>
                  {getInitiales(client.nom)}
                </div>
                <div>
                  <span style={{ fontFamily: 'Jost', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--rosso)', display: 'block', marginBottom: 4 }}>{t.compte_bienvenue}</span>
                  <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(22px,3vw,32px)', color: 'var(--nero)' }}>{client.nom}</h1>
                </div>
                <div style={{ marginLeft: 'auto', background: niveau.bg, color: niveau.color, padding: '8px 16px', borderRadius: 20, fontSize: 13, fontFamily: 'Jost', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {niveau.icon} Membre {niveau.label}
                </div>
              </div>

              {/* Points card */}
              <div style={{ background: 'var(--hero-bg)', borderRadius: 4, padding: 32, marginBottom: 32, border: '1px solid rgba(212,168,67,0.25)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(212,168,67,0.08)' }} />
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontFamily: 'Jost', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>{t.compte_points}</span>
                </div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 56, fontWeight: 600, color: 'var(--oro)', lineHeight: 1, marginBottom: 16 }}>
                  {client.points_fidelite}
                  <span style={{ fontFamily: 'Jost', fontSize: 16, fontWeight: 300, color: 'rgba(255,255,255,0.35)', marginLeft: 8 }}>pts</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 2, height: 6, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, var(--verde), var(--rosso))', transition: 'width 0.8s ease', borderRadius: 2 }} />
                </div>
                <p style={{ fontFamily: 'Jost', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  {client.points_fidelite} / {MAX_POINTS} pts — 100 pts = 1 pizza offerte 🍕
                </p>
              </div>

              {/* Reservations */}
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>{t.compte_reservations}</h2>
                {reservations.length === 0 ? (
                  <div style={{ background: 'white', border: '1px solid var(--grigio-l)', borderRadius: 4, padding: 24, textAlign: 'center' }}>
                    <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontStyle: 'italic', color: 'var(--grigio)' }}>Aucune réservation pour le moment</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {reservations.map(r => (
                      <div key={r.id} style={{ background: 'white', border: '1px solid var(--grigio-l)', borderRadius: 4, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, color: 'var(--nero)', marginBottom: 4 }}>
                            {new Date(r.date_reservation).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {r.heure_reservation}
                          </p>
                          <p style={{ fontFamily: 'Jost', fontSize: 13, color: 'var(--grigio)' }}>{r.nombre_couverts} personnes{r.zone ? ` · ${r.zone}` : ''}</p>
                        </div>
                        <span style={{ fontFamily: 'Jost', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 20, background: statutBg[r.statut] ?? '#eee', color: statutColor[r.statut] ?? 'var(--grigio)', fontWeight: 500 }}>
                          {statutLabel[r.statut] ?? r.statut}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Points history */}
              {mouvements.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>{t.compte_historique}</h2>
                  <div style={{ background: 'white', border: '1px solid var(--grigio-l)', borderRadius: 4, overflow: 'hidden' }}>
                    {mouvements.map((mv, i) => (
                      <div key={mv.id} style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < mouvements.length - 1 ? '1px solid var(--grigio-l)' : 'none', background: i % 2 === 0 ? 'white' : 'var(--bianco-w)' }}>
                        <div>
                          <p style={{ fontFamily: 'Jost', fontSize: 14, color: 'var(--nero)', marginBottom: 2 }}>{mv.motif}</p>
                          <p style={{ fontFamily: 'Jost', fontSize: 12, color: 'var(--grigio)' }}>{new Date(mv.created_at).toLocaleDateString('fr-FR')}</p>
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
                <button onClick={() => { setScreen('phone'); setClient(null); setPhone('') }} className="btn-secondary" style={{ fontSize: 13 }}>Se déconnecter</button>
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
                      ⚠️ Êtes-vous sûr ? Cette action supprimera définitivement votre compte et vos points fidélité.
                    </p>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button onClick={handleDelete} disabled={loading} style={{ background: 'var(--rosso)', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 3, fontSize: 13, cursor: 'pointer', fontFamily: 'Jost', opacity: loading ? 0.7 : 1 }}>
                        {loading ? '...' : 'Confirmer la suppression'}
                      </button>
                      <button onClick={() => setDeleteConfirm(false)} style={{ background: 'none', border: '1px solid var(--grigio-l)', color: 'var(--grigio)', padding: '8px 16px', borderRadius: 3, fontSize: 13, cursor: 'pointer', fontFamily: 'Jost' }}>
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <footer style={{ background: 'var(--nero)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px clamp(20px,5vw,60px)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Jost', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>{t.footer_copyright}</p>
      </footer>
    </div>
  )
}
