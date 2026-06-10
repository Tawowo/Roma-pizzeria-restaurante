import Link from 'next/link'

export const metadata = {
  title: 'Mentions légales | Roma Pizzeria',
}

export default function MentionsLegalesPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bianco-w)', fontFamily: 'Jost, sans-serif' }}>
      {/* Header */}
      <header style={{ background: 'var(--nero)', padding: '20px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontStyle: 'italic', color: 'var(--oro)', textDecoration: 'none', fontWeight: 700 }}>
          Roma <span style={{ fontStyle: 'normal', fontWeight: 400, fontSize: 18, color: 'rgba(255,255,255,0.7)' }}>Pizzeria</span>
        </Link>
        <Link href="/" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontFamily: 'Jost' }}>← Retour à l&apos;accueil</Link>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '60px 20px 100px' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 42, color: 'var(--nero)', marginBottom: 12 }}>
          Mentions <em style={{ color: 'var(--rosso)' }}>légales</em>
        </h1>
        <div style={{ width: 60, height: 2, background: 'var(--oro)', marginBottom: 40 }}></div>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>1. Éditeur du site</h2>
          <p style={{ fontSize: 15, lineHeight: 2, color: 'var(--nero-m)' }}>
            <strong>Roma Pizzeria Restaurant</strong><br />
            Forme juridique : Entreprise individuelle<br />
            Siège social : 20 place Jacques du Bellay, 37420 Savigné-sur-Lathan<br />
            Téléphone : <a href="tel:0668366298" style={{ color: 'var(--rosso)' }}>06 68 36 62 98</a><br />
            Directeur de la publication : Roberto (gérant)
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>2. Hébergement</h2>
          <p style={{ fontSize: 15, lineHeight: 2, color: 'var(--nero-m)' }}>
            <strong>Vercel Inc.</strong><br />
            440 N Barranca Ave #4133<br />
            Covina, CA 91723, USA<br />
            Site : <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--rosso)' }}>vercel.com</a>
          </p>
          <p style={{ fontSize: 15, lineHeight: 2, color: 'var(--nero-m)', marginTop: 8 }}>
            <strong>Supabase Inc.</strong> (base de données)<br />
            Site : <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--rosso)' }}>supabase.com</a>
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>3. Propriété intellectuelle</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--nero-m)' }}>
            L&apos;ensemble du contenu de ce site (textes, images, logos, graphiques) est protégé par le droit d&apos;auteur. Toute reproduction, même partielle, est interdite sans autorisation préalable de Roma Pizzeria Restaurant.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>4. Limitation de responsabilité</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--nero-m)' }}>
            Roma Pizzeria Restaurant s&apos;efforce de maintenir les informations du site à jour (horaires, menu, tarifs). Cependant, des modifications peuvent intervenir sans préavis. Nous déclinons toute responsabilité pour les inexactitudes éventuelles.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>5. Loi applicable</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--nero-m)' }}>
            Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux français seront seuls compétents.
          </p>
        </section>

        <section>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>6. Contact</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--nero-m)' }}>
            Pour toute question relative au site :<br />
            <a href="tel:0668366298" style={{ color: 'var(--rosso)' }}>06 68 36 62 98</a><br />
            20 place Jacques du Bellay, 37420 Savigné-sur-Lathan
          </p>
        </section>
      </main>

      <footer style={{ background: 'var(--nero)', padding: '24px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'Jost' }}>© 2024 Roma Pizzeria Restaurant · Savigné-sur-Lathan</p>
      </footer>
    </div>
  )
}
