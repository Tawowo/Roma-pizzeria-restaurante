'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { setSession } from '@/lib/auth'
import type { AdminRole } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type Profile = { role: AdminRole; nom: string; id: string; emoji: string; label: string; pw: string; activeClass: string }

const PROFILES: Profile[] = [
  { role: 'monica', nom: 'Monica', id: '1', emoji: '🌟', label: 'Monica', pw: 'monica', activeClass: 'bg-green-900 border-green-600' },
  { role: 'andre', nom: 'Andreï', id: '2', emoji: '🍽️', label: 'Andreï', pw: 'andrei', activeClass: 'bg-blue-900 border-blue-600' },
  { role: 'roberto', nom: 'Roberto', id: '3', emoji: '🔥', label: 'Roberto', pw: 'roberto', activeClass: 'bg-orange-900 border-orange-600' },
]

export default function LoginPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<AdminRole | null>(null)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!selected) { setError('Veuillez sélectionner un profil'); return }
    setLoading(true); setError('')

    const selectedRole = selected

    try {
      // 1. Chercher le profil dans Supabase
      const { data: profil, error: supabaseError } = await supabase
        .from('profils_admin')
        .select('*')
        .eq('role', selectedRole)
        .single()

      if (supabaseError || !profil) {
        // Fallback: vérifier avec les mots de passe codés en dur
        const hardcoded = PROFILES.find(p => p.role === selectedRole)
        if (!hardcoded || password !== hardcoded.pw) {
          setError('Mot de passe incorrect')
          return
        }
        setSession({ role: hardcoded.role, nom: hardcoded.nom, id: hardcoded.id })
      } else {
        // Vérifier le mot de passe
        let isValid = false
        const codeAcces: string = profil.code_acces || profil.mot_de_passe || ''

        if (codeAcces.startsWith('$2')) {
          // Hash bcrypt
          isValid = await bcrypt.compare(password, codeAcces)
        } else {
          // Mot de passe en clair → vérifier puis migrer vers bcrypt
          isValid = (password === codeAcces)
          if (isValid && codeAcces) {
            // Migration automatique vers hash
            try {
              const hashed = await bcrypt.hash(password, 10)
              await supabase.from('profils_admin')
                .update({ code_acces: hashed })
                .eq('id', profil.id)
            } catch { /* migration optionnelle, pas bloquante */ }
          }
        }

        if (!isValid) {
          setError('Mot de passe incorrect')
          setLoading(false)
          return
        }

        // Mettre à jour derniere_connexion
        try {
          await supabase.from('profils_admin')
            .update({ derniere_connexion: new Date().toISOString() })
            .eq('id', profil.id)
        } catch { /* optionnel */ }

        const role = (profil.role || selectedRole) as AdminRole
        setSession({ role, nom: profil.nom || profil.name || selectedRole, id: profil.id, permissions: profil.permissions ?? {} })
      }

      // Redirection selon le rôle
      if (selectedRole === 'monica') router.push('/dashboard')
      else if (selectedRole === 'andre') router.push('/reservations')
      else router.push('/cuisine')

    } catch (err) {
      console.error('Login error:', err)
      setError('Erreur de connexion. Vérifiez votre mot de passe.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0F0F' }}>
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="font-serif italic text-5xl text-yellow-500 mb-2">Roma</div>
          <div className="text-gray-400 text-sm tracking-widest uppercase">Administration</div>
        </div>

        {/* Profil */}
        <div className="mb-6">
          <p className="text-gray-400 text-xs mb-3 uppercase tracking-widest">Sélectionnez votre profil</p>
          <div className="grid grid-cols-3 gap-3">
            {PROFILES.map(p => (
              <button
                key={p.role}
                onClick={() => { setSelected(p.role); setError('') }}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  selected === p.role ? p.activeClass : 'border-gray-700 bg-gray-900'
                }`}
              >
                <span className="text-2xl">{p.emoji}</span>
                <span className="text-sm font-medium" style={{ color: '#F5F5F5' }}>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mot de passe */}
        <div className="mb-6">
          <p className="text-gray-400 text-xs mb-3 uppercase tracking-widest">Mot de passe</p>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-red-700"
              style={{ background: '#1A1A1A', border: '1px solid #333', color: '#F5F5F5' }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              aria-label="Afficher le mot de passe"
            >
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div className="mb-4 px-4 py-2 rounded-lg text-sm text-red-400" style={{ background: 'rgba(183,28,28,0.15)', border: '1px solid rgba(183,28,28,0.3)' }}>
            {error}
          </div>
        )}

        {/* Bouton */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-white transition-all hover:bg-red-800 active:scale-95 disabled:opacity-50"
          style={{ background: '#B71C1C' }}
        >
          {loading ? '⏳ Connexion...' : 'Connexion'}
        </button>
      </div>
    </div>
  )
}
