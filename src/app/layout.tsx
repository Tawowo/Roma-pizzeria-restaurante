import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'Roma Pizzeria Restaurante — Savigné-sur-Lathan',
  description: 'Pizzeria italienne authentique à Savigné-sur-Lathan, Indre-et-Loire. Pizzas au four à bois, produits frais, plats du jour et réservation en ligne.',
  manifest: '/manifest.json',
  themeColor: '#C4622D',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5',
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
