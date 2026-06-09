import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--hero-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px', fontFamily: 'Jost, sans-serif' }}>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(80px, 15vw, 120px)', color: 'var(--oro)', lineHeight: 1, marginBottom: 24, fontStyle: 'italic' }}>
        404
      </div>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(22px, 3vw, 32px)', color: 'white', marginBottom: 16 }}>
        Page introuvable
      </div>
      <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', marginBottom: 40, maxWidth: 400 }}>
        Cette page n&apos;existe pas ou a été déplacée. Retournez à l&apos;accueil pour découvrir nos pizzas.
      </p>
      <Link href="/" style={{ background: 'var(--rosso)', color: 'white', border: 'none', borderRadius: 3, padding: '14px 32px', fontFamily: 'Jost, sans-serif', fontWeight: 500, cursor: 'pointer', textDecoration: 'none', fontSize: 14, letterSpacing: 0.5 }}>
        ← Retour à l&apos;accueil
      </Link>
      <div style={{ marginTop: 48, fontFamily: 'Playfair Display, serif', fontSize: 24, fontStyle: 'italic', color: 'var(--oro)', opacity: 0.4 }}>
        Roma 🇮🇹
      </div>
    </div>
  )
}
