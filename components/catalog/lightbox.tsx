"use client"

// ═══════════════════════════════════════════════════════════════════════════════
//  ImageLightbox — full-screen photo gallery for one car. Extracted from
//  inventory-catalog.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { type Car, formatCarTitle } from "@/lib/data"

export function ImageLightbox({ images, startIndex, car, onClose }: {
  images: string[]
  startIndex: number
  car: Car
  onClose: () => void
}) {
  const [idx, setIdx] = useState(Math.min(startIndex, images.length - 1))
  const touchStartX = useRef(0)
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") setIdx(i => Math.max(0, i - 1))
      if (e.key === "ArrowRight") setIdx(i => Math.min(images.length - 1, i + 1))
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [images.length, onClose])

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    const thumb = stripRef.current?.children[idx] as HTMLElement | undefined
    thumb?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [idx])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-black/80 backdrop-blur-sm flex-shrink-0">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-white truncate">{car.year} {formatCarTitle(car.make, car.model)}</span>
          <span className="ml-3 text-xs text-white/40 tabular-nums font-mono">{idx + 1} / {images.length}</span>
        </div>
        <button
          onClick={onClose}
          className="ml-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer flex-shrink-0"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main image */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          const diff = touchStartX.current - e.changedTouches[0].clientX
          if (diff > 50) setIdx(i => Math.min(images.length - 1, i + 1))
          if (diff < -50) setIdx(i => Math.max(0, i - 1))
        }}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={idx}
            src={images[idx]}
            alt={`${car.make} ${car.model} ${idx + 1}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="max-h-full max-w-full object-contain select-none"
            draggable={false}
          />
        </AnimatePresence>

        {idx > 0 && (
          <button
            onClick={() => setIdx(i => i - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white/70 hover:text-white hover:bg-black/60 transition-all cursor-pointer"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {idx < images.length - 1 && (
          <button
            onClick={() => setIdx(i => i + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white/70 hover:text-white hover:bg-black/60 transition-all cursor-pointer"
            aria-label="Next photo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div
          ref={stripRef}
          className="flex items-center gap-1.5 px-4 py-3 overflow-x-auto bg-black/80 backdrop-blur-sm border-t border-border flex-shrink-0 scrollbar-thin"
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`flex-shrink-0 h-12 w-20 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                i === idx ? "border-white/70 opacity-100 scale-105" : "border-transparent opacity-30 hover:opacity-60"
              }`}
            >
              <img src={img} alt={`Фото ${i + 1}`} className="h-full w-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  )
}
