import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#B71C1C',
}

export const metadata: Metadata = {
  title: 'Roma Pizzeria Restaurante | Savigné-sur-Lathan',
  description: 'Pizzeria italienne authentique à Savigné-sur-Lathan (37). Four à bois, produits frais, recettes de famille. Réservez votre table en ligne.',
  keywords: 'pizzeria, restaurant italien, Savigné-sur-Lathan, Indre-et-Loire, pizza four à bois',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Roma Pizzeria Restaurante | Savigné-sur-Lathan',
    description: 'Pizzeria italienne authentique à Savigné-sur-Lathan (37). Four à bois, produits frais, recettes de famille.',
    locale: 'fr_FR',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Roma Pizzeria" />
        <meta name="theme-color" content="#B71C1C" />
      </head>
      <body>{children}</body>
    </html>
  )
}
