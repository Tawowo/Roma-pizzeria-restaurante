import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#C4622D',
}

export const metadata: Metadata = {
  title: 'Roma Pizzeria Restaurante — Savigné-sur-Lathan',
  description: 'Pizzeria italienne authentique à Savigné-sur-Lathan, Indre-et-Loire. Pizzas au four à bois, produits frais, plats du jour et réservation en ligne.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Roma Pizzeria Restaurante',
    description: 'Pizzeria italienne authentique à Savigné-sur-Lathan',
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
        <meta name="theme-color" content="#C4622D" />
      </head>
      <body>{children}</body>
    </html>
  )
}
