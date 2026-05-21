"use client"

import { useRef, useState, useEffect } from "react"
import Image from "next/image"
import { useSettings } from "@/lib/settings-context"
import { calcTotalCost } from "@/lib/constants"
import { type Car, formatCarTitle } from "@/lib/data"

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
      className="group cursor-pointer overflow-hidden rounded-3xl border border-border transition-[border-color] duration-300 hover:border-primary/20"
      style={{
        transform: `scale(${scale})`,
        opacity,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(12px)",
        willChange: "transform, opacity",
      }}
      onClick={() => onSelect(car)}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {car.image && (
          <Image
            src={car.image}
            alt={`${car.make} ${car.model}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            unoptimized={car.image.startsWith("data:")}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-5 left-6 right-6 sm:bottom-6 sm:left-8 sm:right-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">
              {car.year} {car.fuelUa}
            </p>
            <h3
              className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-0.5"
              style={{ letterSpacing: "-0.02em" }}
            >
              {formatCarTitle(car.make, car.model)}
            </h3>
          </div>
          <div className="text-right shrink-0">
            <p className="text-base sm:text-lg font-bold" style={{ color: "var(--primary)" }}>
              {formatPrice(calcTotalCost(car.price).total)}
            </p>
            <p className="text-[10px] sm:text-xs text-white/50 mt-0.5">під ключ</p>
          </div>
        </div>
      </div>
    </div>
  )
}
