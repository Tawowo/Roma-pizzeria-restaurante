'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const session = getSession()
    if (!session) {
      router.replace('/login')
    } else if (session.role === 'roberto') {
      router.replace('/cuisine')
    } else if (session.role === 'andre') {
      router.replace('/reservations')
    } else {
      router.replace('/dashboard')
    }
  }, [router])

  return (
    <div style={{ background: '#0F0F0F', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#888', fontFamily: 'sans-serif' }}>Redirection...</div>
    </div>
  )
}
