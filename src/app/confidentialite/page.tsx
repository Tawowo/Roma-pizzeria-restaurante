import Link from 'next/link'

export const metadata = {
  title: 'Politique de confidentialité | Roma Pizzeria',
}

export default function ConfidentialitePage() {
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
          Politique de <em style={{ color: 'var(--rosso)' }}>confidentialité</em>
        </h1>
        <div style={{ width: 60, height: 2, background: 'var(--oro)', marginBottom: 40 }}></div>
        <p style={{ fontSize: 14, color: 'var(--grigio)', marginBottom: 40, fontStyle: 'italic' }}>Dernière mise à jour : janvier 2024</p>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>1. Responsable du traitement</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--nero-m)' }}>
            Roma Pizzeria Restaurante<br />
            1 Place de l&apos;Église, 37420 Savigné-sur-Lathan<br />
            Téléphone : 06 68 36 62 98<br />
            Responsable : Roberto (gérant)
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>2. Données collectées</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--nero-m)', marginBottom: 12 }}>
            Dans le cadre de l&apos;utilisation de notre site, nous collectons les données personnelles suivantes :
          </p>
          <ul style={{ paddingLeft: 24, fontSize: 15, lineHeight: 2, color: 'var(--nero-m)' }}>
            <li><strong>Nom et prénom</strong> — pour la gestion des réservations</li>
            <li><strong>Numéro de téléphone</strong> — pour la confirmation des réservations et la gestion du programme de fidélité</li>
            <li><strong>Adresse e-mail</strong> (optionnelle) — pour l&apos;envoi de confirmations</li>
            <li><strong>Données de réservation</strong> — date, heure, nombre de couverts, préférences</li>
            <li><strong>Points de fidélité</strong> — historique des visites et avantages</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>3. Finalité du traitement</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--nero-m)' }}>
            Les données collectées sont utilisées uniquement pour :
          </p>
          <ul style={{ paddingLeft: 24, fontSize: 15, lineHeight: 2, color: 'var(--nero-m)', marginTop: 8 }}>
            <li>La gestion et confirmation des réservations de table</li>
            <li>La gestion du programme de fidélité Club Roma</li>
            <li>La communication avec nos clients (confirmation, rappels)</li>
            <li>L&apos;amélioration de nos services</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>4. Durée de conservation</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--nero-m)' }}>
            Vos données personnelles sont conservées pendant <strong>3 ans</strong> à compter de votre dernière interaction avec notre établissement. Passé ce délai, elles sont supprimées automatiquement.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>5. Vos droits (RGPD)</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--nero-m)', marginBottom: 12 }}>
            Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :
          </p>
          <ul style={{ paddingLeft: 24, fontSize: 15, lineHeight: 2, color: 'var(--nero-m)' }}>
            <li><strong>Droit d&apos;accès</strong> — obtenir une copie de vos données</li>
            <li><strong>Droit de rectification</strong> — corriger vos données inexactes</li>
            <li><strong>Droit à l&apos;effacement</strong> — demander la suppression de vos données</li>
            <li><strong>Droit d&apos;opposition</strong> — vous opposer au traitement de vos données</li>
            <li><strong>Droit à la portabilité</strong> — recevoir vos données dans un format structuré</li>
          </ul>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--nero-m)', marginTop: 12 }}>
            Pour exercer ces droits, contactez-nous au <a href="tel:0668366298" style={{ color: 'var(--rosso)' }}>06 68 36 62 98</a> ou directement au restaurant.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>6. Cookies</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--nero-m)' }}>
            Notre site utilise uniquement des <strong>cookies fonctionnels</strong> nécessaires au bon fonctionnement du service (préférence de langue, session). Aucun cookie publicitaire ou de tracking tiers n&apos;est utilisé.
          </p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>7. Hébergement et sous-traitants</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--nero-m)' }}>
            Notre site est hébergé par <strong>Vercel Inc.</strong> (San Francisco, USA — filiale UE conforme RGPD).<br />
            Les données sont stockées via <strong>Supabase</strong> (base de données PostgreSQL hébergée en Europe).
          </p>
        </section>

        <section>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'var(--nero)', marginBottom: 16 }}>8. Réclamation</h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--nero-m)' }}>
            Si vous estimez que le traitement de vos données ne respecte pas la réglementation, vous pouvez introduire une réclamation auprès de la <strong>CNIL</strong> (Commission Nationale de l&apos;Informatique et des Libertés) sur <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--rosso)' }}>www.cnil.fr</a>.
          </p>
        </section>
      </main>

      <footer style={{ background: 'var(--nero)', padding: '24px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'Jost' }}>© 2024 Roma Pizzeria Restaurante · Savigné-sur-Lathan</p>
      </footer>
    </div>
  )
}
