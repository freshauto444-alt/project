"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, SlidersHorizontal, Grid3X3, List, Car as CarIcon } from "lucide-react"
import {
  cars as allCars, type Car, makes, modelsByMake, bodyTypes, bodyTypesMap,
  fuelTypes, fuelTypesMap, driveTypes, driveLabels, transmissionTypes,
} from "@/lib/data"
import { useSettings } from "@/lib/settings-context"
import { calcTotalCost } from "@/lib/constants"
import { t } from "@/lib/i18n"
import { MAX_YEAR } from "./catalog/shared"
import {
  SearchableSelect, DualRange, PillSelect, YearRangeSelect, SortSelect, ExtendedFilters,
} from "./catalog/filters"
import { CarCard, CarListItem } from "./catalog/car-card"
import { ImageLightbox } from "./catalog/lightbox"


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
  // Optional server-pagination: when provided, "Show more" fetches the next
  // page from the parent (which appends to its `cars` state). Used by /order.
  onLoadMore?: () => Promise<Car[]>
  loadingMore?: boolean
  totalCount?: number  // hint for "X / total" label
  // Optional server-side search: when provided, the search input fires this
  // callback (debounced in parent) instead of filtering only the loaded
  // cars. Used by /order so users can find ANY car in the DB, not just the
  // ~50 currently rendered.
  onSearchChange?: (query: string) => void
}

const PAGE_SIZE = 20

// ── "Show more" button: handles both client-side slicing (incrementing visibleCount)
// AND server-side pagination (calling onLoadMore when local cars are exhausted).
function ShowMoreButton({
  visibleCount,
  totalLoaded,
  totalRemote,
  onClickClient,
  onLoadMore,
  loadingMore,
  language,
}: {
  visibleCount: number
  totalLoaded: number
  totalRemote?: number
  onClickClient: () => void
  onLoadMore?: () => Promise<Car[]>
  loadingMore: boolean
  language: import("@/lib/i18n").Language
}) {
  const clientHasMore = visibleCount < totalLoaded
  const serverHasMore = !!onLoadMore && (totalRemote == null || totalLoaded < totalRemote)
  const visibleRemaining = clientHasMore ? totalLoaded - visibleCount : 0
  const totalRemaining = totalRemote != null
    ? Math.max(0, totalRemote - visibleCount)
    : visibleRemaining

  // Suppress unused-warning — kept for future use if we re-introduce counts.
  void totalRemaining

  if (!clientHasMore && !serverHasMore) return null

  const handleClick = async () => {
    if (clientHasMore) {
      onClickClient()
    } else if (onLoadMore) {
      await onLoadMore()
      // After fetch, parent state grows → withImage grows → user can click "show more" again
      // Auto-show first batch of newly loaded cars (one PAGE_SIZE step)
      onClickClient()
    }
  }

  return (
    <div className="flex justify-center mt-6">
      <button
        onClick={handleClick}
        disabled={loadingMore}
        className="rounded-xl bg-primary/[0.1] px-8 py-3 text-sm font-medium text-primary hover:bg-primary/[0.15] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
      >
        {loadingMore
          ? (language === "uk" ? "Завантаження…" : "Loading…")
          : (language === "uk" ? "Показати більше" : "Show more")}
      </button>
    </div>
  )
}

export default function InventoryCatalog({
  onSelectCar,
  user,
  cars: allCars,
  onLoadMore,
  loadingMore = false,
  totalCount,
  onSearchChange,
}: CatalogProps) {
  const { formatPrice, language } = useSettings()
  // Filter state
  const [selMakes, setSelMakes] = useState<string[]>([])
  const [selModels, setSelModels] = useState<string[]>([])
  const [selBody, setSelBody] = useState<string[]>([])
  const [selFuel, setSelFuel] = useState<string[]>([])
  const [selDrive, setSelDrive] = useState<string[]>([])
  const [selTrans, setSelTrans] = useState<string[]>([])
  const [selCond, setSelCond] = useState<string[]>([])
  const [selCountry, setSelCountry] = useState<string[]>([])
  // Cars whose `image` URL failed to load (CDN expired the URL, or asset 404'd).
  // Each card reports failures via onImageError; we filter them out of the visible
  // list so users never see empty "black" placeholder cards.
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set())
  const reportBrokenImage = useCallback((id: string) => {
    setBrokenImageIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])
  // priceRange is in TURNKEY (final Ukrainian price) — consistent with what's displayed on cards.
  // Max 700k turnkey covers up to ~€505k raw EU (supercars).
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 700000])
  const [yearRange, setYearRange] = useState<[number, number]>([1900, MAX_YEAR])
  const [hpRange, setHpRange] = useState<[number, number]>([0, 2000])
  const [mileageRange, setMileageRange] = useState<[number, number]>([0, 500000])
  const [searchQ, setSearchQ] = useState("")

  // Debounced fan-out to parent when a server-side search handler is wired.
  // The local searchQ keeps narrowing within already-loaded cars in real
  // time (so the user sees instant feedback as they type), and 350 ms after
  // they stop typing we ask the parent to refetch from the server so the
  // search can find cars beyond the loaded page.
  useEffect(() => {
    if (!onSearchChange) return
    const id = setTimeout(() => onSearchChange(searchQ.trim()), 350)
    return () => clearTimeout(id)
  }, [searchQ, onSearchChange])

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
      // Filter by TURNKEY price (what user sees on cards), not raw EU.
      const turnkey = car.price ? calcTotalCost(car.price).total : 0
      if (turnkey < priceRange[0] || turnkey > priceRange[1]) return false
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
      case "newest":
        // Sort by id desc as a stable proxy for "most recently added".
        // String-safe compare (works for UUIDs, numeric strings, and parser-hash IDs).
        result.sort((a, b) => (b.id ?? "").localeCompare(a.id ?? ""))
        break
      case "value-desc":   result.sort((a, b) => valueScore(b) - valueScore(a)); break
      case "price-asc":    result.sort((a, b) => a.price - b.price); break
      case "price-desc":   result.sort((a, b) => b.price - a.price); break
      case "year-desc":    result.sort((a, b) => b.year - a.year || b.mileage - a.mileage); break
      case "year-asc":     result.sort((a, b) => a.year - b.year || a.mileage - b.mileage); break
      case "mileage-asc":  result.sort((a, b) => a.mileage - b.mileage); break
      case "mileage-desc": result.sort((a, b) => b.mileage - a.mileage); break
      case "hp-desc":      result.sort((a, b) => b.horsepower - a.horsepower); break
    }
    return result
  }, [allCars, selMakes, selModels, selBody, selFuel, selDrive, selTrans, selCond, selCountry, priceRange, yearRange, hpRange, mileageRange, searchQ, sortBy])

  // Reset pagination when filters/sort change
  const filteredKey = `${selMakes}${selModels}${selBody}${selFuel}${selDrive}${selTrans}${selCond}${selCountry}${priceRange}${yearRange}${hpRange}${mileageRange}${searchQ}${sortBy}`
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [filteredKey])

  const withImage = useMemo(
    () => filtered.filter(car => car.image && !brokenImageIds.has(car.id)),
    [filtered, brokenImageIds],
  )
  const visible = useMemo(() => withImage.slice(0, visibleCount), [withImage, visibleCount])

  const activeCount = [selMakes, selModels, selBody, selFuel, selDrive, selTrans, selCond, selCountry].filter(a => a.length > 0).length
    + (priceRange[0] > 0 || priceRange[1] < 700000 ? 1 : 0)
    + (yearRange[0] > 1900 || yearRange[1] < MAX_YEAR ? 1 : 0)
    + (hpRange[0] > 0 || hpRange[1] < 2000 ? 1 : 0)
    + (mileageRange[0] > 0 || mileageRange[1] < 500000 ? 1 : 0)

  const resetAll = useCallback(() => {
    setSelMakes([]); setSelModels([]); setSelBody([]); setSelFuel([])
    setSelDrive([]); setSelTrans([]); setSelCond([]); setSelCountry([])
    setPriceRange([0, 700000]); setYearRange([1900, MAX_YEAR])
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
      <div className="sticky top-16 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 lg:px-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-2xl">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder={t("catalog.search", language)}
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
            <span className="hidden sm:inline">{t("catalog.filters", language)}</span>
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
          <span className="hidden text-xs text-muted-foreground/50 tabular-nums lg:block">{Math.min(visibleCount, withImage.length)} / {withImage.length} {t("catalog.carsCount", language)}</span>
        </div>

        {/* ── AutoRia-style quick filter chips row ── */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin px-4 pb-3 lg:px-6">
          <span className="hidden shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 sm:inline">
            {t("catalog.quickFilters", language)}:
          </span>
          {[
            { label: t("catalog.quick.budget10", language), active: priceRange[1] === 10000, apply: () => setPriceRange([0, 10000]) },
            { label: t("catalog.quick.budget20", language), active: priceRange[1] === 20000, apply: () => setPriceRange([0, 20000]) },
            { label: t("catalog.quick.budget30", language), active: priceRange[1] === 30000, apply: () => setPriceRange([0, 30000]) },
            { label: t("catalog.quick.year2020", language),  active: yearRange[0] === 2020, apply: () => setYearRange([2020, yearRange[1]]) },
            { label: t("catalog.quick.suv", language),       active: selBody.includes("Позашляховик"), apply: () => setSelBody(prev => prev.includes("Позашляховик") ? prev.filter(v => v !== "Позашляховик") : [...prev, "Позашляховик"]) },
            { label: t("catalog.quick.sedan", language),     active: selBody.includes("Седан"),        apply: () => setSelBody(prev => prev.includes("Седан") ? prev.filter(v => v !== "Седан") : [...prev, "Седан"]) },
            { label: t("catalog.quick.automatic", language), active: selTrans.includes("Автомат"),     apply: () => setSelTrans(prev => prev.includes("Автомат") ? prev.filter(v => v !== "Автомат") : [...prev, "Автомат"]) },
            { label: t("catalog.quick.electric", language),  active: selFuel.includes("Електро"),      apply: () => setSelFuel(prev => prev.includes("Електро") ? prev.filter(v => v !== "Електро") : [...prev, "Електро"]) },
            { label: t("catalog.quick.diesel", language),    active: selFuel.includes("Дизель"),       apply: () => setSelFuel(prev => prev.includes("Дизель") ? prev.filter(v => v !== "Дизель") : [...prev, "Дизель"]) },
          ].map(chip => (
            <button
              key={chip.label}
              onClick={chip.apply}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ring-1 ${
                chip.active
                  ? "bg-primary/[0.12] text-primary ring-primary/30"
                  : "bg-white/[0.03] text-muted-foreground ring-white/[0.06] hover:bg-white/[0.06] hover:text-foreground"
              }`}
            >
              {chip.label}
            </button>
          ))}
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
            className="overflow-hidden border-b border-border"
          >
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-4 lg:p-6 scrollbar-thin">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-foreground">{t("catalog.filters", language)}</h3>
                <div className="flex items-center gap-3">
                  {activeCount > 0 && (
                    <button onClick={resetAll} className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer">{t("catalog.resetAll", language)}</button>
                  )}
                  <button
                    onClick={() => setShowFilters(false)}
                    className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:brightness-110 transition-all cursor-pointer"
                  >
                    {filtered.length} {t("catalog.carsCount", language)}
                  </button>
                </div>
              </div>

              {/* ── Section header: Main parameters ── */}
              <div className="mb-4 flex items-center gap-3">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">{t("catalog.mainParams", language)}</h4>
                <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
              </div>

              {/* ── Core Filters ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                <SearchableSelect label={t("catalog.make", language)} options={makes} selected={selMakes} onToggle={v => { toggle(setSelMakes, v); setSelModels([]) }} onClear={() => { setSelMakes([]); setSelModels([]) }} placeholder="BMW, Audi, Porsche..." />
                <SearchableSelect label={t("catalog.model", language)} options={availableModels} selected={selModels} onToggle={v => toggle(setSelModels, v)} onClear={() => setSelModels([])} placeholder="M4, Q7, Cayenne..." />
                <SearchableSelect label={t("catalog.bodyType", language)} options={bodyTypes} selected={selBody} onToggle={v => toggle(setSelBody, v)} onClear={() => setSelBody([])} placeholder="SUV, Sedan, Coupe..." />
                <SearchableSelect label={t("catalog.fuel", language)} options={fuelTypes} selected={selFuel} onToggle={v => toggle(setSelFuel, v)} onClear={() => setSelFuel([])} placeholder="Diesel, Petrol, Electric..." />
                <PillSelect label={t("catalog.drive", language)} options={driveTypes} selected={selDrive} onToggle={v => toggle(setSelDrive, v)} labels={driveLabels} />
                <PillSelect label={t("catalog.transmission", language)} options={transmissionTypes} selected={selTrans} onToggle={v => toggle(setSelTrans, v)} />
                <DualRange label={t("catalog.priceTurnkey", language)} min={0} max={700000} valueMin={priceRange[0]} valueMax={priceRange[1]} onChange={(a, b) => setPriceRange([a, b])} format={v => `${(v / 1000).toFixed(0)}k \u20AC`} step={5000} />
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
        <div className="flex flex-wrap items-center gap-1.5 px-4 lg:px-6 py-2.5 border-b border-border">
          {selMakes.map(v => <span key={`m-${v}`} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{v}</span>)}
          {selModels.map(v => <span key={`md-${v}`} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{v}</span>)}
          {selBody.map(v => <span key={`b-${v}`} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{v}</span>)}
          {selFuel.map(v => <span key={`f-${v}`} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{v}</span>)}
          {selDrive.map(v => <span key={`d-${v}`} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{driveLabels[v] || v}</span>)}
          {selTrans.map(v => <span key={`t-${v}`} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{v}</span>)}
          {(priceRange[0] > 0 || priceRange[1] < 700000) && <span className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{`${(priceRange[0]/1000).toFixed(0)}k\u2014${(priceRange[1]/1000).toFixed(0)}k \u20AC під ключ`}</span>}
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
              <h3 className="text-base font-semibold text-foreground mb-1">{t("catalog.nothingFound", language)}</h3>
              <p className="text-xs text-muted-foreground/50 mb-4 max-w-xs">{t("catalog.emptyHint", language)}</p>
              <button onClick={resetAll} className="rounded-xl bg-primary/[0.1] px-5 py-2.5 text-xs font-medium text-primary hover:bg-primary/[0.15] cursor-pointer transition-all">
                {t("catalog.resetFilters", language)}
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
                    pool={allCars}
                    onImageError={reportBrokenImage}
                  />
                ))}
              </div>
              <ShowMoreButton
                visibleCount={visibleCount}
                totalLoaded={withImage.length}
                totalRemote={totalCount}
                onClickClient={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                onLoadMore={onLoadMore}
                loadingMore={loadingMore}
                language={language}
              />
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
                    pool={allCars}
                    onImageError={reportBrokenImage}
                  />
                ))}
              </div>
              <ShowMoreButton
                visibleCount={visibleCount}
                totalLoaded={withImage.length}
                totalRemote={totalCount}
                onClickClient={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                onLoadMore={onLoadMore}
                loadingMore={loadingMore}
                language={language}
              />
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
