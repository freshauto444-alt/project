"use client"

import { useState, useRef, useCallback, useEffect, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Gauge, Fuel, Settings2, Calendar, Palette, Zap, RotateCcw,
  CheckCircle2, Heart, Share2, Move, Shield, ArrowRight, RefreshCw,
  ChevronLeft, ChevronRight, Maximize2, Minimize2, MapPin, DoorOpen,
  Armchair, Car, Lock, Wifi, Eye, Phone, MessageCircle, FileText,
  TrendingUp, Download, ExternalLink,
} from "lucide-react"
import { type Car as CarType, formatMileage } from "@/lib/data"
import { useSettings } from "@/lib/settings-context"

/* ───── Cost Calculator ───── */
function calcTotalCost(price: number) {
  const duty = Math.round(price * 0.1)
  const excise = Math.round(price * 0.05)
  const vat = Math.round((price + duty + excise) * 0.2)
  const delivery = 2500
  const certification = 1200
  const broker = 800
  const total = price + duty + excise + vat + delivery + certification + broker
  return { price, duty, excise, vat, delivery, certification, broker, total }
}

/* ───── Fullscreen Gallery ───── */
function FullscreenGallery({ images, startIndex, onClose }: {
  images: string[]
  startIndex: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(startIndex)
  const [zoom, setZoom] = useState(false)
  const [touchStart, setTouchStart] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") setIdx(i => Math.max(0, i - 1))
      if (e.key === "ArrowRight") setIdx(i => Math.min(images.length - 1, i + 1))
      if (e.key === " ") { e.preventDefault(); setZoom(z => !z) }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [images.length, onClose])

  // Auto-scroll thumbnail into view
  useEffect(() => {
    if (stripRef.current) {
      const thumb = stripRef.current.children[idx] as HTMLElement
      if (thumb) thumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
    }
  }, [idx])

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX)
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStart - e.changedTouches[0].clientX
    if (diff > 60) setIdx(i => Math.min(images.length - 1, i + 1))
    if (diff < -60) setIdx(i => Math.max(0, i - 1))
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col bg-black"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm border-b border-white/[0.06]">
        <span className="text-xs text-white/60 tabular-nums font-mono">{idx + 1} / {images.length}</span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setZoom(!zoom)} className="rounded-lg p-2 text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer" aria-label={zoom ? "Zoom out" : "Zoom in"}>
            {zoom ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button onClick={onClose} className="rounded-lg p-2 text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer" aria-label="Close gallery">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main image */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={idx}
            src={images[idx]}
            alt={`Photo ${idx + 1}`}
            crossOrigin="anonymous"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className={`transition-all duration-300 select-none ${zoom ? "max-h-none w-full object-cover cursor-zoom-out" : "max-h-full max-w-full object-contain cursor-zoom-in"}`}
            onClick={() => setZoom(!zoom)}
            draggable={false}
          />
        </AnimatePresence>

        {idx > 0 && (
          <button
            onClick={() => setIdx(idx - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.08] backdrop-blur-md text-white/70 hover:bg-white/[0.15] hover:text-white transition-all cursor-pointer"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {idx < images.length - 1 && (
          <button
            onClick={() => setIdx(idx + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.08] backdrop-blur-md text-white/70 hover:bg-white/[0.15] hover:text-white transition-all cursor-pointer"
            aria-label="Next photo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      <div ref={stripRef} className="flex items-center gap-1.5 px-4 py-3 bg-black/80 backdrop-blur-sm overflow-x-auto scrollbar-thin border-t border-white/[0.06]">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`flex-shrink-0 h-12 w-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
              i === idx ? "border-white/60 opacity-100 scale-105" : "border-transparent opacity-30 hover:opacity-60"
            }`}
          >
            <img src={img} alt={`Thumb ${i + 1}`} crossOrigin="anonymous" className="h-full w-full object-cover" draggable={false} />
          </button>
        ))}
      </div>
    </motion.div>
  )
}

/* ───── 360-degree interactive viewer ───── */
function InteractiveViewer({ car, onOpenGallery }: { car: CarType; onOpenGallery: (idx: number) => void }) {
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const lastX = useRef(0)
  const allImages = [car.image, ...car.gallery.filter(g => g !== car.image)]

  const onStart = useCallback((x: number) => { setIsDragging(true); lastX.current = x }, [])
  const onMove = useCallback((x: number) => {
    if (!isDragging) return
    setRotation(r => r + (x - lastX.current) * 0.5)
    lastX.current = x
  }, [isDragging])
  const onEnd = useCallback(() => setIsDragging(false), [])

  return (
    <div>
      {/* Hero image */}
      <div
        onMouseDown={e => onStart(e.clientX)}
        onMouseMove={e => onMove(e.clientX)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={e => onStart(e.touches[0].clientX)}
        onTouchMove={e => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}
        className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-[#080808] cursor-grab active:cursor-grabbing select-none"
      >
        <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `perspective(1000px) rotateY(${rotation}deg)` }}>
          <img src={car.image} alt={`${car.make} ${car.model}`} crossOrigin="anonymous" className="h-full w-full object-cover" draggable={false} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808]/60 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[10px] text-white/50">
          <Move className="h-3 w-3" />{"Перетягніть для огляду 360\u00B0"}
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <button
            onClick={e => { e.stopPropagation(); setRotation(0) }}
            className="flex items-center gap-1 rounded-lg bg-black/40 backdrop-blur-sm px-2 py-1 text-[10px] text-white/70 hover:text-white transition-colors cursor-pointer"
            aria-label="Reset rotation"
          >
            <RotateCcw className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onOpenGallery(0) }}
            className="flex items-center gap-1 rounded-lg bg-black/40 backdrop-blur-sm px-2 py-1 text-[10px] text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <Maximize2 className="h-2.5 w-2.5" />{"Фото"} ({allImages.length})
          </button>
        </div>
      </div>

      {/* Thumbnail strip */}
      {allImages.length > 1 && (
        <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-thin pb-1">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => onOpenGallery(i)}
              className="flex-shrink-0 h-14 w-20 rounded-xl overflow-hidden border border-white/[0.06] hover:border-white/[0.15] transition-all cursor-pointer"
            >
              <img src={img} alt={`Gallery ${i + 1}`} crossOrigin="anonymous" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───── Feature Chips Section ───── */
const FeatureChips = memo(function FeatureChips({ title, items, icon: Icon }: { title: string; items: string[]; icon: React.ElementType }) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <h4 className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
        <Icon className="h-3 w-3" />{title}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {items.map(f => (
          <span key={f} className="flex items-center gap-1 rounded-lg bg-secondary/30 px-2.5 py-1.5 text-[11px] text-foreground/80">
            <CheckCircle2 className="h-2.5 w-2.5 text-primary/50" />{f}
          </span>
        ))}
      </div>
    </div>
  )
})

/* ───── Cost Breakdown Visual ───── */
function CostBreakdownVisual({ car }: { car: CarType }) {
  const { formatPrice } = useSettings()
  const c = calcTotalCost(car.price)
  const rows = [
    { label: "Вартість авто", value: c.price, color: "bg-foreground/20" },
    { label: "Мито (10%)", value: c.duty, color: "bg-amber-500/40" },
    { label: "Акциз (5%)", value: c.excise, color: "bg-orange-500/40" },
    { label: "ПДВ (20%)", value: c.vat, color: "bg-rose-500/40" },
    { label: "Доставка", value: c.delivery, color: "bg-blue-500/40" },
    { label: "Сертифікація", value: c.certification, color: "bg-indigo-500/40" },
    { label: "Брокер", value: c.broker, color: "bg-violet-500/40" },
  ]
  return (
    <div className="rounded-xl border border-white/[0.06] bg-secondary/20 p-5">
      <div className="flex items-center gap-1.5 mb-4">
        <Zap className="h-3 w-3 text-primary/60" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{"Розрахунок під ключ"}</span>
      </div>

      {/* Visual bar */}
      <div className="h-3 rounded-full overflow-hidden flex mb-4">
        {rows.map((r, i) => (
          <div
            key={i}
            className={`${r.color} transition-all first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${(r.value / c.total) * 100}%` }}
            title={`${r.label}: ${formatPrice(r.value)}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-2">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${r.color} flex-shrink-0`} />
              {r.label}
            </span>
            <span className="text-foreground tabular-nums">{formatPrice(r.value)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-white/[0.06] pt-2 mt-1 sm:col-span-2">
          <span className="text-foreground font-medium">{"Разом"}</span>
          <span className="text-primary font-semibold tabular-nums text-sm">{formatPrice(c.total)}</span>
        </div>
      </div>
    </div>
  )
}

/* ───── Trade-In Section ───── */
function TradeInSection({ car }: { car: CarType }) {
  const { formatPrice } = useSettings()
  const [tradeValue, setTradeValue] = useState(50000)
  const finalPrice = Math.max(0, car.price - tradeValue)
  const sliderPct = ((tradeValue - 5000) / 195000) * 100

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground leading-relaxed">
        {"Обміняйте ваше авто на"} {car.make} {car.model}{". Вкажіть приблизну вартість."}
      </p>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground">{"Оцінка вашого авто"}</label>
          <span className="text-sm font-medium text-foreground tabular-nums">{formatPrice(tradeValue)}</span>
        </div>
        <div className="relative h-6 flex items-center">
          <div className="absolute left-0 right-0 h-1.5 rounded-full bg-white/[0.06]" />
          <div
            className="absolute left-0 h-1.5 rounded-full bg-primary/40"
            style={{ width: `${sliderPct}%` }}
          />
          <input
            type="range" min={5000} max={200000} step={5000} value={tradeValue}
            onChange={e => setTradeValue(Number(e.target.value))}
            className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer dual-range-thumb"
            style={{ zIndex: 3 }}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-secondary/50 p-4 text-center">
          <div className="text-[10px] text-muted-foreground mb-1">{"Ваше авто"}</div>
          <div className="text-base font-semibold text-foreground tabular-nums">-{formatPrice(tradeValue)}</div>
        </div>
        <div className="rounded-xl bg-primary/[0.06] border border-primary/10 p-4 text-center">
          <div className="text-[10px] text-muted-foreground mb-1">{"До оплати"}</div>
          <div className="text-base font-semibold text-primary tabular-nums">{formatPrice(finalPrice)}</div>
        </div>
      </div>
      <div className="rounded-xl bg-secondary/30 p-4">
        <div className="flex items-start gap-3">
          <RefreshCw className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs font-medium text-foreground mb-0.5">{"Як працює Trade-In?"}</div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{"Експерт оцінить ваше авто протягом 1 години. Фінальна оцінка може відрізнятися. Ми враховуємо марку, модель, рік, пробіг та технічний стан."}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href="tel:+380987081919" className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground hover:brightness-110 transition-all">
          <Phone className="h-3 w-3" />{"Замовити оцінку"}
        </a>
        <a href="https://www.instagram.com/freshauto_ua/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-foreground hover:bg-white/[0.04] transition-all">
          <MessageCircle className="h-3 w-3" />{"Написати"}
        </a>
      </div>
    </div>
  )
}

/* ───── Vehicle History ───── */
function VehicleHistory({ car }: { car: CarType }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Mileage chart */}
      <div className="rounded-xl bg-secondary/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" />{"Графік пробігу"}
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums">{formatMileage(car.mileage)}</div>
        </div>
        <div className="flex items-end gap-1 h-20">
          {car.history.map((entry, i) => {
            const max = Math.max(...car.history.map(h => h.mileage), 1)
            const h = Math.max((entry.mileage / max) * 100, 4)
            return (
              <div key={i} className="flex-1 rounded-t bg-primary/20 hover:bg-primary/30 transition-colors relative group cursor-default" style={{ height: `${h}%` }}>
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-primary font-mono whitespace-nowrap bg-background/90 px-1.5 py-0.5 rounded-md backdrop-blur-sm border border-white/[0.06]">
                  {entry.mileage.toLocaleString("uk-UA")} km
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-1 mt-1.5">
          {car.history.map((entry, i) => (
            <div key={i} className="flex-1 text-center text-[8px] text-muted-foreground/50 truncate">{entry.date}</div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-0">
        {car.history.map((entry, i) => (
          <div key={i} className="flex items-start gap-3 py-2">
            <div className="flex flex-col items-center">
              <div className={`h-2.5 w-2.5 rounded-full ring-2 ring-background ${i === car.history.length - 1 ? "bg-primary" : "bg-muted-foreground/30"}`} />
              {i < car.history.length - 1 && <div className="h-7 w-px bg-border" />}
            </div>
            <div className="-mt-0.5 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-foreground">{entry.eventUa}</div>
                <div className="text-[10px] text-muted-foreground tabular-nums">{entry.date}</div>
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">{entry.mileage.toLocaleString("uk-UA")} km</div>
            </div>
          </div>
        ))}
      </div>

      {/* Verification badges */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Без ДТП", icon: Shield, color: "text-emerald-400" },
          { label: "Оригінал фарба", icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Сервісна книжка", icon: FileText, color: "text-emerald-400" },
        ].map(b => (
          <div key={b.label} className="flex flex-col items-center gap-1.5 rounded-xl bg-secondary/30 p-3 text-center">
            <b.icon className={`h-4 w-4 ${b.color}`} />
            <span className="text-[10px] text-muted-foreground">{b.label}</span>
          </div>
        ))}
      </div>

      {/* CarVertical report */}
      {car.verified && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs font-medium text-foreground mb-0.5">{"Звіт CarVertical"}</div>
              <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{"Повний звіт про історію автомобіля. Перевірено: пробіг, ДТП, юридична чистота, сервісна історія."}</p>
              <button className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 hover:text-emerald-300 cursor-pointer transition-colors">
                <Download className="h-3 w-3" />{"Завантажити звіт"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   MAIN MODAL
   ═══════════════════════════════════════════ */
type Tab = "overview" | "features" | "tradein" | "history"

interface CarDetailsModalProps {
  car: CarType | null
  onClose: () => void
  onCheckout: (car: CarType) => void
}

export default function CarDetailsModal({ car, onClose, onCheckout }: CarDetailsModalProps) {
  const { formatPrice } = useSettings()
  const [tab, setTab] = useState<Tab>("overview")
  const [fav, setFav] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryStart, setGalleryStart] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  // Reset tab when car changes
  useEffect(() => {
    setTab("overview")
    setFav(false)
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [car?.id])

  // Escape to close
  useEffect(() => {
    if (!car) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !galleryOpen) onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [car, onClose, galleryOpen])

  if (!car) return null

  const allImages = [car.image, ...car.gallery.filter(g => g !== car.image)]

  const openGallery = (idx: number) => {
    setGalleryStart(idx)
    setGalleryOpen(true)
  }

  const specs = [
    { icon: Calendar, label: "Рік", value: car.year.toString() },
    { icon: Gauge, label: "Пробіг", value: formatMileage(car.mileage) },
    { icon: Fuel, label: "Паливо", value: car.fuelUa },
    { icon: Settings2, label: "КПП", value: car.transmission },
    { icon: Zap, label: "Потужність", value: `${car.horsepower} hp` },
    { icon: Palette, label: "Колір", value: car.colorUa },
    { icon: Car, label: "Привід", value: car.drive },
    { icon: MapPin, label: "Країна", value: car.countryUa },
    { icon: DoorOpen, label: "Дверей", value: car.doors != null ? `${car.doors}` : null },
    { icon: Armchair, label: "Місць", value: car.seats != null ? `${car.seats}` : null },
    { icon: Armchair, label: "Сидіння", value: car.seatMaterialUa },
    { icon: Eye, label: "Стан", value: car.conditionUa },
  ].filter((s): s is typeof s & { value: string } => s.value != null)

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Огляд" },
    { id: "features", label: "Оснащення" },
    { id: "tradein", label: "Trade-In" },
    { id: "history", label: "Історія" },
  ]

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Full-screen detail panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="relative mx-auto my-4 flex h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/[0.06] bg-[#080808] shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate">{car.year} {car.make} {car.model}</h2>
              <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                {car.vin && <p className="text-[10px] text-muted-foreground font-mono">VIN: {car.vin}</p>}
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md ${
                  car.status === "In Stock" ? "bg-emerald-500/10 text-emerald-400" :
                  car.status === "In Transit" ? "bg-amber-500/10 text-amber-400" :
                  car.status === "Reserved" ? "bg-rose-500/10 text-rose-400" :
                  "bg-primary/10 text-primary"
                }`}>{car.statusUa}</span>
                {car.verified && (
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400">
                    <Shield className="inline h-2 w-2 mr-0.5" />{"CarVertical"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
              <button onClick={() => setFav(!fav)} className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all cursor-pointer ${fav ? "text-rose-400 bg-rose-500/10" : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/[0.04]"}`} aria-label={fav ? "Remove from favorites" : "Add to favorites"}>
                <Heart className={`h-4 w-4 ${fav ? "fill-current" : ""}`} />
              </button>
              <button className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/[0.04] transition-all cursor-pointer" aria-label="Share">
                <Share2 className="h-4 w-4" />
              </button>
              <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/[0.04] transition-all cursor-pointer" aria-label="Close modal">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] px-6 overflow-x-auto flex-shrink-0">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id)
                  if (contentRef.current) contentRef.current.scrollTop = 0
                }}
                className={`relative whitespace-nowrap px-4 py-3 text-xs font-medium transition-colors cursor-pointer ${
                  tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
                }`}
              >
                {t.label}
                {tab === t.id && (
                  <motion.div layoutId="detail-tab" className="absolute bottom-0 left-0 right-0 h-px bg-primary" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div ref={contentRef} className="flex-1 overflow-y-auto overscroll-contain p-6">
            <AnimatePresence>
              {tab === "overview" && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Gallery viewer */}
                  <InteractiveViewer car={car} onOpenGallery={openGallery} />

                  {/* Price + CTA */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-2xl font-semibold text-foreground tracking-tight tabular-nums">{formatPrice(car.price)}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {"Під ключ: "}<span className="text-primary font-medium tabular-nums">{formatPrice(calcTotalCost(car.price).total)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => onCheckout(car)} className="group flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 cursor-pointer">
                        {"Замовити"}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </button>
                      <a href="tel:+380987081919" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-all" aria-label="Call">
                        <Phone className="h-4 w-4" />
                      </a>
                    </div>
                  </div>

                  {/* Specs grid */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {specs.map(s => (
                      <div key={s.label} className="flex items-center gap-2.5 rounded-xl bg-secondary/30 px-3 py-2.5">
                        <s.icon className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
                          <div className="text-xs text-foreground truncate">{s.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cost breakdown with visual bar */}
                  <CostBreakdownVisual car={car} />

                  {/* Warranty cards */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-xl bg-secondary/20 p-4">
                      <Shield className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-medium text-foreground mb-0.5">{"Перевірено CarVertical"}</div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{"Повний звіт про історію авто, ДТП, пробіг та юридичну чистоту."}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl bg-secondary/20 p-4">
                      <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-medium text-foreground mb-0.5">{"Гарантія 12 місяців"}</div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{"Повна гарантія технічного стану. Тест-драйв. Доставка по Україні."}</p>
                      </div>
                    </div>
                  </div>

                  {/* Contact CTA */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <a href="tel:+380987081919" className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                      <Phone className="h-3 w-3" />098 708 19 19
                    </a>
                    <a href="tel:+380678160505" className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                      <Phone className="h-3 w-3" />067 816 05 05
                    </a>
                    <a href="https://www.instagram.com/freshauto_ua/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                      <ExternalLink className="h-3 w-3" />@freshauto_ua
                    </a>
                  </div>
                </motion.div>
              )}

              {tab === "features" && (
                <motion.div
                  key="features"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <FeatureChips title="Основне оснащення" items={car.featuresUa} icon={CheckCircle2} />
                  <FeatureChips title="Безпека" items={car.safetyFeatures} icon={Shield} />
                  <FeatureChips title="Комфорт" items={car.comfortFeatures} icon={Armchair} />
                  <FeatureChips title="Мультимедіа" items={car.infotainment} icon={Wifi} />
                  <div className="rounded-xl bg-secondary/20 p-4 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-3 flex-wrap">
                      {car.doors != null && <span className="flex items-center gap-1.5"><DoorOpen className="h-3 w-3" />{car.doors} {"дверей"}</span>}
                      {car.seats != null && <span className="flex items-center gap-1.5"><Armchair className="h-3 w-3" />{car.seats} {"місць"}</span>}
                      {car.seatMaterialUa && <span>{"Сидіння:"} {car.seatMaterialUa}</span>}
                      {car.countryUa && <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{car.countryUa}</span>}
                      {car.plateType && <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" />{car.plateType}</span>}
                    </div>
                  </div>
                </motion.div>
              )}

              {tab === "tradein" && (
                <motion.div
                  key="tradein"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <TradeInSection car={car} />
                </motion.div>
              )}

              {tab === "history" && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <VehicleHistory car={car} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>

      {/* Fullscreen Gallery Overlay */}
      <AnimatePresence>
        {galleryOpen && (
          <FullscreenGallery
            images={allImages}
            startIndex={galleryStart}
            onClose={() => setGalleryOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
