'use client'
import { createContext, useContext, useState, useEffect } from 'react'

type Lang = 'fr' | 'it' | 'en'
const LanguageContext = createContext<{lang: Lang, setLang: (l: Lang) => void}>({
  lang: 'fr', setLang: () => {}
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr')

  useEffect(() => {
    const saved = localStorage.getItem('roma_lang') as Lang
    if (saved && ['fr','it','en'].includes(saved)) setLangState(saved)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('roma_lang', l)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLang = () => useContext(LanguageContext)
