"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Play, Volume2, VolumeX, ChevronDown } from "lucide-react"
import { useSettings } from "@/lib/settings-context"
import { t } from "@/lib/i18n"

interface HeroSectionProps {
  onExplore: () => void
  onFinder: () => void
}

const YOUTUBE_ID = "RrhD500Gwkg"
const POSTER = `https://img.youtube.com/vi/${YOUTUBE_ID}/maxresdefault.jpg`

export default function HeroSection({ onExplore, onFinder }: HeroSectionProps) {
  const { language } = useSettings()
  const sectionRef = useRef<HTMLElement>(null)
  const [iframeReady, setIframeReady] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isVisible, setIsVisible] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loadIframe, setLoadIframe] = useState(false)

  /* Fade-in for text content on mount */
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(t)
  }, [])

  /* Start loading iframe immediately on mount but after first paint */
  useEffect(() => {
    /* requestIdleCallback for non-blocking, or fallback to rAF + small timeout */
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setLoadIframe(true), { timeout: 300 })
      return () => window.cancelIdleCallback(id)
    } else {
      const t = setTimeout(() => setLoadIframe(true), 200)
      return () => clearTimeout(t)
    }
  }, [])

  /* Preload poster image so it's instant */
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = POSTER
  }, [])

  /* Toggle navbar white text when hero is visible */
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const navbar = document.querySelector("header.fixed")
    // Set immediately on mount — hero is always visible at page load
    if (navbar) navbar.classList.add("navbar-hero-active")
    const obs = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
        if (navbar) {
          if (entry.isIntersecting) navbar.classList.add("navbar-hero-active")
          else navbar.classList.remove("navbar-hero-active")
        }
        if (iframeRef.current?.contentWindow) {
          try {
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({ event: "command", func: entry.isIntersecting ? "playVideo" : "pauseVideo" }),
              "https://www.youtube.com"
            )
          } catch { /* cross-origin safe */ }
        }
      },
      { threshold: 0.05 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [iframeReady])

  const toggleMute = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: isMuted ? "unMute" : "mute" }),
          "https://www.youtube.com"
        )
      } catch { /* safe */ }
    }
    setIsMuted(m => !m)
  }, [isMuted])

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const ytSrc = `https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1&mute=1&loop=1&playlist=${YOUTUBE_ID}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(origin)}&disablekb=1&fs=0&cc_load_policy=0&start=1`

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden"
      style={{ background: "#030303" }}
    >
      {/* Poster - ALWAYS visible underneath as safety net for loop gaps */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${POSTER})` }}
        aria-hidden="true"
      />

      {/* YouTube iframe - scaled up ~5% to crop out YT title bar at top & branding at bottom */}
      {loadIframe && (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            opacity: isVisible && iframeReady ? 1 : 0,
            transition: "opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          aria-hidden="true"
        >
          <iframe
            ref={iframeRef}
            src={ytSrc}
            title="Background video"
            allow="autoplay; encrypted-media; accelerometer; gyroscope"
            className="pointer-events-none absolute border-0"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) scale(1.15)",
              width: "max(177.78vh, 100vw)",
              height: "max(56.25vw, 100vh)",
            }}
            loading="lazy"
            onLoad={() => {
              /* Shorter delay - iframe is interactive quickly */
              requestAnimationFrame(() => {
                setTimeout(() => setIframeReady(true), 250)
              })
            }}
          />
        </div>
      )}

      {/* Gradient overlay - Apple style: subtle top, strong bottom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.35) 15%, rgba(0,0,0,0.10) 35%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.85) 100%)",
          zIndex: 2,
        }}
        aria-hidden="true"
      />

      {/* Content - Apple centered, clean */}
      <div
        className="relative flex h-full flex-col items-center justify-center px-6 text-center transition-all duration-[1.2s] ease-out"
        style={{
          zIndex: 5,
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(24px)",
        }}
      >
        {/* Eyebrow */}
        <p
          className="font-semibold uppercase tracking-[0.35em] text-xs sm:text-sm"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          {t("hero.eyebrow", language)}
        </p>

        {/* Hero headline */}
        <h1
          className="mt-5 font-extrabold tracking-tight leading-[1.02] text-balance"
          style={{
            fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
            color: "#FFFFFF",
            letterSpacing: "-0.03em",
          }}
        >
          {t("hero.title1", language)}
          <br />
          <span style={{ color: "var(--primary)" }}>{t("hero.title2", language)}</span>
        </h1>

        {/* Subline */}
        <p
          className="mx-auto mt-5 max-w-lg font-medium leading-relaxed text-base sm:text-lg"
          style={{ color: "rgba(255,255,255,0.65)" }}
        >
          {t("hero.subtitle", language)}
        </p>

        {/* CTA row */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          {/* Primary CTA - large glass pill with teal gradient + animated glow */}
          <button
            onClick={onExplore}
            className="hero-cta-primary group relative overflow-hidden rounded-full px-14 py-5 sm:px-16 sm:py-6 font-extrabold text-lg sm:text-xl tracking-wide cursor-pointer transition-all duration-300 hover:scale-[1.04] active:scale-[0.97]"
            style={{
              background: "linear-gradient(135deg, #00D2C6 0%, #00E8DB 40%, #00B5AA 100%)",
              color: "#000",
              boxShadow: "0 0 60px rgba(0,210,198,0.3), 0 0 120px rgba(0,210,198,0.1), 0 8px 32px rgba(0,0,0,0.4)",
              letterSpacing: "-0.01em",
            }}
          >
            <span className="relative z-10">{t("hero.cta", language)}</span>
            {/* Glass shimmer sweep on hover */}
            <div
              className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
              style={{
                background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)",
              }}
            />
          </button>

          {/* Secondary CTA - frosted glass */}
          <button
            onClick={onFinder}
            className="rounded-full px-12 py-5 sm:px-14 sm:py-6 font-bold text-lg sm:text-xl cursor-pointer transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
            }}
          >
            {t("hero.ctaAi", language)}
          </button>
        </div>

        {/* Watch on YouTube link */}
        <button
          onClick={() => window.open(`https://www.youtube.com/watch?v=${YOUTUBE_ID}`, "_blank", "noopener,noreferrer")}
          className="mt-6 flex items-center gap-2 text-xs font-medium cursor-pointer transition-colors duration-200"
          style={{ color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
        >
          <Play className="h-3.5 w-3.5" />
          {t("hero.watch", language)}
        </button>

        {/* Stats row - Apple style minimal */}
        <div className="mt-14 flex items-center justify-center gap-12 sm:gap-20">
          {[
            { value: "2 400+", label: t("hero.statsCars", language) },
            { value: "14", label: t("hero.statsCountries", language) },
            { value: language === "en" ? "<1 min" : "<1 хв", label: t("hero.statsResponse", language) },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div
                className="font-extrabold tracking-tight text-2xl sm:text-3xl lg:text-4xl"
                style={{ color: "#FFFFFF" }}
              >
                {stat.value}
              </div>
              <div
                className="mt-1 text-xs sm:text-sm font-medium"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mute toggle */}
      <div className="absolute bottom-8 right-6 sm:right-10" style={{ zIndex: 20 }}>
        <button
          onClick={toggleMute}
          className="flex h-10 w-10 items-center justify-center rounded-full cursor-pointer transition-all duration-200 hover:scale-110"
          style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="h-4 w-4" style={{ color: "rgba(255,255,255,0.5)" }} /> : <Volume2 className="h-4 w-4" style={{ color: "rgba(255,255,255,0.5)" }} />}
        </button>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2" style={{ zIndex: 20 }}>
        <div className="flex flex-col items-center gap-1.5">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            {t("hero.scroll", language)}
          </span>
          <ChevronDown className="h-4 w-4 animate-bounce" style={{ color: "rgba(255,255,255,0.2)" }} />
        </div>
      </div>
    </section>
  )
}
