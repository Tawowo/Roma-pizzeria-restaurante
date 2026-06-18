'use client'
import { useState, useEffect } from 'react'

export interface ClientLocal {
  id: string
  nom: string
  telephone: string
  email?: string
  points: number
  nb_visites?: number
}

export function useClient() {
  const [client, setClient] = useState<ClientLocal | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Seulement côté client
    try {
      const saved = localStorage.getItem('roma_client')
      if (saved) setClient(JSON.parse(saved))
    } catch {}
    setLoaded(true)
  }, [])

  const saveClient = (c: ClientLocal) => {
    setClient(c)
    try { localStorage.setItem('roma_client', JSON.stringify(c)) } catch {}
  }

  const logout = () => {
    setClient(null)
    try { localStorage.removeItem('roma_client') } catch {}
  }

  return { client, saveClient, logout, loaded }
}
