"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, Sparkles, LogIn, Sun, Moon, User, Shield, LogOut, ChevronDown } from "lucide-react"
import { useSettings } from "@/lib/settings-context"
import { useAuth } from "@/lib/auth-context"
import { t } from "@/lib/i18n"

function useNavItems() {
  const { language } = useSettings()
  return [
    { href: "/catalog", label: t("nav.catalog", language) },
    { href: "/order", label: t("nav.order", language) },
    { href: "/picker", label: t("nav.picker", language), accent: true },
    { href: "/services", label: t("nav.services", language) },
  ]
}

export default function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { theme, setTheme, language, setLanguage } = useSettings()
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const navItems = useNavItems()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setDropdownOpen(false)
  }, [pathname])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Hero mode handled purely via CSS class on <header> — no hydration issues

  const isAdmin = profile?.role === "admin" || profile?.role === "manager"
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "?"

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "glass-strong border-b border-border py-3 shadow-sm" : "bg-transparent py-5"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-base font-extrabold tracking-tight transition-opacity hover:opacity-70 text-foreground"
            style={{ letterSpacing: "-0.02em" }}
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
                      ? "text-foreground"
                      : item.accent
                      ? "text-primary hover:text-primary hover:brightness-125"
                      : "text-muted-foreground hover:text-foreground"
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
            {/* Language toggle */}
            <button
              onClick={() => setLanguage(language === "uk" ? "en" : "uk")}
              className="flex h-8 items-center justify-center rounded-full px-2 text-[10px] font-bold transition-colors cursor-pointer uppercase tracking-wider text-muted-foreground hover:text-foreground"
              aria-label="Switch language"
            >
              {language === "uk" ? "EN" : "UA"}
            </button>

            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
              aria-label={theme === "dark" ? "Світла тема" : "Темна тема"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Auth: user dropdown or login link */}
            {!authLoading && user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex h-8 items-center gap-1.5 rounded-full px-1.5 text-xs font-medium transition-colors hover:bg-foreground/[0.05] cursor-pointer"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/[0.12] text-[10px] font-bold text-primary">
                    {initials}
                  </div>
                  <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-10 w-52 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-xs font-medium text-foreground truncate">{profile?.full_name || "Користувач"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                      </div>

                      <div className="p-1.5">
                        <Link
                          href="/profile"
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
                        >
                          <User className="h-3.5 w-3.5" />
                          {t("nav.cabinet", language)}
                        </Link>

                        {isAdmin && (
                          <Link
                            href="/admin"
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-primary hover:bg-primary/[0.06] transition-colors"
                          >
                            <Shield className="h-3.5 w-3.5" />
                            {t("nav.crm", language)}
                          </Link>
                        )}

                        <button
                          onClick={signOut}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/[0.06] transition-colors cursor-pointer"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          {t("nav.logout", language)}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : !authLoading ? (
              <Link
                href="/login"
                className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                  pathname === "/login"
                    ? "bg-foreground/[0.08] text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                {t("nav.login", language)}
              </Link>
            ) : null}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-8 w-8 items-center justify-center md:hidden cursor-pointer text-foreground"
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
              {/* User info on mobile */}
              {user && profile && (
                <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl bg-foreground/[0.03]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/[0.12] text-xs font-bold text-primary">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{profile.full_name || "Користувач"}</p>
                    <p className="text-[10px] text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex-1 rounded-xl px-4 py-3.5 text-left text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === "dark" ? t("nav.lightTheme", language) : t("nav.darkTheme", language)}
                </button>
                <button
                  onClick={() => setLanguage(language === "uk" ? "en" : "uk")}
                  className="rounded-xl px-4 py-3.5 text-sm font-bold transition-colors cursor-pointer text-muted-foreground hover:text-foreground uppercase"
                >
                  {language === "uk" ? "EN" : "UA"}
                </button>
              </div>

              {[
                { href: "/", label: t("nav.home", language), accent: false },
                ...navItems,
                { href: "/about", label: t("nav.about", language), accent: false },
                { href: "/contacts", label: t("nav.contacts", language), accent: false },
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

              {/* Auth links for mobile */}
              {user ? (
                <>
                  <Link href="/profile" className="rounded-xl px-4 py-3.5 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2">
                    <User className="h-4 w-4" /> {t("nav.cabinet", language)}
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" className="rounded-xl px-4 py-3.5 text-sm font-medium text-primary flex items-center gap-2">
                      <Shield className="h-4 w-4" /> {t("nav.crm", language)}
                    </Link>
                  )}
                  <button onClick={signOut} className="rounded-xl px-4 py-3.5 text-left text-sm font-medium text-muted-foreground hover:text-destructive flex items-center gap-2 cursor-pointer">
                    <LogOut className="h-4 w-4" /> {t("nav.logout", language)}
                  </button>
                </>
              ) : (
                <Link href="/login" className="rounded-xl px-4 py-3.5 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2">
                  <LogIn className="h-4 w-4" /> {t("nav.login", language)}
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
