'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { T, Lang } from '@/lib/i18n'
import type { Client, Reservation, MouvementFidelite } from '@/lib/supabase'

type Screen = 'phone' | 'create' | 'dashboard'

export default function ComptePage() {
  const [lang, setLang]     = useState<Lang>('fr')
  const [screen, setScreen] = useState<Screen>('phone')

  const [phone, setPhone]   = useState('')
  const [newNom, setNewNom] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const [client, setClient]               = useState<Client | null>(null)
  const [reservations, setReservations]   = useState<Reservation[]>([])
  const [mouvements, setMouvements]       = useState<MouvementFidelite[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

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

  const MAX_POINTS = 500
  const progressPct = client ? Math.min(100, Math.round((client.points_fidelite / MAX_POINTS) * 100)) : 0

  const statutLabel: Record<string, string> = {
    en_attente: 'En attente', confirmee: 'Confirmée', annulee: 'Annulée', honoree: 'Honorée'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ background: 'var(--brown-d)', padding: '0 clamp(20px,5vw,60px)', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(201,148,58,0.2)' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: '20px', color: 'var(--gold-l)', fontWeight: 600 }}>Roma</span>
          <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '10px', fontWeight: 300, color: 'rgba(255,255,255,0.5)', letterSpacing: '3px', textTransform: 'uppercase' }}>Pizzeria</span>
        </Link>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['fr','it','en'] as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{ background: lang===l?'var(--terra)':'transparent', border:`1px solid ${lang===l?'var(--terra)':'rgba(255,255,255,0.2)'}`, color:'#fff', padding:'3px 8px', borderRadius:'2px', fontSize:'10px', textTransform:'uppercase', cursor:'pointer', fontFamily:"'Jost',sans-serif" }}>{l}</button>
          ))}
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: screen === 'dashboard' ? 'flex-start' : 'center', justifyContent: 'center', padding: 'clamp(40px,6vw,80px) clamp(20px,5vw,40px)' }}>
        <div style={{ width: '100%', maxWidth: screen === 'dashboard' ? '900px' : '480px' }}>

          {/* PHONE SCREEN */}
          {screen === 'phone' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--terra)', display: 'block', marginBottom: '10px' }}>Fidélité</span>
                <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(26px,4vw,38px)', color: 'var(--text)', marginBottom: '12px' }}>{t.compte_title}</h1>
                <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '18px', fontStyle: 'italic', color: 'var(--text-l)' }}>Retrouvez vos réservations et vos points fidélité</p>
              </div>
              <form onSubmit={handlePhoneSubmit} style={{ background: '#fff', border: '1px solid rgba(196,98,45,0.15)', borderRadius: '2px', padding: 'clamp(24px,5vw,40px)' }}>
                <label className="rf-label">{t.compte_phone_label}</label>
                <input type="tel" className="rf-input" placeholder={t.compte_phone_ph} value={phone} onChange={e => setPhone(e.target.value)} required />
                {error && <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '13px', color: 'var(--terra)', marginTop: '10px', padding: '10px 14px', background: 'rgba(196,98,45,0.07)', borderRadius: '2px' }}>{error}</p>}
                <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '20px', padding: '14px', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}>
                  {loading ? '...' : t.compte_phone_submit}
                </button>
              </form>
            </>
          )}

          {/* CREATE SCREEN */}
          {screen === 'create' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(24px,4vw,36px)', color: 'var(--text)', marginBottom: '10px' }}>{t.compte_new_title}</h1>
                <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '17px', fontStyle: 'italic', color: 'var(--text-l)' }}>{t.compte_not_found}</p>
              </div>
              <form onSubmit={handleCreate} style={{ background: '#fff', border: '1px solid rgba(196,98,45,0.15)', borderRadius: '2px', padding: 'clamp(24px,5vw,40px)' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label className="rf-label">Téléphone</label>
                  <input type="tel" className="rf-input" value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label className="rf-label">{t.compte_new_nom}</label>
                  <input type="text" className="rf-input" placeholder="Votre nom" value={newNom} onChange={e => setNewNom(e.target.value)} required />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label className="rf-label">{t.compte_new_email}</label>
                  <input type="email" className="rf-input" placeholder="email@exemple.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                </div>
                {error && <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '13px', color: 'var(--terra)', marginBottom: '12px', padding: '10px 14px', background: 'rgba(196,98,45,0.07)', borderRadius: '2px' }}>{error}</p>}
                <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '14px', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}>
                  {loading ? '...' : t.compte_new_submit}
                </button>
                <button type="button" onClick={() => setScreen('phone')} style={{ display: 'block', width: '100%', marginTop: '12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost',sans-serif", fontSize: '13px', color: 'var(--text-l)', textDecoration: 'underline' }}>← Retour</button>
              </form>
            </>
          )}

          {/* DASHBOARD */}
          {screen === 'dashboard' && client && (
            <>
              <div style={{ marginBottom: '32px' }}>
                <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--terra)', display: 'block', marginBottom: '8px' }}>{t.compte_bienvenue}</span>
                <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(24px,4vw,38px)', color: 'var(--text)' }}>{client.nom}</h1>
              </div>

              {/* Points card */}
              <div style={{ background: 'var(--brown-d)', borderRadius: '2px', padding: '32px', marginBottom: '32px', border: '1px solid rgba(201,148,58,0.25)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(201,148,58,0.08)' }} />
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>{t.compte_points}</span>
                </div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '56px', fontWeight: 600, color: 'var(--gold-l)', lineHeight: 1, marginBottom: '16px' }}>
                  {client.points_fidelite}
                  <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '16px', fontWeight: 300, color: 'rgba(255,255,255,0.35)', marginLeft: '8px' }}>pts</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '2px', height: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, var(--terra), var(--gold))', transition: 'width 0.8s ease', borderRadius: '2px' }} />
                </div>
                <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                  {client.points_fidelite} / {MAX_POINTS} pts pour le prochain avantage
                </p>
              </div>

              {/* Reservations */}
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '24px', color: 'var(--text)', marginBottom: '16px' }}>{t.compte_reservations}</h2>
                {reservations.length === 0 ? (
                  <div style={{ background: '#fff', border: '1px solid rgba(196,98,45,0.12)', borderRadius: '2px', padding: '24px', textAlign: 'center' }}>
                    <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '18px', fontStyle: 'italic', color: 'var(--text-l)' }}>Aucune réservation pour le moment</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {reservations.map(r => (
                      <div key={r.id} style={{ background: '#fff', border: '1px solid rgba(196,98,45,0.12)', borderRadius: '2px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <p style={{ fontFamily: "'Playfair Display',serif", fontSize: '16px', color: 'var(--text)', marginBottom: '4px' }}>
                            {new Date(r.date_reservation).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {r.heure_reservation}
                          </p>
                          <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '13px', color: 'var(--text-l)' }}>{r.nombre_couverts} personnes{r.zone ? ` · ${r.zone}` : ''}</p>
                        </div>
                        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '4px 10px', borderRadius: '2px', background: r.statut === 'confirmee' ? 'rgba(74,103,65,0.12)' : r.statut === 'annulee' ? 'rgba(196,98,45,0.1)' : 'rgba(201,148,58,0.12)', color: r.statut === 'confirmee' ? 'var(--green)' : r.statut === 'annulee' ? 'var(--terra)' : 'var(--gold)' }}>
                          {statutLabel[r.statut] ?? r.statut}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Points history */}
              {mouvements.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                  <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '24px', color: 'var(--text)', marginBottom: '16px' }}>{t.compte_historique}</h2>
                  <div style={{ background: '#fff', border: '1px solid rgba(196,98,45,0.12)', borderRadius: '2px', overflow: 'hidden' }}>
                    {mouvements.map((mv, i) => (
                      <div key={mv.id} style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < mouvements.length - 1 ? '1px solid rgba(196,98,45,0.08)' : 'none' }}>
                        <div>
                          <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '14px', color: 'var(--text)', marginBottom: '2px' }}>{mv.motif}</p>
                          <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '12px', color: 'var(--text-l)' }}>{new Date(mv.created_at).toLocaleDateString('fr-FR')}</p>
                        </div>
                        <span style={{ fontFamily: "'Playfair Display',serif", fontSize: '18px', fontWeight: 600, color: mv.points >= 0 ? 'var(--green)' : 'var(--terra)' }}>
                          {mv.points >= 0 ? '+' : ''}{mv.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Link href="/reserver" className="btn-primary" style={{ fontSize: '12px', letterSpacing: '1.5px' }}>Réserver une table</Link>
                <button onClick={() => { setScreen('phone'); setClient(null); setPhone('') }} className="btn-secondary" style={{ fontSize: '12px' }}>Se déconnecter</button>
              </div>
            </>
          )}
        </div>
      </div>

      <footer style={{ background: 'var(--brown-d)', borderTop: '1px solid rgba(201,148,58,0.15)', padding: '20px clamp(20px,5vw,60px)', textAlign: 'center' }}>
        <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>{t.footer_copyright}</p>
      </footer>
    </div>
  )
}
