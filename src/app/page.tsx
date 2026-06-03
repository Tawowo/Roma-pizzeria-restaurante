'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase, PlatDuJour, Article, Categorie, Formule } from '@/lib/supabase'
import { T, Lang } from '@/lib/i18n'

const HORAIRES = [
  { key: 'day_lun', day: 1, midi: false, soir: false },
  { key: 'day_mar', day: 2, midi: false, soir: true },
  { key: 'day_mer', day: 3, midi: true, soir: true },
  { key: 'day_jeu', day: 4, midi: true, soir: true },
  { key: 'day_ven', day: 5, midi: true, soir: true },
  { key: 'day_sam', day: 6, midi: true, soir: true, soir_fin: '22h00', midi_deb: '12h00', midi_fin: '14h30' },
  { key: 'day_dim', day: 0, midi: false, soir: true },
]

export default function Home() {
  const [lang, setLang] = useState<Lang>('fr')
  const [plats, setPlats] = useState<PlatDuJour[]>([])
  const [categories, setCategories] = useState<Categorie[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [formules, setFormules] = useState<Formule[]>([])
  const [catActive, setCatActive] = useState<string>('')
  const [navDark, setNavDark] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [showPWA, setShowPWA] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const t = T[lang]
  const today = new Date().getDay()

  useEffect(() => {
    Promise.all([
      supabase.from('plats_du_jour').select('*').eq('actif', true).order('created_at', { ascending: false }),
      supabase.from('categories').select('*').eq('actif', true).order('ordre'),
      supabase.from('articles').select('*').eq('disponible', true).order('ordre'),
      supabase.from('formules').select('*').eq('actif', true).order('ordre'),
    ]).then(([p, c, a, f]) => {
      if (p.data) setPlats(p.data)
      if (c.data) { setCategories(c.data); setCatActive(c.data[0]?.id || '') }
      if (a.data) setArticles(a.data)
      if (f.data) setFormules(f.data)
    })

    const handleScroll = () => setNavDark(window.scrollY > 60)
    window.addEventListener('scroll', handleScroll)

    // PWA prompt
    setTimeout(() => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      if (!isStandalone && !localStorage.getItem('pwa_dismissed')) setShowPWA(true)
    }, 8000)

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // Loader + hero animation
    const timer = setTimeout(() => setLoaded(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  // Canvas particles
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const COLS = ['#C41E3A','#2D7A3A','#D4A843','#FF3B5C','#4CAF60','#F0C060','#9B1530']
    const particles = Array.from({ length: 100 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight + window.innerHeight,
      s: Math.random() * 4 + 1,
      sp: Math.random() * 1.2 + 0.3,
      vx: (Math.random() - 0.5) * 0.8,
      op: 0, mop: Math.random() * 0.6 + 0.2,
      col: COLS[Math.floor(Math.random() * COLS.length)],
      life: Math.random() * 180, ml: Math.random() * 180 + 140,
    }))
    const dust = Array.from({ length: 150 }, () => ({
      x: Math.random() * 1800, y: Math.random() * 900,
      s: Math.random() * 1.5 + 0.3, op: Math.random() * 0.3 + 0.05,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.18,
      ph: Math.random() * Math.PI * 2,
    }))

    let raf: number
    const anim = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      dust.forEach(d => {
        d.x += d.vx; d.y += d.vy; d.ph += 0.018
        if (d.x < 0) d.x = canvas.width; if (d.x > canvas.width) d.x = 0
        if (d.y < 0) d.y = canvas.height; if (d.y > canvas.height) d.y = 0
        ctx.save(); ctx.globalAlpha = d.op * (0.7 + 0.3 * Math.sin(d.ph))
        ctx.fillStyle = '#D4A843'; ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, Math.PI * 2); ctx.fill(); ctx.restore()
      })
      particles.forEach(p => {
        p.y -= p.sp; p.x += p.vx; p.life++
        if (p.life < 25) p.op = p.life / 25 * p.mop
        else if (p.life > p.ml - 25) p.op = (p.ml - p.life) / 25 * p.mop
        else p.op = p.mop
        if (p.life >= p.ml) {
          p.x = Math.random() * canvas.width; p.y = canvas.height + 10; p.life = 0
        }
        ctx.save(); ctx.globalAlpha = p.op; ctx.fillStyle = p.col
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill(); ctx.restore()
      })
      raf = requestAnimationFrame(anim)
    }
    anim()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  const artsByCat = articles.filter(a => a.categorie_id === catActive)
  const catName = (cat: Categorie) => lang === 'it' && cat.nom_it ? cat.nom_it : lang === 'en' && cat.nom_en ? cat.nom_en : cat.nom
  const artName = (a: Article) => lang === 'it' && a.nom_it ? a.nom_it : lang === 'en' && a.nom_en ? a.nom_en : a.nom
  const artDesc = (a: Article) => lang === 'it' && a.description_it ? a.description_it : lang === 'en' && a.description_en ? a.description_en : a.description

  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <>
      {/* LOADER */}
      {!loaded && (
        <div id="loader">
          <div className="ld-logo" style={{ opacity: 1 }}>Roma</div>
          <div className="ld-sub" style={{ opacity: 1 }}>Pizzeria Restaurante</div>
          <div className="ld-bar-w"><div className="ld-bar" style={{ width: '100%', transition: 'width 1s' }} /></div>
        </div>
      )}

      {/* NAV */}
      <nav className={navDark ? 'dark' : ''}>
        <div className="nav-logo" onClick={() => goTo('hero')}>Roma <em>Pizzeria</em></div>
        <div className="nav-links">
          <div className="lang-sw">
            {(['fr','it','en'] as Lang[]).map(l => (
              <button key={l} className={`lb ${lang === l ? 'on' : ''}`} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button className="nav-link" onClick={() => goTo('about')}>{t.nav_histoire}</button>
          <button className="nav-link" onClick={() => goTo('menu')}>{t.nav_menu}</button>
          <button className="nav-link" onClick={() => goTo('horaires')}>{t.nav_horaires}</button>
          <button className="nav-cta" onClick={() => goTo('resa')}>{t.nav_reserver}</button>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero">
        <canvas ref={canvasRef} id="hc" />
        <div className="ho" />
        <div className="hcontent">
          <div className="hey" style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.8s 0.3s' }}>
            <div className="hey-l" />
            <span>{t.hero_loc}</span>
            <div className="hey-l" />
          </div>
          <h1 className="hh1" style={{ fontSize: 'clamp(44px,8vw,120px)' }}>
            <span className="hline">
              <span className="hli" style={{ transform: loaded ? 'translateY(0)' : 'translateY(110%)', transition: 'transform 1.1s 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
                Roma Pizzeria
              </span>
            </span>
            <span className="hline">
              <span className="hli" style={{ transform: loaded ? 'translateY(0)' : 'translateY(110%)', transition: 'transform 1.1s 0.6s cubic-bezier(0.16,1,0.3,1)' }}>
                <em>Restaurante</em>
              </span>
            </span>
          </h1>
          <p className="htag" style={{ fontSize: 'clamp(15px,2.2vw,22px)', opacity: loaded ? 1 : 0, transition: 'opacity 0.8s 0.9s' }}>
            {t.hero_tag}
          </p>
          <div className="hdiv" style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.6s 1.1s' }}>
            <div className="hdl" /><span style={{ color: 'var(--gold2)' }}>✦</span><div className="hdr" />
          </div>
          <div className="hbtns" style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.7s 1.2s' }}>
            <button className="bp" onClick={() => goTo('menu')}>{t.hero_btn1}</button>
            <Link href="/commander" className="bg" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              🛍 {t.hero_btn3}
            </Link>
            <button className="bo" onClick={() => goTo('resa')}>{t.hero_btn2}</button>
          </div>
        </div>
        <div className="sind" style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.6s 1.6s' }}>
          <span>{t.scroll}</span><div className="sline" />
        </div>
      </section>

      {/* STRIP TRICOLORE */}
      <div className="strip">
        {[
          { cls: 'gr', items: ['Roma Pizzeria','✦','Four à Bois','✦','Roma Pizzeria','✦','Four à Bois','✦'] },
          { cls: 'wh', items: ['Savigné-sur-Lathan','✦','Pizza Artisanale','✦','Savigné-sur-Lathan','✦','Pizza Artisanale','✦'] },
          { cls: 'rd', items: ['Produits Frais','✦','Plat du Jour','✦','Produits Frais','✦','Plat du Jour','✦'] },
        ].map(seg => (
          <div key={seg.cls} className={`strip-seg ${seg.cls}`}>
            <div className="strip-scroll">
              {seg.items.map((item, i) => <span key={i} className="strip-item">{item}</span>)}
              {seg.items.map((item, i) => <span key={`r${i}`} className="strip-item">{item}</span>)}
            </div>
          </div>
        ))}
      </div>

      {/* PLATS DU JOUR */}
      {plats.length > 0 && (
        <div className="plat">
          <div className="plat-in">
            <span className="plat-lbl">{t.plat_lbl}</span>
            {plats.map((p, i) => (
              <span key={p.id}>
                {i > 0 && <span className="plat-sep"> · </span>}
                <strong>{p.nom}</strong>
                {p.description && <span style={{ opacity: 0.8, fontSize: 15 }}> — {p.description}</span>}
                {p.prix && <span style={{ fontFamily: 'Jost', fontStyle: 'normal', fontWeight: 700, marginLeft: 8 }}>{p.prix.toFixed(2)} €</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ABOUT */}
      <section id="about" className="s" style={{ background: 'white', padding: '100px 52px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div className="rl" style={{ position: 'relative', height: 520 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 4, overflow: 'hidden', background: 'linear-gradient(155deg, #E8304A, #C41E3A, #8B1020, #3A0510)' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="280" height="360" viewBox="0 0 280 360">
                  <path d="M30,360 L30,140 Q30,20 140,20 Q250,20 250,140 L250,360 Z" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
                  <path d="M55,360 L55,145 Q55,45 140,45 Q225,45 225,145 L225,360 Z" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
                  <text x="140" y="205" textAnchor="middle" fontFamily="'Playfair Display',serif" fontSize="48" fill="rgba(255,255,255,0.92)" fontWeight="700">ROMA</text>
                  <text x="140" y="235" textAnchor="middle" fontFamily="Jost,sans-serif" fontSize="10" fill="rgba(255,255,255,0.45)" letterSpacing="10">PIZZERIA</text>
                  <text x="140" y="272" textAnchor="middle" fontFamily="'Cormorant Garamond',serif" fontSize="17" fill="rgba(255,255,255,0.55)" fontStyle="italic">Restaurante</text>
                  <rect x="100" y="295" width="14" height="20" fill="#2D7A3A" rx="1"/>
                  <rect x="114" y="295" width="14" height="20" fill="white" rx="1"/>
                  <rect x="128" y="295" width="14" height="20" fill="#C41E3A" rx="1"/>
                </svg>
              </div>
            </div>
            <div className="rs" style={{ position: 'absolute', bottom: -16, right: -24, background: 'white', borderRadius: 4, padding: '22px 28px', boxShadow: '0 24px 60px rgba(26,10,10,0.14)', border: '1px solid rgba(196,30,58,0.08)' }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 48, color: 'var(--r)', lineHeight: 1 }}>50</div>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--textl)', marginTop: 4 }}>{t.ab_t3}</div>
            </div>
            <div className="rs" style={{ position: 'absolute', top: 24, left: -20, background: 'var(--g)', borderRadius: 4, padding: '18px 22px', color: 'white' }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontStyle: 'italic' }}>Fatto a mano</div>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.65, marginTop: 3 }}>{t.ab_t3}</div>
            </div>
          </div>
          <div className="rr">
            <div className="sl sl-g">{t.ab_label}</div>
            <h2 className="st" style={{ fontSize: 'clamp(28px,4vw,52px)' }}>
              {t.ab_t1} <em>{t.ab_t2}</em><br/>{t.ab_t3}
            </h2>
            <p style={{ fontSize: 15, lineHeight: 2, color: 'var(--textm)', marginBottom: 20 }}>{t.ab_p1}</p>
            <p style={{ fontSize: 15, lineHeight: 2, color: 'var(--textm)', marginBottom: 28 }}>{t.ab_p2}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { ico: '🔥', t: t.feat1t, d: t.feat1d, border: 'var(--r)' },
                { ico: '🌿', t: t.feat2t, d: t.feat2d, border: 'var(--g)' },
                { ico: '🤝', t: t.feat3t, d: t.feat3d, border: 'var(--g)' },
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px', background: 'var(--warm)', borderRadius: 4, borderLeft: `3px solid ${f.border}` }}>
                  <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{f.ico}</div>
                  <div><strong style={{ display: 'block', fontWeight: 600, color: 'var(--dark)', fontSize: 14, marginBottom: 2 }}>{f.t}</strong>
                  <span style={{ fontSize: 13, color: 'var(--textm)', lineHeight: 1.55 }}>{f.d}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MENU */}
      <section id="menu" className="s" style={{ background: 'var(--warm)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="ru" style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="sl">{t.mn_label}</div>
            <h2 className="st" style={{ fontSize: 'clamp(28px,4vw,52px)' }}>{t.mn_title} <em>{t.mn_title2}</em></h2>
            <p style={{ fontSize: 13, color: 'var(--textl)', marginTop: 8, fontStyle: 'italic' }}>{t.mn_sub}</p>
          </div>

          {/* Formules */}
          {formules.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div className="sl sl-g" style={{ marginBottom: 20 }}>Formules</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {formules.map(f => (
                  <div key={f.id} style={{ background: 'white', borderRadius: 6, padding: 24, border: '2px solid var(--g)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--g)' }} />
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, marginBottom: 6 }}>{f.nom}</div>
                    {f.description && <div style={{ fontSize: 13, color: 'var(--textm)', marginBottom: 8, fontStyle: 'italic' }}>{f.description}</div>}
                    {f.contenu && <div style={{ fontSize: 12, color: 'var(--textl)', marginBottom: 16, lineHeight: 1.7 }}>{f.contenu}</div>}
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'var(--g)', fontWeight: 700 }}>{f.prix.toFixed(2)} €</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Catégories tabs */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setCatActive(cat.id)} style={{
                padding: '9px 20px', borderRadius: 100, fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase',
                cursor: 'pointer', border: '1.5px solid', fontFamily: 'Jost,sans-serif', transition: 'all 0.25s',
                borderColor: catActive === cat.id ? 'var(--r)' : 'rgba(196,30,58,0.2)',
                background: catActive === cat.id ? 'var(--r)' : 'transparent',
                color: catActive === cat.id ? 'white' : 'var(--textl)',
              }}>
                {catName(cat)}
              </button>
            ))}
          </div>

          {/* Articles */}
          <div>
            {catActive && (() => {
              const cat = categories.find(c => c.id === catActive)
              const isPizza = cat?.nom === 'Pizzas'
              const isSuppl = cat?.nom === 'Suppléments'
              const isVin = cat?.nom === 'Vins' || cat?.nom === 'Pétillants' || cat?.nom === 'Apéritifs & Digestifs'

              if (isSuppl) return (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {artsByCat.map(a => (
                      <div key={a.id} className="sc">
                        <span style={{ fontWeight: 500, fontSize: 14 }}>{artName(a)}</span>
                        <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, color: 'var(--r)' }}>{a.prix.toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'rgba(196,30,58,0.05)', border: '1px solid rgba(196,30,58,0.15)', padding: '14px 18px', borderRadius: 4, marginTop: 20, fontSize: 12, color: 'var(--textm)', fontStyle: 'italic' }}>
                    {t.supp_note}
                  </div>
                </div>
              )

              if (isPizza) return (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {artsByCat.map(a => (
                      <div key={a.id} className="pc" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, marginBottom: 6, fontWeight: 600 }}>{artName(a)}</div>
                        <div style={{ fontSize: 12, color: 'var(--textl)', lineHeight: 1.75, marginBottom: 16, flex: 1 }}>{artDesc(a)}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: a.prix_reduction ? 'var(--textl)' : 'var(--r)', textDecoration: a.prix_reduction ? 'line-through' : 'none' }}>
                              {a.prix.toFixed(2)} €
                            </span>
                            {a.prix_reduction && (
                              <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: 'var(--g)' }}>
                                {a.prix_reduction.toFixed(2)} €
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {a.prix_pala && <span className="bdg bdg-r">Pala {a.prix_pala.toFixed(2)} €</span>}
                            {a.prix_reduction && <span className="bdg bdg-promo">Promo</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'white', borderLeft: '3px solid var(--gold)', padding: '16px 22px', marginTop: 28, fontSize: 13, fontStyle: 'italic', color: 'var(--textl)', borderRadius: '0 4px 4px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>🫓</span>{t.calz_note}
                  </div>
                </div>
              )

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                  {artsByCat.map(a => (
                    <div key={a.id} className="lc" style={{ flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, marginBottom: 4, fontWeight: 600 }}>{artName(a)}</div>
                          {artDesc(a) && <div style={{ fontSize: 12, color: 'var(--textl)', lineHeight: 1.6, fontStyle: 'italic' }}>{artDesc(a)}</div>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {a.prix_reduction ? (
                            <div>
                              <div style={{ fontSize: 13, color: 'var(--textl)', textDecoration: 'line-through' }}>{a.prix.toFixed(2)} €</div>
                              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: 'var(--g)' }}>{a.prix_reduction.toFixed(2)} €</div>
                            </div>
                          ) : (
                            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: 'var(--r)' }}>{a.prix.toFixed(2)} €</div>
                          )}
                          {a.prix_pala && <div style={{ fontSize: 11, color: 'var(--textl)' }}>Pala {a.prix_pala.toFixed(2)} €</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      </section>

      {/* AMBIANCE */}
      <section style={{ background: 'var(--dark2)', padding: '100px 52px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 className="ru" style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(28px,4vw,52px)', color: 'white', textAlign: 'center', marginBottom: 56 }}>
            L'<em style={{ fontStyle: 'italic', color: 'var(--gold2)' }}>{t.amb_t2}</em> {t.amb_t3}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { cls: 'ac1', ico: '🔥', t: t.ac1t, d: t.ac1d },
              { cls: 'ac2', ico: '🍷', t: t.ac2t, d: t.ac2d },
              { cls: 'ac3', ico: '🌿', t: t.ac3t, d: t.ac3d },
            ].map((card, i) => (
              <div key={i} className={`ac ${card.cls} ru`} style={{ transitionDelay: `${i * 0.12}s` }}>
                <div className="ac-bg" />
                <div className="ac-ov" />
                <div className="ac-cnt">
                  <span style={{ fontSize: 28, marginBottom: 10, display: 'block' }}>{card.ico}</span>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: 'white', marginBottom: 8 }}>{card.t}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65 }}>{card.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HORAIRES */}
      <section id="horaires" style={{ background: 'var(--r)', padding: '100px 52px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
          <div className="rl">
            <div className="sl" style={{ color: 'rgba(255,255,255,0.55)' }}>{t.ho_label}</div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(28px,4vw,52px)', color: 'white', lineHeight: 1.1, marginBottom: 22 }}>
              {t.ho_t1} <em style={{ fontStyle: 'italic', color: 'var(--gold2)' }}>{t.ho_t2}</em>
            </h2>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, color: 'var(--gold2)', marginBottom: 8, fontStyle: 'italic' }}>06 68 36 62 98</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.9 }}>20 Place Jacques du Bellay<br/>37340 Savigné-sur-Lathan<br/>Indre-et-Loire · France</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {[t.hz1, t.hz2, t.hz3].map(z => (
                <span key={z} style={{ background: 'rgba(255,255,255,0.12)', color: 'white', padding: '5px 13px', borderRadius: 100, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 600 }}>{z}</span>
              ))}
            </div>
          </div>
          <div className="rr">
            {HORAIRES.map(h => {
              const isToday = h.day === today
              const tKey = h.key as keyof typeof t
              const label = String(t[tKey] || h.key)
              return (
                <div key={h.key} className={`ho-row ${isToday ? 'today' : ''}`}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: isToday ? 'var(--gold2)' : 'white' }}>{label}</span>
                  <span style={{ textAlign: 'right', fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8 }}>
                    {!h.midi && !h.soir ? <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>{t.day_fer}</span> : (
                      <>
                        {h.midi && <span>{h.key === 'day_sam' ? '12h00–14h30' : '12h00–14h00'}<br/></span>}
                        {h.soir && <span>19h00–22h00</span>}
                      </>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* RÉSERVATION */}
      <section id="resa" className="s">
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div className="ru" style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="sl">{t.resa_label}</div>
            <h2 className="st" style={{ fontSize: 'clamp(28px,4vw,52px)' }}>{t.resa_t1} <em>{t.resa_t2}</em></h2>
            <p style={{ fontSize: 15, color: 'var(--textm)', lineHeight: 1.8, marginTop: 12 }}>{t.resa_sub}</p>
          </div>
          <div className="ru" style={{ background: 'white', borderRadius: 8, padding: 40, border: '1px solid rgba(196,30,58,0.08)', boxShadow: '0 24px 80px rgba(26,10,10,0.06)' }}>
            <Link href="/reserver" className="btn-submit" style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}>
              {t.nav_reserver} →
            </Link>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--textl)', marginTop: 16 }}>{t.rf_note}</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'var(--dark)', padding: '120px 52px', textAlign: 'center' }}>
        <div className="ru" style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 className="st" style={{ color: 'white', fontSize: 'clamp(28px,4vw,52px)' }}>{t.cta_t1} <em>{t.cta_t2}</em></h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.9, marginBottom: 40 }}>{t.cta_p}</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/reserver" className="bp" style={{ textDecoration: 'none' }}>{t.cta_btn1}</Link>
            <a href="tel:0668366298" className="bo" style={{ textDecoration: 'none' }}>{t.cta_btn2}</a>
          </div>
          <a href="tel:0668366298" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: "'Playfair Display',serif", fontSize: 28, color: 'var(--gold2)', fontStyle: 'italic', textDecoration: 'none', marginTop: 28 }}>
            06 68 36 62 98
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: 'var(--dark2)', color: 'rgba(255,255,255,0.35)', padding: '40px 52px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>Roma Pizzeria Restaurante</div>
        <div style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.8 }}>
          20 Place Jacques du Bellay · 37340 Savigné-sur-Lathan<br/>
          06 68 36 62 98
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <Link href="/admin" style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textDecoration: 'none', letterSpacing: 1 }}>{t.f_admin}</Link>
          <Link href="/commander" style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textDecoration: 'none', letterSpacing: 1 }}>{t.f_cmd}</Link>
        </div>
      </footer>

      {/* PWA BANNER */}
      {showPWA && (
        <div style={{ position: 'fixed', bottom: 20, left: 16, right: 16, background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.15)', border: '1px solid rgba(196,30,58,0.15)', zIndex: 300, maxWidth: 420, margin: '0 auto' }}>
          <button onClick={() => { setShowPWA(false); localStorage.setItem('pwa_dismissed','1') }} style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--textl)' }}>✕</button>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, marginBottom: 8 }}>📱 {t.pwa_title}</div>
          <p style={{ fontSize: 13, color: 'var(--textm)', lineHeight: 1.6, marginBottom: 12 }}>{t.pwa_desc}</p>
          <div style={{ fontSize: 12, color: 'var(--textl)', lineHeight: 1.7 }}>
            <div>🍎 {t.pwa_ios}</div>
            <div>🤖 {t.pwa_android}</div>
          </div>
        </div>
      )}
    </>
  )
}
