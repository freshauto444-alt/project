"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, Sparkles, LogIn, Sun, Moon } from "lucide-react"
import { useSettings } from "@/lib/settings-context"

const navItems = [
  { href: "/catalog", label: "Каталог" },
  { href: "/order", label: "Під замовлення" },
  { href: "/picker", label: "Підбір", accent: true },
  { href: "/services", label: "Послуги" },
]

export default function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, setTheme } = useSettings()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "glass-strong border-b border-white/[0.04] py-3" : "bg-transparent py-5"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-base font-extrabold tracking-tight text-white transition-opacity hover:opacity-70"
            style={{ letterSpacing: "-0.02em", textShadow: "0 0 12px rgba(255,255,255,0.25), 0 0 4px rgba(255,255,255,0.15)" }}
          >
            Fresh Auto
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Головна навігація">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-full px-4 py-1.5 text-xs font-medium tracking-wide transition-all duration-200 ${
                    isActive
                      ? "text-white"
                      : item.accent
                      ? "text-primary hover:text-primary hover:brightness-125"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  <span className="relative z-10 flex items-center gap-1.5">
                    {item.accent && <Sparkles className="h-3 w-3" />}
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-foreground/[0.06]"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:text-white transition-colors cursor-pointer"
              aria-label={theme === "dark" ? "Світла тема" : "Темна тема"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              href="/login"
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                pathname === "/login"
                  ? "bg-white/[0.08] text-white"
                  : "text-white/70 hover:text-white"
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              {"Увійти"}
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-8 w-8 items-center justify-center text-foreground md:hidden cursor-pointer"
            aria-label="Меню"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 glass-strong pt-20 px-6 md:hidden"
          >
            <div className="flex flex-col gap-1 mt-4">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-xl px-4 py-3.5 text-left text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark" ? "Світла тема" : "Темна тема"}
              </button>
              {[
                { href: "/", label: "Головна", accent: false },
                ...navItems,
                { href: "/about", label: "Про нас", accent: false },
                { href: "/contacts", label: "Контакти", accent: false },
                { href: "/login", label: "Увійти", accent: false },
              ].map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-4 py-3.5 text-sm font-medium transition-colors flex items-center gap-2 ${
                      isActive
                        ? "bg-foreground/[0.05] text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.accent && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
