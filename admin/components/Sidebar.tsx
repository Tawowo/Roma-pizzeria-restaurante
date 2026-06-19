'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearSession } from '@/lib/auth'
import type { AdminRole } from '@/lib/auth'

export const ALL_NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊', key: 'dashboard' },
  { label: 'Réservations', href: '/reservations', icon: '📅', key: 'reservations' },
  { label: 'Commandes', href: '/commandes', icon: '🛒', key: 'commandes' },
  { label: 'Cuisine', href: '/cuisine', icon: '🔥', key: 'cuisine' },
  { label: 'Menu', href: '/menu', icon: '📖', key: 'menu' },
  { label: 'Plats du jour', href: '/plats', icon: '🍽️', key: 'plats' },
  { label: 'Clients', href: '/clients', icon: '👥', key: 'clients' },
  { label: 'Avis', href: '/avis', icon: '⭐', key: 'avis' },
  { label: 'Finances', href: '/finances', icon: '💰', key: 'finances' },
  { label: 'Promotions', href: '/promotions', icon: '🎁', key: 'promotions' },
  { label: 'Design du site', href: '/design', icon: '🎨', key: 'design' },
  { label: 'Paramètres', href: '/parametres', icon: '⚙️', key: 'parametres' },
]

interface SidebarProps {
  nom: string
  role: AdminRole
  permissions?: Record<string, boolean>
}

export default function Sidebar({ nom, role, permissions }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => { setOpen(false) }, [pathname])

  const nav = role === 'monica'
    ? ALL_NAV_ITEMS
    : ALL_NAV_ITEMS.filter(item => permissions?.[item.key] === true)

  const handleLogout = () => {
    clearSession()
    router.push('/login')
  }

  const sidebarContent = (
    <div className="w-64 bg-[#1B5E20] text-white min-h-screen flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="font-serif italic text-[#D4A843] text-2xl font-bold">Roma Admin</div>
      </div>
      {/* User info */}
      <div className="px-6 py-3 border-b border-white/10">
        <div className="text-sm font-semibold text-white">{nom}</div>
        <div className="text-xs text-white/60 capitalize mt-0.5">{role}</div>
      </div>
      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {nav.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-md mb-0.5 text-sm transition-all min-h-[48px] ${
                active ? 'bg-[#B71C1C] text-white' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      {/* Logout */}
      <div className="px-4 py-4 border-t border-white/10">
        <button onClick={handleLogout}
          className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white/80 rounded-md text-sm transition-all border border-white/20 min-h-[48px]">
          🚪 Se déconnecter
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Hamburger button - mobile only */}
      <button
        className="md:hidden fixed top-2 right-4 z-50 w-12 h-12 flex items-center justify-center bg-[#1B5E20] text-white rounded-lg shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
      >
        ☰
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative z-50 flex-shrink-0">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
