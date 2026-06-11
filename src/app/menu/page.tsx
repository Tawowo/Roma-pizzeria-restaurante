'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Categorie, Article, Formule } from '@/lib/supabase'
import { useLang } from '@/lib/LanguageContext'

const TAB_ICONS: Record<string, string> = {
  'Pizzas': '🍕', 'Entrées & Salades': '🥗', 'Suppléments': '➕',
  'Desserts': '🍮', 'Vins': '🍷', 'Pétillants': '🥂',
  'Apéritifs & Digestifs': '🍸', 'Boissons': '🥤',
}
const SPECIALITES = ['Alto Adige', 'Valtellina', 'Asiatica', 'Bolognese']

export default function MenuPage() {
  const { t } = useLang()
  const [categories, setCategories] = useState<Categorie[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [formules, setFormules] = useState<Formule[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('categories').select('*').eq('actif', true).order('ordre').then(({ data }) => setCategories(data ?? []))
    supabase.from('articles').select('*').order('ordre').then(({ data }) => setArticles(data ?? []))
    supabase.from('formules').select('*').eq('actif', true).order('ordre').then(({ data }) => setFormules(data ?? []))
  }, [])

  const activeCat = categories[activeTab]
  const isWine = activeCat && (activeCat.nom.includes('Vin') || activeCat.nom.includes('Pétillant'))
  const filtered = articles.filter(a => {
    if (!activeCat || a.categorie_id !== activeCat.id) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return a.nom.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q)
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bianco-w)' }}>
      {/* Header */}
      <div style={{ background: 'var(--hero-bg)', padding: '80px 20px 60px', textAlign: 'center' }}>
        <Link href="/" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Jost', textDecoration: 'none', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 24, display: 'inline-block' }}>← {t('retour')}</Link>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(36px, 5vw, 60px)', color: 'white', fontStyle: 'italic', marginBottom: 12 }}>{t('menu_titre')}</h1>
        <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontStyle: 'italic', color: 'rgba(255,255,255,0.6)' }}>{t('menu_frais')}</p>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 20px' }}>
        {/* Search */}
        <div style={{ maxWidth: 440, margin: '0 auto 40px', position: 'relative' }}>
          <input type="text" className="form-input" placeholder={`🔍 ${t('menu_recherche')}`} value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 16 }} />
        </div>

        {/* Tabs — scroll horizontal sur mobile */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 40, scrollSnapType: 'x mandatory' }}>
          {categories.map((cat, i) => (
            <button key={cat.id} onClick={() => { setActiveTab(i); setSearch('') }} style={{
              flexShrink: 0, scrollSnapAlign: 'start',
              padding: '10px 20px', borderRadius: 2,
              border: `1px solid ${activeTab === i ? 'var(--rosso)' : 'rgba(183,28,28,0.2)'}`,
              background: activeTab === i ? 'var(--rosso)' : 'transparent',
              color: activeTab === i ? '#fff' : 'var(--nero-m)',
              fontFamily: 'Jost, sans-serif', fontSize: 12, fontWeight: 500,
              letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.3s',
              whiteSpace: 'nowrap',
            }}>
              {TAB_ICONS[cat.nom] ?? ''} {cat.nom}
            </button>
          ))}
        </div>

        {/* Articles grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, marginBottom: 60 }}>
          {filtered.map(art => {
            const isVeg = art.nom === 'Végétarienne'
            const isSpec = SPECIALITES.includes(art.nom)
            return (
              <div key={art.id} style={{ background: 'white', border: '1px solid rgba(183,28,28,0.12)', borderRadius: 3, padding: '22px 24px', opacity: art.disponible ? 1 : 0.6, position: 'relative', transition: 'box-shadow 0.3s, border-color 0.3s' }}>
                {!art.disponible && (
                  <span style={{ position: 'absolute', top: 12, right: 12, background: 'var(--grigio-l)', color: 'var(--grigio)', fontFamily: 'Jost', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 2 }}>{t('menu_indisponible')}</span>
                )}
                <div style={{ display: 'flex', gap: 6, marginBottom: isVeg || isSpec ? 8 : 0, flexWrap: 'wrap' }}>
                  {isVeg && <span className="badge badge-verde">🌱 {t('menu_vegetarien')}</span>}
                  {isSpec && <span className="badge badge-rosso">🔥 {t('menu_specialite')}</span>}
                </div>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 19, color: 'var(--nero)', marginBottom: 6 }}>{art.nom}</h3>
                {art.description && (
                  <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 15, fontStyle: 'italic', color: 'var(--grigio)', lineHeight: 1.5, marginBottom: 12 }}>{art.description}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  {isWine && art.prix_pala ? (
                    <>
                      <span style={{ fontFamily: 'Jost', fontSize: 12, color: 'var(--grigio)' }}>{t('menu_verre')}</span>
                      <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--rosso)' }}>{art.prix.toFixed(2)} €</span>
                      <span style={{ fontFamily: 'Jost', fontSize: 12, color: 'var(--grigio)', marginLeft: 8 }}>{t('menu_bouteille')}</span>
                      <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--rosso)' }}>{art.prix_pala.toFixed(2)} €</span>
                    </>
                  ) : art.prix_pala ? (
                    <>
                      <span style={{ fontFamily: 'Jost', fontSize: 12, color: 'var(--grigio)' }}>33cm</span>
                      <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--rosso)' }}>{art.prix.toFixed(2)} €</span>
                      <span style={{ fontFamily: 'Jost', fontSize: 12, color: 'var(--grigio)', marginLeft: 8 }}>{t('menu_pala')}</span>
                      <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--verde)' }}>{art.prix_pala.toFixed(2)} €</span>
                    </>
                  ) : (
                    <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: 'var(--rosso)' }}>
                      {art.prix.toFixed(2)} €
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Formulas */}
        {formules.length > 0 && (
          <div style={{ background: 'var(--verde-pale)', borderRadius: 4, padding: 40, marginBottom: 40 }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, color: 'var(--nero)', textAlign: 'center', marginBottom: 32 }}>{t('menu_titre')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {formules.map(f => (
                <div key={f.id} style={{ background: 'white', borderRadius: 3, padding: 24, borderTop: '3px solid var(--verde)' }}>
                  <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: 'var(--nero)', marginBottom: 4 }}>{f.nom}</h3>
                  {f.description && <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, fontStyle: 'italic', color: 'var(--grigio)', marginBottom: 8 }}>{f.description}</p>}
                  {f.contenu && <p style={{ fontFamily: 'Jost', fontSize: 13, color: 'var(--grigio)', lineHeight: 1.5, marginBottom: 16 }}>{f.contenu}</p>}
                  <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, color: 'var(--rosso)' }}>{f.prix.toFixed(2)} €</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ padding: '14px 20px', background: 'var(--rosso-pale)', borderLeft: '3px solid var(--rosso)', borderRadius: 3 }}>
            <p style={{ fontSize: 14, color: 'var(--rosso-m)', fontFamily: 'Jost' }}>🍕 {t('menu_calzone')}</p>
          </div>
          <div style={{ padding: '14px 20px', background: 'var(--verde-pale)', borderLeft: '3px solid var(--verde)', borderRadius: 3 }}>
            <p style={{ fontSize: 14, color: 'var(--verde-m)', fontFamily: 'Jost' }}>➕ {t('menu_supplements_note')}</p>
          </div>
        </div>

        {/* CTA commander */}
        <div style={{ marginTop: 60, textAlign: 'center', padding: '40px 20px', background: 'var(--hero-bg)', borderRadius: 4 }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: 'white', marginBottom: 12 }}>{t('menu_cta_titre')}</h3>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', marginBottom: 24 }}>{t('menu_cta_desc')}</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/#commander" className="btn-primary" style={{ textDecoration: 'none' }}>🍕 {t('hero_cta_commander')}</Link>
            <Link href="/#reserver" className="btn-secondary" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>📅 {t('hero_cta_reserver')}</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
