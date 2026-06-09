'use client'
import { Inter } from 'next/font/google'
import './globals.css'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { getSession } from '@/lib/auth'
import type { AdminSession } from '@/lib/auth'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setSession(getSession())
    setMounted(true)
  }, [pathname])

  const noSidebar = pathname === '/login' || pathname === '/cuisine'

  return (
    <html lang="fr">
      <body className={inter.className} style={{ background: '#0F0F0F', margin: 0, padding: 0 }}>
        {!mounted ? (
          <div style={{ background: '#0F0F0F', minHeight: '100vh' }}>{children}</div>
        ) : noSidebar || !session ? (
          <div style={{ background: '#0F0F0F', minHeight: '100vh' }}>{children}</div>
        ) : (
          <div style={{ display: 'flex', minHeight: '100vh', background: '#0F0F0F' }}>
            <Sidebar nom={session.nom} role={session.role} />
            <main style={{ flex: 1, overflowY: 'auto', minHeight: '100vh' }}>
              {children}
            </main>
          </div>
        )}
      </body>
    </html>
  )
}
