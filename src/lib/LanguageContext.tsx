'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { T, type Lang, type TKeys } from '@/lib/translations'

interface LanguageContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TKeys) => string
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'fr',
  setLang: () => {},
  t: (key) => T.fr[key] ?? key,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('roma_lang') as Lang
      if (saved && ['fr', 'it', 'en'].includes(saved)) setLangState(saved)
    } catch { /* SSR */ }
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('roma_lang', l) } catch { /* SSR */ }
  }

  const t = (key: TKeys): string => T[lang][key] ?? T.fr[key] ?? key

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLang = () => useContext(LanguageContext)
