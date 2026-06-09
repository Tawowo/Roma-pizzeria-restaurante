'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { T, Lang } from '@/lib/i18n'
import type { Categorie, Article, PlatDuJour, Formule } from '@/lib/supabase'

interface Particle {
  x: number; y: number; vx: number; vy: number
  r: number; color: string; alpha: number; spin: number; angle: number
}

const HORAIRES_DATA = [
  { dayKey: 'day_1' as const, heuresKey: 'h_lundi'   as const, jsDay: 1, closed: true  },
  { dayKey: 'day_2' as const, heuresKey: 'h_mardi'   as const, jsDay: 2, closed: false },
  { dayKey: 'day_3' as const, heuresKey: 'h_mercredi'as const, jsDay: 3, closed: false },
  { dayKey: 'day_4' as const, heuresKey: 'h_jeudi'   as const, jsDay: 4, closed: false },
  { dayKey: 'day_5' as const, heuresKey: 'h_vendredi'as const, jsDay: 5, closed: false },
  { dayKey: 'day_6' as const, heuresKey: 'h_samedi'  as const, jsDay: 6, closed: false },
  { dayKey: 'day_0' as const, heuresKey: 'h_dimanche'as const, jsDay: 0, closed: false },
]

export default function HomePage() {
  const [loaded, setLoaded]       = useState(false)
  const [lang, setLang]           = useState<Lang>('fr')
  const [navDark, setNavDark]     = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  const [plats, setPlats]           = useState<PlatDuJour[]>([])
  const [categories, setCategories] = useState<Categorie[]>([])
  const [articles, setArticles]     = useState<Article[]>([])
  const [formules, setFormules]     = useState<Formule[]>([])

  const [resaForm, setResaForm] = useState({
    nom: '', telephone: '', date: '', heure: '', couverts: '2', zone: '', notes: ''
  })
  const [resaLoading, setResaLoading] = useState(false)
  const [resaSuccess, setResaSuccess] = useState(false)
  const [resaError,   setResaError]   = useState('')

  const [pwaBanner, setPwaBanner]       = useState(false)
  const [deferredPrompt, setDeferred]   = useState<Event | null>(null)

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const loaderBarRef = useRef<HTMLDivElement>(null)
  const rafRef       = useRef<number>(0)
  const t = T[lang]
  const todayDay = new Date().getDay()

  /* loader */
  useEffect(() => {
    if (loaderBarRef.current) {
      const bar = loaderBarRef.current
      requestAnimationFrame(() => { bar.style.width = '100%' })
    }
    const id = setTimeout(() => setLoaded(true), 1800)
    return () => clearTimeout(id)
  }, [])

  /* nav scroll */
  useEffect(() => {
    const fn = () => setNavDark(window.scrollY > 60)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  /* PWA */
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa_dismissed')
    if (dismissed) return
    const handler = (e: Event) => { e.preventDefault(); setDeferred(e) }
    window.addEventListener('beforeinstallprompt', handler)
    const id = setTimeout(() => setPwaBanner(true), 8000)
    return () => { window.removeEventListener('beforeinstallprompt', handler); clearTimeout(id) }
  }, [])

  /* supabase */
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase.from('platdujour').select('*').eq('actif', true).lte('date_debut', today)
      .order('date_debut', { ascending: false }).limit(1)
      .then(({ data }) => setPlats(data ?? []))
    supabase.from('categorie').select('*').eq('actif', true).order('ordre')
      .then(({ data }) => setCategories(data ?? []))
    supabase.from('article').select('*').order('ordre')
      .then(({ data }) => setArticles(data ?? []))
    supabase.from('formule').select('*').eq('actif', true).order('ordre')
      .then(({ data }) => setFormules(data ?? []))
  }, [])

  /* canvas */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const COLORS = ['#C41E3A', '#4A6741', '#C9943A', '#C4622D', '#ffffff']
    let particles: Particle[] = []
    let w = 0, h = 0
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const spawn = (): Particle => ({
      x: Math.random() * w, y: h + 10,
      vx: (Math.random() - 0.5) * 0.8, vy: -(0.4 + Math.random() * 0.9),
      r: 2 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 0.5 + Math.random() * 0.4,
      spin: (Math.random() - 0.5) * 0.05,
      angle: Math.random() * Math.PI * 2,
    })
    for (let i = 0; i < 60; i++) { const p = spawn(); p.y = Math.random() * h; particles.push(p) }
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      if (Math.random() < 0.15) particles.push(spawn())
      if (particles.length > 120) particles.splice(0, 1)
      particles = particles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.angle += p.spin
        ctx.save()
        ctx.globalAlpha = p.alpha * Math.max(0, p.y / h)
        ctx.translate(p.x, p.y); ctx.rotate(p.angle)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.5)
        ctx.restore()
        return p.y > -20
      })
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize) }
  }, [])

  /* GSAP hero entrance */
  useEffect(() => {
    if (!loaded) return
    const run = async () => {
      const gsap = (await import('gsap')).default
      gsap.fromTo('#hero-badge', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.2 })
      gsap.fromTo('#hero-title', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, delay: 0.4 })
      gsap.fromTo('#hero-sub',   { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.7 })
      gsap.fromTo('#hero-btns',  { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.9 })
      gsap.fromTo('#hero-scroll',{ opacity: 0 },         { opacity: 1,        duration: 0.6, delay: 1.4 })
    }
    run()
  }, [loaded])

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }, [])

  const getArticleName = (a: Article) =>
    lang === 'it' && a.nom_it ? a.nom_it : lang === 'en' && a.nom_en ? a.nom_en : a.nom
  const getCatName = (c: Categorie) =>
    lang === 'it' && c.nom_it ? c.nom_it : lang === 'en' && c.nom_en ? c.nom_en : c.nom

  const catArticles = categories[activeTab]
    ? articles.filter(a => a.categorie_id === categories[activeTab].id)
    : []

  const minDate = () => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  const handleResa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resaForm.nom || !resaForm.telephone || !resaForm.date || !resaForm.heure) return
    const day = new Date(resaForm.date + 'T12:00:00').getDay()
    if (day === 1) { setResaError(t.resa_lundi_info); return }
    setResaLoading(true); setResaError('')
    try {
      let clientId: string | undefined
      const { data: existing } = await supabase
        .from('client').select('id').eq('telephone', resaForm.telephone).single()
      if (existing) {
        clientId = existing.id
      } else {
        const { data: nc } = await supabase
          .from('client')
          .insert({ nom: resaForm.nom, telephone: resaForm.telephone, points_fidelite: 0 })
          .select('id').single()
        clientId = nc?.id
      }
      await supabase.from('reservation').insert({
        client_id: clientId, nom: resaForm.nom, telephone: resaForm.telephone,
        date_reservation: resaForm.date, heure_reservation: resaForm.heure,
        nombre_couverts: parseInt(resaForm.couverts),
        zone: resaForm.zone || null, notes: resaForm.notes || null, statut: 'en_attente',
      })
      setResaSuccess(true)
    } catch {
      setResaError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setResaLoading(false)
    }
  }

  /* nav link style helper */
  const nlColor = (dark: boolean) => dark ? 'var(--text-m)' : 'rgba(255,255,255,0.8)'

  return (
    <>
      {/* ── LOADER ───────────────────────────────────────────── */}
      <div id="loader" className={loaded ? 'hide' : ''}>
        <div className="ld-logo">Roma</div>
        <div className="ld-sub">Savigné-sur-Lathan</div>
        <div className="ld-bar-w"><div className="ld-bar" ref={loaderBarRef} /></div>
      </div>

      {/* ── NAV ──────────────────────────────────────────────── */}
      <nav className={`site-nav${navDark ? ' dark' : ''}`}>
        <button onClick={() => scrollTo('hero')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: '22px', color: navDark ? 'var(--brown-d)' : 'var(--gold-l)', fontWeight: 600, letterSpacing: '1px' }}>Roma</span>
          <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '11px', fontWeight: 300, color: navDark ? 'var(--text-l)' : 'rgba(255,255,255,0.6)', letterSpacing: '3px', textTransform: 'uppercase' }}>Pizzeria</span>
        </button>

        <div className="hidden md:flex items-center gap-8">
          {([['histoire', t.nav_histoire], ['menu', t.nav_menu], ['horaires', t.nav_horaires]] as [string,string][]).map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost',sans-serif", fontSize: '11px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', color: nlColor(navDark), transition: 'color 0.3s ease' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--terra)')}
              onMouseLeave={e => (e.currentTarget.style.color = nlColor(navDark))}
            >{label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="hidden md:flex" style={{ gap: '4px' }}>
            {(['fr','it','en'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                background: lang === l ? 'var(--terra)' : 'transparent',
                border: `1px solid ${lang === l ? 'var(--terra)' : 'rgba(255,255,255,0.3)'}`,
                color: lang === l ? '#fff' : (navDark ? 'var(--text-l)' : 'rgba(255,255,255,0.55)'),
                padding: '3px 8px', borderRadius: '2px', fontSize: '10px', letterSpacing: '1px',
                textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Jost',sans-serif", transition: 'all 0.3s',
              }}>{l}</button>
            ))}
          </div>
          <button onClick={() => scrollTo('reservation')} className="hidden md:block btn-primary" style={{ padding: '8px 18px', fontSize: '11px', letterSpacing: '2px' }}>{t.nav_reserver}</button>
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[0,1,2].map(i => (
                <span key={i} style={{ display: 'block', width: '22px', height: '1.5px', background: navDark ? 'var(--text)' : '#fff', transition: 'all 0.3s', transformOrigin: 'center',
                  transform: menuOpen ? (i===0?'rotate(45deg) translate(4px,4px)':i===1?'scaleX(0)':'rotate(-45deg) translate(4px,-4px)') : 'none' }} />
              ))}
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'var(--brown-d)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '28px' }}>
          {([['histoire',t.nav_histoire],['menu',t.nav_menu],['horaires',t.nav_horaires],['reservation',t.nav_reserver]] as [string,string][]).map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Playfair Display',serif", fontSize: '28px', color: '#fff' }}>{label}</button>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            {(['fr','it','en'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{ background: lang===l?'var(--terra)':'transparent', border:`1px solid ${lang===l?'var(--terra)':'rgba(255,255,255,0.3)'}`, color:'#fff', padding:'6px 14px', borderRadius:'2px', fontSize:'12px', textTransform:'uppercase', cursor:'pointer', fontFamily:"'Jost',sans-serif" }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section id="hero" style={{ minHeight: '100vh', background: 'var(--brown-d)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,rgba(42,18,0,0.88) 0%,rgba(42,18,0,0.6) 50%,rgba(196,98,45,0.12) 100%)', zIndex: 1 }} />
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: 'clamp(100px,12vh,140px) 24px 80px', maxWidth: '900px', margin: '0 auto' }}>
          <div id="hero-badge" style={{ opacity: 0, marginBottom: '24px' }}>
            <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(201,148,58,0.3)', padding: '6px 18px', borderRadius: '2px' }}>{t.hero_badge}</span>
          </div>
          <div id="hero-title" style={{ opacity: 0 }}>
            <h1 style={{ lineHeight: 1, marginBottom: '12px' }}>
              <span style={{ display: 'block', fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 'clamp(56px,10vw,96px)', fontWeight: 700, color: 'var(--gold-l)', letterSpacing: '-1px' }}>{t.hero_title1}</span>
              <span style={{ display: 'block', fontFamily: "'Playfair Display',serif", fontSize: 'clamp(32px,6vw,64px)', fontWeight: 400, color: '#fff', letterSpacing: '6px', textTransform: 'uppercase' }}>{t.hero_title2}</span>
            </h1>
          </div>
          <p id="hero-sub" style={{ opacity: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(16px,2.5vw,22px)', fontStyle: 'italic', color: 'rgba(255,255,255,0.65)', margin: '24px auto', maxWidth: '480px', letterSpacing: '0.5px' }}>{t.hero_subtitle}</p>
          <div id="hero-btns" style={{ opacity: 0, display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '36px' }}>
            <button onClick={() => scrollTo('menu')} className="btn-primary" style={{ padding: '14px 32px', fontSize: '12px', letterSpacing: '2px' }}>{t.hero_cta1}</button>
            <button onClick={() => scrollTo('reservation')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', fontFamily: "'Jost',sans-serif", fontSize: '12px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', padding: '14px 32px', borderRadius: '2px', cursor: 'pointer', transition: 'background 0.3s' }}
              onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background='transparent')}
            >{t.hero_cta2}</button>
          </div>
          <div id="hero-scroll" style={{ opacity: 0, marginTop: '56px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.3)', fontFamily: "'Jost',sans-serif", fontSize: '9px', letterSpacing: '4px', textTransform: 'uppercase' }}>
            <span>{t.hero_scroll}</span>
            <span className="scroll-pulse" style={{ fontSize: '16px' }}>↓</span>
          </div>
        </div>
      </section>

      {/* ── PLAT DU JOUR ─────────────────────────────────────── */}
      {plats.length > 0 && (
        <section style={{ background: 'var(--terra-pale)', padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <span className="section-badge">{t.plat_badge}</span>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(26px,4vw,36px)', color: 'var(--brown-d)', margin: '8px 0' }}>{plats[0].nom}</h2>
            {plats[0].description && (
              <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '20px', fontStyle: 'italic', color: 'var(--text-m)', margin: '10px 0' }}>{plats[0].description}</p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '14px' }}>
              {plats[0].prix && <span style={{ fontFamily: "'Playfair Display',serif", fontSize: '28px', fontWeight: 600, color: 'var(--gold)' }}>{plats[0].prix.toFixed(2)} €</span>}
              {plats[0].prepare_par && <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '12px', color: 'var(--text-l)', letterSpacing: '1px' }}>{t.plat_prepared_by} {plats[0].prepare_par}</span>}
            </div>
          </div>
        </section>
      )}

      {/* ── NOTRE HISTOIRE ───────────────────────────────────── */}
      <section id="histoire" style={{ padding: 'clamp(60px,8vw,100px) clamp(20px,5vw,80px)', background: 'var(--cream)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '60px', alignItems: 'center' }}>
          <div>
            <span className="section-badge">{t.histoire_title}</span>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(28px,4vw,46px)', color: 'var(--text)', lineHeight: 1.2, marginBottom: '16px' }}>{t.histoire_subtitle}</h2>
            <div style={{ width: '48px', height: '1px', background: 'var(--gold)', marginBottom: '24px' }} />
            <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '20px', color: 'var(--text-m)', lineHeight: 1.7, marginBottom: '32px' }}>{t.histoire_text}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {([['🔥', t.histoire_icon1], ['🍋', t.histoire_icon2], ['❤️', t.histoire_icon3]] as [string,string][]).map(([icon, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '22px' }}>{icon}</span>
                  <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '14px', fontWeight: 400, color: 'var(--text-m)', letterSpacing: '0.5px' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'linear-gradient(135deg,var(--terra-pale),var(--warm))', borderRadius: '2px', padding: '48px 40px', border: '1px solid rgba(196,98,45,0.2)', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: '64px', color: 'var(--terra)', lineHeight: 1, marginBottom: '16px', opacity: 0.55 }}>🍕</div>
            <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '22px', fontStyle: 'italic', color: 'var(--brown)', lineHeight: 1.5 }}>&quot;L&apos;Italie dans chaque bouchée, la France dans chaque accueil&quot;</p>
            <div style={{ width: '40px', height: '1px', background: 'var(--gold)', margin: '20px auto 16px' }} />
            <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-l)' }}>Savigné-sur-Lathan · Depuis 2015</p>
          </div>
        </div>
      </section>

      {/* ── MENU ─────────────────────────────────────────────── */}
      <section id="menu" style={{ padding: 'clamp(60px,8vw,100px) clamp(20px,5vw,80px)', background: 'var(--warm)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span className="section-badge">{t.menu_title}</span>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(28px,4vw,48px)', color: 'var(--text)', marginBottom: '12px' }}>Nos saveurs</h2>
            <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '17px', fontStyle: 'italic', color: 'var(--text-l)', maxWidth: '560px', margin: '0 auto' }}>{t.menu_note}</p>
          </div>

          {categories.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '40px' }}>
              {categories.map((cat, i) => (
                <button key={cat.id} onClick={() => setActiveTab(i)} style={{
                  padding: '9px 20px', borderRadius: '2px',
                  border: `1px solid ${activeTab===i ? 'var(--terra)' : 'rgba(196,98,45,0.2)'}`,
                  background: activeTab===i ? 'var(--terra)' : 'transparent',
                  color: activeTab===i ? '#fff' : 'var(--text-m)',
                  fontFamily: "'Jost',sans-serif", fontSize: '12px', fontWeight: 500,
                  letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.3s',
                }}>{getCatName(cat)}</button>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '16px' }}>
            {catArticles.map(art => (
              <div key={art.id} style={{ background: '#fff', border: '1px solid rgba(196,98,45,0.12)', borderRadius: '2px', padding: '20px 22px', opacity: art.disponible ? 1 : 0.6, position: 'relative', transition: 'box-shadow 0.3s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.boxShadow='0 8px 32px rgba(42,18,0,0.08)')}
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.boxShadow='none')}
              >
                {!art.disponible && <span style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(42,18,0,0.07)', color: 'var(--text-l)', fontFamily: "'Jost',sans-serif", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '2px' }}>{t.menu_indisponible}</span>}
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '18px', color: 'var(--text)', marginBottom: '6px', paddingRight: !art.disponible ? '90px' : '0' }}>{getArticleName(art)}</h3>
                {art.description && <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '13px', fontWeight: 300, color: 'var(--text-l)', lineHeight: 1.5, marginBottom: '12px' }}>{art.description}</p>}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <span style={{ fontFamily: "'Playfair Display',serif", fontSize: '20px', fontWeight: 600, color: art.prix_reduction ? 'var(--text-l)' : 'var(--gold)', textDecoration: art.prix_reduction ? 'line-through' : 'none' }}>{art.prix.toFixed(2)} €</span>
                  {art.prix_reduction && <span style={{ fontFamily: "'Playfair Display',serif", fontSize: '20px', fontWeight: 600, color: 'var(--terra)' }}>{art.prix_reduction.toFixed(2)} €</span>}
                  {art.prix_pala && <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '12px', color: 'var(--text-l)' }}>Pala: {art.prix_pala.toFixed(2)} €</span>}
                </div>
              </div>
            ))}
          </div>

          {formules.length > 0 && (
            <div style={{ marginTop: '60px' }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: '32px', color: 'var(--text)', textAlign: 'center', marginBottom: '32px' }}>{t.menu_formules_title}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '16px' }}>
                {formules.map(f => (
                  <div key={f.id} style={{ background: 'var(--terra-pale)', border: '1px solid rgba(196,98,45,0.2)', borderRadius: '2px', padding: '24px' }}>
                    <h4 style={{ fontFamily: "'Playfair Display',serif", fontSize: '20px', color: 'var(--brown-d)', marginBottom: '8px' }}>{f.nom}</h4>
                    {f.description && <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '17px', fontStyle: 'italic', color: 'var(--text-m)', marginBottom: '8px' }}>{f.description}</p>}
                    {f.contenu && <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '13px', color: 'var(--text-l)', lineHeight: 1.5, marginBottom: '16px' }}>{f.contenu}</p>}
                    <span style={{ fontFamily: "'Playfair Display',serif", fontSize: '24px', fontWeight: 600, color: 'var(--gold)' }}>{f.prix.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── HORAIRES ─────────────────────────────────────────── */}
      <section id="horaires" style={{ padding: 'clamp(60px,8vw,100px) clamp(20px,5vw,80px)', background: 'var(--cream)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span className="section-badge">{t.horaires_title}</span>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(28px,4vw,48px)', color: 'var(--text)' }}>Nos horaires</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '48px', alignItems: 'start' }}>
            <div style={{ background: 'var(--brown-d)', borderRadius: '2px', padding: '32px', border: '1px solid rgba(201,148,58,0.2)' }}>
              {HORAIRES_DATA.map(({ dayKey, heuresKey, jsDay, closed }) => {
                const isToday = jsDay === todayDay
                return (
                  <div key={dayKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isToday ? '14px 12px' : '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', background: isToday ? 'rgba(201,148,58,0.1)' : 'transparent', borderRadius: isToday ? '2px' : '0', margin: isToday ? '3px -12px' : '0' }}>
                    <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '13px', fontWeight: isToday ? 500 : 300, color: isToday ? 'var(--gold-l)' : 'rgba(255,255,255,0.65)' }}>{t[dayKey]}</span>
                    <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '15px', fontStyle: closed ? 'normal' : 'italic', color: closed ? 'var(--terra-l)' : 'rgba(255,255,255,0.8)' }}>{closed ? t.horaires_closed : t[heuresKey]}</span>
                  </div>
                )
              })}
              <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px' }}>
                <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '8px' }}>📍 1 Place de l&apos;Église, 37420 Savigné-sur-Lathan</p>
                <a href="tel:0668366298" style={{ fontFamily: "'Jost',sans-serif", fontSize: '16px', fontWeight: 500, color: 'var(--gold-l)', textDecoration: 'none', letterSpacing: '1px' }}>📞 06 68 36 62 98</a>
              </div>
            </div>
            <div style={{ borderRadius: '2px', overflow: 'hidden', border: '1px solid rgba(196,98,45,0.2)', height: '420px' }}>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d5317.7!2d0.1!3d47.45!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sSavign%C3%A9-sur-Lathan%2C+France!5e0!3m2!1sfr!2sfr!4v1700000000000!5m2!1sfr!2sfr"
                width="100%" height="100%" style={{ border: 0 }}
                allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                title="Localisation Roma Pizzeria Savigné-sur-Lathan"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── RÉSERVATION ──────────────────────────────────────── */}
      <section id="reservation" style={{ padding: 'clamp(60px,8vw,100px) clamp(20px,5vw,80px)', background: 'var(--terra-pale)' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <span className="section-badge">{t.nav_reserver}</span>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(28px,4vw,44px)', color: 'var(--text)' }}>{t.resa_title}</h2>
          </div>

          {resaSuccess ? (
            <div style={{ background: '#fff', border: '1px solid rgba(74,103,65,0.3)', borderRadius: '2px', padding: 'clamp(32px,5vw,48px)', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '22px', fontStyle: 'italic', color: 'var(--text-m)', marginBottom: '20px' }}>{t.resa_success}</p>
              <button onClick={() => { setResaSuccess(false); setResaForm({ nom:'', telephone:'', date:'', heure:'', couverts:'2', zone:'', notes:'' }) }} className="btn-secondary">Nouvelle réservation</button>
            </div>
          ) : (
            <form onSubmit={handleResa} style={{ background: '#fff', border: '1px solid rgba(196,98,45,0.15)', borderRadius: '2px', padding: 'clamp(24px,5vw,40px)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div><label className="rf-label">{t.resa_nom}</label><input type="text" className="rf-input" placeholder={t.resa_ph_nom} value={resaForm.nom} onChange={e => setResaForm(p=>({...p,nom:e.target.value}))} required /></div>
                <div><label className="rf-label">{t.resa_tel}</label><input type="tel" className="rf-input" placeholder={t.resa_ph_tel} value={resaForm.telephone} onChange={e => setResaForm(p=>({...p,telephone:e.target.value}))} required /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                <div>
                  <label className="rf-label">{t.resa_date}</label>
                  <input type="date" className="rf-input" min={minDate()} value={resaForm.date}
                    onChange={e => {
                      const d = new Date(e.target.value + 'T12:00:00')
                      setResaError(d.getDay() === 1 ? t.resa_lundi_info : '')
                      setResaForm(p => ({ ...p, date: e.target.value }))
                    }} required />
                </div>
                <div>
                  <label className="rf-label">{t.resa_heure}</label>
                  <select className="rf-select" value={resaForm.heure} onChange={e => setResaForm(p=>({...p,heure:e.target.value}))} required>
                    <option value="">--:--</option>
                    {['12:00','12:30','13:00','13:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'].map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                <div>
                  <label className="rf-label">{t.resa_couverts}</label>
                  <select className="rf-select" value={resaForm.couverts} onChange={e => setResaForm(p=>({...p,couverts:e.target.value}))}>
                    {[1,2,3,4,5,6,7,8,10,12].map(n => <option key={n} value={n}>{n} {n===1?'personne':'personnes'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="rf-label">{t.resa_zone}</label>
                  <select className="rf-select" value={resaForm.zone} onChange={e => setResaForm(p=>({...p,zone:e.target.value}))}>
                    <option value="">Indifférent</option>
                    <option value="rdc">Rez-de-chaussée</option>
                    <option value="etage">Étage</option>
                    <option value="terrasse">Terrasse</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <label className="rf-label">{t.resa_notes}</label>
                <textarea className="rf-textarea" placeholder={t.resa_ph_notes} value={resaForm.notes} onChange={e => setResaForm(p=>({...p,notes:e.target.value}))} />
              </div>
              {resaError && <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '13px', color: 'var(--terra)', marginTop: '12px', padding: '10px 14px', background: 'rgba(196,98,45,0.08)', borderRadius: '2px' }}>{resaError}</p>}
              <button type="submit" className="btn-primary" disabled={resaLoading} style={{ width: '100%', marginTop: '24px', padding: '16px', justifyContent: 'center', opacity: resaLoading ? 0.7 : 1 }}>
                {resaLoading ? '...' : t.resa_submit}
              </button>
              <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '11px', color: 'var(--text-l)', textAlign: 'center', marginTop: '14px', letterSpacing: '0.5px' }}>{t.resa_note}</p>
            </form>
          )}
        </div>
      </section>

      {/* ── CTA FINALE ───────────────────────────────────────── */}
      <section style={{ background: 'var(--brown-d)', padding: 'clamp(60px,8vw,100px) 24px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 'clamp(28px,4vw,52px)', color: '#fff', marginBottom: '14px' }}>{t.cta_title}</h2>
        <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '22px', fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', marginBottom: '36px' }}>{t.cta_subtitle}</p>
        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => scrollTo('reservation')} className="btn-primary" style={{ padding: '14px 32px', fontSize: '12px', letterSpacing: '2px' }}>{t.cta_btn1}</button>
          <a href="tel:0668366298" style={{ display: 'inline-flex', alignItems: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '14px 32px', borderRadius: '2px', fontFamily: "'Jost',sans-serif", fontSize: '12px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', textDecoration: 'none', transition: 'background 0.3s' }}
            onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background='transparent')}
          >{t.cta_btn2}</a>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer style={{ background: 'var(--brown-d)', borderTop: '1px solid rgba(201,148,58,0.18)', padding: '48px clamp(20px,5vw,80px)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '32px' }}>
          <div>
            <span style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: '24px', color: 'var(--gold-l)', fontWeight: 600 }}>Roma</span>
            <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '16px', fontStyle: 'italic', color: 'rgba(255,255,255,0.35)', marginTop: '6px' }}>Pizzeria Restaurante</p>
          </div>
          <div>
            <h4 style={{ fontFamily: "'Jost',sans-serif", fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '14px' }}>{t.footer_links}</h4>
            {([['menu','menu'], ['reservation','reserver'], ] as [string,string][]).map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)} style={{ display: 'block', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost',sans-serif", fontSize: '14px', color: 'rgba(255,255,255,0.45)', padding: '3px 0', transition: 'color 0.3s', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.color='var(--gold-l)')}
                onMouseLeave={e => (e.currentTarget.style.color='rgba(255,255,255,0.45)')}
              >{label === 'menu' ? t.footer_menu : t.footer_reserver}</button>
            ))}
            <Link href="/compte" style={{ display: 'block', fontFamily: "'Jost',sans-serif", fontSize: '14px', color: 'rgba(255,255,255,0.45)', padding: '3px 0', textDecoration: 'none' }}>{t.footer_compte}</Link>
          </div>
          <div>
            <h4 style={{ fontFamily: "'Jost',sans-serif", fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '14px' }}>Contact</h4>
            <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.8 }}>{t.footer_address}</p>
            <a href="tel:0668366298" style={{ display: 'block', fontFamily: "'Jost',sans-serif", fontSize: '14px', color: 'var(--gold-l)', textDecoration: 'none', marginTop: '6px' }}>{t.footer_phone}</a>
          </div>
        </div>
        <div style={{ maxWidth: '1200px', margin: '24px auto 0', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>{t.footer_copyright}</p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link href="/admin"    style={{ fontFamily: "'Jost',sans-serif", fontSize: '11px', color: 'rgba(255,255,255,0.15)', textDecoration: 'none' }}>Admin</Link>
            <Link href="/commander" style={{ fontFamily: "'Jost',sans-serif", fontSize: '11px', color: 'rgba(255,255,255,0.15)', textDecoration: 'none' }}>Commander</Link>
          </div>
        </div>
      </footer>

      {/* ── PWA BANNER ───────────────────────────────────────── */}
      {pwaBanner && (
        <div className="pwa-banner">
          <span>📱 {t.pwa_install}</span>
          {deferredPrompt && (
            <button className="btn-primary" style={{ padding: '7px 14px', fontSize: '11px', letterSpacing: '1px', whiteSpace: 'nowrap' }}
              onClick={async () => {
                (deferredPrompt as unknown as { prompt: () => void }).prompt()
                setPwaBanner(false); localStorage.setItem('pwa_dismissed','1')
              }}
            >Installer</button>
          )}
          <button onClick={() => { setPwaBanner(false); localStorage.setItem('pwa_dismissed','1') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
      )}
    </>
  )
}
