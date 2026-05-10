"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Loader2, Check, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { useSettings } from "@/lib/settings-context"
import { t } from "@/lib/i18n"

/* ─── GlassInput ────────────────────────────────────────────── */

function GlassInput({
  icon: Icon, type = "text", placeholder, value, onChange, autoComplete, disabled,
}: {
  icon: React.ComponentType<{ className?: string }>
  type?: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  disabled?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const isPw = type === "password"

  return (
    <div
      className={`group relative flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-300 ${
        focused
          ? "border-primary/40 bg-primary/[0.04] shadow-[0_0_20px_rgba(0,210,198,0.06)]"
          : "border-border bg-secondary/30 hover:border-border/60"
      }`}
    >
      <Icon className={`h-4 w-4 flex-shrink-0 transition-colors duration-300 ${focused ? "text-primary" : "text-muted-foreground/50"}`} />
      <input
        type={isPw && showPw ? "text" : type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        disabled={disabled}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none disabled:opacity-50"
      />
      {isPw && value && (
        <button type="button" onClick={() => setShowPw(!showPw)} className="flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer" tabIndex={-1}>
          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
      <motion.div
        className="absolute bottom-0 left-1/2 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        initial={{ width: 0, x: "-50%" }}
        animate={{ width: focused ? "80%" : 0, x: "-50%" }}
        transition={{ duration: 0.3 }}
      />
    </div>
  )
}

/* ─── PasswordStrength ──────────────────────────────────────── */

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+", ok: password.length >= 8 },
    { label: "A-Z", ok: /[A-Z]/.test(password) },
    { label: "0-9", ok: /\d/.test(password) },
  ]
  const score = checks.filter((c) => c.ok).length
  const labels = ["", "Слабкий", "Середній", "Надійний"]
  return (
    <div className="flex items-center gap-3 mt-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i < score ? (score === 3 ? "bg-emerald-500" : score === 2 ? "bg-amber-400" : "bg-destructive/60") : "bg-border"
            }`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: i < score ? 1 : 0.3 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            style={{ transformOrigin: "left" }}
          />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground/50">{labels[score]}</span>
    </div>
  )
}

/* ─── Main Login Client ─────────────────────────────────────── */

type AuthTab = "email" | "phone" | "magic"

export default function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/profile"
  const { user } = useAuth()
  const { language } = useSettings()

  // Redirect if already logged in
  useEffect(() => {
    if (user) router.replace(redirect)
  }, [user, redirect, router])

  const supabase = createClient()

  const [authTab, setAuthTab] = useState<AuthTab>("email")
  const [mode, setMode] = useState<"login" | "register">("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const emailValid = mode === "login"
    ? email.includes("@") && password.length >= 6
    : name.trim().length >= 2 && email.includes("@") && password.length >= 8

  /* ─── Email/password ─── */
  const handleEmailSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailValid) return
    setError("")
    setLoading(true)

    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      } else {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        })
        if (err) throw err
      }
      setSuccess(true)
      setTimeout(() => router.push(redirect), 600)
    } catch (err: any) {
      setError(err.message || "Помилка авторизації")
    } finally {
      setLoading(false)
    }
  }, [emailValid, mode, email, password, name, supabase, router, redirect])

  /* ─── Google OAuth ─── */
  const handleGoogle = useCallback(async () => {
    setError("")
    const origin = window.location.origin
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(redirect)}` },
    })
    if (err) setError(err.message)
  }, [supabase, redirect])

  /* ─── Phone OTP ─── */
  const handleSendOtp = useCallback(async () => {
    if (!phone || phone.length < 10) return
    setError("")
    setLoading(true)
    try {
      const formatted = phone.startsWith("+") ? phone : `+380${phone.replace(/^0/, "")}`
      const { error: err } = await supabase.auth.signInWithOtp({ phone: formatted })
      if (err) throw err
      setOtpSent(true)
    } catch (err: any) {
      setError(err.message || "Не вдалось відправити SMS")
    } finally {
      setLoading(false)
    }
  }, [phone, supabase])

  const handleVerifyOtp = useCallback(async () => {
    if (!otpCode || otpCode.length < 4) return
    setError("")
    setLoading(true)
    try {
      const formatted = phone.startsWith("+") ? phone : `+380${phone.replace(/^0/, "")}`
      const { error: err } = await supabase.auth.verifyOtp({ phone: formatted, token: otpCode, type: "sms" })
      if (err) throw err
      setSuccess(true)
      setTimeout(() => router.push(redirect), 600)
    } catch (err: any) {
      setError(err.message || "Невірний код")
    } finally {
      setLoading(false)
    }
  }, [otpCode, phone, supabase, router, redirect])

  /* ─── Magic link ─── */
  const handleMagicLink = useCallback(async () => {
    if (!email.includes("@")) return
    setError("")
    setLoading(true)
    try {
      const origin = window.location.origin
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(redirect)}` },
      })
      if (err) throw err
      setMagicSent(true)
    } catch (err: any) {
      setError(err.message || "Не вдалось відправити лист")
    } finally {
      setLoading(false)
    }
  }, [email, supabase, redirect])

  const tabs: { id: AuthTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "email", label: t("login.email", language), icon: Mail },
    { id: "phone", label: t("login.phone", language), icon: Phone },
    { id: "magic", label: t("login.magic", language), icon: Sparkles },
  ]

  return (
    <section className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-6 py-20 pt-28">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/[0.03] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-primary/[0.02] blur-[80px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        {/* Glass card */}
        <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden">
          <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          <div className="p-8 sm:p-10">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="text-center mb-8"
            >
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/[0.08] mb-4 border border-primary/10">
                <motion.div animate={{ rotate: success ? 360 : 0 }} transition={{ duration: 0.6 }}>
                  {success ? <Check className="h-5 w-5 text-emerald-400" /> : <Lock className="h-5 w-5 text-primary" />}
                </motion.div>
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {success ? t("login.success", language) : mode === "login" ? t("login.title", language) : t("login.register", language)}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {success ? t("login.redirecting", language) : mode === "login" ? t("login.subtitle", language) : t("login.registerSubtitle", language)}
              </p>
            </motion.div>

            {/* Auth method tabs */}
            {!success && (
              <div className="flex gap-1 rounded-2xl border border-border bg-secondary/30 p-1 mb-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setAuthTab(tab.id); setError("") }}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-all cursor-pointer ${
                      authTab === tab.id
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ── EMAIL TAB ── */}
            {authTab === "email" && !success && (
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
                <AnimatePresence mode="wait">
                  {mode === "register" && (
                    <motion.div key="name" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                      <GlassInput icon={User} placeholder={t("login.yourName", language)} value={name} onChange={setName} autoComplete="name" disabled={loading} />
                    </motion.div>
                  )}
                </AnimatePresence>

                <GlassInput icon={Mail} type="email" placeholder={t("login.email", language)} value={email} onChange={setEmail} autoComplete="email" disabled={loading} />
                <GlassInput icon={Lock} type="password" placeholder={mode === "login" ? t("login.password", language) : t("login.createPassword", language)} value={password} onChange={setPassword} autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={loading} />

                {mode === "register" && password && <PasswordStrength password={password} />}

                {error && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive mt-1">{error}</motion.p>
                )}

                <motion.button
                  type="submit"
                  disabled={!emailValid || loading}
                  whileTap={{ scale: 0.98 }}
                  className={`relative mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-medium transition-all duration-300 cursor-pointer overflow-hidden ${
                    emailValid && !loading
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:brightness-110"
                      : "bg-secondary/50 text-muted-foreground/30 border border-border"
                  }`}
                >
                  {emailValid && !loading && (
                    <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }} />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{mode === "login" ? t("login.signIn", language) : t("login.createAccount", language)}<ArrowRight className="h-4 w-4" /></>}
                  </span>
                </motion.button>

                <div className="mt-3 text-center">
                  <span className="text-xs text-muted-foreground/50">
                    {mode === "login" ? t("login.noAccount", language) : t("login.hasAccount", language)}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setMode(mode === "login" ? "register" : "login"); setError("") }}
                    className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer font-medium"
                  >
                    {mode === "login" ? t("login.signUp", language) : t("login.signInLink", language)}
                  </button>
                </div>
              </form>
            )}

            {/* ── PHONE TAB ── */}
            {authTab === "phone" && !success && (
              <div className="flex flex-col gap-3">
                {!otpSent ? (
                  <>
                    <GlassInput icon={Phone} type="tel" placeholder="+380 __ ___ __ __" value={phone} onChange={setPhone} autoComplete="tel" disabled={loading} />
                    <p className="text-[11px] text-muted-foreground/40">Ми відправимо SMS з кодом підтвердження</p>
                    {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-destructive">{error}</motion.p>}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSendOtp}
                      disabled={!phone || phone.length < 10 || loading}
                      className={`mt-2 flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-medium transition-all cursor-pointer ${
                        phone.length >= 10 && !loading
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110"
                          : "bg-secondary/50 text-muted-foreground/30 border border-border"
                      }`}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Отримати код</span><ArrowRight className="h-4 w-4" /></>}
                    </motion.button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground text-center">Код відправлено на {phone}</p>
                    <GlassInput icon={Lock} placeholder="Код з SMS" value={otpCode} onChange={setOtpCode} autoComplete="one-time-code" disabled={loading} />
                    {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-destructive">{error}</motion.p>}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleVerifyOtp}
                      disabled={otpCode.length < 4 || loading}
                      className={`mt-2 flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-medium transition-all cursor-pointer ${
                        otpCode.length >= 4 && !loading
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110"
                          : "bg-secondary/50 text-muted-foreground/30 border border-border"
                      }`}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Підтвердити"}
                    </motion.button>
                    <button onClick={() => { setOtpSent(false); setOtpCode(""); setError("") }} className="text-xs text-muted-foreground/50 hover:text-primary transition-colors cursor-pointer mt-1">
                      Змінити номер
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── MAGIC LINK TAB ── */}
            {authTab === "magic" && !success && (
              <div className="flex flex-col gap-3">
                {!magicSent ? (
                  <>
                    <GlassInput icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} autoComplete="email" disabled={loading} />
                    <p className="text-[11px] text-muted-foreground/40">Ми відправимо посилання для входу — без пароля</p>
                    {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-destructive">{error}</motion.p>}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleMagicLink}
                      disabled={!email.includes("@") || loading}
                      className={`mt-2 flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-medium transition-all cursor-pointer ${
                        email.includes("@") && !loading
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110"
                          : "bg-secondary/50 text-muted-foreground/30 border border-border"
                      }`}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" /><span>Відправити посилання</span></>}
                    </motion.button>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/[0.08] mb-4 border border-primary/10">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Перевірте пошту</p>
                    <p className="mt-2 text-xs text-muted-foreground">Ми відправили посилання для входу на {email}</p>
                    <button onClick={() => { setMagicSent(false); setError("") }} className="mt-4 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer">
                      Спробувати знову
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            {!success && authTab === "email" && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center"><span className="bg-card px-4 text-[11px] text-muted-foreground/40">{t("login.or", language)}</span></div>
                </div>

                {/* Google OAuth */}
                <button
                  onClick={handleGoogle}
                  type="button"
                  className="flex h-11 w-full items-center justify-center gap-2.5 rounded-2xl border border-border bg-secondary/30 text-sm text-foreground hover:bg-secondary/50 hover:border-border/60 transition-all cursor-pointer"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  {t("login.google", language)}
                </button>
              </>
            )}
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        </div>

        {/* Back to home */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            {t("login.backHome", language)}
          </Link>
        </div>
      </motion.div>
    </section>
  )
}
