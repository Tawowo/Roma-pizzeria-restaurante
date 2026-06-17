'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LanguageContext'
import type { Lang } from '@/lib/translations'

// Horaires d'ouverture par jour JS (0=dim, 1=lun, 2=mar, 3=mer, 4=jeu, 5=ven, 6=sam)
function getHoraires(day: number): { debut: string; fin: string }[] {
  if (day === 1) return []
  if (day === 2 || day === 0) return [{ debut: '19:00', fin: '21:30' }]
  if (day >= 3 && day <= 5) return [{ debut: '12:00', fin: '14:30' }, { debut: '19:00', fin: '21:30' }]
  if (day === 6) return [{ debut: '12:00', fin: '14:30' }, { debut: '19:00', fin: '22:00' }]
  return []
}

function toMins(h: string): number {
  const [hh, mm] = h.substring(0, 5).split(':').map(Number)
  return hh * 60 + mm
}

function fromMins(mins: number): string {
  return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`
}

function isHeureDansHoraires(day: number, heure: string): boolean {
  const mins = toMins(heure)
  return getHoraires(day).some(h => mins >= toMins(h.debut) && mins <= toMins(h.fin))
}

function horairesLabel(day: number): string {
  const h = getHoraires(day)
  if (h.length === 0) return 'Fermé'
  return h.map(s => `${s.debut}–${s.fin}`).join(' · ')
}

const ZONE_LABELS: Record<string, string> = { rdc: 'RDC', etage: 'Étage', terrasse: 'Terrasse' }
const ZONES = ['rdc', 'etage', 'terrasse']

interface Dispo {
  ok: boolean
  tablesDispo: number
  zone: string
  heure: string
  couverts: number
  suggestionHeure?: string
  zonesDispo?: string[]
}

export default function ReserverPage() {
  const { lang, setLang, t } = useLang()
  const [form, setForm] = useState({
    nom: '', telephone: '', date: '', heure: '', couverts: '2', zone: '', notes: '', email: ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [dispo, setDispo] = useState<Dispo | null>(null)
  const [checkingDispo, setCheckingDispo] = useState(false)

  const checkDispo = useCallback(async (date: string, heure: string, zone: string, couverts: string) => {
    setDispo(null)
    if (!date || !heure || !zone || !couverts) return
    const day = new Date(date + 'T12:00:00').getDay()
    if (day === 1 || !isHeureDansHoraires(day, heure)) return

    setCheckingDispo(true)
    try {
      const nCouverts = parseInt(couverts)
      const heureMins = toMins(heure)

      const countDispo = async (z: string, targetMins: number): Promise<number> => {
        const { data: tables } = await supabase
          .from('tables_restaurant').select('capacite').eq('zone', z).eq('actif', true)
        const { data: resas } = await supabase
          .from('reservations').select('heure_reservation')
          .eq('date_reservation', date).eq('zone_preference', z).neq('statut', 'annulee')
        const capables = (tables ?? []).filter((t: { capacite: number }) => t.capacite >= nCouverts).length
        const conflits = (resas ?? []).filter((r: { heure_reservation: string }) => {
          const rm = toMins(r.heure_reservation)
          return targetMins < rm + 75 && targetMins + 75 > rm
        }).length
        return Math.max(0, capables - conflits)
      }

      const tablesDispo = await countDispo(zone, heureMins)

      if (tablesDispo > 0) {
        setDispo({ ok: true, tablesDispo, zone, heure, couverts: nCouverts })
        return
      }

      // Chercher prochain créneau dans la même zone
      let suggestionHeure: string | undefined
      const day2 = new Date(date + 'T12:00:00').getDay()
      for (let delta = 15; delta <= 120; delta += 15) {
        const newMins = heureMins + delta
        const newHeure = fromMins(newMins)
        if (!isHeureDansHoraires(day2, newHeure)) continue
        const d = await countDispo(zone, newMins)
        if (d > 0) { suggestionHeure = newHeure; break }
      }

      // Chercher autres zones disponibles au même créneau
      const zonesDispo: string[] = []
      for (const z of ZONES.filter(z => z !== zone)) {
        const d = await countDispo(z, heureMins)
        if (d > 0) zonesDispo.push(z)
      }

      setDispo({ ok: false, tablesDispo: 0, zone, heure, couverts: nCouverts, suggestionHeure, zonesDispo })
    } catch (err) {
      console.error('checkDispo', err)
    } finally {
      setCheckingDispo(false)
    }
  }, [])

  useEffect(() => {
    const { date, heure, zone, couverts } = form
    if (date && heure && zone) {
      const t = setTimeout(() => checkDispo(date, heure, zone, couverts), 400)
      return () => clearTimeout(t)
    } else {
      setDispo(null)
    }
  }, [form.date, form.heure, form.zone, form.couverts, checkDispo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const day = new Date(form.date + 'T12:00:00').getDay()
    if (day === 1) { setError(t('reserver_lundi')); return }
    if (form.heure && !isHeureDansHoraires(day, form.heure)) {
      setError(`Cet horaire est en dehors de nos heures d'ouverture (${horairesLabel(day)}).`)
      return
    }
    setLoading(true); setError('')
    try {
      let clientId: string | undefined
      const { data: existing } = await supabase
        .from('clients').select('id').eq('telephone', form.telephone).single()
      if (existing) { clientId = existing.id } else {
        const { data: nc } = await supabase
          .from('clients').insert({ nom: form.nom, telephone: form.telephone, points: 0, nb_visites: 0 })
          .select('id').single()
        clientId = nc?.id
      }
      const heureFormatee = form.heure.length === 5 ? form.heure + ':00' : form.heure
      console.log('[reserver] zone avant insert:', JSON.stringify(form.zone), '→ zone_preference:', form.zone || null)
      const { error: resaErr } = await supabase.from('reservations').insert({
        client_id: clientId ?? null,
        nom: form.nom,
        telephone: form.telephone,
        email: form.email?.trim() || null,
        date_reservation: form.date,
        heure_reservation: heureFormatee,
        nombre_couverts: parseInt(form.couverts),
        zone_preference: form.zone || null,
        notes: form.notes || null,
        statut: 'en_attente',
      })
      if (resaErr) throw resaErr
      if (form.email?.trim()) {
        try {
          await fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: form.email.trim(),
              subject: 'Confirmation de votre réservation — Roma Pizzeria Restaurant',
              html: `
                <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #FBF6EE;">
                  <h1 style="color: #B71C1C;">Roma Pizzeria Restaurant</h1>
                  <h2>Votre réservation est enregistrée ✅</h2>
                  <p>Bonjour <strong>${form.nom}</strong>,</p>
                  <p>Nous avons bien reçu votre demande de réservation pour le <strong>${form.date}</strong> à <strong>${form.heure}</strong> pour <strong>${form.couverts} couverts</strong>.</p>
                  <p>Nous vous confirmerons par téléphone dans les plus brefs délais.</p>
                  <hr style="border: 1px solid #E0D5C5; margin: 24px 0;">
                  <p style="font-size: 13px; color: #555;">💡 Vous n'avez pas encore de compte fidélité ? Créez-en un sur notre site pour cumuler des points et obtenir des avantages exclusifs !</p>
                  <p>À bientôt,<br><strong>L'équipe Roma Pizzeria Restaurant</strong></p>
                </div>
              `
            })
          })
        } catch { /* email non bloquant */ }
      }
      setSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Erreur inconnue'
      setError(`Erreur : ${msg}`)
    } finally {
      setLoading(false)
    }
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
            <button key={l} onClick={() => setLang(l)} style={{ background: lang===l?'var(--terra)':'transparent', border:`1px solid ${lang===l?'var(--terra)':'rgba(255,255,255,0.2)'}`, color: '#fff', padding: '3px 8px', borderRadius: '2px', fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Jost',sans-serif" }}>{l}</button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(40px,6vw,80px) clamp(20px,5vw,40px)' }}>
        <div style={{ width: '100%', maxWidth: '580px' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--terra)', marginBottom: '10px', display: 'block' }}>Réservation</span>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(28px,4vw,42px)', color: 'var(--text)' }}>{t('reserver_titre')}</h1>
          </div>

          {success ? (
            <div style={{ background: '#fff', border: '1px solid rgba(74,103,65,0.3)', borderRadius: '2px', padding: '48px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '22px', fontStyle: 'italic', color: 'var(--text-m)', marginBottom: '24px' }}>{t('reserver_succes')}</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => { setSuccess(false); setForm({ nom:'', telephone:'', date:'', heure:'', couverts:'2', zone:'', notes:'', email:'' }); setDispo(null) }} className="btn-secondary">{t('reserver_titre')}</button>
                <Link href="/" className="btn-primary">{t('retour')}</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid rgba(196,98,45,0.15)', borderRadius: '2px', padding: 'clamp(24px,5vw,40px)' }}>
              {/* Nom + Téléphone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="rf-label">{t('reserver_nom')}</label>
                  <input type="text" className="rf-input" placeholder={t('reserver_nom')} value={form.nom} onChange={e => setForm(p=>({...p,nom:e.target.value}))} required />
                </div>
                <div>
                  <label className="rf-label">{t('reserver_tel')}</label>
                  <input type="tel" className="rf-input" placeholder={t('reserver_tel')} value={form.telephone} onChange={e => setForm(p=>({...p,telephone:e.target.value}))} required />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginTop: '16px' }}>
                <label className="rf-label">Email <span style={{ color: '#888', fontSize: '13px' }}>(optionnel)</span></label>
                <input type="email" className="rf-input" placeholder="votre@email.com" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} />
                <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '12px', color: '#888', marginTop: '4px' }}>
                  📧 En renseignant votre email, vous recevrez une confirmation de réservation et un message après votre repas pour partager votre expérience.
                </p>
              </div>

              {/* Date + Heure */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                <div>
                  <label className="rf-label">{t('reserver_date')}</label>
                  <input type="date" className="rf-input" value={form.date}
                    onChange={e => {
                      const d = e.target.value
                      const day = new Date(d + 'T12:00:00').getDay()
                      setError(day === 1 ? t('reserver_lundi') : '')
                      setForm(p=>({...p, date: d}))
                    }} required />
                  {form.date && (() => {
                    const day = new Date(form.date + 'T12:00:00').getDay()
                    if (day === 1) return null
                    const label = horairesLabel(day)
                    return <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '11px', color: 'var(--text-l)', marginTop: '4px' }}>Horaires : {label}</p>
                  })()}
                </div>
                <div>
                  <label className="rf-label">{t('reserver_heure')}</label>
                  <input
                    type="time"
                    className="rf-input"
                    value={form.heure}
                    onChange={e => setForm(p=>({...p, heure: e.target.value}))}
                    required
                  />
                </div>
              </div>

              {/* Couverts + Zone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                <div>
                  <label className="rf-label">{t('reserver_couverts')}</label>
                  <select className="rf-select" value={form.couverts} onChange={e => setForm(p=>({...p,couverts:e.target.value}))}>
                    {[1,2,3,4,5,6,7,8,10,12].map(n => <option key={n} value={n}>{n} {n===1?'personne':'personnes'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="rf-label">{t('reserver_zone')}</label>
                  <select className="rf-select" value={form.zone} onChange={e => setForm(p=>({...p,zone:e.target.value}))}>
                    <option value="">{t('reserver_zone_indifferent')}</option>
                    <option value="rdc">{t('reserver_zone_rdc')}</option>
                    <option value="etage">{t('reserver_zone_etage')}</option>
                    <option value="terrasse">{t('reserver_zone_terrasse')}</option>
                  </select>
                </div>
              </div>

              {/* Bandeau disponibilité */}
              {checkingDispo && (
                <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(201,148,58,0.08)', borderRadius: '2px', fontFamily: "'Jost',sans-serif", fontSize: '13px', color: 'var(--text-l)' }}>
                  Vérification de la disponibilité…
                </div>
              )}
              {!checkingDispo && dispo && dispo.ok && (
                <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(74,103,65,0.08)', border: '1px solid rgba(74,103,65,0.2)', borderRadius: '2px', fontFamily: "'Jost',sans-serif", fontSize: '13px', color: '#2d5a27' }}>
                  ✅ {dispo.tablesDispo} table{dispo.tablesDispo > 1 ? 's' : ''} disponible{dispo.tablesDispo > 1 ? 's' : ''} en {ZONE_LABELS[dispo.zone]} pour {dispo.couverts} couvert{dispo.couverts > 1 ? 's' : ''}
                </div>
              )}
              {!checkingDispo && dispo && !dispo.ok && (
                <div style={{ marginTop: '12px', padding: '12px 14px', background: 'rgba(196,98,45,0.06)', border: '1px solid rgba(196,98,45,0.2)', borderRadius: '2px', fontFamily: "'Jost',sans-serif", fontSize: '13px', color: 'var(--terra)' }}>
                  <p style={{ marginBottom: '8px' }}>
                    Aucune table disponible en {ZONE_LABELS[dispo.zone]} pour {dispo.couverts} couvert{dispo.couverts > 1 ? 's' : ''} à {dispo.heure}.
                    {dispo.suggestionHeure && ` Disponible à ${dispo.suggestionHeure} dans cette zone.`}
                    {!dispo.suggestionHeure && dispo.zonesDispo && dispo.zonesDispo.length > 0 && ` ${dispo.zonesDispo.map(z => ZONE_LABELS[z]).join(', ')} est disponible à cet horaire.`}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {dispo.suggestionHeure && (
                      <button type="button"
                        onClick={() => setForm(p => ({ ...p, heure: dispo.suggestionHeure! }))}
                        style={{ padding: '5px 12px', background: 'var(--terra)', color: '#fff', border: 'none', borderRadius: '2px', fontSize: '12px', cursor: 'pointer', fontFamily: "'Jost',sans-serif" }}>
                        → {dispo.suggestionHeure} en {ZONE_LABELS[dispo.zone]}
                      </button>
                    )}
                    {(dispo.zonesDispo ?? []).map(z => (
                      <button key={z} type="button"
                        onClick={() => setForm(p => ({ ...p, zone: z }))}
                        style={{ padding: '5px 12px', background: 'var(--terra)', color: '#fff', border: 'none', borderRadius: '2px', fontSize: '12px', cursor: 'pointer', fontFamily: "'Jost',sans-serif" }}>
                        → {ZONE_LABELS[z]} à {dispo.heure}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div style={{ marginTop: '16px' }}>
                <label className="rf-label">{t('reserver_message')}</label>
                <textarea className="rf-textarea" placeholder={t('reserver_message')} value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))} />
              </div>

              {error && <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '13px', color: 'var(--terra)', marginTop: '12px', padding: '10px 14px', background: 'rgba(196,98,45,0.08)', borderRadius: '2px' }}>{error}</p>}

              <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '24px', padding: '16px', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}>
                {loading ? t('chargement') : t('reserver_btn')}
              </button>
              <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '11px', color: 'var(--text-l)', textAlign: 'center', marginTop: '14px' }}>Confirmation par téléphone · 06 68 36 62 98</p>
            </form>
          )}
        </div>
      </div>

      <footer style={{ background: 'var(--brown-d)', borderTop: '1px solid rgba(201,148,58,0.15)', padding: '20px clamp(20px,5vw,60px)', textAlign: 'center' }}>
        <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>© 2025 Roma Pizzeria Restaurant · Savigné-sur-Lathan</p>
      </footer>
    </div>
  )
}
