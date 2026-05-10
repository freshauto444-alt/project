"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2, Check } from "lucide-react"

interface AuthPageProps {
  onLogin: (user: { name: string; email: string }) => void
  onBack: () => void
}

function GlassInput({
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  icon: React.ComponentType<{ className?: string }>
  type?: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
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
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
      />
      {isPw && value && (
        <button
          type="button"
          onClick={() => setShowPw(!showPw)}
          className="flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer"
          tabIndex={-1}
        >
          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
      {/* Animated underline glow */}
      <motion.div
        className="absolute bottom-0 left-1/2 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        initial={{ width: 0, x: "-50%" }}
        animate={{ width: focused ? "80%" : 0, x: "-50%" }}
        transition={{ duration: 0.3 }}
      />
    </div>
  )
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ symbols", ok: password.length >= 8 },
    { label: "A-Z", ok: /[A-Z]/.test(password) },
    { label: "0-9", ok: /\d/.test(password) },
  ]
  const score = checks.filter((c) => c.ok).length
  return (
    <div className="flex items-center gap-3 mt-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i < score
                ? score === 3
                  ? "bg-emerald-500"
                  : score === 2
                    ? "bg-amber-400"
                    : "bg-destructive/60"
                : "bg-border"
            }`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: i < score ? 1 : 0.3 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            style={{ transformOrigin: "left" }}
          />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground/50">
        {score === 0 ? "" : score === 1 ? "Weak" : score === 2 ? "Medium" : "Strong"}
      </span>
    </div>
  )
}

export default function AuthPage({ onLogin, onBack }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const isValid =
    mode === "login"
      ? email.includes("@") && password.length >= 6
      : name.trim().length >= 2 && email.includes("@") && password.length >= 8

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!isValid) return
      setError("")
      setLoading(true)

      // Simulate auth delay
      setTimeout(() => {
        setLoading(false)
        setSuccess(true)
        setTimeout(() => {
          onLogin({ name: name || email.split("@")[0], email })
        }, 800)
      }, 1200)
    },
    [isValid, mode, name, email, password, onLogin]
  )

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login")
    setError("")
    setSuccess(false)
  }

  return (
    <section className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-6 py-20">
      {/* Ambient bg glow */}
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
          {/* Decorative top line */}
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
                <motion.div
                  animate={{ rotate: success ? 360 : 0 }}
                  transition={{ duration: 0.6 }}
                >
                  {success ? (
                    <Check className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Lock className="h-5 w-5 text-primary" />
                  )}
                </motion.div>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    {mode === "login" ? "Welcome back" : "Create account"}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {mode === "login"
                      ? "Sign in to your Fresh Auto account"
                      : "Join Fresh Auto for personalized experience"}
                  </p>
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <AnimatePresence mode="wait">
                {mode === "register" && (
                  <motion.div
                    key="name-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <GlassInput
                      icon={User}
                      placeholder="Your name"
                      value={name}
                      onChange={setName}
                      autoComplete="name"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <GlassInput
                icon={Mail}
                type="email"
                placeholder="Email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />

              <GlassInput
                icon={Lock}
                type="password"
                placeholder={mode === "login" ? "Password" : "Create password"}
                value={password}
                onChange={setPassword}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />

              {mode === "register" && password && (
                <PasswordStrength password={password} />
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive mt-1"
                >
                  {error}
                </motion.p>
              )}

              {mode === "login" && (
                <div className="flex justify-end">
                  <button type="button" className="text-[11px] text-muted-foreground/50 hover:text-primary transition-colors cursor-pointer">
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Submit button */}
              <motion.button
                type="submit"
                disabled={!isValid || loading || success}
                whileTap={{ scale: 0.98 }}
                className={`relative mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-medium transition-all duration-300 cursor-pointer overflow-hidden ${
                  success
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                    : isValid
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:brightness-110"
                      : "bg-secondary/50 text-muted-foreground/30 border border-border"
                }`}
              >
                {/* Shimmer effect */}
                {isValid && !loading && !success && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : success ? (
                    <>
                      <Check className="h-4 w-4" />
                      {"Success!"}
                    </>
                  ) : (
                    <>
                      {mode === "login" ? "Sign in" : "Create account"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </span>
              </motion.button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-4 text-[11px] text-muted-foreground/40">{"or"}</span>
              </div>
            </div>

            {/* Social login stubs */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                className="flex h-11 items-center justify-center gap-2.5 rounded-2xl border border-border bg-secondary/30 text-sm text-foreground hover:bg-secondary/50 hover:border-border/60 transition-all cursor-pointer"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {"Continue with Google"}
              </button>
              <button
                type="button"
                className="flex h-11 items-center justify-center gap-2.5 rounded-2xl border border-border bg-secondary/30 text-sm text-foreground hover:bg-secondary/50 hover:border-border/60 transition-all cursor-pointer"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                {"Continue with GitHub"}
              </button>
            </div>

            {/* Toggle mode */}
            <div className="mt-6 text-center">
              <span className="text-xs text-muted-foreground/50">
                {mode === "login" ? "No account yet? " : "Already have an account? "}
              </span>
              <button
                type="button"
                onClick={switchMode}
                className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer font-medium"
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </div>
          </div>

          {/* Decorative bottom line */}
          <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <button
            onClick={onBack}
            className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer"
          >
            {"Back to home page"}
          </button>
        </div>
      </motion.div>
    </section>
  )
}
