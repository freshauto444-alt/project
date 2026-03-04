"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"

export type Theme = "dark" | "light"
export type Currency = "EUR" | "USD" | "UAH"
export type Language = "uk" | "en"

interface SettingsContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
  currency: Currency
  setCurrency: (c: Currency) => void
  language: Language
  setLanguage: (l: Language) => void
  formatPrice: (priceEur: number) => string
}

const RATES: Record<Currency, number> = { EUR: 1, USD: 1.08, UAH: 44.5 }
const SYMBOLS: Record<Currency, { currency: string; locale: string }> = {
  EUR: { currency: "EUR", locale: "uk-UA" },
  USD: { currency: "USD", locale: "en-US" },
  UAH: { currency: "UAH", locale: "uk-UA" },
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")
  const [currency, setCurrencyState] = useState<Currency>("EUR")
  const [language, setLanguageState] = useState<Language>("uk")

  /* Apply theme class to <html> */
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    document.documentElement.classList.remove("dark", "light")
    document.documentElement.classList.add(t)
    localStorage.setItem("fa-theme", t)
  }, [])

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c)
    localStorage.setItem("fa-currency", c)
  }, [])

  const setLanguage = useCallback((l: Language) => {
    setLanguageState(l)
    localStorage.setItem("fa-lang", l)
  }, [])

  /* Restore from localStorage on mount */
  useEffect(() => {
    const savedTheme = localStorage.getItem("fa-theme") as Theme | null
    const savedCurrency = localStorage.getItem("fa-currency") as Currency | null
    const savedLang = localStorage.getItem("fa-lang") as Language | null
    if (savedTheme && (savedTheme === "dark" || savedTheme === "light")) setTheme(savedTheme)
    if (savedCurrency && (savedCurrency === "EUR" || savedCurrency === "USD" || savedCurrency === "UAH")) setCurrencyState(savedCurrency)
    if (savedLang && (savedLang === "uk" || savedLang === "en")) setLanguageState(savedLang)
  }, [setTheme])

  const formatPrice = useCallback((priceEur: number): string => {
    const converted = Math.round(priceEur * RATES[currency])
    return new Intl.NumberFormat(SYMBOLS[currency].locale, {
      style: "currency",
      currency: SYMBOLS[currency].currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(converted)
  }, [currency])

  return (
    <SettingsContext.Provider value={{ theme, setTheme, currency, setCurrency, language, setLanguage, formatPrice }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider")
  return ctx
}
