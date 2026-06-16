'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LanguageContext'
import type { Lang } from '@/lib/translations'

export default function ReserverPage() {
  const { lang, setLang, t } = useLang()
  const [form, setForm] = useState({
    nom: '', telephone: '', date: '', heure: '', couverts: '2', zone: '', notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const day = new Date(form.date + 'T12:00:00').getDay()
    if (day === 1) { setError(t('reserver_lundi')); return }
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
      const { error: resaErr } = await supabase.from('reservations').insert({
        client_id: clientId ?? null,
        nom: form.nom,
        telephone: form.telephone,
        date_reservation: form.date,
        heure_reservation: form.heure,
        nombre_couverts: parseInt(form.couverts),
        zone_preference: form.zone || null,
        notes: form.notes || null,
        statut: 'en_attente',
      })
      if (resaErr) throw resaErr
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
                <button onClick={() => { setSuccess(false); setForm({ nom:'', telephone:'', date:'', heure:'', couverts:'2', zone:'', notes:'' }) }} className="btn-secondary">{t('reserver_titre')}</button>
                <Link href="/" className="btn-primary">{t('retour')}</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid rgba(196,98,45,0.15)', borderRadius: '2px', padding: 'clamp(24px,5vw,40px)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div><label className="rf-label">{t('reserver_nom')}</label><input type="text" className="rf-input" placeholder={t('reserver_nom')} value={form.nom} onChange={e => setForm(p=>({...p,nom:e.target.value}))} required /></div>
                <div><label className="rf-label">{t('reserver_tel')}</label><input type="tel" className="rf-input" placeholder={t('reserver_tel')} value={form.telephone} onChange={e => setForm(p=>({...p,telephone:e.target.value}))} required /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                <div>
                  <label className="rf-label">{t('reserver_date')}</label>
                  <input type="date" className="rf-input" value={form.date}
                    onChange={e => { setError(new Date(e.target.value+'T12:00:00').getDay()===1?t('reserver_lundi'):''); setForm(p=>({...p,date:e.target.value})) }} required />
                </div>
                <div>
                  <label className="rf-label">{t('reserver_heure')}</label>
                  <select className="rf-select" value={form.heure} onChange={e => setForm(p=>({...p,heure:e.target.value}))} required>
                    <option value="">--:--</option>
                    {['12:00','12:30','13:00','13:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'].map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
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
