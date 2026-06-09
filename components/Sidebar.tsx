'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearSession } from '@/lib/auth'
import type { AdminRole } from '@/lib/auth'

const NAV_MONICA = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { label: 'Réservations', href: '/reservations', icon: '📅' },
  { label: 'Commandes', href: '/commandes', icon: '🛒' },
  { label: 'Cuisine', href: '/cuisine', icon: '🔥' },
  { label: 'Menu', href: '/menu', icon: '📖' },
  { label: 'Plats du jour', href: '/plats', icon: '🍽️' },
  { label: 'Clients', href: '/clients', icon: '👥' },
  { label: 'Avis', href: '/avis', icon: '⭐' },
  { label: 'Finances', href: '/finances', icon: '💰' },
  { label: 'Paramètres', href: '/parametres', icon: '⚙️' },
]

const NAV_ANDRE = [
  { label: 'Réservations', href: '/reservations', icon: '📅' },
  { label: 'Commandes', href: '/commandes', icon: '🛒' },
  { label: 'Menu', href: '/menu', icon: '📖' },
]

const NAV_ROBERTO = [
  { label: 'Cuisine', href: '/cuisine', icon: '🔥' },
]

interface SidebarProps {
  nom: string
  role: AdminRole
}

export default function Sidebar({ nom, role }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const nav = role === 'monica' ? NAV_MONICA : role === 'andre' ? NAV_ANDRE : NAV_ROBERTO

  const handleLogout = () => {
    clearSession()
    router.push('/login')
  }

  return (
    <aside style={{
      width: 240, background: '#1A1A1A', height: '100vh', position: 'sticky', top: 0,
      display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0,
      borderRight: '1px solid #2a2a2a',
    }}>
      {/* Logo */}
      <div style={{ padding: '0 24px 24px', borderBottom: '1px solid #2a2a2a', marginBottom: 16 }}>
        <div style={{ fontFamily: 'serif', fontSize: 26, fontStyle: 'italic', color: '#D4A843', fontWeight: 700 }}>Roma</div>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#555', fontFamily: 'sans-serif' }}>Administration</div>
      </div>

      {/* User info */}
      <div style={{ padding: '0 24px 16px', borderBottom: '1px solid #2a2a2a', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: '#F5F5F5', fontWeight: 600 }}>{nom}</div>
        <div style={{ fontSize: 11, color: '#888', textTransform: 'capitalize', marginTop: 2 }}>{role}</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 12px', overflowY: 'auto' }}>
        {nav.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 6, marginBottom: 2,
              background: active ? 'rgba(183,28,28,0.2)' : 'transparent',
              color: active ? '#F5F5F5' : '#888',
              textDecoration: 'none', fontSize: 13, fontFamily: 'sans-serif',
              borderLeft: active ? '3px solid #B71C1C' : '3px solid transparent',
              transition: 'all 0.2s',
            }}>
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid #2a2a2a' }}>
        <button onClick={handleLogout} style={{
          width: '100%', padding: '10px 16px', background: 'rgba(183,28,28,0.15)', color: '#B71C1C',
          border: '1px solid rgba(183,28,28,0.3)', borderRadius: 6, fontSize: 13, cursor: 'pointer',
          fontFamily: 'sans-serif', transition: 'all 0.2s',
        }}>
          🚪 Se déconnecter
        </button>
      </div>
    </aside>
  )
}
