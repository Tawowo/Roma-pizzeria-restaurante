'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LanguageContext'

interface Avis {
  id: string
  texte: string
  auteur?: string
  ville?: string
  note: number
  source: string
  created_at: string
}

export default function AvisPage() {
  const { t } = useLang()
  const [avis, setAvis] = useState<Avis[]>([])
  const [formNote, setFormNote] = useState(5)
  const [formTexte, setFormTexte] = useState('')
  const [formTel, setFormTel] = useState('')
  const [clientInfo, setClientInfo] = useState<{id:string;nom:string} | null>(null)
  const [telChecked, setTelChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [filterNote, setFilterNote] = useState(0)

  useEffect(() => {
    supabase.from('avis').select('id,texte,auteur,ville,note,source,created_at')
      .eq('statut', 'valide').order('created_at', { ascending: false })
      .then(({ data }) => setAvis((data ?? []) as Avis[]))
    const storedTel = localStorage.getItem('roma_client_tel')
    if (storedTel) setFormTel(storedTel)
  }, [])

  const checkTel = async () => {
    if (!formTel.trim()) return
    setLoading(true)
    try {
      const { data } = await supabase.from('clients').select('id,nom').eq('telephone', formTel.trim()).single()
      if (data) {
        setClientInfo(data as {id:string;nom:string})
        setTelChecked(true)
        setError('')
      } else {
        setError('Numéro inconnu. Créez un compte sur /compte pour laisser un avis et gagner des points.')
        setTelChecked(false)
      }
    } catch {
      setError('Numéro inconnu. Créez un compte fidélité pour laisser un avis.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientInfo || !formTexte.trim()) return
    setLoading(true); setError('')
    try {
      const { error: err } = await supabase.from('avis').insert({
        client_id: clientInfo.id, note: formNote, texte: formTexte.trim(),
        auteur: clientInfo.nom, source: 'site', statut: 'en_attente',
      })
      if (err) throw err
      await supabase.from('mouvements_fidelite').insert({
        client_id: clientInfo.id, points: 10, motif: 'Avis laissé ⭐',
      })
      setSuccess(true)
    } catch {
      setError('Erreur lors de la soumission. Vous avez peut-être déjà laissé un avis.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = filterNote > 0 ? avis.filter(a => a.note === filterNote) : avis
  const moyenne = avis.length > 0 ? Math.round(avis.reduce((s, a) => s + a.note, 0) / avis.length * 10) / 10 : 5

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bianco-w)' }}>
      {/* Header */}
      <div style={{ background: 'var(--hero-bg)', padding: '80px 20px 60px', textAlign: 'center' }}>
        <Link href="/" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Jost', textDecoration: 'none', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 24, display: 'inline-block' }}>← {t('retour')}</Link>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(32px,5vw,52px)', color: 'white', fontStyle: 'italic', marginBottom: 12 }}>{t('avis_titre')}</h1>
        {avis.length > 0 && (
          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.1)', padding: '8px 20px', borderRadius: 20 }}>
            <span style={{ color: 'var(--rosso-l)', fontSize: 16 }}>{'⭐'.repeat(5)}</span>
            <span style={{ fontFamily: 'Jost', fontSize: 14, color: 'white', fontWeight: 600 }}>{moyenne}/5 · {avis.length} avis</span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 20px' }}>
        {/* Filtres */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[0,5,4,3].map(n => (
            <button key={n} onClick={() => setFilterNote(n)}
              style={{ padding: '8px 18px', borderRadius: 2, border: `1px solid ${filterNote===n?'var(--rosso)':'var(--grigio-l)'}`, background: filterNote===n?'var(--rosso)':'transparent', color: filterNote===n?'white':'var(--nero-m)', fontFamily: 'Jost', fontSize: 13, cursor: 'pointer' }}>
              {n === 0 ? 'Tous' : `${'⭐'.repeat(n)} (${n}★)`}
            </button>
          ))}
        </div>

        {/* Liste avis */}
        <div style={{ display: 'grid', gap: 20, marginBottom: 60 }}>
          {filtered.map(r => (
            <div key={r.id} style={{ background: 'white', padding: '24px 28px', borderRadius: 4, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderLeft: '3px solid var(--verde)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontFamily: 'Jost', fontSize: 14, fontWeight: 600, color: 'var(--rosso)', marginBottom: 2 }}>{r.auteur ?? 'Client Roma'}</div>
                  {r.ville && <div style={{ fontSize: 12, color: 'var(--grigio)', fontFamily: 'Jost' }}>{r.ville}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: 'var(--rosso)', fontSize: 14 }}>{'⭐'.repeat(r.note)}</span>
                  <span style={{ fontSize: 11, color: 'var(--grigio)', fontFamily: 'Jost' }}>{r.source === 'facebook' ? 'Facebook' : 'Site'}</span>
                </div>
              </div>
              <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontStyle: 'italic', color: 'var(--nero-m)', lineHeight: 1.6 }}>&quot;{r.texte}&quot;</p>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--grigio)', fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontStyle: 'italic' }}>
              Aucun avis pour ce filtre
            </div>
          )}
        </div>

        {/* Formulaire avis */}
        <div style={{ background: 'var(--verde-pale)', borderRadius: 4, padding: '40px', border: '1px solid rgba(27,94,32,0.2)' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: 'var(--nero)', marginBottom: 8 }}>{t('avis_laisser')}</h2>
          <p style={{ fontSize: 13, color: 'var(--verde-m)', fontFamily: 'Jost', marginBottom: 24 }}>Partagez votre expérience et gagnez <strong>+10 points fidélité</strong> 🎁</p>

          {success ? (
            <div style={{ background: 'white', borderRadius: 3, padding: 28, textAlign: 'center', border: '1px solid var(--verde)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: 'var(--verde)', marginBottom: 8 }}>{t('avis_succes')}</h3>
              <p style={{ fontSize: 14, color: 'var(--grigio)', fontFamily: 'Jost' }}>Votre avis sera publié après validation par notre équipe. +10 points crédités.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: 4, padding: 28 }}>
              {!telChecked ? (
                <>
                  <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 8 }}>Votre téléphone (compte fidélité)</label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <input type="tel" className="form-input" placeholder="06 XX XX XX XX" value={formTel} onChange={e => setFormTel(e.target.value)} style={{ flex: 1 }} />
                    <button type="button" onClick={checkTel} className="btn-verde" disabled={loading} style={{ flexShrink: 0, padding: '10px 20px' }}>
                      {loading ? '...' : 'Valider'}
                    </button>
                  </div>
                  {error && <p style={{ fontSize: 13, color: 'var(--rosso)', marginTop: 10, fontFamily: 'Jost' }}>{error} <Link href="/compte" style={{ color: 'var(--verde)' }}>Créer un compte →</Link></p>}
                </>
              ) : (
                <>
                  <div style={{ background: 'var(--verde-pale)', padding: '12px 16px', borderRadius: 3, marginBottom: 20, fontSize: 14, color: 'var(--verde-m)', fontFamily: 'Jost' }}>
                    ✅ Connecté en tant que <strong>{clientInfo?.nom}</strong> (+10 pts après validation)
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 8 }}>{t('avis_note')}</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[5,4,3,2,1].map(n => (
                        <button key={n} type="button" onClick={() => setFormNote(n)}
                          style={{ background: formNote===n?'var(--rosso)':'transparent', border: `1px solid ${formNote===n?'var(--rosso)':'var(--grigio-l)'}`, color: formNote===n?'white':'var(--grigio)', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontFamily: 'Jost', fontSize: 13 }}>
                          {'⭐'.repeat(n)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 8 }}>{t('avis_texte')} *</label>
                    <textarea className="form-input" rows={4} placeholder={t('avis_texte')} value={formTexte} onChange={e => setFormTexte(e.target.value)} required style={{ resize: 'vertical' }} />
                  </div>
                  {error && <p style={{ fontSize: 13, color: 'var(--rosso)', marginBottom: 12, fontFamily: 'Jost' }}>{error}</p>}
                  <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: 14, opacity: loading?0.7:1 }}>
                    {loading ? t('chargement') : `⭐ ${t('avis_btn')}`}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
