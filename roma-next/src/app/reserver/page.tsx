'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const MIDI = ['12:00','12:15','12:30','12:45','13:00','13:15','13:30','13:45']
const SOIR = ['19:00','19:15','19:30','19:45','20:00','20:15','20:30','20:45','21:00','21:15','21:30']

function getSlots(date: string) {
  if (!date) return []
  const d = new Date(date + 'T12:00:00')
  const day = d.getDay()
  if (day === 1) return []
  if ([3,4,5,6].includes(day)) return [...MIDI, ...SOIR]
  return SOIR
}

export default function ReserverPage() {
  const [nom, setNom] = useState('')
  const [tel, setTel] = useState('')
  const [date, setDate] = useState('')
  const [heure, setHeure] = useState('')
  const [couverts, setCouverts] = useState(2)
  const [zone, setZone] = useState('indiff')
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const slots = getSlots(date)
  const minDate = new Date(); minDate.setDate(minDate.getDate() + 1)

  const submit = async () => {
    setErr('')
    if (!nom.trim()) { setErr('Veuillez entrer votre nom'); return }
    if (!tel.trim()) { setErr('Le téléphone est obligatoire'); return }
    if (!date) { setErr('Choisissez une date'); return }
    if (!heure) { setErr('Choisissez un horaire'); return }
    setLoading(true)
    const { error } = await supabase.from('reservations').insert({
      nom, telephone: tel, date_reservation: date,
      heure_reservation: heure, nombre_couverts: couverts,
      zone, notes: notes || null, statut: 'en_attente',
    })
    setLoading(false)
    if (error) { setErr('Erreur. Appelez le 06 68 36 62 98'); return }
    setSuccess(true)
  }

  if (success) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🍕</div>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, marginBottom: 12 }}>Réservation envoyée !</h1>
        <p style={{ fontSize: 15, color: 'var(--textm)', lineHeight: 1.8, marginBottom: 12 }}>
          Merci <strong>{nom}</strong>, votre demande pour le{' '}
          <strong>{new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>{' '}
          à <strong>{heure}</strong> pour <strong>{couverts} personne{couverts > 1 ? 's' : ''}</strong> a bien été reçue.
        </p>
        <p style={{ fontSize: 13, color: 'var(--textl)', marginBottom: 28 }}>
          Nous vous confirmons par téléphone au <a href="tel:0668366298" style={{ color: 'var(--r)' }}>06 68 36 62 98</a>
        </p>
        <Link href="/" className="bp" style={{ textDecoration: 'none', display: 'inline-block' }}>← Retour à l'accueil</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <header style={{ background: 'var(--dark)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none', fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'white' }}>Roma <em style={{ color: 'var(--gold2)' }}>Pizzeria</em></Link>
        <a href="tel:0668366298" style={{ color: 'var(--gold2)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>06 68 36 62 98</a>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '48px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="sl" style={{ textAlign: 'center' }}>Réservation</div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 40, marginBottom: 12 }}>Réservez <em style={{ color: 'var(--r)' }}>votre table</em></h1>
          <p style={{ fontSize: 15, color: 'var(--textm)', lineHeight: 1.8 }}>Pour une soirée en famille, un dîner romantique ou une occasion spéciale.</p>
        </div>

        <div style={{ background: 'white', borderRadius: 8, padding: '36px', border: '1px solid rgba(196,30,58,0.08)', boxShadow: '0 24px 80px rgba(26,10,10,0.06)', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label className="rf-label">Nom *</label><input className="rf-input" value={nom} onChange={e => setNom(e.target.value)} placeholder="Dupont" /></div>
            <div><label className="rf-label">Téléphone *</label><input className="rf-input" value={tel} onChange={e => setTel(e.target.value)} placeholder="06 XX XX XX XX" type="tel" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="rf-label">Date *</label>
              <input className="rf-input" type="date" value={date} onChange={e => { setDate(e.target.value); setHeure('') }} min={minDate.toISOString().split('T')[0]} />
              {date && slots.length === 0 && <div style={{ fontSize: 12, color: 'var(--r)', marginTop: 4 }}>Fermé ce jour-là</div>}
            </div>
            <div>
              <label className="rf-label">Personnes *</label>
              <select className="rf-select" value={couverts} onChange={e => setCouverts(Number(e.target.value))}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} personne{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>
          {slots.length > 0 && (
            <div>
              <label className="rf-label">Heure souhaitée *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {slots.map(s => (
                  <button key={s} onClick={() => setHeure(s)} className={`slot ${heure === s ? 'sel' : ''}`}>{s}</button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="rf-label">Zone préférée</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[{v:'indiff',l:'Indifférent'},{v:'rdc',l:'RDC'},{v:'etage',l:'Étage'},{v:'terrasse',l:'Terrasse'}].map(z => (
                <button key={z.v} onClick={() => setZone(z.v)} className={`zone-btn ${zone === z.v ? 'sel' : ''}`}>{z.l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="rf-label">Notes / Occasion spéciale</label>
            <textarea className="rf-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Occasion spéciale, allergie, demande particulière..." />
          </div>
          {err && <div style={{ color: 'var(--r)', fontSize: 13, textAlign: 'center' }}>{err}</div>}
          <button className="btn-submit" onClick={submit} disabled={loading || slots.length === 0 || !heure}>
            {loading ? 'Envoi...' : 'Confirmer ma réservation'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--textl)' }}>
            En cas de besoin, n'hésitez pas à nous appeler au <a href="tel:0668366298" style={{ color: 'var(--r)' }}>06 68 36 62 98</a>
          </p>
        </div>
      </div>
    </div>
  )
}
