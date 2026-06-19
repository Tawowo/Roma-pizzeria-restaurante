import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'
import { LanguageProvider } from '@/lib/LanguageContext'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#B71C1C',
}

export const metadata: Metadata = {
  title: 'Roma Pizzeria Restaurant 2026 | Savigné-sur-Lathan',
  description: 'Pizzeria italienne authentique à Savigné-sur-Lathan (37). Four Morello Forni, produits frais, recettes de famille. Réservez votre table en ligne.',
  keywords: 'pizzeria, restaurant italien, Savigné-sur-Lathan, Indre-et-Loire, pizza four Morello Forni',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Roma Pizzeria Restaurant | Savigné-sur-Lathan',
    description: 'Pizzeria italienne authentique à Savigné-sur-Lathan (37). Four Morello Forni, produits frais, recettes de famille.',
    locale: 'fr_FR',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Roma Pizzeria" />
        <meta name="theme-color" content="#B71C1C" />
        <meta name="geo.region" content="FR-37" />
        <meta name="geo.placename" content="Savigné-sur-Lathan" />
        <meta name="geo.position" content="47.4833;0.2167" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Restaurant",
          "name": "Roma Pizzeria Restaurant",
          "address": { "@type": "PostalAddress", "streetAddress": "20 place Jacques du Bellay", "postalCode": "37420", "addressLocality": "Savigné-sur-Lathan", "addressCountry": "FR" },
          "telephone": "+33668366298",
          "servesCuisine": "Italian",
          "priceRange": "€€",
          "openingHours": ["Tu 19:00-21:30", "We-Fr 12:00-14:30", "We-Fr 19:00-21:30", "Sa 12:00-14:30", "Sa 19:00-22:00", "Su 19:00-21:30"]
        }) }} />
      </head>
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  )
}
