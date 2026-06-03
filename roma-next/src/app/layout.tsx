import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'Roma Pizzeria Restaurante — Savigné-sur-Lathan',
  description: 'Pizzeria italienne authentique à Savigné-sur-Lathan. Pizzas artisanales, plats du jour, réservation et commande en ligne.',
  manifest: '/manifest.json',
  themeColor: '#C41E3A',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Roma Pizzeria" />
      </head>
      <body>{children}</body>
    </html>
  )
}
