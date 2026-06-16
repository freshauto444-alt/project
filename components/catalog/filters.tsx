"use client"

// ═══════════════════════════════════════════════════════════════════════════════
//  Catalog filter UI — SearchableSelect, DualRange, PillSelect, Year pickers,
//  SortSelect and the ExtendedFilters panel. Extracted from inventory-catalog.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, ChevronDown, ChevronRight, Lock, Search, X } from "lucide-react"
import { conditionTypes, countries } from "@/lib/data"
import { useSettings } from "@/lib/settings-context"
import { t } from "@/lib/i18n"
import { MAX_YEAR } from "./shared"

export function SearchableSelect({
  label, options, selected, onToggle, onClear, placeholder,
}: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
  onClear: () => void
  placeholder?: string
}) {
  const { language } = useSettings()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const effectivePlaceholder = placeholder ?? t("catalog.searchInList", language)

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
        className="flex w-full items-center justify-between rounded-xl border border-border bg-white/[0.03] px-4 py-3 text-left text-sm transition-all hover:bg-white/[0.06] hover:border-border cursor-pointer"
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
          <button onClick={onClear} className="text-xs text-muted-foreground/40 hover:text-muted-foreground cursor-pointer ml-0.5 self-center">{t("catalog.reset", language)}</button>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-2xl shadow-black/40"
          >
            <div className="p-2.5 border-b border-border">
              <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5">
                <Search className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={effectivePlaceholder}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/30"
                />
                {query && <button onClick={() => setQuery("")} className="cursor-pointer"><X className="h-3.5 w-3.5 text-muted-foreground/40" /></button>}
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto overscroll-contain p-1.5 scrollbar-thin">
              {filtered.length === 0 && (
                <div className="px-3 py-5 text-center text-xs text-muted-foreground/40">{t("catalog.nothingFound", language)}</div>
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
                      active ? "border-primary bg-primary" : "border-border bg-transparent"
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
export function DualRange({
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
  const { language } = useSettings()
  const [collapsed, setCollapsed] = useState(subtle)

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/[0.04] transition-all cursor-pointer"
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
        {subtle && <button onClick={() => setCollapsed(true)} className="text-xs text-muted-foreground/30 hover:text-muted-foreground cursor-pointer">{t("catalog.collapse", language)}</button>}
      </div>
      <div className="flex items-center gap-2.5">
        <div className="flex-1 min-w-0">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{t("common.from", language)}</span>
          <input
            type="number"
            value={valueMin}
            onChange={e => { const v = Number(e.target.value); if (!isNaN(v)) onChange(Math.max(min, Math.min(v, valueMax)), valueMax) }}
            onBlur={e => { const v = Number(e.target.value); if (isNaN(v) || v < min) onChange(min, valueMax) }}
            className="w-full rounded-xl border border-border bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30 transition-colors tabular-nums"
          />
        </div>
        <span className="text-xs text-muted-foreground/30 flex-shrink-0 mt-4">{"\u2014"}</span>
        <div className="flex-1 min-w-0">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{t("common.to", language)}</span>
          <input
            type="number"
            value={valueMax}
            onChange={e => { const v = Number(e.target.value); if (!isNaN(v)) onChange(valueMin, Math.min(max, Math.max(v, valueMin))) }}
            onBlur={e => { const v = Number(e.target.value); if (isNaN(v) || v > max) onChange(valueMin, max) }}
            className="w-full rounded-xl border border-border bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30 transition-colors tabular-nums"
          />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   PillSelect — Drive / Transmission / Condition
   ═══════════════════════════════════════════ */
export function PillSelect({ label, options, selected, onToggle, labels }: {
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
                  : "bg-white/[0.03] text-muted-foreground/60 border border-border hover:bg-white/[0.06] hover:text-muted-foreground"
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
export function ComingSoonFilter({ label }: { label: string }) {
  const { language } = useSettings()
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.03] bg-white/[0.01] px-4 py-3 opacity-40 select-none">
      <span className="text-sm text-muted-foreground/50">{label}</span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground/30">
        <Lock className="h-3 w-3" />{t("catalog.soon", language)}
      </span>
    </div>
  )
}


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
          className="flex w-full items-center justify-between rounded-xl border border-border bg-white/[0.03] px-3.5 py-2.5 text-left text-sm transition-all hover:bg-white/[0.06] hover:border-border cursor-pointer"
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
            className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-2xl shadow-black/40 overflow-hidden"
          >
            {/* Manual input at top */}
            <div className="p-2 border-b border-border">
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

export function YearRangeSelect({ valueFrom, valueTo, onChangeFrom, onChangeTo }: {
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
export function SortSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { language } = useSettings()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const options = [
    { value: "newest",       label: t("catalog.sort.newest", language),       dir: "🆕" },
    { value: "value-desc",   label: t("catalog.sort.value", language),        dir: "★"  },
    { value: "price-asc",    label: t("catalog.sort.priceAsc", language),     dir: "↑"  },
    { value: "price-desc",   label: t("catalog.sort.priceDesc", language),    dir: "↓"  },
    { value: "year-desc",    label: t("catalog.sort.yearDesc", language),     dir: "↓"  },
    { value: "year-asc",     label: t("catalog.sort.yearAsc", language),      dir: "↑"  },
    { value: "mileage-asc",  label: t("catalog.sort.mileageAsc", language),   dir: "↑"  },
    { value: "mileage-desc", label: t("catalog.sort.mileageDesc", language),  dir: "↓"  },
    { value: "hp-desc",      label: t("catalog.sort.powerDesc", language),    dir: "↓"  },
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
        aria-label={t("catalog.sortBy", language)}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 hidden md:inline">
          {t("catalog.sortBy", language)}:
        </span>
        <span className="truncate max-w-[180px] text-foreground">{current.label}</span>
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
            className="absolute right-0 top-full z-50 mt-1 min-w-[240px] rounded-xl border border-border bg-card shadow-2xl shadow-black/40 overflow-hidden"
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
                    <span className="font-medium text-left">{opt.label}</span>
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
export function ExtendedFilters({
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
  const { language } = useSettings()

  return (
    <div className="mt-5 border-t border-border pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer uppercase tracking-wider"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        {t("catalog.extendedFilters", language)}
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
              <DualRange label={`${t("catalog.power", language)} (hp)`} min={0} max={2000} valueMin={hpRange[0]} valueMax={hpRange[1]} onChange={(a, b) => setHpRange([a, b])} step={10} />
              <DualRange label={`${t("catalog.mileage", language)} (km)`} min={0} max={500000} valueMin={mileageRange[0]} valueMax={mileageRange[1]} onChange={(a, b) => setMileageRange([a, b])} format={v => `${(v / 1000).toFixed(0)}k`} step={5000} />
              <PillSelect label={t("catalog.condition", language)} options={conditionTypes} selected={selCond} onToggle={toggleCond} />
              <SearchableSelect label={t("catalog.country", language)} options={countries} selected={selCountry} onToggle={toggleCountry} onClear={clearCountry} placeholder={t("catalog.placeholder.country", language)} />
              <PillSelect label={t("catalog.doors", language)} options={["2", "3", "4", "5"]} selected={[]} onToggle={() => {}} />
              <PillSelect label={t("catalog.seats", language)} options={["2", "4", "5", "7"]} selected={[]} onToggle={() => {}} />
              <PillSelect label={t("catalog.color", language)} options={["Чорний", "Білий", "Сірий", "Синій", "Червоний", "Зелений"]} selected={[]} onToggle={() => {}} />
              <PillSelect label={t("catalog.safety", language)} options={["ABS", "ESP", "Airbags 6+", "360 камера", "Lane Assist"]} selected={[]} onToggle={() => {}} />
              <PillSelect label={t("catalog.comfort", language)} options={["Клімат 2+", "Підігрів", "Люк", "Ел. сидіння", "Keyless"]} selected={[]} onToggle={() => {}} />
              <PillSelect label={t("catalog.media", language)} options={["Apple CarPlay", "Android Auto", "Navi", "HUD", "B&O / Harman"]} selected={[]} onToggle={() => {}} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
