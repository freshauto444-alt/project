"use client"

import { useRef, useState, useEffect } from "react"
import { useSettings } from "@/lib/settings-context"
import type { Car } from "@/lib/data"

interface AiShowcaseCardProps {
  car: Car
  onSelect: (car: Car) => void
}

export default function AiShowcaseCard({ car, onSelect }: AiShowcaseCardProps) {
  const { formatPrice } = useSettings()
  const cardRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    let raf = 0
    const update = () => {
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      const center = rect.top + rect.height / 2
      const dist = Math.abs(center - vh * 0.5)
      const maxDist = vh * 0.65
      setProgress(Math.max(0, Math.min(1, 1 - dist / maxDist)))
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    update()
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  const scale = 0.88 + progress * 0.12
  const opacity = 0.25 + progress * 0.75

  return (
    <div
      ref={cardRef}
      className="group cursor-pointer overflow-hidden rounded-3xl border border-white/[0.06] transition-[border-color] duration-300 hover:border-primary/20"
      style={{
        transform: `scale(${scale})`,
        opacity,
        background: "rgba(10,10,10,0.6)",
        backdropFilter: "blur(12px)",
        willChange: "transform, opacity",
      }}
      onClick={() => onSelect(car)}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {car.image && (
          <img
            src={car.image}
            alt={`${car.make} ${car.model}`}
            crossOrigin="anonymous"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-5 left-6 right-6 sm:bottom-6 sm:left-8 sm:right-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs sm:text-sm font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
              {car.year} {car.fuelUa}
            </p>
            <h3
              className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-0.5"
              style={{ letterSpacing: "-0.02em" }}
            >
              {car.make} {car.model}
            </h3>
          </div>
          <p className="text-base sm:text-lg font-bold shrink-0" style={{ color: "#00D2C6" }}>
            {formatPrice(car.price)}
          </p>
        </div>
      </div>
    </div>
  )
}
