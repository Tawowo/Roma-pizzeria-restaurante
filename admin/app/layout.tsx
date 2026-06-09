'use client'
import { Inter } from 'next/font/google'
import './globals.css'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSession } from '@/lib/auth'
import type { AdminSession } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'

const inter = Inter({ subsets: ['latin'] })

const NO_SIDEBAR = ['/login', '/cuisine']

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [session, setSession] = useState<AdminSession | null>(null)

  useEffect(() => {
    setSession(getSession())
  }, [pathname])

  const noSidebar = NO_SIDEBAR.some(p => pathname === p || pathname.startsWith(p + '/'))

  return (
    <html lang="fr">
      <body className={`${inter.className} bg-[#FBF6EE] text-[#1A1A1A]`}>
        {noSidebar || !session ? (
          children
        ) : (
          <div className="flex min-h-screen">
            <Sidebar nom={session.nom} role={session.role} />
            <div className="flex-1 flex flex-col min-h-screen">
              <header className="h-14 bg-white border-b border-[#E0D5C5] flex items-center px-6 shrink-0">
                <span className="text-sm text-[#555555]">Bienvenue, <strong>{session.nom}</strong></span>
              </header>
              <main className="flex-1 p-6">{children}</main>
            </div>
          </div>
        )}
      </body>
    </html>
  )
}
