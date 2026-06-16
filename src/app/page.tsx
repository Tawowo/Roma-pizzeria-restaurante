'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { T, Lang } from '@/lib/i18n'
import { useLang } from '@/lib/LanguageContext'
import type { Categorie, Article, PlatDuJour, Formule } from '@/lib/supabase'

interface Particle {
  x: number; y: number; vx: number; vy: number
  r: number; color: string; alpha: number; spin: number; angle: number
}

const TAB_ICONS = ['🍕', '🥗', '➕', '🍮', '🍷', '🥂', '🍸', '🥤']
const SPECIALITES = ['Burrata', 'Valtellina', 'Asiatica', 'Bolognese']

export default function HomePage() {
  const [loaded, setLoaded] = useState(false)
  const { lang, setLang } = useLang()
  const [navScrolled, setNavScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [menuSearch, setMenuSearch] = useState('')
  const [plats, setPlats] = useState<PlatDuJour[]>([])
  const [categories, setCategories] = useState<Categorie[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [formules, setFormules] = useState<Formule[]>([])
  const [parametre, setParametre] = useState<{ msg_fermeture?: string; site_ouvert?: string }>({})
  const [resaForm, setResaForm] = useState({ nom: '', telephone: '', date: '', heure: '', couverts: '2', zone: '', notes: '' })
  const [resaLoading, setResaLoading] = useState(false)
  const [resaSuccess, setResaSuccess] = useState(false)
  const [resaError, setResaError] = useState('')
  const [cmdForm, setCmdForm] = useState({ nom: '', telephone: '', date: '', heure: '', notes: '' })
  const [cmdItems, setCmdItems] = useState<{ pizzaId: string; nom: string; prix33: number; prixPala: number; qty: number; taille: '33cm' | 'pala'; calzone: boolean }[]>([])
  const [cmdStep, setCmdStep] = useState<1 | 2>(1)
  const [cmdLoading, setCmdLoading] = useState(false)
  const [cmdSuccess, setCmdSuccess] = useState(false)
  const [cmdError, setCmdError] = useState('')
  const [cmdPizzaSelect, setCmdPizzaSelect] = useState('')
  const [cmdPizzaQty, setCmdPizzaQty] = useState(1)
  const [cmdPizzaTaille, setCmdPizzaTaille] = useState<'33cm' | 'pala'>('33cm')
  const [cmdPizzaCalzone, setCmdPizzaCalzone] = useState(false)
  const [pwaBanner, setPwaBanner] = useState(false)
  const [heroStats, setHeroStats] = useState({ annees: '15', nb_pizzas: '16', familles: '13', frais: '100' })
  const [avisData, setAvisData] = useState<{id:string;texte:string;auteur?:string;ville?:string;note:number;source:string}[]>([])
  const [avisMoyenne, setAvisMoyenne] = useState(5)
  const [cmdClientDetecte, setCmdClientDetecte] = useState<{nom:string;pts:number} | null>(null)
  const [cmdTelSearch, setCmdTelSearch] = useState(false)
  const [resaClientDetecte, setResaClientDetecte] = useState<{nom:string} | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loaderBarRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const t = T[lang]

  const bandeauVisible = !!(parametre.msg_fermeture || parametre.site_ouvert === 'false')

  /* Loader */
  useEffect(() => {
    const bar = loaderBarRef.current
    if (bar) {
      let w = 0
      const interval = setInterval(() => {
        w = Math.min(100, w + (100 / (1500 / 50)))
        bar.style.width = w + '%'
        if (w >= 100) clearInterval(interval)
      }, 50)
    }
    const id = setTimeout(() => setLoaded(true), 1800)
    return () => clearTimeout(id)
  }, [])

  /* Nav scroll */
  useEffect(() => {
    const fn = () => setNavScrolled(window.scrollY > 60)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  /* PWA banner */
  useEffect(() => {
    if (localStorage.getItem('roma_pwa_dismissed') === 'true') { setPwaBanner(false); return }
    const id = setTimeout(() => setPwaBanner(true), 10000)
    return () => clearTimeout(id)
  }, [])

  /* Supabase */
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase.from('plats_du_jour').select('*').eq('actif', true).lte('date_debut', today)
      .order('date_debut', { ascending: false })
      .then(({ data }) => setPlats(data ?? []))
    supabase.from('categories').select('*').eq('actif', true).order('ordre')
      .then(({ data }) => setCategories(data ?? []))
    supabase.from('articles').select('*').order('ordre')
      .then(({ data }) => setArticles(data ?? []))
    supabase.from('formules').select('*').eq('actif', true).order('ordre')
      .then(({ data }) => setFormules(data ?? []))
    supabase.from('parametres').select('*')
      .then(({ data }) => {
        if (data) {
          const obj: Record<string, string> = {}
          data.forEach((r: { cle: string; valeur: string }) => { obj[r.cle] = r.valeur })
          setParametre(obj)
        }
      })
    supabase.from('parametres').select('cle,valeur').in('cle', ['hero_annees','hero_nb_pizzas','hero_familles','hero_frais'])
      .then(({ data }) => {
        if (data) {
          const map: Record<string,string> = {}
          data.forEach((r: {cle:string;valeur:string}) => { map[r.cle] = r.valeur })
          setHeroStats({
            annees: map['hero_annees'] ?? '15',
            nb_pizzas: map['hero_nb_pizzas'] ?? '16',
            familles: map['hero_familles'] ?? '13',
            frais: map['hero_frais'] ?? '100',
          })
        }
      })
    supabase.from('avis').select('id,texte,auteur,ville,note,source').eq('statut','valide').order('created_at',{ascending:false}).limit(6)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAvisData(data)
          const moy = data.reduce((s: number, a: {note:number}) => s + a.note, 0) / data.length
          setAvisMoyenne(Math.round(moy * 10) / 10)
        }
      })
  }, [])

  /* Canvas particles */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const COLORS = ['#1B5E20', '#B71C1C', '#FFFFFF', '#D4A843']
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
      gsap.fromTo('#hero-title', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, delay: 0.4 })
      gsap.fromTo('#hero-sub', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.7 })
      gsap.fromTo('#hero-btns', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.9 })
      gsap.fromTo('#hero-counters', { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 1.2 })
    }
    run()
  }, [loaded])

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
        .from('clients').select('id').eq('telephone', resaForm.telephone).single()
      if (existing) {
        clientId = existing.id
      } else {
        const { data: nc } = await supabase
          .from('clients')
          .insert({ nom: resaForm.nom, telephone: resaForm.telephone, points: 0, nb_visites: 0 })
          .select('id').single()
        clientId = nc?.id
      }
      await supabase.from('reservations').insert({
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

  const getCatName = (c: Categorie) =>
    lang === 'it' && c.nom_it ? c.nom_it : lang === 'en' && c.nom_en ? c.nom_en : c.nom
  const getArticleName = (a: Article) =>
    lang === 'it' && a.nom_it ? a.nom_it : lang === 'en' && a.nom_en ? a.nom_en : a.nom

  const activeCat = categories[activeTab]
  const catArticles = activeCat
    ? articles.filter(a => {
        if (a.categorie_id !== activeCat.id) return false
        if (!menuSearch.trim()) return true
        const q = menuSearch.toLowerCase()
        return getArticleName(a).toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q)
      })
    : []

  const isWineTab = activeCat && (activeCat.nom.includes('Vin') || activeCat.nom.includes('Pétillant'))

  const nowOpen = (() => {
    const now = new Date()
    const day = now.getDay()
    const h = now.getHours() + now.getMinutes() / 60
    if (day === 1) return false
    if (day === 2 || day === 0) return h >= 19 && h < 21.5
    if (day >= 3 && day <= 5) return (h >= 12 && h < 14.5) || (h >= 19 && h < 21.5)
    if (day === 6) return (h >= 12 && h < 14.5) || (h >= 19 && h < 22)
    return false
  })()

  const todayDay = new Date().getDay()

  return (
    <>
      {/* LOADER */}
      {!loaded && (
        <div id="loader">
          <div className="ld-logo">Roma</div>
          <div className="ld-flag">🇮🇹</div>
          <div className="ld-sub">Savigné-sur-Lathan · Indre-et-Loire</div>
          <div className="ld-bar-w"><div className="ld-bar" ref={loaderBarRef} /></div>
        </div>
      )}

      {/* BANDEAU URGENCE */}
      {bandeauVisible && (
        <div style={{ background: 'var(--rosso)', color: 'white', textAlign: 'center', padding: '10px', fontSize: '14px', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300 }}>
          {parametre.site_ouvert === 'false' ? '⚠️ Fermé exceptionnellement — Réouverture prochaine' : `⚠️ ${parametre.msg_fermeture}`}
        </div>
      )}

      {/* NAV */}
      <nav className={navScrolled ? 'scrolled' : ''} style={{ top: bandeauVisible ? 40 : 0 }}>
        {/* Logo — toujours visible */}
        <a href="/" style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontStyle: 'italic', color: navScrolled ? 'var(--rosso)' : 'white', textDecoration: 'none', fontWeight: 700 }}>
          Roma <span style={{ fontStyle: 'normal', fontWeight: 400, fontSize: 18, color: navScrolled ? 'var(--nero)' : 'rgba(255,255,255,0.7)' }}>Pizzeria</span>
        </a>
        {/* Links desktop uniquement */}
        <div className="nav-desktop-links">
          {[
            { label: 'Histoire', href: '#histoire' },
            { label: 'Menu', href: '/menu', isLink: true },
            { label: 'Commander', href: '#commander', isRed: true },
            { label: 'Horaires', href: '#horaires' },
            { label: 'Réserver', href: '#reserver' },
          ].map(item => item.isLink ? (
            <Link key={item.label} href={item.href}
              style={{ color: navScrolled ? 'var(--nero-m)' : 'white', fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'Jost', fontWeight: 500 }}>
              {item.label}
            </Link>
          ) : (
            <a key={item.label} href={item.href}
              style={{ color: item.isRed ? 'var(--rosso)' : (navScrolled ? 'var(--nero-m)' : 'white'), fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'Jost', fontWeight: item.isRed ? 600 : 500 }}>
              {item.label}
            </a>
          ))}
        </div>
        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Lang switcher — desktop uniquement */}
          <div className="nav-desktop-links" style={{ gap: 4 }}>
            {(['fr', 'it', 'en'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)}
                style={{ background: lang === l ? 'var(--rosso)' : 'transparent', color: lang === l ? 'white' : (navScrolled ? 'var(--nero)' : 'white'), border: '1px solid', borderColor: lang === l ? 'var(--rosso)' : (navScrolled ? 'var(--grigio-l)' : 'rgba(255,255,255,0.4)'), borderRadius: 2, padding: '3px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'Jost', letterSpacing: 1 }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <Link href="/compte" className="nav-desktop-links" style={{ color: navScrolled ? 'var(--verde)' : 'var(--verde-l)', fontSize: 12, fontFamily: 'Jost', textDecoration: 'none' }}>Mon compte</Link>
          <a href="#reserver" className="btn-primary nav-desktop-links" style={{ padding: '8px 20px', fontSize: 12, textDecoration: 'none' }}>Réserver</a>
          {/* Hamburger — mobile uniquement */}
          <button onClick={() => setMenuOpen(v => !v)} className="nav-mobile-only" aria-label="Menu" style={{ background: 'none', border: 'none', color: navScrolled ? 'var(--nero)' : 'white', cursor: 'pointer', fontSize: 26, lineHeight: 1, padding: 4 }}>☰</button>
        </div>
      </nav>

      {/* MOBILE DRAWER */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--hero-bg)', zIndex: 400, display: 'flex', flexDirection: 'column', padding: '60px 32px 32px', overflow: 'auto' }}>
          <button onClick={() => setMenuOpen(false)} aria-label="Fermer" style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 32, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          <div style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: 28, color: 'white', marginBottom: 40 }}>Roma <span style={{ fontStyle: 'normal', fontSize: 18, color: 'rgba(255,255,255,0.4)' }}>Pizzeria</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {[
              { label: '🏠 Accueil', href: '/' },
              { label: '📖 Notre histoire', href: '#histoire' },
              { label: '🍕 Notre menu', href: '/menu' },
              { label: '🍕 Commander à emporter', href: '#commander' },
              { label: '📅 Réserver une table', href: '#reserver' },
              { label: '⏰ Horaires & Localisation', href: '#horaires' },
              { label: '🎁 Mon compte fidélité', href: '/compte' },
            ].map(item => item.href.startsWith('/') && item.href !== '/' ? (
              <Link key={item.label} href={item.href} onClick={() => setMenuOpen(false)}
                style={{ color: 'rgba(255,255,255,0.85)', fontSize: 20, fontFamily: 'Playfair Display, serif', fontStyle: 'italic', textDecoration: 'none', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {item.label}
              </Link>
            ) : (
              <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}
                style={{ color: 'rgba(255,255,255,0.85)', fontSize: 20, fontFamily: 'Playfair Display, serif', fontStyle: 'italic', textDecoration: 'none', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {item.label}
              </a>
            ))}
          </div>
          {/* Lang switcher dans le drawer */}
          <div style={{ display: 'flex', gap: 8, marginTop: 32 }}>
            {(['fr', 'it', 'en'] as Lang[]).map(l => (
              <button key={l} onClick={() => { setLang(l); setMenuOpen(false) }}
                style={{ background: lang === l ? 'var(--rosso)' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 2, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'Jost', letterSpacing: 1 }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* HERO */}
      <section style={{ height: '100vh', background: 'var(--hero-bg)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <img src="https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=1920" alt="" loading="lazy"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.15, animation: 'kenburns 20s ease infinite' }} />
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <div id="hero-content" style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '0 20px' }}>
          <div style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 24, fontFamily: 'Jost' }}>
            🇮🇹 Authentique cuisine italienne · Savigné-sur-Lathan
          </div>
          <div id="hero-title" style={{ opacity: 0 }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(56px, 8vw, 96px)', fontStyle: 'italic', color: 'white', lineHeight: 1, marginBottom: 8 }}>Roma</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(36px, 5vw, 72px)', color: 'white', lineHeight: 1, marginBottom: 24, fontWeight: 400 }}>Pizzeria</div>
          </div>
          <div id="hero-sub" style={{ opacity: 0, fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(16px, 2.5vw, 22px)', fontStyle: 'italic', color: 'rgba(255,255,255,0.7)', marginBottom: 40, maxWidth: 600 }}>
            Une famille italienne vous accueille · Four à bois · Produits frais · Recettes transmises de génération en génération
          </div>
          <div id="hero-btns" style={{ opacity: 0, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#menu" className="btn-primary">Découvrir le menu</a>
            <a href="#reserver" style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 3, padding: '12px 28px', fontFamily: 'Jost', fontWeight: 500, textDecoration: 'none', transition: 'all 0.3s ease' }}>Réserver une table</a>
            <Link href="/compte" style={{ background: 'transparent', color: 'var(--verde-l)', border: '1px solid var(--verde-l)', borderRadius: 3, padding: '12px 28px', fontFamily: 'Jost', fontWeight: 500, textDecoration: 'none', transition: 'all 0.3s ease' }}>Mon compte fidélité</Link>
          </div>
          <div id="hero-counters" style={{ opacity: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginTop: 60, maxWidth: 600, margin: '60px auto 0' }}>
            {[
              { icon: '🔥', val: `+${heroStats.annees}`, label: "ans d'expérience" },
              { icon: '🍕', val: `+${heroStats.nb_pizzas}`, label: 'pizzas au menu' },
              { icon: '⭐', val: `+${heroStats.familles}`, label: 'familles fidèles' },
              { icon: '🫒', val: `${heroStats.frais}%`, label: 'produits frais' },
            ].map(c => (
              <div key={c.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24 }}>{c.icon}</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: 'var(--rosso)', fontWeight: 700 }}>{c.val}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Jost', letterSpacing: 0.5 }}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 2, fontFamily: 'Jost' }}>
          DÉFILER ↓
        </div>
      </section>

      {/* PLAT DU JOUR */}
      {plats.length > 0 && (
        <section style={{ background: 'var(--verde-pale)', padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <span className="badge badge-rosso" style={{ marginBottom: 20, display: 'inline-block' }}>🍽 Suggestion du jour</span>
            <div style={{ display: 'grid', gridTemplateColumns: plats.length > 1 ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr', gap: 24, maxWidth: plats.length === 1 ? 500 : 900, margin: '0 auto' }}>
              {plats.map(p => (
                <div key={p.id} style={{ background: 'white', borderRadius: 4, padding: 32, boxShadow: '0 4px 20px rgba(27,94,32,0.1)', borderLeft: '3px solid var(--verde)' }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: 'var(--nero)', marginBottom: 8 }}>{p.nom}</div>
                  {p.description && <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontStyle: 'italic', color: 'var(--grigio)', marginBottom: 16 }}>{p.description}</div>}
                  {p.prix && <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--rosso)' }}>{p.prix.toFixed(2)} €</div>}
                </div>
              ))}
            </div>
            <p style={{ marginTop: 20, fontFamily: 'Cormorant Garamond, serif', fontSize: 16, fontStyle: 'italic', color: 'var(--verde-m)' }}>
              Préparé ce matin par Monica avec des produits locaux
            </p>
          </div>
        </section>
      )}

      {/* NOTRE HISTOIRE */}
      <section id="histoire" style={{ padding: '100px 20px', background: 'var(--bianco-c)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <span className="badge badge-verde" style={{ marginBottom: 20, display: 'inline-block' }}>Notre histoire</span>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(32px, 3vw, 42px)', color: 'var(--nero)', marginBottom: 24, lineHeight: 1.2 }}>
              Une trattoria au cœur <em style={{ color: 'var(--rosso)' }}>du village</em>
            </h2>
            <div className="section-divider"></div>
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontStyle: 'italic', color: 'var(--grigio)', marginBottom: 40, borderLeft: '3px solid var(--verde)', paddingLeft: 20, maxWidth: 600, margin: '0 auto 40px', textAlign: 'left' }}>
              &quot;La pizza, c&apos;est l&apos;amour qu&apos;on met dans la pâte&quot; — Roberto
            </p>
          </div>

          {/* 3 portraits famille */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, marginBottom: 60 }}>
            {[
              {
                icon: '🔥', name: 'Roberto', role: 'Le Chef Pizzaiolo',
                img: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400',
                text: "Originaire de Calabre, Roberto a grandi dans la tradition de la pizza napolitaine. Son four à pizza Morello Forni — de fabrication italienne, sole rotative — et ses recettes transmises de génération en génération font de chaque pizza une œuvre unique.",
                color: 'var(--rosso)'
              },
              {
                icon: '🌿', name: 'Monica', role: 'La Cuisinière',
                img: 'https://images.unsplash.com/photo-1607631568010-a87245c0daf8?w=400',
                text: "Monica apporte chaque jour sa touche créative avec ses plats cuisinés maison — lasagnes, risottos, pâtes fraîches. Le plat du jour, c'est son territoire, et il change selon les saisons et son inspiration.",
                color: 'var(--verde)'
              },
              {
                icon: '🍽', name: 'Andreï', role: "L'Accueil",
                img: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400',
                text: "Andreï est le visage de Roma. Toujours souriant, il gère les réservations, les commandes et s'assure que chaque client reparte avec le sourire. C'est lui que vous entendez au téléphone !",
                color: 'var(--rosso)'
              },
            ].map(p => (
              <div key={p.name} style={{ background: 'white', borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderTop: `3px solid ${p.color}` }}>
                {/* IMAGE REMPLAÇABLE — demander la photo à la famille (400x400px carrée) */}
                <img src={p.img} alt={`${p.name} — Roma Pizzeria`} loading="lazy"
                  style={{ width: '100%', height: 220, objectFit: 'cover', objectPosition: 'top' }} />
                <div style={{ padding: 24 }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{p.icon}</div>
                  <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: 'var(--nero)', marginBottom: 2 }}>{p.name}</h3>
                  <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: p.color, fontFamily: 'Jost', fontWeight: 500, marginBottom: 12 }}>{p.role}</div>
                  <p style={{ fontSize: 14, color: 'var(--grigio)', lineHeight: 1.7, fontFamily: 'Jost' }}>{p.text}</p>
                  {p.name === 'Roberto' && (
                    <div style={{ marginTop: 12, background: 'var(--rosso)', color: 'white', padding: '8px 14px', borderRadius: 3, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: 'Jost', fontWeight: 600 }}>
                      🏆 7× lauréat Meilleure Pizza de Tours
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Timeline + icônes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 48, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
                {[
                  { icon: '📍', title: 'Origines en Italie', desc: "Pâtes fraîches pétries chaque matin, recette secrète transmise de génération en génération" },
                  { icon: '🏡', title: 'Installation en Touraine', desc: 'Ouverture de Roma à Savigné-sur-Lathan' },
                  { icon: '❤️', title: "Aujourd'hui", desc: 'La même passion, les mêmes recettes, toute la famille' },
                ].map(step => (
                  <div key={step.title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{step.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--nero)', fontSize: 14, fontFamily: 'Jost' }}>{step.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--grigio)', marginTop: 2 }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[{ icon: '🔥', label: 'Four Morello Forni' }, { icon: '🍋', label: 'Produits frais' }, { icon: '❤️', label: 'Accueil chaleureux' }].map(i => (
                  <div key={i.label} style={{ textAlign: 'center', padding: '16px 8px', background: 'white', borderRadius: 3, borderBottom: '2px solid var(--verde)' }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{i.icon}</div>
                    <div style={{ fontSize: 11, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', letterSpacing: 0.5 }}>{i.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              {/* IMAGE REMPLAÇABLE — photo de la salle / du four (800x600px) */}
              <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800" alt="Roma Pizzeria — salle du restaurant" loading="lazy"
                style={{ width: '100%', height: 400, objectFit: 'cover', borderRadius: 4 }} />
              <div style={{ position: 'absolute', bottom: -16, left: -16, background: 'var(--rosso)', color: 'white', padding: '14px 20px', borderRadius: 3 }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontStyle: 'italic', fontWeight: 700 }}>15+</div>
                <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Jost' }}>ans d&apos;expérience</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MENU */}
      <section id="menu" style={{ padding: '100px 20px', background: 'var(--bianco-w)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <span className="badge badge-verde" style={{ marginBottom: 16, display: 'inline-block' }}>Nos saveurs</span>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 42, color: 'var(--nero)', marginBottom: 16 }}>
              Découvrez notre <em style={{ color: 'var(--rosso)' }}>menu</em>
            </h2>
            <div className="section-divider"></div>
          </div>

          {/* Search */}
          <div style={{ maxWidth: 400, margin: '0 auto 40px', position: 'relative' }}>
            <input type="text" placeholder="Rechercher une pizza, un plat..." value={menuSearch} onChange={e => setMenuSearch(e.target.value)}
              className="form-input" style={{ paddingLeft: 40 }} />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--grigio)' }}>🔍</span>
          </div>

          {/* Tabs */}
          {categories.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 }}>
              {categories.map((cat, i) => (
                <button key={cat.id} onClick={() => setActiveTab(i)} style={{
                  padding: '9px 20px', borderRadius: 2,
                  border: `1px solid ${activeTab === i ? 'var(--rosso)' : 'rgba(183,28,28,0.2)'}`,
                  background: activeTab === i ? 'var(--rosso)' : 'transparent',
                  color: activeTab === i ? '#fff' : 'var(--nero-m)',
                  fontFamily: 'Jost, sans-serif', fontSize: 12, fontWeight: 500,
                  letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.3s',
                }}>
                  {TAB_ICONS[i] ?? ''} {getCatName(cat)}
                </button>
              ))}
            </div>
          )}

          {/* Articles grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {catArticles.map(art => {
              const name = getArticleName(art)
              const isVeg = name === 'Végétarienne'
              const isSpec = SPECIALITES.includes(name)
              return (
                <div key={art.id} style={{ background: '#fff', border: '1px solid rgba(183,28,28,0.12)', borderRadius: 3, padding: '20px 22px', opacity: art.disponible ? 1 : 0.6, position: 'relative' }}>
                  {!art.disponible && (
                    <span style={{ position: 'absolute', top: 12, right: 12, background: 'var(--grigio-l)', color: 'var(--grigio)', fontFamily: 'Jost', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 2 }}>Indisponible</span>
                  )}
                  {isVeg && <span className="badge badge-verde" style={{ marginBottom: 8, display: 'inline-block' }}>🌱 Végétarienne</span>}
                  {isSpec && <span className="badge badge-rosso" style={{ marginBottom: 8, display: 'inline-block', marginLeft: isVeg ? 4 : 0 }}>⭐ Spécialité</span>}
                  <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: 'var(--nero)', marginBottom: 6, paddingRight: !art.disponible ? 90 : 0 }}>{name}</h3>
                  {art.description && (
                    <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 15, fontStyle: 'italic', color: 'var(--grigio)', lineHeight: 1.5, marginBottom: 12 }}>{art.description}</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    {isWineTab && art.prix_pala ? (
                      <>
                        <span style={{ fontFamily: 'Jost', fontSize: 13, color: 'var(--grigio)' }}>Verre —</span>
                        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--rosso)' }}>{art.prix.toFixed(2)} €</span>
                        <span style={{ fontFamily: 'Jost', fontSize: 13, color: 'var(--grigio)', marginLeft: 8 }}>Bouteille —</span>
                        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--rosso)' }}>{art.prix_pala.toFixed(2)} €</span>
                      </>
                    ) : art.prix_pala ? (
                      <>
                        <span style={{ fontFamily: 'Jost', fontSize: 13, color: 'var(--grigio)' }}>33cm —</span>
                        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--rosso)' }}>{art.prix.toFixed(2)} €</span>
                        <span style={{ fontFamily: 'Jost', fontSize: 13, color: 'var(--grigio)', marginLeft: 8 }}>Pala —</span>
                        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--rosso)' }}>{art.prix_pala.toFixed(2)} €</span>
                      </>
                    ) : (art.prix_reduction || (art.promotion && art.promotion > 0)) ? (
                      <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700 }}>
                        <span style={{ color: 'var(--grigio)', textDecoration: 'line-through', marginRight: 6 }}>{art.prix.toFixed(2)} €</span>
                        <span style={{ color: 'var(--rosso)' }}>
                          {art.prix_reduction ? art.prix_reduction.toFixed(2) : (art.prix * (1 - (art.promotion ?? 0) / 100)).toFixed(2)} €
                        </span>
                        {art.promotion && art.promotion > 0 && !art.prix_reduction && (
                          <span style={{ marginLeft: 6, background: 'var(--rosso)', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>-{art.promotion}%</span>
                        )}
                      </span>
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
            <div style={{ marginTop: 60, background: 'var(--verde-pale)', borderRadius: 4, padding: 40 }}>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, color: 'var(--nero)', textAlign: 'center', marginBottom: 32 }}>Nos formules</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                {formules.map(f => (
                  <div key={f.id} style={{ background: 'white', borderRadius: 3, padding: 24, borderTop: '3px solid var(--verde)' }}>
                    <h4 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: 'var(--nero)', marginBottom: 8 }}>{f.nom}</h4>
                    {f.description && <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, fontStyle: 'italic', color: 'var(--grigio)', marginBottom: 8 }}>{f.description}</p>}
                    {f.contenu && <p style={{ fontFamily: 'Jost', fontSize: 13, color: 'var(--grigio)', lineHeight: 1.5, marginBottom: 16 }}>{f.contenu}</p>}
                    <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, color: 'var(--rosso)' }}>{f.prix.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calzone note */}
          <div style={{ marginTop: 32, padding: '16px 24px', background: 'var(--rosso-pale)', borderLeft: '3px solid var(--rosso)', borderRadius: 3 }}>
            <p style={{ fontSize: 14, color: 'var(--rosso-m)', fontFamily: 'Jost' }}>🍕 Toutes nos pizzas 33cm peuvent être préparées en Calzone sur demande</p>
          </div>
        </div>
      </section>

      {/* AMBIANCE */}
      <section style={{ padding: '100px 20px', background: 'var(--bianco-c)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <span className="badge badge-verde" style={{ marginBottom: 16, display: 'inline-block' }}>Nos espaces</span>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 42, color: 'var(--nero)', marginBottom: 8 }}>
              L&apos;ambiance <em style={{ color: 'var(--rosso)' }}>Roma</em>
            </h2>
            <p style={{ color: 'var(--grigio)', fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontStyle: 'italic' }}>Trois espaces pour tous vos moments</p>
            <div className="section-divider"></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
            {[
              { icon: '🏠', title: 'Rez-de-chaussée', desc: "L'espace convivial — idéal pour les repas en famille ou entre amis", img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600' },
              { icon: '🏛', title: 'Étage', desc: "L'espace cosy — parfait pour les repas entre collègues ou les dîners décontractés", img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600' },
              { icon: '🌿', title: 'Terrasse (été)', desc: "L'espace en plein air — profitez du soleil et de la douceur tourangelle", img: 'https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=600' },
            ].map(e => (
              <div key={e.title} style={{ borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', background: 'white' }}>
                <img src={e.img} alt={e.title} loading="lazy" style={{ width: '100%', height: 220, objectFit: 'cover' }} />
                <div style={{ padding: 24 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{e.icon}</div>
                  <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: 'var(--nero)', marginBottom: 8 }}>{e.title}</h3>
                  <p style={{ fontSize: 14, color: 'var(--grigio)', lineHeight: 1.6 }}>{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: 40, color: 'var(--grigio)', fontSize: 14, fontStyle: 'italic' }}>
            50 couverts · Privatisation possible pour événements — <a href="tel:0668366298" style={{ color: 'var(--rosso)' }}>06 68 36 62 98</a>
          </p>
        </div>
      </section>

      {/* HORAIRES */}
      <section id="horaires" style={{ padding: '100px 20px', background: 'var(--bianco-w)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <span className="badge badge-verde" style={{ marginBottom: 16, display: 'inline-block' }}>Horaires & Localisation</span>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 42, color: 'var(--nero)', marginBottom: 16 }}>Quand nous rendre visite ?</h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 20, background: nowOpen ? 'var(--verde-pale)' : 'var(--rosso-pale)', marginBottom: 16 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: nowOpen ? 'var(--verde)' : 'var(--rosso)', display: 'inline-block' }}></span>
              <span style={{ fontSize: 13, fontFamily: 'Jost', color: nowOpen ? 'var(--verde)' : 'var(--rosso)', fontWeight: 500 }}>
                {nowOpen ? 'Ouvert maintenant' : 'Actuellement fermé'}
              </span>
            </div>
            <div className="section-divider"></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 48, alignItems: 'start' }}>
            <div style={{ borderRadius: 4, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
              {[
                { jsDay: 1, nom: 'Lundi', heures: 'Fermé', closed: true },
                { jsDay: 2, nom: 'Mardi', heures: 'Soir 19h – 21h30', closed: false },
                { jsDay: 3, nom: 'Mercredi', heures: 'Midi 12h–14h30 + Soir 19h–21h30', closed: false },
                { jsDay: 4, nom: 'Jeudi', heures: 'Midi 12h–14h30 + Soir 19h–21h30', closed: false },
                { jsDay: 5, nom: 'Vendredi', heures: 'Midi 12h–14h30 + Soir 19h–21h30', closed: false },
                { jsDay: 6, nom: 'Samedi', heures: 'Midi 12h–14h30 + Soir 19h–22h', closed: false },
                { jsDay: 0, nom: 'Dimanche', heures: 'Soir 19h – 21h30', closed: false },
              ].map((row, idx) => {
                const isToday = row.jsDay === todayDay
                return (
                  <div key={row.nom} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 20px',
                    background: isToday ? 'var(--rosso-pale)' : idx % 2 === 0 ? 'white' : 'var(--verde-pale)',
                    borderLeft: isToday ? '3px solid var(--rosso)' : '3px solid transparent',
                  }}>
                    <span style={{ fontFamily: 'Jost', fontSize: 17, fontWeight: isToday ? 700 : 600, color: isToday ? 'var(--rosso)' : 'var(--nero)' }}>{row.nom}</span>
                    <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 17, fontWeight: 600, fontStyle: row.closed ? 'normal' : 'italic', color: row.closed ? 'var(--rosso)' : 'var(--nero-m)' }}>{row.heures}</span>
                  </div>
                )
              })}
            </div>
            <div>
              <div style={{ borderRadius: 4, overflow: 'hidden', border: '1px solid var(--grigio-l)', height: 400, marginBottom: 20 }}>
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d5317.7!2d0.1!3d47.45!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sSavign%C3%A9-sur-Lathan%2C+France!5e0!3m2!1sfr!2sfr!4v1700000000000!5m2!1sfr!2sfr"
                  width="100%" height="100%" style={{ border: 0 }}
                  allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                  title="Localisation Roma Pizzeria"
                />
              </div>
              <a href="https://www.google.com/maps/dir/?api=1&destination=Savign%C3%A9-sur-Lathan" target="_blank" rel="noopener noreferrer"
                className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none', marginBottom: 12 }}>
                📍 Itinéraire Google Maps
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* COMMANDER À EMPORTER */}
      <section id="commander" style={{ padding: '100px 20px', background: 'linear-gradient(135deg, #7B0000 0%, var(--rosso-m) 100%)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', marginBottom: 16, display: 'inline-block' }}>Pizza à emporter</span>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 4vw, 42px)', color: 'white', marginBottom: 12 }}>
              🍕 Commander à <em style={{ color: 'white', fontStyle: 'italic' }}>emporter</em>
            </h2>
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontStyle: 'italic', color: 'rgba(255,255,255,0.7)' }}>
              Commandez en avance, récupérez quand vous voulez
            </p>
          </div>

          {cmdSuccess ? (
            <div style={{ background: 'white', borderRadius: 4, padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: 'var(--verde)', marginBottom: 12 }}>Commande envoyée !</h3>
              <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontStyle: 'italic', color: 'var(--grigio)', marginBottom: 24 }}>
                Andreï vous rappelle pour confirmer. 📞 06 68 36 62 98
              </p>
              <button onClick={() => { setCmdSuccess(false); setCmdStep(1); setCmdItems([]); setCmdForm({ nom: '', telephone: '', date: '', heure: '', notes: '' }) }} className="btn-primary">Nouvelle commande</button>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
              {/* Steps indicator */}
              <div style={{ display: 'flex', background: 'var(--bianco-c)' }}>
                {[{ n: 1, label: 'Votre commande' }, { n: 2, label: 'Confirmation' }].map(s => (
                  <div key={s.n} onClick={() => cmdStep === 2 && s.n === 1 && setCmdStep(1)}
                    style={{ flex: 1, padding: '16px 20px', textAlign: 'center', background: cmdStep === s.n ? 'var(--rosso)' : 'transparent', color: cmdStep === s.n ? 'white' : 'var(--grigio)', fontFamily: 'Jost', fontSize: 13, fontWeight: 500, cursor: s.n === 1 && cmdStep === 2 ? 'pointer' : 'default', transition: 'all 0.3s' }}>
                    <span style={{ marginRight: 8 }}>{s.n}.</span>{s.label}
                  </div>
                ))}
              </div>

              <div style={{ padding: '32px 40px' }}>
                {cmdStep === 1 ? (
                  <>
                    {/* Détection fidélité commander */}
                    <div style={{ background: 'var(--verde-pale)', borderRadius: 3, padding: '16px 20px', marginBottom: 20, border: '1px solid rgba(27,94,32,0.2)' }}>
                      {cmdClientDetecte ? (
                        <div style={{ fontSize: 14, color: 'var(--verde-m)', fontFamily: 'Jost' }}>
                          🎁 Bonjour <strong>{cmdClientDetecte.nom}</strong> ! Vous gagnerez environ <strong>{cmdClientDetecte.pts} points</strong> avec cette commande ✓
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--verde-m)', fontFamily: 'Jost', fontWeight: 600, marginBottom: 8 }}>
                            🎁 Connectez-vous pour gagner des points fidélité !
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input type="tel" className="form-input" placeholder="Votre téléphone" value={cmdForm.telephone}
                              onChange={e => { setCmdForm(p => ({ ...p, telephone: e.target.value })); setCmdClientDetecte(null) }}
                              style={{ flex: 1, fontSize: 13 }} />
                            <button type="button" onClick={async () => {
                              if (!cmdForm.telephone.trim()) return
                              setCmdTelSearch(true)
                              const { data } = await supabase.from('clients').select('id,nom,points,nb_visites').eq('telephone', cmdForm.telephone.trim()).single()
                              setCmdTelSearch(false)
                              if (data) {
                                const estPoints = Math.round(cmdItems.reduce((s, i) => s + i.qty * (i.taille==='pala'?i.prixPala:i.prix33), 0))
                                setCmdClientDetecte({ nom: (data as {nom:string;points:number}).nom, pts: estPoints || 0 })
                              }
                            }} className="btn-verde" disabled={cmdTelSearch} style={{ flexShrink: 0, padding: '10px 16px', fontSize: 12 }}>
                              {cmdTelSearch ? '...' : 'Vérifier'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Infos de base */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 6 }}>Nom *</label>
                        <input type="text" className="form-input" placeholder="Votre nom" value={cmdForm.nom} onChange={e => setCmdForm(p => ({ ...p, nom: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 6 }}>Téléphone *</label>
                        <input type="tel" className="form-input" placeholder="06 XX XX XX XX" value={cmdForm.telephone} onChange={e => setCmdForm(p => ({ ...p, telephone: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 6 }}>Date de retrait *</label>
                        <input type="date" className="form-input" min={minDate()} value={cmdForm.date}
                          onChange={e => {
                            const d = new Date(e.target.value + 'T12:00:00')
                            setCmdError(d.getDay() === 1 ? 'Nous sommes fermés le lundi.' : '')
                            setCmdForm(p => ({ ...p, date: e.target.value, heure: '' }))
                          }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 6 }}>Heure de retrait *</label>
                        <select className="form-input" value={cmdForm.heure} onChange={e => setCmdForm(p => ({ ...p, heure: e.target.value }))} style={{ cursor: 'pointer' }}>
                          <option value="">--:--</option>
                          {(() => {
                            const d = cmdForm.date ? new Date(cmdForm.date + 'T12:00:00').getDay() : -1
                            const midi = d >= 3 && d <= 6
                            const soir = d !== 1 && d !== -1
                            const opts: string[] = []
                            if (midi) opts.push('12:00', '12:30', '13:00', '13:30', '14:00', '14:30')
                            if (soir) opts.push('19:00', '19:30', '20:00', '20:30', '21:00', '21:30')
                            return opts.map(h => <option key={h} value={h}>{h}</option>)
                          })()}
                        </select>
                      </div>
                    </div>

                    {/* Sélecteur de pizzas */}
                    <div style={{ background: 'var(--rosso-pale)', borderRadius: 3, padding: 24, marginBottom: 20 }}>
                      <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: 'var(--nero)', marginBottom: 16 }}>Ajouter une pizza</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero-m)', marginBottom: 4 }}>Pizza</label>
                          <select className="form-input" value={cmdPizzaSelect} onChange={e => setCmdPizzaSelect(e.target.value)} style={{ cursor: 'pointer' }}>
                            <option value="">Choisir une pizza...</option>
                            {articles.filter(a => {
                              const cat = categories.find(c => c.id === a.categorie_id)
                              return cat?.nom === 'Pizzas' && a.disponible
                            }).map(a => (
                              <option key={a.id} value={a.id}>{a.nom} — {a.prix.toFixed(2)} €</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero-m)', marginBottom: 4 }}>Quantité</label>
                          <select className="form-input" value={cmdPizzaQty} onChange={e => setCmdPizzaQty(parseInt(e.target.value))} style={{ cursor: 'pointer' }}>
                            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero-m)', marginBottom: 4 }}>Taille</label>
                          <select className="form-input" value={cmdPizzaTaille} onChange={e => setCmdPizzaTaille(e.target.value as '33cm' | 'pala')} style={{ cursor: 'pointer' }}>
                            <option value="33cm">33 cm</option>
                            <option value="pala">Pala 60×40</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontFamily: 'Jost', cursor: 'pointer' }}>
                          <input type="checkbox" checked={cmdPizzaCalzone} onChange={e => setCmdPizzaCalzone(e.target.checked)} />
                          En Calzone
                        </label>
                      </div>
                      <button type="button" onClick={() => {
                        const art = articles.find(a => a.id === cmdPizzaSelect)
                        if (!art) return
                        setCmdItems(prev => [...prev, {
                          pizzaId: art.id, nom: art.nom,
                          prix33: art.prix, prixPala: art.prix_pala ?? art.prix * 2.5,
                          qty: cmdPizzaQty, taille: cmdPizzaTaille, calzone: cmdPizzaCalzone,
                        }])
                        setCmdPizzaSelect(''); setCmdPizzaQty(1); setCmdPizzaTaille('33cm'); setCmdPizzaCalzone(false)
                      }} className="btn-primary" style={{ opacity: cmdPizzaSelect ? 1 : 0.5 }} disabled={!cmdPizzaSelect}>
                        + Ajouter
                      </button>
                    </div>

                    {/* Récapitulatif articles */}
                    {cmdItems.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <h4 style={{ fontFamily: 'Jost', fontSize: 13, fontWeight: 600, color: 'var(--nero)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Ma commande</h4>
                        {cmdItems.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--grigio-l)' }}>
                            <span style={{ fontFamily: 'Jost', fontSize: 14, color: 'var(--nero)' }}>
                              {item.qty}× {item.nom} ({item.taille}{item.calzone ? ', Calzone' : ''})
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                              <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: 'var(--rosso)' }}>
                                {(item.qty * (item.taille === 'pala' ? item.prixPala : item.prix33)).toFixed(2)} €
                              </span>
                              <button onClick={() => setCmdItems(prev => prev.filter((_, i) => i !== idx))}
                                style={{ background: 'none', border: 'none', color: 'var(--grigio)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: 'var(--rosso)' }}>
                          <span>Total estimé</span>
                          <span>{cmdItems.reduce((sum, i) => sum + i.qty * (i.taille === 'pala' ? i.prixPala : i.prix33), 0).toFixed(2)} €</span>
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 6 }}>Notes / Allergies</label>
                      <textarea className="form-input" placeholder="Allergie, demande particulière..." value={cmdForm.notes} onChange={e => setCmdForm(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
                    </div>

                    {cmdError && (
                      <div style={{ padding: '12px 16px', background: 'var(--rosso-pale)', border: '1px solid var(--rosso-l)', borderRadius: 3, fontSize: 13, color: 'var(--rosso)', fontFamily: 'Jost', marginBottom: 16 }}>
                        {cmdError}
                      </div>
                    )}

                    <button type="button" className="btn-primary" style={{ width: '100%', padding: 16, opacity: (cmdItems.length > 0 && cmdForm.nom && cmdForm.telephone && cmdForm.date && cmdForm.heure) ? 1 : 0.5 }}
                      disabled={!(cmdItems.length > 0 && cmdForm.nom && cmdForm.telephone && cmdForm.date && cmdForm.heure)}
                      onClick={() => {
                        const d = new Date(cmdForm.date + 'T12:00:00')
                        if (d.getDay() === 1) { setCmdError('Nous sommes fermés le lundi.'); return }
                        setCmdStep(2)
                      }}>
                      Voir le récapitulatif →
                    </button>
                  </>
                ) : (
                  <>
                    {/* Étape 2 — Confirmation */}
                    <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 24 }}>Récapitulatif de votre commande</h3>
                    <div style={{ background: 'var(--bianco-c)', borderRadius: 3, padding: 24, marginBottom: 24 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, fontSize: 14, fontFamily: 'Jost' }}>
                        <div><span style={{ color: 'var(--grigio)' }}>Nom :</span> <strong>{cmdForm.nom}</strong></div>
                        <div><span style={{ color: 'var(--grigio)' }}>Tél :</span> <strong>{cmdForm.telephone}</strong></div>
                        <div><span style={{ color: 'var(--grigio)' }}>Date :</span> <strong>{cmdForm.date}</strong></div>
                        <div><span style={{ color: 'var(--grigio)' }}>Retrait :</span> <strong>{cmdForm.heure}</strong></div>
                      </div>
                      {cmdItems.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--grigio-l)', fontSize: 14, fontFamily: 'Jost' }}>
                          <span>{item.qty}× {item.nom} ({item.taille}{item.calzone ? ', Calzone' : ''})</span>
                          <strong style={{ color: 'var(--rosso)' }}>{(item.qty * (item.taille === 'pala' ? item.prixPala : item.prix33)).toFixed(2)} €</strong>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: 'var(--rosso)' }}>
                        <span>Total estimé</span>
                        <span>{cmdItems.reduce((sum, i) => sum + i.qty * (i.taille === 'pala' ? i.prixPala : i.prix33), 0).toFixed(2)} €</span>
                      </div>
                    </div>
                    {cmdError && (
                      <div style={{ padding: '12px 16px', background: 'var(--rosso-pale)', border: '1px solid var(--rosso-l)', borderRadius: 3, fontSize: 13, color: 'var(--rosso)', fontFamily: 'Jost', marginBottom: 16 }}>{cmdError}</div>
                    )}
                    <button type="button" className="btn-primary" style={{ width: '100%', padding: 16, opacity: cmdLoading ? 0.7 : 1 }} disabled={cmdLoading}
                      onClick={async () => {
                        setCmdLoading(true); setCmdError('')
                        try {
                          let clientId: string | undefined
                          const { data: existingClient } = await supabase.from('clients').select('id').eq('telephone', cmdForm.telephone).single()
                          if (existingClient) {
                            clientId = existingClient.id
                          } else {
                            const { data: nc } = await supabase.from('clients')
                              .insert({ nom: cmdForm.nom, telephone: cmdForm.telephone })
                              .select('id').single()
                            clientId = nc?.id
                          }
                          const total = cmdItems.reduce((sum, i) => sum + i.qty * (i.taille === 'pala' ? i.prixPala : i.prix33), 0)
                          const { data: cmd } = await supabase.from('commandes').insert({
                            client_id: clientId ?? null, 'Type': 'a_emporter', 'Statut': 'en_attente',
                            total, notes: cmdForm.notes || null,
                            heure_retrait: cmdForm.date + 'T' + cmdForm.heure,
                          }).select('id').single()
                          if (cmd) {
                            await supabase.from('lignes_commande').insert(
                              cmdItems.map(item => ({
                                commande_id: cmd.id,
                                article_nom: item.nom + (item.calzone ? ' (Calzone)' : ''),
                                quantite: item.qty,
                                taille: item.taille,
                                prix_unitaire: item.taille === 'pala' ? item.prixPala : item.prix33,
                              }))
                            )
                          }
                          setCmdSuccess(true)
                        } catch {
                          setCmdError('Une erreur est survenue. Appelez le 06 68 36 62 98.')
                        } finally {
                          setCmdLoading(false)
                        }
                      }}>
                      {cmdLoading ? '...' : '🍕 Envoyer ma commande'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* RÉSERVATION */}
      <section id="reserver" style={{ padding: '100px 20px', background: 'var(--bianco-c)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 60, alignItems: 'start' }}>
          {/* Form */}
          <div>
            <span className="badge badge-verde" style={{ marginBottom: 16, display: 'inline-block' }}>Réservation en ligne</span>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 36, color: 'var(--nero)', marginBottom: 32 }}>
              Réserver une <em style={{ color: 'var(--rosso)' }}>table</em>
            </h2>
            {resaSuccess ? (
              <div style={{ background: 'var(--verde-pale)', border: '1px solid var(--verde)', borderRadius: 4, padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontStyle: 'italic', color: 'var(--verde)', marginBottom: 20 }}>{t.resa_success}</p>
                <button onClick={() => { setResaSuccess(false); setResaForm({ nom: '', telephone: '', date: '', heure: '', couverts: '2', zone: '', notes: '' }) }} className="btn-secondary">Nouvelle réservation</button>
              </div>
            ) : (
              <form onSubmit={handleResa} style={{ background: 'white', borderRadius: 4, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 6, letterSpacing: 0.5 }}>Nom *</label>
                    <input type="text" className="form-input" placeholder="Votre nom" value={resaForm.nom} onChange={e => setResaForm(p => ({ ...p, nom: e.target.value }))} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 6, letterSpacing: 0.5 }}>Téléphone *</label>
                    <input type="tel" className="form-input" placeholder="06 XX XX XX XX" value={resaForm.telephone} onChange={e => setResaForm(p => ({ ...p, telephone: e.target.value }))} required
                      onBlur={async () => {
                        if (resaForm.telephone.trim().length >= 10) {
                          const { data } = await supabase.from('clients').select('nom').eq('telephone', resaForm.telephone.trim()).single()
                          if (data) {
                            setResaClientDetecte(data as {nom:string})
                            setResaForm(p => ({ ...p, nom: (data as {nom:string}).nom }))
                          }
                        }
                      }} />
                    {resaClientDetecte && (
                      <div style={{ fontSize: 12, color: 'var(--verde-m)', fontFamily: 'Jost', marginTop: 6 }}>
                        ✓ Bonjour {resaClientDetecte.nom} ! +5 points bonus pour cette réservation 🎁
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 6 }}>Date *</label>
                    <input type="date" className="form-input" min={minDate()} value={resaForm.date}
                      onChange={e => {
                        const d = new Date(e.target.value + 'T12:00:00')
                        setResaError(d.getDay() === 1 ? t.resa_lundi_info : '')
                        setResaForm(p => ({ ...p, date: e.target.value, heure: '' }))
                      }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 6 }}>Heure *</label>
                    <select className="form-input" value={resaForm.heure} onChange={e => setResaForm(p => ({ ...p, heure: e.target.value }))} required style={{ cursor: 'pointer' }}>
                      <option value="">--:--</option>
                      {(() => {
                        const d = resaForm.date ? new Date(resaForm.date + 'T12:00:00').getDay() : -1
                        const midi = d >= 3 && d <= 6
                        const soir = d !== 1
                        const opts: string[] = []
                        if (midi) opts.push('12:00', '12:30', '13:00', '13:30', '14:00')
                        if (soir) {
                          opts.push('19:00', '19:30', '20:00', '20:30', '21:00', '21:30')
                          if (d === 6) opts.push('22:00')
                        }
                        return opts.map(h => <option key={h} value={h}>{h}</option>)
                      })()}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 6 }}>Couverts</label>
                    <select className="form-input" value={resaForm.couverts} onChange={e => setResaForm(p => ({ ...p, couverts: e.target.value }))} style={{ cursor: 'pointer' }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => <option key={n} value={n}>{n} {n === 1 ? 'personne' : 'personnes'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 6 }}>Zone</label>
                    <select className="form-input" value={resaForm.zone} onChange={e => setResaForm(p => ({ ...p, zone: e.target.value }))} style={{ cursor: 'pointer' }}>
                      <option value="">Indifférent</option>
                      <option value="rdc">Rez-de-chaussée</option>
                      <option value="etage">Étage</option>
                      <option value="terrasse">Terrasse</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontFamily: 'Jost', fontWeight: 500, color: 'var(--nero)', marginBottom: 6 }}>Notes</label>
                  <textarea className="form-input" placeholder="Allergie, demande particulière..." value={resaForm.notes} onChange={e => setResaForm(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ resize: 'vertical' }} />
                </div>
                {resaError && (
                  <div style={{ padding: '12px 16px', background: 'var(--rosso-pale)', border: '1px solid var(--rosso-l)', borderRadius: 3, fontSize: 13, color: 'var(--rosso)', fontFamily: 'Jost', marginBottom: 16 }}>
                    {resaError}
                  </div>
                )}
                <button type="submit" className="btn-primary" disabled={resaLoading} style={{ width: '100%', padding: 16, opacity: resaLoading ? 0.7 : 1 }}>
                  {resaLoading ? '...' : '📅 Confirmer la réservation'}
                </button>
                <p style={{ fontSize: 11, color: 'var(--grigio)', textAlign: 'center', marginTop: 12, fontFamily: 'Jost' }}>Confirmation par téléphone · 06 68 36 62 98</p>
              </form>
            )}
          </div>
          {/* Right info */}
          <div>
            <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800" alt="Salle Roma Pizzeria" loading="lazy"
              style={{ width: '100%', height: 280, objectFit: 'cover', borderRadius: 4, marginBottom: 32 }} />
            <div style={{ background: 'white', borderRadius: 4, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: 'var(--nero)', marginBottom: 20 }}>Pourquoi réserver ?</h3>
              {[
                { icon: '✅', text: 'Votre table garantie à l\'heure souhaitée' },
                { icon: '🎁', text: 'Surprises pour les occasions spéciales' },
                { icon: '⭐', text: 'Points fidélité doublés sur réservation' },
              ].map(a => (
                <div key={a.icon} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  <p style={{ fontSize: 14, color: 'var(--nero-m)', fontFamily: 'Jost', lineHeight: 1.5 }}>{a.text}</p>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--grigio-l)', paddingTop: 20, marginTop: 8 }}>
                <a href="tel:0668366298" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--rosso)', textDecoration: 'none', fontFamily: 'Jost', fontWeight: 600, fontSize: 16 }}>
                  📞 06 68 36 62 98
                </a>
                <div style={{ fontSize: 12, color: 'var(--grigio)', marginTop: 8, fontFamily: 'Jost' }}>
                  Mar–Dim · Midi 12h–14h30 · Soir 19h–22h
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROGRAMME FIDÉLITÉ */}
      <section style={{ padding: '100px 20px', background: 'var(--verde-pale)', borderTop: '1px solid rgba(27,94,32,0.1)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 4vw, 42px)', color: 'var(--nero)', marginBottom: 16 }}>
            🎁 Le Club Roma — Votre <em style={{ color: 'var(--verde)' }}>fidélité</em> récompensée
          </h2>
          <div className="section-divider"></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 32, marginTop: 40 }}>
            {[
              { step: '1', icon: '📱', title: 'Créez votre compte', desc: 'Avec votre numéro de téléphone — simple et rapide' },
              { step: '2', icon: '🍕', title: 'Venez manger', desc: 'Gagnez des points à chaque visite chez Roma' },
              { step: '3', icon: '🎁', title: 'Profitez de récompenses', desc: 'Pizzas offertes, priorité réservation, surprises' },
            ].map(s => (
              <div key={s.step} style={{ background: 'white', padding: 32, borderRadius: 4, boxShadow: '0 2px 12px rgba(27,94,32,0.08)', borderTop: '3px solid var(--verde)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{s.icon}</div>
                <div style={{ background: 'var(--verde)', color: 'white', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, margin: '0 auto 12px' }}>{s.step}</div>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: 'var(--nero)', marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--grigio)', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 40, padding: '20px 32px', background: 'var(--rosso)', color: 'white', borderRadius: 3, display: 'inline-block' }}>
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontStyle: 'italic' }}>100 points = 1 pizza offerte 🍕</span>
          </div>
          <div style={{ marginTop: 24 }}>
            <Link href="/compte" className="btn-verde" style={{ display: 'inline-block', textDecoration: 'none', padding: '14px 36px' }}>Créer mon compte</Link>
          </div>
        </div>
      </section>

      {/* AVIS CLIENTS */}
      <section style={{ padding: '100px 20px', background: 'var(--bianco-w)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 42, color: 'var(--nero)', marginBottom: 8 }}>
              Ce que disent <em style={{ color: 'var(--rosso)' }}>nos clients</em>
            </h2>
            {avisData.length > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--verde-pale)', padding: '6px 16px', borderRadius: 20, marginBottom: 8 }}>
                <span style={{ color: 'var(--rosso)', fontSize: 14 }}>{'⭐'.repeat(Math.round(avisMoyenne))}</span>
                <span style={{ fontFamily: 'Jost', fontSize: 13, color: 'var(--verde-m)', fontWeight: 600 }}>{avisMoyenne}/5 · {avisData.length} avis</span>
              </div>
            )}
            <div className="section-divider"></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, marginBottom: 32 }}>
            {(avisData.length > 0 ? avisData.slice(0, 3) : [
              { id:'1', texte: "La meilleure pizza de Touraine ! Roberto et sa famille nous accueillent comme des rois.", auteur: "Marie L.", ville: "Langeais", note: 5, source: 'facebook' },
              { id:'2', texte: "On vient tous les samedis depuis 3 ans. La Burrata est à tomber !", auteur: "Thomas B.", ville: "Bourgueil", note: 5, source: 'facebook' },
              { id:'3', texte: "Service impeccable d'Andreï, cuisine généreuse de Roberto. Une vraie trattoria !", auteur: "Famille Moreau", ville: "Chinon", note: 5, source: 'facebook' },
            ]).map(r => (
              <div key={r.id} style={{ background: 'white', padding: 32, borderRadius: 4, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', borderLeft: '3px solid var(--verde)' }}>
                <div style={{ color: 'var(--rosso)', fontSize: 16, marginBottom: 12 }}>{'⭐'.repeat(r.note)}</div>
                <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 19, fontStyle: 'italic', color: 'var(--nero-m)', lineHeight: 1.6, marginBottom: 16 }}>&quot;{r.texte}&quot;</p>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rosso)', fontFamily: 'Jost' }}>{r.auteur ?? 'Client Roma'}</div>
                {r.ville && <div style={{ fontSize: 12, color: 'var(--grigio)' }}>{r.ville}</div>}
                {r.source === 'facebook' && <div style={{ fontSize: 11, color: 'var(--grigio)', marginTop: 4, fontFamily: 'Jost' }}>via Facebook</div>}
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="https://www.facebook.com/p/Roma-Pizzeria-Restaurant-61576928932483/" target="_blank" rel="noopener noreferrer"
              className="btn-secondary" style={{ textDecoration: 'none', fontSize: 13 }}>
              Voir tous les avis sur Facebook →
            </a>
            <Link href="/avis" className="btn-verde" style={{ textDecoration: 'none', fontSize: 13 }}>
              Laisser un avis (+10 pts)
            </Link>
          </div>
        </div>
      </section>

      {/* CTA FINALE */}
      <section style={{ padding: '100px 20px', background: 'var(--hero-bg)', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Una tavola vi aspetta</div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 4vw, 42px)', color: 'white', marginBottom: 16 }}>
            Une table vous attend à <em style={{ color: 'var(--verde-l)' }}>Savigné-sur-Lathan</em>
          </h2>
          <div className="section-divider"></div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 40 }}>
            <a href="#reserver" className="btn-primary">📅 Réserver</a>
            <a href="tel:0668366298" className="btn-secondary" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}>📞 Appeler</a>
            <Link href="/compte" className="btn-verde">⭐ Mon compte</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: 'var(--nero)', color: 'rgba(255,255,255,0.8)', padding: '80px 20px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 48, paddingBottom: 48 }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontStyle: 'italic', color: 'white', marginBottom: 12 }}>Roma 🇮🇹</div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>Pizzeria italienne authentique à Savigné-sur-Lathan. Four à bois, produits frais, recettes de famille.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <a href="https://www.facebook.com/p/Roma-Pizzeria-Restaurant-61576928932483/" target="_blank" rel="noopener noreferrer"
                style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 2, fontSize: 11, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontFamily: 'Jost' }}>
                Facebook
              </a>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--verde-l)', marginBottom: 20, fontFamily: 'Jost', fontWeight: 500 }}>Navigation</div>
            {[{ l: 'Accueil', h: '#' }, { l: 'Menu', h: '#menu' }, { l: 'Réserver', h: '#reserver' }, { l: 'Mon compte', h: '/compte' }].map(i => (
              <a key={i.l} href={i.h} style={{ display: 'block', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 14, marginBottom: 10, fontFamily: 'Jost' }}>{i.l}</a>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--verde-l)', marginBottom: 20, fontFamily: 'Jost', fontWeight: 500 }}>Horaires</div>
            {[
              { j: 'Lun', h: 'Fermé' },
              { j: 'Mar', h: 'Soir 19h – 21h30' },
              { j: 'Mer–Ven', h: 'Midi + Soir' },
              { j: 'Sam', h: 'Midi + Soir 19h – 22h' },
              { j: 'Dim', h: 'Soir 19h – 21h30' },
            ].map(r => (
              <div key={r.j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, fontFamily: 'Jost' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{r.j}</span>
                <span style={{ color: r.h === 'Fermé' ? 'var(--rosso-l)' : 'rgba(255,255,255,0.7)' }}>{r.h}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--verde-l)', marginBottom: 20, fontFamily: 'Jost', fontWeight: 500 }}>Contact</div>
            <div style={{ fontSize: 13, lineHeight: 2, color: 'rgba(255,255,255,0.6)', fontFamily: 'Jost' }}>
              <div>📍 Savigné-sur-Lathan, 37420</div>
              <div>Indre-et-Loire, France</div>
              <a href="tel:0668366298" style={{ color: 'var(--rosso-l)', textDecoration: 'none' }}>📞 06 68 36 62 98</a>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '20px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, maxWidth: 1200, margin: '0 auto' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'Jost' }}>© 2026 Roma Pizzeria Restaurant · Tous droits réservés</span>
          <div style={{ display: 'flex', gap: 24 }}>
            {[{ l: 'Politique de confidentialité', h: '/confidentialite' }, { l: 'Mentions légales', h: '/mentions-legales' }].map(i => (
              <Link key={i.l} href={i.h} style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontFamily: 'Jost' }}>{i.l}</Link>
            ))}
          </div>
        </div>
      </footer>

      {/* PWA BANNER */}
      {pwaBanner && (
        <div style={{ position: 'fixed', bottom: 72, left: 12, right: 12, background: 'var(--hero-bg)', color: 'white', padding: '20px 20px 16px', borderRadius: 6, zIndex: 200, boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(27,94,32,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontStyle: 'italic', color: 'white' }}>Accès rapide à Roma 🍕</div>
            <button onClick={() => { setPwaBanner(false); localStorage.setItem('roma_pwa_dismissed', 'true') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0, marginLeft: 12 }}>✕</button>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: 'Jost', marginBottom: 8 }}>
            {typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
              ? "Appuyez sur le bouton Partager ↑ → puis \"Sur l'écran d'accueil\""
              : "Appuyez sur ⋮ → \"Ajouter à l'écran d'accueil\""}
          </p>
          <button onClick={() => { setPwaBanner(false); localStorage.setItem('roma_pwa_dismissed', 'true') }}
            className="btn-verde" style={{ padding: '8px 20px', fontSize: 12, width: '100%' }}>
            J&apos;ai compris
          </button>
        </div>
      )}
    </>
  )
}
