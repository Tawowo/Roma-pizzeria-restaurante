'use client'
import { useState, useEffect } from 'react'

export interface ClientLocal {
  id: string
  nom: string
  telephone: string
  email?: string
  points: number
}

export function useClient() {
  const [client, setClient] = useState<ClientLocal | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('roma_client')
      if (saved) setClient(JSON.parse(saved))
    } catch {}
  }, [])

  const saveClient = (c: ClientLocal) => {
    setClient(c)
    localStorage.setItem('roma_client', JSON.stringify(c))
  }

  const logout = () => {
    setClient(null)
    localStorage.removeItem('roma_client')
  }

  return { client, saveClient, logout }
}
