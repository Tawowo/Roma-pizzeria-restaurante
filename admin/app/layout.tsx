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
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className={`${inter.className} bg-[#FBF6EE] text-[#1A1A1A] overflow-x-hidden`}>
        {noSidebar || !session ? (
          children
        ) : (
          <div className="flex min-h-screen">
            <Sidebar nom={session.nom} role={session.role} permissions={session.permissions} />
            <div className="flex-1 flex flex-col min-h-screen min-w-0">
              <header className="h-14 bg-white border-b border-[#E0D5C5] flex items-center px-4 md:px-6 pr-16 md:pr-6 shrink-0">
                <span className="text-sm text-[#555555]">Bienvenue, <strong>{session.nom}</strong></span>
              </header>
              <main className="flex-1 p-3 md:p-6 overflow-x-hidden">{children}</main>
            </div>
          </div>
        )}
      </body>
    </html>
  )
}
