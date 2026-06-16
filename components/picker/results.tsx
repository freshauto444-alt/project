"use client"

// ═══════════════════════════════════════════════════════════════════════════════
//  Results screen — CriteriaBar, the sort dropdown and the ResultsScreen that
//  ties the chat + result cards together. Extracted from unified-picker.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronLeft, RotateCcw, Search, SlidersHorizontal } from "lucide-react"
import { type Car as CarType } from "@/lib/data"
import { ratePriceVsMarket } from "@/lib/constants"
import { t, tp } from "@/lib/i18n"
import { useSettings } from "@/lib/settings-context"
import { buildTags, mapApiCar, type Answer } from "./shared"
import { ResultCard } from "./result-card"
import { AIChat } from "./chat"

// ─── CriteriaBar ──────────────────────────────────────────────────────────────

function CriteriaBar({ answers, onReset }: { answers: Answer[]; onReset: () => void }) {
  const { language } = useSettings()
  const tags = buildTags(answers)
  if (tags.length === 0) return null
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/22">{tp("criteria_title", language)}</span>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-[11px] text-white/28 transition-colors hover:text-white/55 cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
          {tp("reset_all", language)}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, i) => (
          <span
            key={`${i}-${tag}`}
            className="rounded-xl border border-primary/16 bg-primary/[0.045] px-2.5 py-1 text-[11px] text-primary/70"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── PickerSortSelect — compact dropdown for picker results ──────────────────
type PickerSortValue = "relevance" | "price-asc" | "price-desc" | "year-desc" | "year-asc"
function PickerSortSelect({
  value, onChange,
}: {
  value: PickerSortValue
  onChange: (v: PickerSortValue) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const options: { value: PickerSortValue; label: string; hint: string }[] = [
    { value: "relevance",  label: "За релевантністю", hint: "★" },
    { value: "price-asc",  label: "Ціна: дешевші",     hint: "↑" },
    { value: "price-desc", label: "Ціна: дорожчі",     hint: "↓" },
    { value: "year-desc",  label: "Рік: новіші",       hint: "↓" },
    { value: "year-asc",   label: "Рік: старіші",      hint: "↑" },
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
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all cursor-pointer ring-1 ${
          open
            ? "bg-white/[0.06] text-foreground ring-white/[0.12]"
            : "text-muted-foreground/60 ring-transparent hover:text-foreground hover:bg-white/[0.04]"
        }`}
      >
        <SlidersHorizontal className="h-3 w-3" />
        <span>{current.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-1 min-w-[210px] rounded-xl border border-border bg-card shadow-2xl shadow-black/40 overflow-hidden"
          >
            <div className="p-1.5">
              {options.map(opt => {
                const active = opt.value === value
                return (
                  <button
                    key={opt.value}
                    onClick={() => { onChange(opt.value); setOpen(false) }}
                    className={`flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer ${
                      active ? "bg-primary/[0.08] text-primary" : "text-foreground/70 hover:bg-white/[0.04] hover:text-foreground"
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className={`tabular-nums font-bold text-sm ${active ? "text-primary" : "text-muted-foreground/30"}`}>
                      {opt.hint}
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

// ─── ResultsScreen ────────────────────────────────────────────────────────────

export function ResultsScreen({
  answers, cars, loading, onSelectCar, onReset, onBack,
  freeText, approvedSuggestion, rejectedSuggestions,
}: {
  answers: Answer[]
  cars: CarType[]
  loading: boolean
  onSelectCar: (car: CarType) => void
  onReset: () => void
  onBack: () => void
  freeText?: string
  approvedSuggestion?: { make: string; model: string; yearRange: string; whyRecommended: string } | null
  rejectedSuggestions?: { make: string; model: string }[]
}) {
  const { language } = useSettings()
  const [allCars, setAllCars] = useState<CarType[]>(cars)
  const [loadingMore, setLoadingMore] = useState(false)
  const [chatPrefsRef, setChatPrefsRef] = useState<any>(null)
  const [sortBy, setSortBy] = useState<"relevance" | "price-asc" | "price-desc" | "year-desc" | "year-asc">("relevance")
  useEffect(() => { setAllCars(cars) }, [cars])
  const handleNewCars = useCallback((newCars: CarType[]) => {
    setAllCars(newCars)
  }, [])

  // Relevance score = 0.4 * below-market + 0.3 * mileage + 0.3 * year.
  // Each component is normalized 0-1 within the current result set so the
  // ranking adapts to whatever the user is looking at — a 60k-km car in a
  // 30-150k spread scores 0.69, in a 50-80k spread it scores 0.67, etc.
  const sortedCars = useMemo(() => {
    const list = [...allCars]
    if (sortBy === "price-asc") {
      return list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
    }
    if (sortBy === "price-desc") {
      return list.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity))
    }
    if (sortBy === "year-desc") {
      return list.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    }
    if (sortBy === "year-asc") {
      return list.sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity))
    }
    // relevance
    const mileages = list.map(c => c.mileage).filter((m): m is number => typeof m === "number" && m > 0)
    const years = list.map(c => c.year).filter((y): y is number => typeof y === "number" && y > 0)
    const maxMileage = mileages.length ? Math.max(...mileages) : 1
    const minYear = years.length ? Math.min(...years) : 0
    const maxYear = years.length ? Math.max(...years) : 1
    const yearRange = Math.max(maxYear - minYear, 1)
    const pricesByModel = new Map<string, number[]>()
    for (const c of list) {
      if (typeof c.price !== "number" || c.price <= 0) continue
      const key = `${c.make ?? ""}|${c.model ?? ""}`
      const arr = pricesByModel.get(key) ?? []
      arr.push(c.price)
      pricesByModel.set(key, arr)
    }
    const score = (c: CarType): number => {
      const key = `${c.make ?? ""}|${c.model ?? ""}`
      const peers = pricesByModel.get(key) ?? []
      let priceScore = 0.5
      if (typeof c.price === "number" && c.price > 0 && peers.length >= 3) {
        const { percentile } = ratePriceVsMarket(c.price, peers)
        priceScore = 1 - percentile / 100
      }
      let mileageScore = 0.5
      if (typeof c.mileage === "number" && c.mileage > 0) {
        mileageScore = 1 - c.mileage / maxMileage
      }
      let yearScore = 0.5
      if (typeof c.year === "number" && c.year > 0) {
        yearScore = (c.year - minYear) / yearRange
      }
      return 0.4 * priceScore + 0.3 * mileageScore + 0.3 * yearScore
    }
    return list.sort((a, b) => score(b) - score(a))
  }, [allCars, sortBy])

  const loadMore = useCallback(async () => {
    if (loadingMore || !chatPrefsRef) return
    setLoadingMore(true)
    try {
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [],
          answers,
          loadMore: true,
          chatPreferences: chatPrefsRef,
        }),
      })
      const data = await res.json()
      if (data.cars?.length > 0) {
        const mapped = (data.cars as any[]).map(mapApiCar)
        // Deduplicate by source_url or id
        setAllCars(prev => {
          const existingKeys = new Set(prev.map(c => c.sourceUrl ?? c.id))
          const fresh = mapped.filter(c => {
            const key = c.sourceUrl ?? c.id
            return !key || !existingKeys.has(key)
          })
          return [...prev, ...fresh]
        })
      }
      if (data.chatPreferences) setChatPrefsRef(data.chatPreferences)
    } catch { /* ignore */ } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, chatPrefsRef, answers])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col gap-5"
    >
      {/* Navigation */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Змінити критерії
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
          Новий пошук
        </button>
      </div>

      <CriteriaBar answers={answers} onReset={onReset} />

      <AIChat
        answers={answers}
        cars={allCars}
        onNewCars={handleNewCars}
        onPrefsChange={setChatPrefsRef}
        freeText={freeText}
        approvedSuggestion={approvedSuggestion}
        rejectedSuggestions={rejectedSuggestions}
      />

      {/* Results header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          {loading && allCars.length === 0
            ? tp("searching_short", language)
            : loading
              ? `${tp("found_n", language)}: ${allCars.filter(c => c.image).length} ${language === "uk" ? "авто" : "cars"} • ${language === "uk" ? "шукаємо ще..." : "loading more..."}`
              : `${tp("found_n", language)}: ${allCars.filter(c => c.image).length} ${language === "uk" ? "авто" : "cars"}`}
        </span>
        {!loading && allCars.length > 0 && (
          <PickerSortSelect value={sortBy} onChange={setSortBy} />
        )}
        {loading && allCars.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-primary/60">
            <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-primary/30 border-t-primary" />
            {language === "uk" ? "доб. ще..." : "more..."}
          </span>
        )}
      </div>

      {loading && allCars.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[16/10] animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : allCars.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <Search className="h-8 w-8 text-white/[0.07]" />
          <p className="text-sm text-white/32">
            У каталозі поки немає авто за цими критеріями. Запитайте AI-асистента вище — він запустить пошук на всіх майданчиках.
          </p>
          <div className="mt-1 flex gap-2">
            <button
              onClick={onReset}
              className="rounded-2xl border border-border px-4 py-2 text-sm text-white/45 transition-all hover:border-border hover:text-white/70 cursor-pointer"
            >
              Почати спочатку
            </button>
            <a
              href="/catalog"
              className="rounded-2xl bg-primary/[0.07] px-4 py-2 text-sm text-primary transition-all hover:bg-primary/[0.13]"
            >
              Весь каталог
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sortedCars.filter(car => car.image).map((car, i) => (
              <motion.div
                key={car.id ?? `car-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.5) }}
              >
                <ResultCard car={car} onClick={() => onSelectCar(car)} allCars={cars} />
              </motion.div>
            ))}
            {/* Skeleton placeholders while more sources are loading */}
            {loading && [...Array(2)].map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="aspect-[16/10] animate-pulse rounded-2xl bg-white/[0.03] flex items-center justify-center"
              >
                <span className="text-[10px] text-white/20 uppercase tracking-widest">
                  {language === "uk" ? "завантаження..." : "loading..."}
                </span>
              </div>
            ))}
          </div>

          {chatPrefsRef && (
            <div className="flex justify-center pt-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-2xl border border-border px-5 py-2.5 text-sm text-white/50 transition-all hover:border-primary/20 hover:text-primary cursor-pointer disabled:opacity-40"
              >
                {loadingMore ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="block h-3.5 w-3.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </motion.span>
                    Шукаю ще…
                  </>
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5" />
                    Завантажити ще авто
                  </>
                )}
              </motion.button>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
