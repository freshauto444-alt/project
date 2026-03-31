"use client"

import { useState, useMemo, useCallback, useRef, useEffect, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search, X, ChevronDown, Check, SlidersHorizontal, Grid3X3, List,
  Heart, Eye, Fuel, Gauge, Calendar, MapPin, Shield, Lock, ChevronRight,
  RotateCcw, Car as CarIcon, Maximize2, ChevronLeft, Images,
} from "lucide-react"
import {
  cars as allCars, type Car, makes, modelsByMake, bodyTypes, bodyTypesMap,
  fuelTypes, fuelTypesMap, driveTypes, driveLabels, transmissionTypes,
  conditionTypes, countries, formatMileage,
} from "@/lib/data"
import { useSettings } from "@/lib/settings-context"

/* ═══════════════════════════════════════════
   SearchableSelect — auto.ria / mobile.de style
   ═══════════════════════════════════════════ */
function SearchableSelect({
  label, options, selected, onToggle, onClear, placeholder = "Пошук...",
}: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
  onClear: () => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = useMemo(() => {
    if (!query) return options
    const q = query.toLowerCase()
    return options.filter(o => o.toLowerCase().includes(q))
  }, [options, query])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 60) }}
        className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-left text-sm transition-all hover:bg-white/[0.06] hover:border-white/[0.10] cursor-pointer"
      >
        <span className="text-muted-foreground">
          {selected.length > 0 ? (
            <span className="text-foreground font-medium">{selected.length} {label.toLowerCase()}</span>
          ) : label}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.slice(0, 4).map(s => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/[0.08] px-2.5 py-1 text-xs font-medium text-primary">
              {s}
              <button onClick={() => onToggle(s)} className="cursor-pointer hover:text-primary/60"><X className="h-3 w-3" /></button>
            </span>
          ))}
          {selected.length > 4 && <span className="text-xs text-muted-foreground/50 self-center">{`+${selected.length - 4}`}</span>}
          <button onClick={onClear} className="text-xs text-muted-foreground/40 hover:text-muted-foreground cursor-pointer ml-0.5 self-center">{"Скинути"}</button>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-white/[0.08] bg-[#0d0d0d] shadow-2xl shadow-black/40"
          >
            <div className="p-2.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5">
                <Search className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/30"
                />
                {query && <button onClick={() => setQuery("")} className="cursor-pointer"><X className="h-3.5 w-3.5 text-muted-foreground/40" /></button>}
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto overscroll-contain p-1.5 scrollbar-thin">
              {filtered.length === 0 && (
                <div className="px-3 py-5 text-center text-xs text-muted-foreground/40">{"Нічого не знайдено"}</div>
              )}
              {filtered.map(option => {
                const active = selected.includes(option)
                return (
                  <button
                    key={option}
                    onClick={() => onToggle(option)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                      active ? "bg-primary/[0.08] text-primary" : "text-foreground/80 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-all ${
                      active ? "border-primary bg-primary" : "border-white/[0.12] bg-transparent"
                    }`}>
                      {active && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span className="truncate">{option}</span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════
   DualRange — price / year / power / mileage
   ═══════════════════════════════════════════ */
function DualRange({
  label, min, max, valueMin, valueMax, onChange, format, step = 1, subtle = false,
}: {
  label: string
  min: number
  max: number
  valueMin: number
  valueMax: number
  onChange: (min: number, max: number) => void
  format?: (v: number) => string
  step?: number
  subtle?: boolean
}) {
  const [collapsed, setCollapsed] = useState(subtle)

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex w-full items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 text-sm text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/[0.04] transition-all cursor-pointer"
      >
        <span>{label}</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground/70">{label}</span>
        {subtle && <button onClick={() => setCollapsed(true)} className="text-xs text-muted-foreground/30 hover:text-muted-foreground cursor-pointer">{"Згорнути"}</button>}
      </div>
      <div className="flex items-center gap-2.5">
        <div className="flex-1 min-w-0">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{"Від"}</span>
          <input
            type="number"
            value={valueMin}
            onChange={e => { const v = Number(e.target.value); if (!isNaN(v)) onChange(Math.max(min, Math.min(v, valueMax)), valueMax) }}
            onBlur={e => { const v = Number(e.target.value); if (isNaN(v) || v < min) onChange(min, valueMax) }}
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30 transition-colors tabular-nums"
          />
        </div>
        <span className="text-xs text-muted-foreground/30 flex-shrink-0 mt-4">{"\u2014"}</span>
        <div className="flex-1 min-w-0">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{"До"}</span>
          <input
            type="number"
            value={valueMax}
            onChange={e => { const v = Number(e.target.value); if (!isNaN(v)) onChange(valueMin, Math.min(max, Math.max(v, valueMin))) }}
            onBlur={e => { const v = Number(e.target.value); if (isNaN(v) || v > max) onChange(valueMin, max) }}
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30 transition-colors tabular-nums"
          />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   PillSelect — Drive / Transmission / Condition
   ═══════════════════════════════════════════ */
function PillSelect({ label, options, selected, onToggle, labels }: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
  labels?: Record<string, string>
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground/70">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map(o => {
          const active = selected.includes(o)
          return (
            <button
              key={o}
              onClick={() => onToggle(o)}
              className={`rounded-xl px-3.5 py-2 text-xs font-medium transition-all cursor-pointer ${
                active
                  ? "bg-primary/[0.12] text-primary border border-primary/20"
                  : "bg-white/[0.03] text-muted-foreground/60 border border-white/[0.04] hover:bg-white/[0.06] hover:text-muted-foreground"
              }`}
            >
              {labels?.[o] || o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   ComingSoonFilter — greyed out stubs
   ═══════════════════════════════════════════ */
function ComingSoonFilter({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.03] bg-white/[0.01] px-4 py-3 opacity-40 select-none">
      <span className="text-sm text-muted-foreground/50">{label}</span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground/30">
        <Lock className="h-3 w-3" />{"Скоро"}
      </span>
    </div>
  )
}

const CURRENT_YEAR = new Date().getFullYear()
const MAX_YEAR = CURRENT_YEAR + 1

function YearDropdown({ value, onChange, years, label }: { value: number; onChange: (y: number) => void; years: number[]; label: string }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setEditing(false) } }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Scroll to selected year when opened
  useEffect(() => {
    if (open && listRef.current) {
      const idx = years.indexOf(value)
      if (idx >= 0) {
        const el = listRef.current.children[idx] as HTMLElement
        if (el) el.scrollIntoView({ block: "center" })
      }
    }
  }, [open, value, years])

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      {editing ? (
        <div className="flex flex-col gap-0.5 rounded-xl border border-primary/30 bg-white/[0.03] px-3.5 py-1.5">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{label}</span>
          <input
            autoFocus
            type="number"
            defaultValue={value}
            onBlur={e => {
              const v = parseInt(e.target.value)
              if (!isNaN(v) && v >= 1900 && v <= MAX_YEAR) onChange(v)
              setEditing(false)
            }}
            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
            className="w-full bg-transparent text-sm text-foreground font-medium outline-none tabular-nums"
          />
        </div>
      ) : (
        <button
          onClick={() => setOpen(!open)}
          onDoubleClick={() => { setOpen(false); setEditing(true) }}
          className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-left text-sm transition-all hover:bg-white/[0.06] hover:border-white/[0.10] cursor-pointer"
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{label}</span>
            <span className="text-foreground font-medium tabular-nums">{value}</span>
          </div>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-white/[0.08] bg-[#0d0d0d] shadow-2xl shadow-black/40 overflow-hidden"
          >
            {/* Manual input at top */}
            <div className="p-2 border-b border-white/[0.06]">
              <input
                type="number"
                placeholder="Введіть рік..."
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const v = parseInt((e.target as HTMLInputElement).value)
                    if (!isNaN(v) && v >= 1900 && v <= MAX_YEAR) { onChange(v); setOpen(false) }
                  }
                }}
                className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/30 tabular-nums"
              />
            </div>
            <div ref={listRef} className="max-h-52 overflow-y-auto overscroll-contain p-1.5 scrollbar-thin">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => { onChange(y); setOpen(false) }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2 text-left text-sm transition-colors cursor-pointer ${
                    y === value ? "bg-primary/[0.1] text-primary font-medium" : "text-foreground/80 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="tabular-nums">{y}</span>
                  {y === value && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function YearRangeSelect({ valueFrom, valueTo, onChangeFrom, onChangeTo }: {
  valueFrom: number; valueTo: number; onChangeFrom: (y: number) => void; onChangeTo: (y: number) => void
}) {
  const yearsFrom = useMemo(() => {
    const arr: number[] = []
    for (let y = MAX_YEAR; y >= 1900; y--) arr.push(y)
    return arr
  }, [])
  const yearsTo = useMemo(() => {
    const arr: number[] = []
    for (let y = MAX_YEAR; y >= valueFrom; y--) arr.push(y)
    return arr
  }, [valueFrom])

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground/70">{"Рік випуску"}</span>
      <div className="flex items-center gap-2.5">
        <YearDropdown value={valueFrom} onChange={v => { onChangeFrom(v); if (v > valueTo) onChangeTo(v) }} years={yearsFrom} label="Від" />
        <span className="text-xs text-muted-foreground/30 flex-shrink-0">{"\u2014"}</span>
        <YearDropdown value={valueTo} onChange={v => onChangeTo(v)} years={yearsTo} label="До" />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   SortSelect — кастомний дропдаун сортування
   Додай цей компонент в inventory-catalog.tsx
   після YearRangeSelect, перед ExtendedFilters
   ═══════════════════════════════════════════ */
function SortSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const options = [
    { value: "value-desc",  label: "Вигідність", dir: "★" },
    { value: "price-asc",   label: "Ціна",       dir: "↑" },
    { value: "price-desc",  label: "Ціна",       dir: "↓" },
    { value: "year-desc",   label: "Рік",        dir: "↓" },
    { value: "mileage-asc", label: "Пробіг",     dir: "↑" },
    { value: "hp-desc",     label: "Потужність", dir: "↓" },
  ]

  const current = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-xl px-3.5 py-3 text-sm font-medium transition-all cursor-pointer ring-1 ${
          open
            ? "bg-white/[0.06] text-foreground ring-white/[0.12]"
            : "bg-white/[0.04] text-muted-foreground ring-white/[0.06] hover:bg-white/[0.06] hover:text-foreground"
        }`}
      >
        <span className="hidden sm:inline">{current.label}</span>
        <span className="tabular-nums font-bold text-primary">{current.dir}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-xl border border-white/[0.08] bg-[#0d0d0d] shadow-2xl shadow-black/40 overflow-hidden"
          >
            <div className="p-1.5">
              {options.map(opt => {
                const active = opt.value === value
                return (
                  <button
                    key={opt.value}
                    onClick={() => { onChange(opt.value); setOpen(false) }}
                    className={`flex w-full items-center justify-between gap-6 rounded-lg px-3.5 py-2.5 text-sm transition-colors cursor-pointer ${
                      active
                        ? "bg-primary/[0.08] text-primary"
                        : "text-foreground/70 hover:bg-white/[0.04] hover:text-foreground"
                    }`}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className={`tabular-nums font-bold text-base leading-none ${
                      active ? "text-primary" : "text-muted-foreground/30"
                    }`}>
                      {opt.dir}
                    </span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════
   ExtendedFilters — collapsible extra filters
   ═══════════════════════════════════════════ */
function ExtendedFilters({
  hpRange, setHpRange, mileageRange, setMileageRange, selCond, toggleCond, selCountry, toggleCountry, clearCountry,
}: {
  hpRange: [number, number]
  setHpRange: (r: [number, number]) => void
  mileageRange: [number, number]
  setMileageRange: (r: [number, number]) => void
  selCond: string[]
  toggleCond: (v: string) => void
  selCountry: string[]
  toggleCountry: (v: string) => void
  clearCountry: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-5 border-t border-white/[0.04] pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer uppercase tracking-wider"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        {"Розширені фільтри"}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 pt-4">
              <DualRange label="Потужність (hp)" min={0} max={2000} valueMin={hpRange[0]} valueMax={hpRange[1]} onChange={(a, b) => setHpRange([a, b])} step={10} />
              <DualRange label="Пробіг (km)" min={0} max={500000} valueMin={mileageRange[0]} valueMax={mileageRange[1]} onChange={(a, b) => setMileageRange([a, b])} format={v => `${(v / 1000).toFixed(0)}k`} step={5000} />
              <PillSelect label="Стан" options={conditionTypes} selected={selCond} onToggle={toggleCond} />
              <SearchableSelect label="Країна" options={countries} selected={selCountry} onToggle={toggleCountry} onClear={clearCountry} placeholder="Німеччина, США..." />
              <PillSelect label="Двері" options={["2", "3", "4", "5"]} selected={[]} onToggle={() => {}} />
              <PillSelect label="Місця" options={["2", "4", "5", "7"]} selected={[]} onToggle={() => {}} />
              <PillSelect label="Колір" options={["Чорний", "Білий", "Сірий", "Синій", "Червоний", "Зелений"]} selected={[]} onToggle={() => {}} />
              <PillSelect label="Безпека" options={["ABS", "ESP", "Airbags 6+", "360 камера", "Lane Assist"]} selected={[]} onToggle={() => {}} />
              <PillSelect label="Комфорт" options={["Клімат 2+", "Підігрів", "Люк", "Ел. сидіння", "Keyless"]} selected={[]} onToggle={() => {}} />
              <PillSelect label="Мультимедіа" options={["Apple CarPlay", "Android Auto", "Navi", "HUD", "B&O / Harman"]} selected={[]} onToggle={() => {}} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════
   CarCard — grid mode (memoized)
   ═══════════════════════════════════════════ */
const CarCard = memo(function CarCard({
  car, onSelect, onGallery, liked, onLike,
}: {
  car: Car
  onSelect: (c: Car) => void
  onGallery: (c: Car, index: number) => void
  liked: boolean
  onLike: () => void
}) {
  const { formatPrice } = useSettings()
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  useEffect(() => { if (imgRef.current?.complete) setLoaded(true) }, [])

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.04] bg-white/[0.02] transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.08] hover:shadow-2xl hover:shadow-black/20"
    >
      {/* Image */}
      <div className="relative aspect-[16/9] overflow-hidden cursor-pointer" onClick={() => onGallery(car, 0)}>
        {!loaded && <div className="absolute inset-0 animate-pulse bg-muted/50 rounded-t-2xl" />}
        {car.image && (
          <img
            ref={imgRef}
            src={car.image}
            alt={`${car.make} ${car.model}`}
            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${loaded ? "opacity-100" : "opacity-0"}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
          />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Photo count badge */}
        {car.gallery.length > 1 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/50 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-medium text-white/80">
            <Images className="h-2.5 w-2.5" />{car.gallery.length}
          </div>
        )}

        {/* Top badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          {car.verified && (
            <span className="rounded-lg bg-emerald-500/80 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
              <Shield className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />{"Перевірено"}
            </span>
          )}
          <span className={`rounded-lg px-2 py-0.5 text-[9px] font-semibold backdrop-blur-sm ${
            car.status === "In Stock" ? "bg-emerald-500/20 text-emerald-300" :
            car.status === "In Transit" ? "bg-amber-500/20 text-amber-300" :
            car.status === "Reserved" ? "bg-rose-500/20 text-rose-300" :
            "bg-primary/20 text-primary"
          }`}>{car.statusUa}</span>
        </div>

        {/* Action buttons on hover */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={e => { e.stopPropagation(); onLike() }}
            className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition-all cursor-pointer ${
              liked ? "bg-rose-500/20 text-rose-400" : "bg-black/40 text-white/70 hover:text-white"
            }`}
            aria-label="Like"
          >
            <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onSelect(car) }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/70 hover:text-white backdrop-blur-md transition-all cursor-pointer"
            aria-label="Details"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Quick specs overlay */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-2.5 text-[9px] text-white/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {car.fuelUa && <span className="flex items-center gap-1"><Fuel className="h-2.5 w-2.5" />{car.fuelUa}</span>}
          {car.horsepower != null && <span className="flex items-center gap-1"><Gauge className="h-2.5 w-2.5" />{car.horsepower} hp</span>}
          {car.drive && car.drive !== "unknown" && <span className="flex items-center gap-1"><CarIcon className="h-2.5 w-2.5" />{car.drive}</span>}
          {car.countryUa && <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{car.countryUa}</span>}
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-4 cursor-pointer" onClick={() => onSelect(car)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{car.make} {car.model}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{[car.year, car.engine, car.bodyTypeUa].filter(Boolean).join(" · ")}</p>
          </div>
          <span className="text-sm font-bold text-foreground flex-shrink-0 tabular-nums">{formatPrice(car.price)}</span>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground/60">
          <span className="flex items-center gap-1"><Gauge className="h-3 w-3" />{formatMileage(car.mileage)}</span>
          {car.transmission && <span>{car.transmission}</span>}
          {car.countryUa && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{car.countryUa}</span>}
        </div>
      </div>
    </div>
  )
})

/* ═══════════════════════════════════════════
   CarListItem — AUTO.RIA style horizontal card
   ═══════════════════════════════════════════ */
const CarListItem = memo(function CarListItem({
  car, onSelect, onGallery, liked, onLike,
}: {
  car: Car
  onSelect: (c: Car) => void
  onGallery: (c: Car, index: number) => void
  liked: boolean
  onLike: () => void
}) {
  const { formatPrice } = useSettings()
  const [expanded, setExpanded] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  useEffect(() => { if (imgRef.current?.complete) setImgLoaded(true) }, [])

  return (
    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] overflow-hidden transition-all duration-200 hover:border-white/[0.08]">
      {/* Main row: image left, info right */}
      <div className="flex flex-col sm:flex-row">
        {/* Image - consistent fixed size, clickable for gallery */}
        <div
          className="relative w-full sm:w-[340px] flex-shrink-0 aspect-[16/9] overflow-hidden cursor-pointer group"
          onClick={() => onGallery(car, 0)}
        >
          {!imgLoaded && <div className="absolute inset-0 animate-pulse bg-white/[0.04]" />}
          {car.image && (
            <img
              ref={imgRef}
              src={car.image}
              alt={`${car.make} ${car.model}`}
              className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
            />
          )}
          {/* Badges on image */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            {car.verified && (
              <span className="rounded-lg bg-emerald-500/80 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm flex items-center gap-1">
                <Shield className="h-3 w-3" />{"Перевірений дилер"}
              </span>
            )}
          </div>
          {/* Expand icon on hover */}
          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur-md text-white/80">
              <Maximize2 className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        {/* Info section */}
        <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col">
          {/* Top: title + like */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-base sm:text-lg font-bold text-foreground hover:text-primary transition-colors cursor-pointer text-left"
                style={{ letterSpacing: "-0.01em" }}
              >
                {car.make} {car.model} {car.year}
              </button>
              <p className="text-xs text-muted-foreground mt-0.5">
                {[car.engine, car.horsepower != null ? `${car.horsepower} к.с.` : null, car.bodyTypeUa, car.conditionUa].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onLike() }}
              className={`p-2 rounded-full transition-colors cursor-pointer flex-shrink-0 ${liked ? "text-rose-400" : "text-muted-foreground/30 hover:text-muted-foreground"}`}
              aria-label="Like"
            >
              <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
            </button>
          </div>

          {/* Price */}
          <div className="mt-2">
            <span className="text-lg sm:text-xl font-extrabold tabular-nums" style={{ color: "#00D2C6" }}>{formatPrice(car.price)}</span>
          </div>

          {/* Specs row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" />{formatMileage(car.mileage)}</span>
            {car.fuelUa && <span className="flex items-center gap-1.5"><Fuel className="h-3.5 w-3.5" />{car.fuelUa}{car.engine && car.fuel !== "Electric" ? `, ${car.engine}` : ""}</span>}
            {car.transmission && <span className="flex items-center gap-1.5"><CarIcon className="h-3.5 w-3.5" />{car.transmission}</span>}
            {car.countryUa && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{car.countryUa}</span>}
          </div>

          {/* Tags */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${
              car.status === "In Stock" ? "bg-emerald-500/10 text-emerald-400" :
              car.status === "In Transit" ? "bg-amber-500/10 text-amber-400" :
              car.status === "Reserved" ? "bg-rose-500/10 text-rose-400" :
              "bg-primary/10 text-primary"
            }`}>{car.statusUa}</span>
            {car.drive && car.drive !== "unknown" && <span className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-white/[0.04] text-muted-foreground">{car.drive}</span>}
            {car.colorUa && <span className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-white/[0.04] text-muted-foreground">{car.colorUa}</span>}
            {car.featuresUa.slice(0, 2).map(f => (
              <span key={f} className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-white/[0.04] text-muted-foreground">{f}</span>
            ))}
          </div>

          {/* Description teaser */}
          <p className="mt-3 text-xs text-muted-foreground/60 line-clamp-2 leading-relaxed">
            {[car.make, car.model, String(car.year), car.conditionUa, car.fuelUa, car.transmission, car.colorUa, car.countryUa].filter(Boolean).join(", ")}.
          </p>
        </div>
      </div>

      {/* Expandable detail section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden border-t border-white/[0.04]"
          >
            <div className="p-5 sm:p-6 space-y-5">
              {/* Gallery thumbnails - clickable to open lightbox */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider mb-3">
                  {"Фото"}{car.gallery.length > 0 && <span className="ml-1.5 text-muted-foreground/30 font-normal normal-case tracking-normal">{car.gallery.length}</span>}
                </h4>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {car.gallery.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => onGallery(car, i)}
                      className="relative flex-shrink-0 w-28 h-20 sm:w-36 sm:h-24 rounded-xl overflow-hidden cursor-pointer group/thumb border border-white/[0.06] hover:border-primary/30 transition-colors"
                    >
                      <img
                        src={src}
                        alt={`${car.make} ${car.model} ${i + 1}`}
                                                className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/20 transition-colors flex items-center justify-center">
                        <Maximize2 className="h-4 w-4 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Specs grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { label: "Двигун", value: car.engine },
                  { label: "Потужність", value: car.horsepower != null ? `${car.horsepower} к.с.` : null },
                  { label: "Паливо", value: car.fuelUa },
                  { label: "КПП", value: car.transmission },
                  { label: "Привід", value: car.drive && car.drive !== "unknown" ? car.drive : null },
                  { label: "Пробіг", value: formatMileage(car.mileage) },
                  { label: "Кузов", value: car.bodyTypeUa },
                  { label: "Колір", value: car.colorUa },
                  { label: "Двері", value: car.doors != null ? `${car.doors}` : null },
                  { label: "Місця", value: car.seats != null ? `${car.seats}` : null },
                  { label: "Сидіння", value: car.seatMaterialUa },
                  { label: "Країна", value: car.countryUa },
                ].filter((s): s is { label: string; value: string } => s.value != null && s.value !== "").map(s => (
                  <div key={s.label} className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-3.5 py-2.5">
                    <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">{s.label}</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Features */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2">{"Особливості"}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {car.featuresUa.map(f => (
                    <span key={f} className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-primary/[0.06] text-primary">{f}</span>
                  ))}
                </div>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  onClick={() => onSelect(car)}
                  className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all cursor-pointer"
                >
                  {"Детальніше / Замовити"}
                </button>
                <a
                  href="tel:+380987081919"
                  className="rounded-xl border border-white/[0.08] px-6 py-3 text-sm font-semibold text-foreground hover:bg-white/[0.04] transition-all"
                >
                  {"Зателефонувати"}
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

/* ═══════════════════════════════════════════
   ImageLightbox — photo gallery for one car
   ═══════════════════════════════════════════ */
function ImageLightbox({ images, startIndex, car, onClose }: {
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-black/80 backdrop-blur-sm flex-shrink-0">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-white truncate">{car.year} {car.make} {car.model}</span>
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
          className="flex items-center gap-1.5 px-4 py-3 overflow-x-auto bg-black/80 backdrop-blur-sm border-t border-white/[0.06] flex-shrink-0 scrollbar-thin"
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`flex-shrink-0 h-12 w-18 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
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

/* ═══════════════════════════════════════════
   VALUE SCORE — price/quality ranking
   ═══════════════════════════════════════════ */
const CUR_YEAR = new Date().getFullYear()
function valueScore(car: Car): number {
  let s = 0
  if (car.year) s += Math.max(0, 30 - (CUR_YEAR - car.year) * 3)
  if (car.mileage != null) s += Math.max(0, 25 - car.mileage / 12000)
  else s += 10
  if (car.price && car.year) {
    const expected = Math.max(10000, (CUR_YEAR - car.year) * 4000 + 15000)
    const r = car.price / expected
    s += r <= 0.7 ? 25 : r <= 1.0 ? 20 : r <= 1.3 ? 12 : 5
  }
  if (car.image) s += 10
  if (car.safetyFeatures?.length > 0 || car.comfortFeatures?.length > 0) s += 5
  if (car.horsepower >= 150) s += 5
  return s
}

/* ═══════════════════════════════════════════
   MAIN CATALOG COMPONENT
   ═══════════════════════════════════════════ */
interface CatalogProps {
  onSelectCar: (car: Car) => void
  user?: { name: string; email: string } | null
  cars: Car[]
}

const PAGE_SIZE = 20

export default function InventoryCatalog({ onSelectCar, user, cars: allCars }: CatalogProps) {
  const { formatPrice } = useSettings()
  // Filter state
  const [selMakes, setSelMakes] = useState<string[]>([])
  const [selModels, setSelModels] = useState<string[]>([])
  const [selBody, setSelBody] = useState<string[]>([])
  const [selFuel, setSelFuel] = useState<string[]>([])
  const [selDrive, setSelDrive] = useState<string[]>([])
  const [selTrans, setSelTrans] = useState<string[]>([])
  const [selCond, setSelCond] = useState<string[]>([])
  const [selCountry, setSelCountry] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500000])
  const [yearRange, setYearRange] = useState<[number, number]>([1900, MAX_YEAR])
  const [hpRange, setHpRange] = useState<[number, number]>([0, 2000])
  const [mileageRange, setMileageRange] = useState<[number, number]>([0, 500000])
  const [searchQ, setSearchQ] = useState("")

  // View state
  const [view, setView] = useState<"grid" | "list">("grid")
  const [sortBy, setSortBy] = useState<string>("value-desc")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [showFilters, setShowFilters] = useState(false)
  const [likes, setLikes] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<{ car: Car; index: number } | null>(null)

  // Toggle helpers
  const toggle = useCallback((set: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    set(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }, [])

  // Available models based on selected makes
  const availableModels = useMemo(() => {
    if (selMakes.length === 0) return Object.values(modelsByMake).flat().sort()
    return selMakes.flatMap(m => modelsByMake[m] || []).sort()
  }, [selMakes])

  // Filter + sort
  const filtered = useMemo(() => {
    let result = allCars.filter(car => {
      if (selMakes.length > 0 && !selMakes.some(m => m.toLowerCase() === car.make.toLowerCase())) return false
      if (selModels.length > 0 && !selModels.includes(car.model)) return false
      if (selBody.length > 0 && !selBody.some(b => bodyTypesMap[b] === car.bodyType)) return false
      if (selFuel.length > 0 && !selFuel.some(f => fuelTypesMap[f] === car.fuel)) return false
      if (selDrive.length > 0 && !selDrive.includes(car.drive)) return false
      if (selTrans.length > 0) {
        const match = selTrans.some(t => {
          if (!car.transmission) return false
          if (t === "Автомат") return car.transmission.toLowerCase().includes("automatic") || car.transmission.includes("Speedshift") || car.transmission.includes("Steptronic") || car.transmission.includes("DSG")
          if (t === "Механіка") return car.transmission.toLowerCase().includes("manual")
          if (t === "Робот") return car.transmission.includes("PDK") || car.transmission.includes("DCT") || car.transmission.includes("SSG") || car.transmission.includes("LDF") || car.transmission.includes("F1")
          if (t === "Варіатор") return car.transmission.includes("CVT")
          return false
        })
        if (!match) return false
      }
      if (selCond.length > 0 && !selCond.includes(car.conditionUa ?? "")) return false
      if (selCountry.length > 0 && !selCountry.includes(car.countryUa ?? "")) return false
      if (car.price < priceRange[0] || car.price > priceRange[1]) return false
      if (car.year < yearRange[0] || car.year > yearRange[1]) return false
      if (hpRange[0] > 0 && car.horsepower < hpRange[0]) return false
      if (hpRange[1] < 2000 && car.horsepower > hpRange[1]) return false
      if (car.mileage < mileageRange[0] || car.mileage > mileageRange[1]) return false
      if (searchQ) {
        const q = searchQ.toLowerCase()
        const text = `${car.make} ${car.model} ${car.engine} ${car.colorUa ?? ""} ${car.bodyTypeUa} ${car.fuelUa} ${car.countryUa ?? ""}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })

    switch (sortBy) {
      case "value-desc": result.sort((a, b) => valueScore(b) - valueScore(a)); break
      case "price-asc": result.sort((a, b) => a.price - b.price); break
      case "price-desc": result.sort((a, b) => b.price - a.price); break
      case "year-desc": result.sort((a, b) => b.year - a.year); break
      case "mileage-asc": result.sort((a, b) => a.mileage - b.mileage); break
      case "hp-desc": result.sort((a, b) => b.horsepower - a.horsepower); break
    }
    return result
  }, [selMakes, selModels, selBody, selFuel, selDrive, selTrans, selCond, selCountry, priceRange, yearRange, hpRange, mileageRange, searchQ, sortBy])

  // Reset pagination when filters/sort change
  const filteredKey = `${selMakes}${selModels}${selBody}${selFuel}${selDrive}${selTrans}${selCond}${selCountry}${priceRange}${yearRange}${hpRange}${mileageRange}${searchQ}${sortBy}`
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [filteredKey])

  const withImage = useMemo(() => filtered.filter(car => car.image), [filtered])
  const visible = useMemo(() => withImage.slice(0, visibleCount), [withImage, visibleCount])

  const activeCount = [selMakes, selModels, selBody, selFuel, selDrive, selTrans, selCond, selCountry].filter(a => a.length > 0).length
    + (priceRange[0] > 0 || priceRange[1] < 500000 ? 1 : 0)
    + (yearRange[0] > 1900 || yearRange[1] < MAX_YEAR ? 1 : 0)
    + (hpRange[0] > 0 || hpRange[1] < 2000 ? 1 : 0)
    + (mileageRange[0] > 0 || mileageRange[1] < 500000 ? 1 : 0)

  const resetAll = useCallback(() => {
    setSelMakes([]); setSelModels([]); setSelBody([]); setSelFuel([])
    setSelDrive([]); setSelTrans([]); setSelCond([]); setSelCountry([])
    setPriceRange([0, 500000]); setYearRange([1900, MAX_YEAR])
    setHpRange([0, 2000]); setMileageRange([0, 500000])
    setSearchQ("")
  }, [])

  const toggleLike = useCallback((id: string) => {
    setLikes(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])



  return (
    <section id="catalog" className="min-h-screen w-full">
      {/* ── Sticky Toolbar ── */}
      <div className="sticky top-16 z-30 border-b border-white/[0.04] bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
          {/* Search */}
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Пошук за маркою, моделлю, двигуном..."
              className="w-full rounded-xl bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-foreground outline-none ring-1 ring-white/[0.06] placeholder:text-muted-foreground/30 focus:ring-primary/30 transition-all"
            />
            {searchQ && (
              <button onClick={() => setSearchQ("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer">
                <X className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Toggle filters button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all cursor-pointer ${
              showFilters ? "bg-primary/[0.1] text-primary ring-1 ring-primary/20" : "bg-white/[0.04] text-muted-foreground ring-1 ring-white/[0.06] hover:bg-white/[0.06]"
            }`}
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">{"Фільтри"}</span>
            {activeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{activeCount}</span>
            )}
          </button>

          <SortSelect value={sortBy} onChange={setSortBy} />

          {/* View toggles */}
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/[0.06]">
            <button onClick={() => setView("grid")} className={`rounded-lg p-2.5 transition-all cursor-pointer ${view === "grid" ? "bg-primary/[0.15] text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"}`} aria-label="Grid view">
              <Grid3X3 className="h-5 w-5" />
            </button>
            <button onClick={() => setView("list")} className={`rounded-lg p-2.5 transition-all cursor-pointer ${view === "list" ? "bg-primary/[0.15] text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"}`} aria-label="List view">
              <List className="h-5 w-5" />
            </button>
          </div>

          {/* Count */}
          <span className="hidden text-xs text-muted-foreground/50 tabular-nums lg:block">{Math.min(visibleCount, withImage.length)} / {withImage.length} {"авто"}</span>
        </div>
      </div>

      {/* ── Collapsible Filter Panel ── */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden border-b border-white/[0.04]"
          >
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-4 lg:p-6 scrollbar-thin">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-foreground">{"Параметри пошуку"}</h3>
                <div className="flex items-center gap-3">
                  {activeCount > 0 && (
                    <button onClick={resetAll} className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer">{"Скинути все"}</button>
                  )}
                  <button
                    onClick={() => setShowFilters(false)}
                    className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:brightness-110 transition-all cursor-pointer"
                  >
                    {"Показати"} {filtered.length} {"авто"}
                  </button>
                </div>
              </div>

              {/* ── Core Filters ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                <SearchableSelect label="Марка" options={makes} selected={selMakes} onToggle={v => { toggle(setSelMakes, v); setSelModels([]) }} onClear={() => { setSelMakes([]); setSelModels([]) }} placeholder="BMW, Audi, Porsche..." />
                <SearchableSelect label="Модель" options={availableModels} selected={selModels} onToggle={v => toggle(setSelModels, v)} onClear={() => setSelModels([])} placeholder="M4, Q7, Cayenne..." />
                <SearchableSelect label="Тип кузова" options={bodyTypes} selected={selBody} onToggle={v => toggle(setSelBody, v)} onClear={() => setSelBody([])} placeholder="Седан, Купе, SUV..." />
                <SearchableSelect label="Паливо" options={fuelTypes} selected={selFuel} onToggle={v => toggle(setSelFuel, v)} onClear={() => setSelFuel([])} placeholder="Бензин, Електро..." />
                <PillSelect label="Привід" options={driveTypes} selected={selDrive} onToggle={v => toggle(setSelDrive, v)} labels={driveLabels} />
                <PillSelect label="КПП" options={transmissionTypes} selected={selTrans} onToggle={v => toggle(setSelTrans, v)} />
                <DualRange label="Ціна" min={0} max={500000} valueMin={priceRange[0]} valueMax={priceRange[1]} onChange={(a, b) => setPriceRange([a, b])} format={v => `${(v / 1000).toFixed(0)}k \u20AC`} step={5000} />
                <YearRangeSelect valueFrom={yearRange[0]} valueTo={yearRange[1]} onChangeFrom={v => setYearRange([v, Math.max(v, yearRange[1])])} onChangeTo={v => setYearRange([yearRange[0], v])} />
              </div>

              {/* ── Extended Filters ── */}
              <ExtendedFilters
                hpRange={hpRange} setHpRange={r => setHpRange(r)}
                mileageRange={mileageRange} setMileageRange={setMileageRange}
                selCond={selCond} toggleCond={v => toggle(setSelCond, v)}
                selCountry={selCountry} toggleCountry={v => toggle(setSelCountry, v)}
                clearCountry={() => setSelCountry([])}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active filter tags when panel is closed ── */}
      {!showFilters && activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 lg:px-6 py-2.5 border-b border-white/[0.04]">
          {selMakes.map(v => <span key={`m-${v}`} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{v}</span>)}
          {selModels.map(v => <span key={`md-${v}`} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{v}</span>)}
          {selBody.map(v => <span key={`b-${v}`} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{v}</span>)}
          {selFuel.map(v => <span key={`f-${v}`} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{v}</span>)}
          {selDrive.map(v => <span key={`d-${v}`} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{driveLabels[v] || v}</span>)}
          {selTrans.map(v => <span key={`t-${v}`} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{v}</span>)}
          {(priceRange[0] > 0 || priceRange[1] < 500000) && <span className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{`${(priceRange[0]/1000).toFixed(0)}k\u2014${(priceRange[1]/1000).toFixed(0)}k \u20AC`}</span>}
          {(yearRange[0] > 1900 || yearRange[1] < MAX_YEAR) && <span className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{`${yearRange[0]}\u2014${yearRange[1]}`}</span>}
          {(hpRange[0] > 0 || hpRange[1] < 2000) && <span className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{`${hpRange[0]}\u2014${hpRange[1]} hp`}</span>}
          {(mileageRange[0] > 0 || mileageRange[1] < 500000) && <span className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{`${(mileageRange[0]/1000).toFixed(0)}k\u2014${(mileageRange[1]/1000).toFixed(0)}k km`}</span>}
          {selCond.map(v => <span key={`c-${v}`} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{v}</span>)}
          {selCountry.map(v => <span key={`co-${v}`} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{v}</span>)}
        </div>
      )}

      {/* ── Car Grid / List ── */}
      <div className="p-4 lg:p-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] mb-4">
                <CarIcon className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">{"Нічого не знайдено"}</h3>
              <p className="text-xs text-muted-foreground/50 mb-4 max-w-xs">{"Спробуйте змінити параметри фільтрів або скиньте всі фільтри"}</p>
              <button onClick={resetAll} className="rounded-xl bg-primary/[0.1] px-5 py-2.5 text-xs font-medium text-primary hover:bg-primary/[0.15] cursor-pointer transition-all">
                {"Скинути фільтри"}
              </button>
            </div>
          ) : view === "grid" ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map(car => (
                  <CarCard
                    key={car.id}
                    car={car}
                    onSelect={onSelectCar}
                    onGallery={(c, i) => setLightbox({ car: c, index: i })}
                    liked={likes.has(car.id)}
                    onLike={() => toggleLike(car.id)}
                  />
                ))}
              </div>
              {visibleCount < withImage.length && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                    className="rounded-xl bg-primary/[0.1] px-8 py-3 text-sm font-medium text-primary hover:bg-primary/[0.15] transition-all cursor-pointer"
                  >
                    Показати більше ({withImage.length - visibleCount} ще)
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3 w-full">
                {visible.map(car => (
                  <CarListItem
                    key={car.id}
                    car={car}
                    onSelect={onSelectCar}
                    onGallery={(c, i) => setLightbox({ car: c, index: i })}
                    liked={likes.has(car.id)}
                    onLike={() => toggleLike(car.id)}
                  />
                ))}
              </div>
              {visibleCount < withImage.length && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                    className="rounded-xl bg-primary/[0.1] px-8 py-3 text-sm font-medium text-primary hover:bg-primary/[0.15] transition-all cursor-pointer"
                  >
                    Показати більше ({withImage.length - visibleCount} ще)
                  </button>
                </div>
              )}
            </>
          )}
      </div>

      {/* ── Image lightbox ── */}
      <AnimatePresence>
        {lightbox && (
          <ImageLightbox
            images={lightbox.car.gallery.length > 0 ? lightbox.car.gallery : [lightbox.car.image]}
            startIndex={lightbox.index}
            car={lightbox.car}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
