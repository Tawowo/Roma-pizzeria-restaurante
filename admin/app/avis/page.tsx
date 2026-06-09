'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type StatutAvis = 'en_attente' | 'valide' | 'refuse'

interface Avis {
  id: string
  note: number
  texte: string
  auteur: string
  ville?: string
  source?: string
  statut: StatutAvis
  created_at: string
}

function Stars({ note }: { note: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < note ? '#D4A843' : '#444', fontSize: 14 }}>★</span>
      ))}
    </div>
  )
}

export default function AvisPage() {
  const router = useRouter()
  const [onglet, setOnglet] = useState<StatutAvis>('en_attente')
  const [avis, setAvis] = useState<Avis[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAvis = useCallback(async (statut: StatutAvis) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('avis')
        .select('*')
        .eq('statut', statut)
        .order('created_at', { ascending: false })
      if (error) throw error
      setAvis(data ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/login'); return }
    if (session.role !== 'monica') { router.replace('/dashboard'); return }
    fetchAvis('en_attente')
  }, [router, fetchAvis])

  useEffect(() => {
    fetchAvis(onglet)
  }, [onglet, fetchAvis])

  const updateStatut = async (id: string, statut: StatutAvis) => {
    try {
      await supabase.from('avis').update({ statut }).eq('id', id)
      await fetchAvis(onglet)
    } catch (err) {
      console.error(err)
    }
  }

  const onglets: { key: StatutAvis; label: string }[] = [
    { key: 'en_attente', label: 'En attente' },
    { key: 'valide', label: 'Validés' },
    { key: 'refuse', label: 'Refusés' },
  ]

  return (
    <div className="p-8" style={{ color: '#F5F5F5' }}>
      <h1 className="text-2xl font-bold mb-6">Avis clients</h1>

      {/* Onglets */}
      <div className="flex gap-2 mb-6">
        {onglets.map(o => (
          <button key={o.key} onClick={() => setOnglet(o.key)}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: onglet === o.key ? '#B71C1C' : '#242424', color: onglet === o.key ? '#fff' : '#888', border: onglet === o.key ? '1px solid #B71C1C' : '1px solid #333' }}>
            {o.label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-gray-500">Chargement...</div> : avis.length === 0 ? (
        <div className="text-gray-500">Aucun avis {onglet === 'en_attente' ? 'en attente' : onglet === 'valide' ? 'validé' : 'refusé'}.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {avis.map(a => (
            <div key={a.id} className="rounded-xl p-5" style={{ background: '#242424', border: '1px solid #2a2a2a' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Stars note={a.note} />
                  <div className="font-medium mt-1">{a.auteur}</div>
                  <div className="text-xs text-gray-500">
                    {a.ville && `${a.ville} · `}{a.source && `${a.source} · `}
                    {new Date(a.created_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <div className="text-3xl font-bold" style={{ color: '#D4A843' }}>{a.note}/5</div>
              </div>
              <p className="text-sm text-gray-300 mb-4 leading-relaxed">{a.texte}</p>
              {onglet !== 'valide' && (
                <button onClick={() => updateStatut(a.id, 'valide')} className="px-4 py-1.5 rounded-lg text-xs font-medium mr-2"
                  style={{ background: 'rgba(46,125,50,0.2)', color: '#4caf50', border: '1px solid rgba(46,125,50,0.3)' }}>
                  ✓ Valider
                </button>
              )}
              {onglet !== 'refuse' && (
                <button onClick={() => updateStatut(a.id, 'refuse')} className="px-4 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(183,28,28,0.2)', color: '#ef5350', border: '1px solid rgba(183,28,28,0.3)' }}>
                  ✗ Refuser
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
