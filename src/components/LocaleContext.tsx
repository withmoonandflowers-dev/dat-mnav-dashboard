import { createContext, useContext, useState, type ReactNode } from 'react'
import { type Locale, LOCALE_LABELS } from '../i18n'

interface LocaleCtx {
  locale: Locale
  setLocale: (l: Locale) => void
}

const Ctx = createContext<LocaleCtx>({ locale: 'en', setLocale: () => {} })

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    // Detect browser language
    const lang = navigator.language
    if (lang.startsWith('zh-TW') || lang === 'zh-Hant') return 'zh-TW'
    if (lang.startsWith('zh')) return 'zh-CN'
    if (lang.startsWith('ja')) return 'ja'
    return 'en'
  })
  return <Ctx.Provider value={{ locale, setLocale }}>{children}</Ctx.Provider>
}

export function useLocale() { return useContext(Ctx) }

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale()
  return (
    <div className="flex items-center gap-1">
      {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([key, label]) => (
        <button
          key={key}
          onClick={() => setLocale(key)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            locale === key
              ? 'bg-orange-500 text-black'
              : 'bg-[#1a1a1a] text-gray-400 hover:text-white hover:bg-[#222]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
