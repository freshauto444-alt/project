"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight, ChevronLeft, Sparkles, Check, Send, RotateCcw,
  Car, Fuel, Settings2, Calendar, Zap, DollarSign, Search,
  SlidersHorizontal, Gauge, Palette, Armchair, DoorOpen, Users,
  Building2, Plane, Briefcase, Wrench, TrendingUp, MessageSquare,
} from "lucide-react"
import { type Car as CarType, formatCarTitle } from "@/lib/data"
import { calcTotalCost, SOURCE_SITES, ratePriceVsMarket, PRICE_RATING_CONFIG } from "@/lib/constants"
import { t, tOpt, tp, type Language } from "@/lib/i18n"
import { useSettings } from "@/lib/settings-context"

// ─── API → CarType mapper ──────────────────────────────────────────────────────
// The parser API returns snake_case keys; CarType uses camelCase.
function mapApiCar(raw: any): CarType {
  return {
    ...raw,
    colorUa: raw.colorUa ?? raw.color_ua,
    fuelUa: raw.fuelUa ?? raw.fuel_ua,
    bodyType: raw.bodyType ?? raw.body_type,
    bodyTypeUa: raw.bodyTypeUa ?? raw.body_type_ua,
    statusUa: raw.statusUa ?? raw.status_ua,
    featuresUa: raw.featuresUa ?? raw.features_ua ?? [],
    safetyFeatures: raw.safetyFeatures ?? raw.safety_features ?? [],
    comfortFeatures: raw.comfortFeatures ?? raw.comfort_features ?? [],
    infotainment: raw.infotainment ?? [],
    seatMaterial: raw.seatMaterial ?? raw.seat_material,
    seatMaterialUa: raw.seatMaterialUa ?? raw.seat_material_ua,
    countryUa: raw.countryUa ?? raw.country_ua,
    plateType: raw.plateType ?? raw.plate_type,
    sourceType: raw.sourceType ?? raw.source_type,
    sourceUrl: raw.sourceUrl ?? raw.source_url,
    sourceSite: raw.sourceSite ?? raw.source_site,
    features: raw.features ?? [],
    gallery: raw.gallery ?? [],
    history: raw.history ?? [],
  }
}

// Streaming search: opens SSE to /api/ai-picker/stream and invokes callbacks
// as each parser source completes. Lets the UI append cars progressively.
interface StreamPayload {
  make?: string | null
  model?: string | null
  body_type?: string | null
  fuel?: string | null
  transmission?: string | null
  drive?: string | null
  color?: string | null
  vehicle_type?: string | null
  year_from?: number | null
  year_to?: number | null
  budget_min?: number | null
  budget_max?: number | null
}
interface StreamCallbacks {
  onCars?: (cars: CarType[], source: string) => void
  onDone?: (total: number) => void
  onError?: (msg: string) => void
}
async function streamSearch(
  payload: StreamPayload,
  signal: AbortSignal,
  cb: StreamCallbacks,
): Promise<void> {
  let res: Response
  try {
    res = await fetch("/api/ai-picker/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify(payload),
    })
  } catch (e: any) {
    if (e?.name !== "AbortError") cb.onError?.(e?.message ?? "Network error")
    return
  }
  if (!res.ok || !res.body) {
    cb.onError?.(`HTTP ${res.status}`)
    return
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split("\n")
      buf = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        try {
          const ev = JSON.parse(line.slice(6))
          if (ev.error) cb.onError?.(ev.error)
          if (ev.cars && Array.isArray(ev.cars) && ev.cars.length > 0) {
            cb.onCars?.(ev.cars.map(mapApiCar), ev.source ?? "?")
          }
          if (ev.done) cb.onDone?.(ev.total ?? 0)
        } catch { /* skip malformed event */ }
      }
    }
  } catch (e: any) {
    if (e?.name !== "AbortError") cb.onError?.(e?.message ?? "Stream error")
  }
}

// crypto.randomUUID is missing in Safari < 15.4 and older Android Chrome.
// Polyfill with a Math.random-based v4 — collision-safe enough for client_order_id.
function makeUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}


// ─── Types ────────────────────────────────────────────────────────────────────

interface Answer {
  questionId: string
  selected: string[]
  custom: string
}

interface Question {
  id: string
  icon: React.ElementType
  title: string
  subtitle: string
  options: string[]
  multi: boolean
}

interface RetrySuggestion {
  label: string
  prefs: Record<string, unknown>  // diff to merge into chatPreferences
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  retrySuggestion?: RetrySuggestion | null
}

// ─── Questions ────────────────────────────────────────────────────────────────

const QUESTIONS: Question[] = [
  {
    id: "budget",
    icon: DollarSign,
    title: "Який ваш бюджет?",
    subtitle: "Вкажіть діапазон в EUR",
    multi: false,
    options: [], // Custom UI — rendered as two number inputs
  },
  {
    id: "purpose",
    icon: Sparkles,
    title: "Для чого авто?",
    subtitle: "Швидкий пресет — можна обрати декілька",
    multi: true,
    options: ["Місто", "Подорожі", "Спорт", "Сім'я", "Бізнес", "Робота", "Інвестиція"],
  },
  {
    id: "body",
    icon: Car,
    title: "Який тип транспорту?",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: [
      "Седан", "Хетчбек", "Універсал", "Позашляховик", "Купе", "Кабріолет",
      "Мікроавтобус", "Пікап", "Вантажівка", "Автобус", "Мотоцикл", "Багі", "Спецтехніка",
    ],
  },
  {
    id: "fuel",
    icon: Fuel,
    title: "Тип палива",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: ["Бензин", "Дизель", "Електро", "Гібрид", "Plug-in гібрид", "Газ (LPG)", "Газ (CNG)", "Етанол", "Водень"],
  },
  {
    id: "year",
    icon: Calendar,
    title: "Рік випуску",
    subtitle: "Оберіть діапазон — від та до",
    multi: false,
    options: [],
  },
  {
    id: "transmission",
    icon: Settings2,
    title: "Тип трансмісії",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: ["Автомат", "Механіка", "Робот (DSG/DCT)", "Варіатор (CVT)"],
  },
  {
    id: "drive",
    icon: Zap,
    title: "Який привід?",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: ["Передній (FWD)", "Задній (RWD)", "Повний (AWD/4WD)"],
  },
  {
    id: "mileage",
    icon: Gauge,
    title: "Пробіг",
    subtitle: "Діапазон в км",
    multi: false,
    options: [],
  },
  {
    id: "engine",
    icon: SlidersHorizontal,
    title: "Об'єм двигуна",
    subtitle: "Діапазон в літрах",
    multi: false,
    options: [],
  },
  {
    id: "hp",
    icon: Zap,
    title: "Потужність",
    subtitle: "Мінімум к.с.",
    multi: false,
    options: [],
  },
  {
    id: "doors",
    icon: DoorOpen,
    title: "Кількість дверей",
    subtitle: "Оберіть одну",
    multi: false,
    options: ["2", "3", "4", "5"],
  },
  {
    id: "seats",
    icon: Users,
    title: "Кількість місць",
    subtitle: "Оберіть одну",
    multi: false,
    options: ["2", "4", "5", "7+"],
  },
  {
    id: "color",
    icon: Palette,
    title: "Колір кузова",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: ["Білий", "Чорний", "Сірий", "Сріблястий", "Синій", "Червоний", "Зелений", "Коричневий", "Бежевий", "Жовтий"],
  },
  {
    id: "interior",
    icon: Armchair,
    title: "Матеріал салону",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: ["Шкіра", "Екошкіра", "Тканина", "Велюр", "Алькантара", "Комбінований", "Карбон"],
  },
]

// Mapping: Ukrainian color names → English (for API)
const COLOR_HEX: Record<string, string> = {
  "Білий": "#F5F5F5", "Чорний": "#1A1A1A", "Сірий": "#9CA3AF",
  "Сріблястий": "#C0C0C0", "Синій": "#3B82F6", "Червоний": "#EF4444",
  "Зелений": "#10B981", "Коричневий": "#92400E", "Бежевий": "#E8D9C0",
  "Жовтий": "#FBBF24",
}

const EMPTY_ANSWERS: Answer[] = QUESTIONS.map(q => ({
  questionId: q.id,
  selected: [],
  custom: "",
}))

// Question IDs whose `selected` is a [from, to] range — render as "from – to"
// (or "from" / "to" when only one side is set). Without this, range answers
// produce duplicate tags like ["5", "5"] for engine 5–5.
const RANGE_QUESTIONS = new Set(["year", "mileage", "engine", "budget"])

function buildTags(answers: Answer[]): string[] {
  const tags: string[] = []
  answers.forEach(a => {
    if (RANGE_QUESTIONS.has(a.questionId)) {
      const from = a.selected[0] ?? ""
      const to = a.selected[1] ?? ""
      if (from && to) tags.push(from === to ? from : `${from} – ${to}`)
      else if (from || to) tags.push(from || to)
    } else {
      a.selected.forEach(s => tags.push(s))
      if (a.custom.trim()) tags.push(a.custom.trim())
    }
  })
  return tags
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const { language } = useSettings()
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 font-mono text-[11px] tracking-widest text-primary/55">
        {tp("progress_question", language)} {current + 1}&nbsp;/&nbsp;{total}
      </span>
      <div className="relative h-px flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-primary/50"
          initial={false}
          animate={{ width: `${((current + 1) / total) * 100}%` }}
          transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
        />
      </div>
    </div>
  )
}

// ─── YearScrollPicker ─────────────────────────────────────────────────────────

const YEAR_ITEM_H = 44
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1990 + 1 }, (_, i) => String(CURRENT_YEAR - i))

function YearScrollPicker({
  selected, onSelect, defaultYear,
}: {
  selected: string
  onSelect: (y: string) => void
  defaultYear?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Only commit selection after the user actually interacts with the picker.
  // Scroll-snap can fire spurious scroll events on mount — ignore those.
  const hasInteracted = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const target = selected || defaultYear || ""
    const idx = target ? YEARS.indexOf(target) : 0
    if (idx >= 0) {
      el.scrollTop = idx * YEAR_ITEM_H
      // Commit the initial/default value so the tag appears even without scrolling
      if (!selected && target) onSelect(target)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = () => {
    const el = containerRef.current
    if (!el || !hasInteracted.current) return
    const idx = Math.round(el.scrollTop / YEAR_ITEM_H)
    const year = YEARS[Math.max(0, Math.min(idx, YEARS.length - 1))]
    if (year) onSelect(year)
  }

  const handleInteract = () => { hasInteracted.current = true }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border" style={{ height: 5 * YEAR_ITEM_H }}>
      {/* Selected row highlight */}
      <div
        className="pointer-events-none absolute inset-x-0 z-10 border-y border-primary/20 bg-primary/[0.04]"
        style={{ top: 2 * YEAR_ITEM_H, height: YEAR_ITEM_H }}
      />

      <div
        ref={containerRef}
        onScroll={handleScroll}
        onPointerDown={handleInteract}
        onTouchStart={handleInteract}
        onWheel={handleInteract}
        className="h-full overflow-y-scroll"
        style={{
          scrollSnapType: "y mandatory",
          scrollbarWidth: "none",
          WebkitMaskImage: "linear-gradient(transparent, black 28%, black 72%, transparent)",
          maskImage: "linear-gradient(transparent, black 28%, black 72%, transparent)",
        } as React.CSSProperties}
      >
        <div style={{ height: 2 * YEAR_ITEM_H }} />
        {YEARS.map(y => (
          <div
            key={y}
            onClick={() => {
              hasInteracted.current = true
              const idx = YEARS.indexOf(y)
              containerRef.current?.scrollTo({ top: idx * YEAR_ITEM_H, behavior: "smooth" })
            }}
            style={{ height: YEAR_ITEM_H, scrollSnapAlign: "center" } as React.CSSProperties}
            className={`flex cursor-pointer items-center justify-center text-base font-semibold transition-colors ${
              y === selected ? "text-primary" : "text-white/35"
            }`}
          >
            {y}
          </div>
        ))}
        <div style={{ height: 2 * YEAR_ITEM_H }} />
      </div>
    </div>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`flex select-none items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm transition-all cursor-pointer ${
        selected
          ? "border-primary/35 bg-primary/[0.07] text-primary"
          : "border-border bg-white/[0.025] text-white/50 hover:border-border hover:text-white/70"
      }`}
    >
      <AnimatePresence>
        {selected && (
          <motion.span
            key="check"
            initial={{ scale: 0, width: 0 }}
            animate={{ scale: 1, width: 16 }}
            exit={{ scale: 0, width: 0 }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20"
          >
            <Check className="h-2.5 w-2.5" />
          </motion.span>
        )}
      </AnimatePresence>
      {label}
    </motion.button>
  )
}

// ─── QuestionStep ─────────────────────────────────────────────────────────────

// Map question.id → (title, subtitle) keys defined in i18n.ts's PICKER_STRINGS.
// Keeps QUESTIONS module-scope constant immutable while allowing per-render
// translation via tp(language).
const Q_TITLE_KEY: Record<string, { title: string; sub: string }> = {
  budget: { title: "q_budget_title", sub: "q_budget_sub" },
  purpose: { title: "q_purpose_title", sub: "q_purpose_sub" },
  body: { title: "q_body_title", sub: "q_multi_sub" },
  fuel: { title: "q_fuel_title", sub: "q_multi_sub" },
  year: { title: "q_year_title", sub: "q_year_sub" },
  transmission: { title: "q_trans_title", sub: "q_multi_sub" },
  drive: { title: "q_drive_title", sub: "q_multi_sub" },
  mileage: { title: "q_mileage_title", sub: "q_mileage_sub" },
  engine: { title: "q_engine_title", sub: "q_engine_sub" },
  hp: { title: "q_hp_title", sub: "q_hp_sub" },
  doors: { title: "q_doors_title", sub: "q_single_sub" },
  seats: { title: "q_seats_title", sub: "q_single_sub" },
  color: { title: "q_color_title", sub: "q_multi_sub" },
  interior: { title: "q_interior_title", sub: "q_multi_sub" },
}

function QuestionStep({
  question, answer, onChange, onNext, onBack, isFirst, isLast,
}: {
  question: Question
  answer: Answer
  onChange: (a: Answer) => void
  onNext: () => void
  onBack: () => void
  isFirst: boolean
  isLast: boolean
}) {
  const { language } = useSettings()
  const Icon = question.icon
  const isYearQuestion = question.id === "year"
  const isBudgetQuestion = question.id === "budget"
  const canProceed = isYearQuestion || isBudgetQuestion || answer.selected.length > 0 || answer.custom.trim().length > 0
  const titleKeys = Q_TITLE_KEY[question.id]
  const qTitle = titleKeys ? tp(titleKeys.title as any, language) : question.title
  const qSubtitle = titleKeys ? tp(titleKeys.sub as any, language) : question.subtitle

  const toggle = (opt: string) => {
    if (question.multi) {
      const next = answer.selected.includes(opt)
        ? answer.selected.filter(s => s !== opt)
        : [...answer.selected, opt]
      onChange({ ...answer, selected: next })
    } else {
      onChange({ ...answer, selected: answer.selected[0] === opt ? [] : [opt] })
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -28 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/[0.07]">
          <Icon className="h-4 w-4 text-primary/65" />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-snug text-foreground">{qTitle}</h2>
          <p className="mt-0.5 text-sm text-white/30">{qSubtitle}</p>
        </div>
      </div>

      {/* Options / Year Picker / Budget Picker */}
      {question.id === "budget" ? (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-white/35">{tp("from_eur", language)}</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="20 000"
                value={answer.selected[0] ?? ""}
                onChange={e => {
                  const raw = e.target.value.replace(/[^\d]/g, "")
                  const formatted = raw ? parseInt(raw).toLocaleString("uk-UA") : ""
                  onChange({ ...answer, selected: [formatted, answer.selected[1] ?? ""] })
                }}
                onKeyDown={e => e.key === "Enter" && onNext()}
                className="w-full rounded-xl border border-border bg-white/[0.03] px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none transition-colors"
              />
            </div>
            <span className="pb-3 text-white/20">—</span>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-white/35">{tp("to_eur", language)}</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder={tp("limitless", language)}
                value={answer.selected[1] ?? ""}
                onChange={e => {
                  const raw = e.target.value.replace(/[^\d]/g, "")
                  const formatted = raw ? parseInt(raw).toLocaleString("uk-UA") : ""
                  onChange({ ...answer, selected: [answer.selected[0] ?? "", formatted] })
                }}
                onKeyDown={e => e.key === "Enter" && onNext()}
                className="w-full rounded-xl border border-border bg-white/[0.03] px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none transition-colors"
              />
            </div>
          </div>
          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            {[
              ["20 000", "30 000"],
              ["30 000", "50 000"],
              ["50 000", "80 000"],
              ["80 000", ""],
            ].map(([from, to]) => (
              <button
                key={from}
                onClick={() => onChange({ ...answer, selected: [from, to] })}
                className={`rounded-xl border px-3 py-1.5 text-xs transition-all ${
                  answer.selected[0] === from && answer.selected[1] === to
                    ? "border-primary/40 bg-primary/[0.08] text-primary"
                    : "border-border text-white/40 hover:border-white/20"
                }`}
              >
                {to ? `${from} – ${to}` : `${from}+`}
              </button>
            ))}
          </div>
        </div>
      ) : question.id === "year" ? (
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-center text-xs font-medium text-white/35">{tp("from_label", language)}</p>
            <YearScrollPicker
              selected={answer.selected[0] ?? ""}
              defaultYear="2020"
              onSelect={y => onChange({ ...answer, selected: [y, answer.selected[1] ?? ""] })}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-center text-xs font-medium text-white/35">{tp("to_label", language)}</p>
            <YearScrollPicker
              selected={answer.selected[1] ?? ""}
              onSelect={y => {
                const from = answer.selected[0] ?? ""
                // Ensure To >= From (swap if user sets To before From)
                if (from && parseInt(y) < parseInt(from)) {
                  onChange({ ...answer, selected: [y, from] })
                } else {
                  onChange({ ...answer, selected: [from, y] })
                }
              }}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {question.options.map(opt => (
              <Chip
                key={opt}
                label={tOpt(opt, language)}
                selected={answer.selected.includes(opt)}
                onClick={() => toggle(opt)}
              />
            ))}
          </div>

          {/* Custom input */}
          <input
            value={answer.custom}
            onChange={e => onChange({ ...answer, custom: e.target.value })}
            onKeyDown={e => e.key === "Enter" && onNext()}
            placeholder={language === "uk" ? "Або напишіть свій варіант..." : "Or type your own..."}
            className="w-full rounded-2xl border border-border bg-white/[0.025] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/35 outline-none transition-all focus:border-primary/22 focus:bg-white/[0.04]"
          />
        </>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-4">
          {!isFirst && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-sm text-white/30 transition-colors hover:text-white/55 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {language === "uk" ? "Назад" : "Back"}
            </button>
          )}
          <button
            onClick={() => {
              if (isYearQuestion) onChange({ ...answer, selected: [], custom: "" })
              onNext()
            }}
            className="text-sm text-white/20 transition-colors hover:text-white/40 cursor-pointer"
          >
            {language === "uk" ? "Пропустити" : "Skip"}
          </button>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onNext}
          disabled={!canProceed}
          className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium transition-all cursor-pointer ${
            canProceed
              ? "bg-primary text-black hover:brightness-110"
              : "cursor-not-allowed bg-white/[0.05] text-white/22"
          }`}
        >
          {isLast ? tp("submit_find", language) : tp("submit_next", language)}
          <ArrowRight className="h-3.5 w-3.5" />
        </motion.button>
      </div>
    </motion.div>
  )
}

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

// ─── SearchingBanner ─────────────────────────────────────────────────────────

function SearchingBanner() {
  const { language } = useSettings()
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState(tp("status_connecting", language))

  const steps = [
    { at: 5,  text: tp("status_as24", language) },
    { at: 25, text: tp("status_reviewing", language) },
    { at: 45, text: tp("status_blocket", language) },
    { at: 65, text: tp("status_mobilede", language) },
    { at: 80, text: tp("status_scoring", language) },
    { at: 92, text: tp("status_ranking", language) },
  ]

  useEffect(() => {
    let current = 0
    const interval = setInterval(() => {
      // Повільно росте до 95, останні % чекає реальної відповіді
      const increment = current < 60 ? 1.2 : current < 85 ? 0.5 : 0.15
      current = Math.min(current + increment, 95)
      setProgress(current)
      const step = [...steps].reverse().find(s => current >= s.at)
      if (step) setStatusText(step.text)
    }, 800)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 rounded-2xl border border-primary/15 bg-primary/[0.03] p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.2 }}
                className="block h-1.5 w-1.5 rounded-full bg-primary"
              />
            ))}
          </div>
          <span className="text-sm text-white/70">{statusText}</span>
        </div>
        <span className="text-[11px] text-primary/60">{Math.round(progress)}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      <p className="text-[11px] text-white/25">{tp("banner_hint", language)}</p>
    </motion.div>
  )
}

// ─── AIChat (замінити ТІЛЬКИ цей компонент в unified-picker.tsx) ──────────────

function AIChat({
  answers,
  cars,
  onNewCars,
  onPrefsChange,
}: {
  answers: Answer[]
  cars: CarType[]
  onNewCars: (cars: CarType[]) => void
  onPrefsChange?: (prefs: any) => void
}) {
  const { language } = useSettings()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [clientOrderId, setClientOrderId] = useState<string | null>(null)
  const [chatPreferences, setChatPreferences] = useState<any>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length > 1) return
    const tags = buildTags(answers)
    const intro =
      tags.length > 0
        ? (language === "uk"
            ? `Знайдено ${cars.length} варіантів за вашими критеріями (${tags.slice(0, 3).join(", ")}${tags.length > 3 ? " та інші" : ""}).${
                cars.length === 0
                  ? " Можу запустити пошук на європейських майданчиках — зазвичай знаходжу 15-30 свіжих варіантів. Скажіть що шукаєте."
                  : " Можу детально розповісти про будь-яке авто або уточнити підбір."
              }`
            : `Found ${cars.length} matches for your criteria (${tags.slice(0, 3).join(", ")}${tags.length > 3 ? " and more" : ""}).${
                cars.length === 0
                  ? " I can search European marketplaces — usually 15-30 fresh options. Tell me what you need."
                  : " I can dive into any car or refine the selection."
              }`)
        : tp("chat_intro", language)
    setMessages([{ role: "assistant", content: intro }])
  }, [cars.length, language])

  useEffect(() => {
    const el = messagesContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading, searching])

  // Запуск парсера з передачею chatPreferences
  const runSearch = async (orderId: string, fullMessages: ChatMessage[]) => {
    setSearching(true)
    try {
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: fullMessages,
          answers,
          cars: [],
          triggerSearch: true,
          clientOrderId: orderId,
          chatPreferences, // Pass previous preferences for cumulative search
        }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: "assistant", content: data.message, retrySuggestion: data.retrySuggestion ?? null }])
      if (data.chatPreferences) { setChatPreferences(data.chatPreferences); onPrefsChange?.(data.chatPreferences) }
      onNewCars((data.cars ?? []).map(mapApiCar))
    } catch {
      setMessages(m => [
        ...m,
        { role: "assistant", content: tp("chat_error", language) + " " + tp("chat_retry", language) },
      ])
    } finally {
      setSearching(false)
    }
  }

  // Apply AI-suggested adjustment + re-run search
  const applyRetrySuggestion = async (sug: RetrySuggestion) => {
    if (searching || loading) return
    const nextPrefs = { ...(chatPreferences ?? {}), ...sug.prefs }
    setChatPreferences(nextPrefs)
    onPrefsChange?.(nextPrefs)
    const ackMsg: ChatMessage = { role: "user", content: `Застосувати: ${sug.label}` }
    const next: ChatMessage[] = [...messages, ackMsg]
    setMessages(next)
    setSearching(true)
    try {
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          answers,
          cars: [],
          triggerSearch: true,
          clientOrderId: clientOrderId ?? makeUuid(),
          chatPreferences: nextPrefs,
        }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: "assistant", content: data.message, retrySuggestion: data.retrySuggestion ?? null }])
      if (data.chatPreferences) { setChatPreferences(data.chatPreferences); onPrefsChange?.(data.chatPreferences) }
      onNewCars((data.cars ?? []).map(mapApiCar))
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Не вдалося перешукати. Спробуйте ще раз." }])
    } finally {
      setSearching(false)
    }
  }

  const send = async () => {
    if (!input.trim() || loading || searching) return
    const text = input.trim()
    setInput("")
    const next: ChatMessage[] = [...messages, { role: "user", content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          answers,
          cars: cars.slice(0, 8),
          chatPreferences, // Always pass current preferences
        }),
      })
      const data = await res.json()

      // Update preferences if returned
      if (data.chatPreferences) { setChatPreferences(data.chatPreferences); onPrefsChange?.(data.chatPreferences) }

      // AI decided to search
      if (data.searching && data.clientOrderId) {
        setMessages(m => [...m, { role: "assistant", content: data.message, retrySuggestion: data.retrySuggestion ?? null }])
        setClientOrderId(data.clientOrderId)
        runSearch(data.clientOrderId, next)
        return
      }

      setMessages(m => [
        ...m,
        { role: "assistant", content: data.message ?? tp("chat_retry", language), retrySuggestion: data.retrySuggestion ?? null },
      ])
    } catch {
      setMessages(m => [
        ...m,
        { role: "assistant", content: "Сталася помилка. Спробуйте ще раз." },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white/[0.015]">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-primary/18 bg-primary/[0.07]">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">AI-консультант Fresh Auto</div>
          <div className="flex items-center gap-1 text-[10px] text-white/22">
            <motion.span
              animate={{ opacity: searching ? [0.4, 1, 0.4] : 1 }}
              transition={{ duration: 1.2, repeat: searching ? Infinity : 0 }}
              className={`h-1.5 w-1.5 rounded-full ${searching ? "bg-amber-400" : "bg-primary/55"}`}
            />
            {searching ? tp("chat_status_searching", language) : tp("chat_status_online", language)}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex max-h-72 flex-col gap-2.5 overflow-y-auto p-4 scrollbar-thin"
      >
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="flex max-w-[88%] flex-col gap-1.5">
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-tr-sm bg-primary/[0.07] text-primary"
                    : "rounded-tl-sm bg-white/[0.04] text-white/70"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "assistant" && msg.retrySuggestion && (
                <button
                  onClick={() => applyRetrySuggestion(msg.retrySuggestion!)}
                  disabled={loading || searching}
                  className="group flex items-center gap-2 self-start rounded-xl border border-primary/30 bg-primary/[0.08] px-3 py-2 text-[12px] font-medium text-primary transition-all hover:border-primary/60 hover:bg-primary/[0.14] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
                  Перешукати: {msg.retrySuggestion.label}
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {loading && !searching && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white/[0.04] px-3.5 py-3">
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                  className="block h-1.5 w-1.5 rounded-full bg-white/35"
                />
              ))}
            </div>
          </div>
        )}

        {searching && <SearchingBanner />}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          disabled={searching}
          placeholder={searching ? tp("chat_status_searching", language) : tp("chat_placeholder", language)}
          className="flex-1 rounded-xl border border-border bg-white/[0.025] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/35 outline-none transition-all focus:border-primary/22 disabled:opacity-40"
        />
        <motion.button
          whileTap={{ scale: 0.91 }}
          onClick={send}
          disabled={!input.trim() || loading || searching}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all cursor-pointer ${
            input.trim() && !loading && !searching
              ? "bg-primary/[0.08] text-primary hover:bg-primary/[0.15]"
              : "bg-white/[0.03] text-white/15"
          }`}
        >
          <Send className="h-3.5 w-3.5" />
        </motion.button>
      </div>
    </div>
  )
}

// ─── ResultCard ───────────────────────────────────────────────────────────────

function ResultCard({ car, onClick, allCars }: { car: CarType; onClick: () => void; allCars: CarType[] }) {
  const { language } = useSettings()
  const totalCost = car.price ? calcTotalCost(car.price) : null
  const source = SOURCE_SITES[(car as any).sourceSite || (car as any).source_site || ""] || null

  // Price rating vs market — prefer same make+model (tighter comparable set) with make fallback.
  const samePrices = allCars
    .filter(c => c.make === car.make && c.model === car.model && c.price)
    .map(c => c.price!)
  const fallbackPrices = allCars
    .filter(c => c.make === car.make && c.price)
    .map(c => c.price!)
  const comparable = samePrices.length >= 3 ? samePrices : fallbackPrices
  const priceInfo = car.price ? ratePriceVsMarket(car.price, comparable) : null
  const ratingConfig = priceInfo ? PRICE_RATING_CONFIG[priceInfo.rating] : null
  const ratingLabel = ratingConfig ? t(ratingConfig.labelKey, language) : ""
  const ratingTooltip = priceInfo && ratingConfig
    ? (priceInfo.pct <= -4
        ? t("price.tooltipGood", language, { pct: Math.abs(priceInfo.pct) })
        : priceInfo.pct >= 8
        ? t("price.tooltipHigh", language, { pct: priceInfo.pct })
        : t("price.tooltipMarket", language))
    : ""

  return (
    <div
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white/[0.02] cursor-pointer transition-all hover:border-white/[0.1] hover:bg-white/[0.03] hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-white/[0.03]">
        {car.image ? (
          <img
            src={car.image}
            alt={`${car.make} ${car.model}`}
            crossOrigin="anonymous"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Car className="h-10 w-10 text-white/[0.06]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
        <div className="absolute bottom-2.5 left-3 text-xs font-semibold text-white drop-shadow">
          {car.year} {formatCarTitle(car.make, car.model)}
        </div>
        {/* Source badge */}
        {source && (
          <div className="absolute top-2 right-2 rounded-lg bg-black/60 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-sm">
            {source.flag} {source.name}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2 px-3.5 py-2.5">
        {/* Specs row */}
        <div className="flex items-center gap-3 text-[11px] text-white/32">
          {car.mileage && (
            <span className="flex items-center gap-1">
              <Gauge className="h-3 w-3" />
              {(car.mileage / 1000).toFixed(0)}k {t("result.km", language)}
            </span>
          )}
          {(car.fuelUa || car.fuel) && <span>{car.fuelUa || car.fuel}</span>}
          {car.transmission && <span>{car.transmission}</span>}
        </div>

        {/* Prices — turnkey (under-key) is the primary number; raw EU shown as context */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm font-semibold text-primary">
              {totalCost ? `€${totalCost.total.toLocaleString(language === "en" ? "en-US" : "uk-UA")}` : "—"}
              <span className="text-[10px] font-normal text-muted-foreground/70 ml-1.5">{t("result.turnkey", language)}</span>
            </div>
            {car.price && (
              <div className="text-[11px] text-muted-foreground/50">
                €{car.price.toLocaleString(language === "en" ? "en-US" : "uk-UA")} {t("result.inEu", language)}
              </div>
            )}
          </div>
          {/* Price rating */}
          {ratingConfig && priceInfo && (
            <div className="flex flex-col items-end gap-0.5" title={ratingTooltip}>
              <span className="text-[10px] font-medium" style={{ color: ratingConfig.color }}>
                {ratingLabel}
              </span>
              {/* Mini price bar */}
              <div className="relative h-1 w-16 rounded-full bg-white/[0.08]">
                <div
                  className="absolute top-[-1px] h-[6px] w-[6px] rounded-full"
                  style={{
                    left: `${Math.min(95, Math.max(5, priceInfo.percentile))}%`,
                    backgroundColor: ratingConfig.color,
                    transform: "translateX(-50%)",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ResultsScreen ────────────────────────────────────────────────────────────

function ResultsScreen({
  answers, cars, loading, onSelectCar, onReset, onBack,
}: {
  answers: Answer[]
  cars: CarType[]
  loading: boolean
  onSelectCar: (car: CarType) => void
  onReset: () => void
  onBack: () => void
}) {
  const { language } = useSettings()
  const [allCars, setAllCars] = useState<CarType[]>(cars)
  const [loadingMore, setLoadingMore] = useState(false)
  const [chatPrefsRef, setChatPrefsRef] = useState<any>(null)
  useEffect(() => { setAllCars(cars) }, [cars])
  const handleNewCars = useCallback((newCars: CarType[]) => {
    setAllCars(newCars)
  }, [])

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

      <AIChat answers={answers} cars={allCars} onNewCars={handleNewCars} onPrefsChange={setChatPrefsRef} />

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
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/40">
            <SlidersHorizontal className="h-3 w-3" />
            За релевантністю
          </span>
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
            {allCars.filter(car => car.image).map((car, i) => (
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

// ─── AI Suggestion Card ──────────────────────────────────────────────────────

interface Suggestion {
  make: string
  model: string
  yearRange: string
  priceRange: string
  whyRecommended: string
  concerns: string
  photo?: string | null
  searchParams: Record<string, any>
  // Honesty fields from suggest endpoint — tell the user upfront when
  // the AI's recommendation doesn't perfectly match their constraints.
  budgetFit?: "fits" | "tight" | "over"
  overBy?: number   // EUR over budget (only meaningful when budgetFit==="over")
  feasibilityWarning?: string | null  // AI's note about unsatisfiable params
}

function SuggestionCard({
  suggestion,
  onApprove,
  approved,
  loading,
}: {
  suggestion: Suggestion
  onApprove: () => void
  approved: boolean
  loading: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`overflow-hidden rounded-2xl border transition-all ${
        approved
          ? "border-primary/40 bg-primary/[0.06]"
          : "border-border bg-white/[0.02] hover:border-white/[0.14]"
      }`}
    >
      <div className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground sm:text-lg">
              {formatCarTitle(suggestion.make, suggestion.model)}
            </h3>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-white/50">
                {suggestion.yearRange}
              </span>
              {suggestion.priceRange && (
                <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-primary/70">
                  {suggestion.priceRange} EUR
                </span>
              )}
              {suggestion.budgetFit === "over" && (suggestion.overBy ?? 0) > 0 && (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/[0.08] px-2.5 py-0.5 text-xs text-amber-400/90">
                  +€{(suggestion.overBy ?? 0).toLocaleString()} над бюджетом
                </span>
              )}
              {suggestion.budgetFit === "tight" && (
                <span className="rounded-full border border-yellow-500/30 bg-yellow-500/[0.06] px-2.5 py-0.5 text-xs text-yellow-400/80">
                  На межі бюджету
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onApprove}
            disabled={loading}
            className={`w-full shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-all sm:w-auto sm:py-2 ${
              approved
                ? "bg-primary text-black"
                : "border border-border text-foreground/70 hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-primary" />
                Шукаю на 4 сайтах...
              </span>
            ) : approved ? (
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Знайдено
              </span>
            ) : (
              "Знайти авто"
            )}
          </button>
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-white/50">
          {suggestion.whyRecommended}
        </p>
        {suggestion.feasibilityWarning && (
          <div className="mt-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[12px] leading-relaxed text-amber-200/90">
            ⚠️ {suggestion.feasibilityWarning}
          </div>
        )}
        {suggestion.concerns && (
          <p className="mt-1.5 text-[12px] text-white/30 italic">
            {suggestion.concerns}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Suggestions Screen ──────────────────────────────────────────────────────

function SuggestionsScreen({
  suggestions,
  loading,
  onApprove,
  onSearchAll,
  onReset,
  onBack,
  onRefresh,
  approvedIndices,
  searchingIndex,
  error,
}: {
  suggestions: Suggestion[]
  loading: boolean
  onApprove: (idx: number) => void
  onSearchAll: () => void
  onReset: () => void
  onBack: () => void
  onRefresh: () => void
  approvedIndices: Set<number>
  searchingIndex: number | null
  error: string | null
}) {
  return (
    <motion.div
      key="suggestions"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {/* Navigation buttons */}
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">AI рекомендує для вас</h2>
            <p className="mt-1 text-sm text-muted-foreground/60">
              Оберіть моделі, які цікавлять — система знайде найкращі пропозиції
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Змінити критерії
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Отримати нові варіанти під ті ж критерії"
            className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-2 text-xs font-medium text-primary hover:bg-primary/[0.12] hover:border-primary/40 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Оновити варіанти
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Новий пошук
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && suggestions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-primary" />
          <p className="text-sm text-white/40">AI аналізує ваші побажання...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {suggestions.map((s, i) => (
            <SuggestionCard
              key={`${s.make}-${s.model}-${i}`}
              suggestion={s}
              onApprove={() => onApprove(i)}
              approved={approvedIndices.has(i)}
              loading={searchingIndex === i}
            />
          ))}
          {loading && suggestions.length > 0 && (
            <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-dashed border-white/10 py-5 text-sm text-white/40">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-primary" />
              <span>AI підбирає ще варіанти…</span>
            </div>
          )}
          {!loading && suggestions.length > 0 && approvedIndices.size === 0 && (
            <button
              onClick={onSearchAll}
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/[0.08] py-3.5 text-sm font-semibold text-primary hover:bg-primary/[0.14] hover:border-primary/60 transition-all cursor-pointer"
            >
              <Search className="h-4 w-4" />
              Шукати за всіма параметрами без уточнення
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Single Page Filter Form ─────────────────────────────────────────────────

function FilterChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-[13px] font-medium transition-all cursor-pointer ${
        selected
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  )
}

function FilterSection({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4">
      <label className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary/60" />{title}
      </label>
      {children}
    </div>
  )
}

// ─── Vehicle pictograms (Material Design Icons, Apache 2.0, viewBox 0 0 24 24) ───
// Filled silhouette style. Rendered with fill="currentColor", no stroke.
// Paths taken verbatim from github.com/Templarian/MaterialDesign via WebFetch.
const BODY_SVG: Record<string, string> = {
  "Седан":        "M16,6L19,10H21C22.11,10 23,10.89 23,12V15H21A3,3 0 0,1 18,18A3,3 0 0,1 15,15H9A3,3 0 0,1 6,18A3,3 0 0,1 3,15H1V12C1,10.89 1.89,10 3,10L6,6H16M10.5,7.5H6.75L4.86,10H10.5V7.5M12,7.5V10H17.14L15.25,7.5H12M6,13.5A1.5,1.5 0 0,0 4.5,15A1.5,1.5 0 0,0 6,16.5A1.5,1.5 0 0,0 7.5,15A1.5,1.5 0 0,0 6,13.5M18,13.5A1.5,1.5 0 0,0 16.5,15A1.5,1.5 0 0,0 18,16.5A1.5,1.5 0 0,0 19.5,15A1.5,1.5 0 0,0 18,13.5Z",
  "Хетчбек":      "M16,6H6L1,12V15H3A3,3 0 0,0 6,18A3,3 0 0,0 9,15H15A3,3 0 0,0 18,18A3,3 0 0,0 21,15H23V12C23,10.89 22.11,10 21,10H19L16,6M6.5,7.5H10.5V10H4.5L6.5,7.5M12,7.5H15.5L17.46,10H12V7.5M6,13.5A1.5,1.5 0 0,1 7.5,15A1.5,1.5 0 0,1 6,16.5A1.5,1.5 0 0,1 4.5,15A1.5,1.5 0 0,1 6,13.5M18,13.5A1.5,1.5 0 0,1 19.5,15A1.5,1.5 0 0,1 18,16.5A1.5,1.5 0 0,1 16.5,15A1.5,1.5 0 0,1 18,13.5Z",
  "Універсал":    "M3,6H16L19,10H21C22.11,10 23,10.89 23,12V15H21A3,3 0 0,1 18,18A3,3 0 0,1 15,15H9A3,3 0 0,1 6,18A3,3 0 0,1 3,15H1V8C1,6.89 1.89,6 3,6M2.5,7.5V10H10.5V7.5H2.5M12,7.5V10H17.14L15.25,7.5H12M6,13.5A1.5,1.5 0 0,0 4.5,15A1.5,1.5 0 0,0 6,16.5A1.5,1.5 0 0,0 7.5,15A1.5,1.5 0 0,0 6,13.5M18,13.5A1.5,1.5 0 0,0 16.5,15A1.5,1.5 0 0,0 18,16.5A1.5,1.5 0 0,0 19.5,15A1.5,1.5 0 0,0 18,13.5Z",
  "Позашляховик": "M5,11L6.5,6.5H17.5L19,11M17.5,16A1.5,1.5 0 0,1 16,14.5A1.5,1.5 0 0,1 17.5,13A1.5,1.5 0 0,1 19,14.5A1.5,1.5 0 0,1 17.5,16M6.5,16A1.5,1.5 0 0,1 5,14.5A1.5,1.5 0 0,1 6.5,13A1.5,1.5 0 0,1 8,14.5A1.5,1.5 0 0,1 6.5,16M18.92,6C18.72,5.42 18.16,5 17.5,5H6.5C5.84,5 5.28,5.42 5.08,6L3,12V20A1,1 0 0,0 4,21H5A1,1 0 0,0 6,20V19H18V20A1,1 0 0,0 19,21H20A1,1 0 0,0 21,20V12L18.92,6Z",
  "Купе":         "M12,8.5H7L4,11H3C1.89,11 1,11.89 1,13V16H3.17C3.6,17.2 4.73,18 6,18C7.27,18 8.4,17.2 8.82,16H15.17C15.6,17.2 16.73,18 18,18C19.27,18 20.4,17.2 20.82,16H23V15C23,13.89 21.97,13.53 21,13L12,8.5M5.25,12L7.5,10H11.5L15.5,12H5.25M6,13.5A1.5,1.5 0 0,1 7.5,15A1.5,1.5 0 0,1 6,16.5A1.5,1.5 0 0,1 4.5,15A1.5,1.5 0 0,1 6,13.5M18,13.5A1.5,1.5 0 0,1 19.5,15A1.5,1.5 0 0,1 18,16.5A1.5,1.5 0 0,1 16.5,15A1.5,1.5 0 0,1 18,13.5Z",
  "Кабріолет":    "M16,6L15,6.75L17.5,10H13.5V8.5H12V10H3C1.89,10 1,10.89 1,12V15H3A3,3 0 0,0 6,18A3,3 0 0,0 9,15H15A3,3 0 0,0 18,18A3,3 0 0,0 21,15H23V12C23,10.89 22.11,10 21,10H19L16,6M6,13.5A1.5,1.5 0 0,1 7.5,15A1.5,1.5 0 0,1 6,16.5A1.5,1.5 0 0,1 4.5,15A1.5,1.5 0 0,1 6,13.5M18,13.5A1.5,1.5 0 0,1 19.5,15A1.5,1.5 0 0,1 18,16.5A1.5,1.5 0 0,1 16.5,15A1.5,1.5 0 0,1 18,13.5Z",
  "Мікроавтобус": "M3,7C1.89,7 1,7.89 1,9V17H3A3,3 0 0,0 6,20A3,3 0 0,0 9,17H15A3,3 0 0,0 18,20A3,3 0 0,0 21,17H23V13C23,11.89 22.11,11 21,11L18,7H3M3,8.5H7V11H3V8.5M9,8.5H13V11H9V8.5M15,8.5H17.5L19.46,11H15V8.5M6,15.5A1.5,1.5 0 0,1 7.5,17A1.5,1.5 0 0,1 6,18.5A1.5,1.5 0 0,1 4.5,17A1.5,1.5 0 0,1 6,15.5M18,15.5A1.5,1.5 0 0,1 19.5,17A1.5,1.5 0 0,1 18,18.5A1.5,1.5 0 0,1 16.5,17A1.5,1.5 0 0,1 18,15.5Z",
  "Пікап":        "M16,6H10.5V10H1V15H3A3,3 0 0,0 6,18A3,3 0 0,0 9,15H15A3,3 0 0,0 18,18A3,3 0 0,0 21,15H23V12C23,10.89 22.11,10 21,10H19L16,6M12,7.5H15.5L17.46,10H12V7.5M6,13.5A1.5,1.5 0 0,1 7.5,15A1.5,1.5 0 0,1 6,16.5A1.5,1.5 0 0,1 4.5,15A1.5,1.5 0 0,1 6,13.5M18,13.5A1.5,1.5 0 0,1 19.5,15A1.5,1.5 0 0,1 18,16.5A1.5,1.5 0 0,1 16.5,15A1.5,1.5 0 0,1 18,13.5Z",
  "Вантажівка":   "M18,18.5A1.5,1.5 0 0,1 16.5,17A1.5,1.5 0 0,1 18,15.5A1.5,1.5 0 0,1 19.5,17A1.5,1.5 0 0,1 18,18.5M19.5,9.5L21.46,12H17V9.5M6,18.5A1.5,1.5 0 0,1 4.5,17A1.5,1.5 0 0,1 6,15.5A1.5,1.5 0 0,1 7.5,17A1.5,1.5 0 0,1 6,18.5M20,8H17V4H3C1.89,4 1,4.89 1,6V17H3A3,3 0 0,0 6,20A3,3 0 0,0 9,17H15A3,3 0 0,0 18,20A3,3 0 0,0 21,17H23V12L20,8Z",
  "Автобус":      "M3,6C1.89,6 1,6.89 1,8V15H3A3,3 0 0,0 6,18A3,3 0 0,0 9,15H15A3,3 0 0,0 18,18A3,3 0 0,0 21,15H23V8C23,6.89 22.11,6 21,6H3M2.5,7.5H6.5V10H2.5V7.5M8,7.5H12V10H8V7.5M13.5,7.5H17.5V10H13.5V7.5M19,7.5H21.5V13L19,11V7.5M6,13.5A1.5,1.5 0 0,1 7.5,15A1.5,1.5 0 0,1 6,16.5A1.5,1.5 0 0,1 4.5,15A1.5,1.5 0 0,1 6,13.5M18,13.5A1.5,1.5 0 0,1 19.5,15A1.5,1.5 0 0,1 18,16.5A1.5,1.5 0 0,1 16.5,15A1.5,1.5 0 0,1 18,13.5Z",
  "Мотоцикл":     "M17.42,10L13.41,6H9V8H12.59L14.59,10H6.5C4,10 2,12 2,14.5C2,17 4,19 6.5,19C8.72,19 10.56,17.38 10.92,15.27L13.04,14C13,14.17 13,14.33 13,14.5C13,17 15,19 17.5,19C20,19 22,17 22,14.5C22,12 20,10 17.5,10M8.84,15.26C8.5,16.27 7.58,17 6.47,17C5.09,17 3.97,15.88 3.97,14.5C3.97,13.12 5.09,12 6.47,12C7.59,12 8.5,12.74 8.84,13.75H6V15.25L8.84,15.26M17.47,17C16.09,17 14.97,15.88 14.97,14.5C14.97,13.12 16.09,12 17.47,12A2.5,2.5 0 0,1 19.97,14.5A2.5,2.5 0 0,1 17.47,17Z",
  "Багі":         "M20 11C19.8 11 19.6 11 19.5 11.1L17.4 9H20V6L16.3 7.9L13.4 5H9V7H12.6L14.6 9H11L7 11L5 9H0V11H4C1.8 11 0 12.8 0 15S1.8 19 4 19 8 17.2 8 15L10 17H13L16.5 10.9L17.5 11.9C16.6 12.6 16 13.8 16 15C16 17.2 17.8 19 20 19S24 17.2 24 15 22.2 11 20 11M4 17C2.9 17 2 16.1 2 15S2.9 13 4 13 6 13.9 6 15 5.1 17 4 17M20 17C18.9 17 18 16.1 18 15S18.9 13 20 13 22 13.9 22 15 21.1 17 20 17Z",
  "Спецтехніка":  "M18.5 18.5C19.04 18.5 19.5 18.96 19.5 19.5S19.04 20.5 18.5 20.5H6.5C5.96 20.5 5.5 20.04 5.5 19.5S5.96 18.5 6.5 18.5H18.5M18.5 17H6.5C5.13 17 4 18.13 4 19.5S5.13 22 6.5 22H18.5C19.88 22 21 20.88 21 19.5S19.88 17 18.5 17M21 11H18V7H13L10 11V16H22L21 11M11.54 11L13.5 8.5H16V11H11.54M9.76 3.41L4.76 2L2 11.83C1.66 13.11 2.41 14.44 3.7 14.8L4.86 15.12L8.15 12.29L4.27 11.21L6.15 4.46L8.94 5.24C9.5 5.53 10.71 6.34 11.47 7.37L12.5 6H12.94C11.68 4.41 9.85 3.46 9.76 3.41Z",
}


function BodyTypeCard({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  const path = BODY_SVG[label] ?? ""
  return (
    <button
      onClick={onClick}
      type="button"
      aria-pressed={selected}
      className={`group relative flex min-h-[130px] flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all cursor-pointer ${
        selected
          ? "border-primary/60 bg-primary/[0.08] text-primary shadow-[0_0_0_1px_rgba(0,210,198,0.18),0_8px_24px_-12px_rgba(0,210,198,0.35)]"
          : "border-border bg-card/30 text-muted-foreground hover:border-primary/40 hover:bg-primary/[0.03] hover:text-foreground"
      }`}
    >
      {selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_40%,rgba(0,210,198,0.12),transparent_60%)]"
        />
      )}
      <svg
        viewBox="0 0 24 24"
        className="relative h-20 w-20"
        fill="currentColor"
      >
        <path d={path} />
      </svg>
      <span className="relative text-[12px] font-medium leading-tight">{label}</span>
      {selected && (
        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
      )}
    </button>
  )
}

function AllFiltersForm({
  answers,
  onChange,
  freeText,
  onFreeTextChange,
  onSubmit,
  onClear,
  loading,
  language,
}: {
  answers: Answer[]
  onChange: (idx: number, ans: Answer) => void
  freeText: string
  onFreeTextChange: (text: string) => void
  onSubmit: () => void
  onClear: () => void
  loading: boolean
  language: Language
}) {
  const byId = Object.fromEntries(answers.map((a, i) => [a.questionId, { answer: a, index: i }]))

  const toggle = (qIdx: number, opt: string, multi: boolean) => {
    const ans = answers[qIdx]
    if (multi) {
      const next = ans.selected.includes(opt)
        ? ans.selected.filter(s => s !== opt)
        : [...ans.selected, opt]
      onChange(qIdx, { ...ans, selected: next })
    } else {
      onChange(qIdx, { ...ans, selected: ans.selected[0] === opt ? [] : [opt] })
    }
  }

  const setBudget = (field: 0 | 1, value: string) => {
    const raw = value.replace(/[^\d]/g, "")
    const formatted = raw ? parseInt(raw).toLocaleString("uk-UA") : ""
    const bi = byId.budget.index
    const prev = answers[bi].selected
    const next = field === 0 ? [formatted, prev[1] ?? ""] : [prev[0] ?? "", formatted]
    onChange(bi, { ...answers[bi], selected: next })
  }

  const setYear = (field: 0 | 1, value: string) => {
    const yi = byId.year.index
    const prev = answers[yi].selected
    const next = field === 0 ? [value, prev[1] ?? ""] : [prev[0] ?? "", value]
    onChange(yi, { ...answers[yi], selected: next })
  }

  const setRange = (qid: "mileage" | "engine", field: 0 | 1, value: string) => {
    const raw = value.replace(/[^\d.]/g, "")
    const idx = byId[qid].index
    const prev = answers[idx].selected
    const next = field === 0 ? [raw, prev[1] ?? ""] : [prev[0] ?? "", raw]
    onChange(idx, { ...answers[idx], selected: next })
  }

  const setSingle = (qid: "hp", value: string) => {
    const raw = value.replace(/[^\d]/g, "")
    const idx = byId[qid].index
    onChange(idx, { ...answers[idx], selected: raw ? [raw] : [] })
  }

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: currentYear - 2014 }, (_, i) => String(currentYear - i))

  const inputCls = "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none transition-colors"
  const selectCls = "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary/40 focus:outline-none transition-colors"

  const SectionHeader = ({ title, step, hint }: { title: string; step?: string; hint?: string }) => (
    <div className="mt-3 flex items-center gap-3 first:mt-0">
      {step && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/[0.08] font-mono text-[10px] font-bold text-primary">
          {step}
        </span>
      )}
      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        <h3 className="shrink-0 text-[13px] font-bold uppercase tracking-[0.16em] text-foreground">{title}</h3>
        {hint && <span className="hidden text-[11px] text-muted-foreground/60 sm:block">{hint}</span>}
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
    </div>
  )

  // Icon map for purpose presets (funnel entry tiles)
  const PURPOSE_ICON: Record<string, React.ElementType> = {
    "Місто": Building2, "Подорожі": Plane, "Спорт": Zap,
    "Сім'я": Users, "Бізнес": Briefcase, "Робота": Wrench,
    "Інвестиція": TrendingUp,
  }

  // Count active filters so the "Clear all" chip can render in a disabled state.
  const activeFilterCount = answers.reduce((n, a) => n + (a.selected.length > 0 || a.custom.trim().length > 0 ? 1 : 0), 0) + (freeText.trim() ? 1 : 0)
  const hasActiveFilters = activeFilterCount > 0

  return (
    <div className="flex flex-col gap-5">
      {/* ═══ TOP BAR — always visible to prevent layout jump when filters toggle ═══ */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card/50 px-4 py-2.5">
        <div className={`flex items-center gap-2 text-xs ${hasActiveFilters ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
          <SlidersHorizontal className={`h-3.5 w-3.5 ${hasActiveFilters ? "text-primary/60" : "text-muted-foreground/30"}`} />
          <span className="font-medium">
            {t("picker.activeFilters", language)}: <span className={hasActiveFilters ? "text-foreground" : "text-muted-foreground/50"}>{activeFilterCount}</span>
          </span>
        </div>
        <button
          onClick={onClear}
          disabled={!hasActiveFilters}
          type="button"
          title={t("picker.clearAll", language)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
            hasActiveFilters
              ? "border-border bg-card text-muted-foreground hover:border-red-500/40 hover:bg-red-500/[0.06] hover:text-red-400 cursor-pointer"
              : "border-border/40 bg-transparent text-muted-foreground/30 cursor-not-allowed"
          }`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("picker.clearAll", language)}
        </button>
      </div>

      {/* ═══ AI HERO — воронка: найширший вхід, текстом описати ═══ */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-transparent p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground sm:text-xl">{t("picker.hero.title", language)}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {t("picker.hero.subtitle", language)} <em className="text-foreground/80">{t("picker.hero.example", language)}</em>{t("picker.hero.subtitleTail", language)}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <MessageSquare className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/60" />
                <input
                  value={freeText}
                  onChange={e => onFreeTextChange(e.target.value.slice(0, 500))}
                  onKeyDown={e => e.key === "Enter" && onSubmit()}
                  placeholder={t("picker.hero.placeholder", language)}
                  maxLength={500}
                  className="w-full rounded-xl border border-primary/30 bg-card/80 px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/60 focus:outline-none transition-colors"
                />
              </div>
              <button
                onClick={onSubmit}
                disabled={loading}
                className="shrink-0 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    {t("picker.hero.searchingShort", language)}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <ArrowRight className="h-4 w-4" /> {t("picker.hero.askAI", language)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Divider "або" */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">{t("picker.or", language)}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* ═══ STEP 01 — ДЛЯ ЧОГО? (найширший фільтр, покриває цілий пресет) ═══ */}
      <SectionHeader step="01" title={t("picker.sec.purpose", language)} hint={t("picker.sec.purposeHint", language)} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {QUESTIONS.find(q => q.id === "purpose")?.options.map(opt => {
          const Icon = PURPOSE_ICON[opt] ?? Sparkles
          const selected = byId.purpose.answer.selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(byId.purpose.index, opt, true)}
              aria-pressed={selected}
              className={`group relative flex flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 transition-all cursor-pointer ${
                selected
                  ? "border-primary/60 bg-primary/[0.10] text-primary shadow-[0_0_0_1px_rgba(0,210,198,0.18),0_8px_24px_-12px_rgba(0,210,198,0.35)]"
                  : "border-border bg-card/30 text-muted-foreground hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground"
              }`}
            >
              <Icon className={`h-6 w-6 transition-transform ${selected ? "scale-110" : "group-hover:scale-105"}`} />
              <span className="text-[12px] font-semibold leading-tight">{tOpt(opt, language)}</span>
              {selected && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ═══ STEP 02 — БЮДЖЕТ + РІК (фінансові рамки) ═══ */}
      <SectionHeader step="02" title={t("picker.sec.budgetYear", language)} hint={t("picker.sec.budgetYearHint", language)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FilterSection icon={DollarSign} title={t("picker.filter.budget", language)}>
          <div className="flex items-center gap-2">
            <input type="text" inputMode="numeric" placeholder={t("picker.filter.budgetFrom", language)}
              value={byId.budget.answer.selected[0] ?? ""}
              onChange={e => setBudget(0, e.target.value)}
              className={inputCls}
            />
            <span className="text-muted-foreground/30 text-sm">—</span>
            <input type="text" inputMode="numeric" placeholder={t("picker.filter.toShort", language)}
              value={byId.budget.answer.selected[1] ?? ""}
              onChange={e => setBudget(1, e.target.value)}
              className={inputCls}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground/60">{t("picker.filter.budgetHint", language)}</p>
        </FilterSection>

        <FilterSection icon={Calendar} title={t("picker.filter.year", language)}>
          <div className="flex items-center gap-2">
            <select value={byId.year.answer.selected[0] ?? ""} onChange={e => setYear(0, e.target.value)} className={selectCls}>
              <option value="">{t("picker.filter.fromShort", language)}</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-muted-foreground/30 text-sm">—</span>
            <select value={byId.year.answer.selected[1] ?? ""} onChange={e => setYear(1, e.target.value)} className={selectCls}>
              <option value="">{t("picker.filter.toShort", language)}</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </FilterSection>
      </div>

      {/* ═══ STEP 03 — ТИП ТРАНСПОРТУ (силуети) ═══ */}
      <SectionHeader step="03" title={t("picker.sec.bodyType", language)} hint={t("picker.sec.bodyTypeHint", language)} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
        {QUESTIONS.find(q => q.id === "body")?.options.map(opt => (
          <BodyTypeCard key={opt} label={tOpt(opt, language)}
            selected={byId.body.answer.selected.includes(opt)}
            onClick={() => toggle(byId.body.index, opt, true)}
          />
        ))}
      </div>

      {/* ═══ STEP 04 — ДВИГУН ═══ */}
      <SectionHeader step="04" title={t("picker.sec.engine", language)} hint={t("picker.sec.engineHint", language)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FilterSection icon={Fuel} title={t("picker.filter.fuelType", language)}>
          <div className="flex flex-wrap gap-1.5">
            {QUESTIONS.find(q => q.id === "fuel")?.options.map(opt => (
              <FilterChip key={opt} label={tOpt(opt, language)}
                selected={byId.fuel.answer.selected.includes(opt)}
                onClick={() => toggle(byId.fuel.index, opt, true)}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection icon={SlidersHorizontal} title={t("picker.filter.engineVol", language)}>
          <div className="flex items-center gap-2">
            <input type="text" inputMode="decimal" placeholder={t("picker.filter.fromShort", language)}
              value={byId.engine.answer.selected[0] ?? ""}
              onChange={e => setRange("engine", 0, e.target.value)}
              className={inputCls}
            />
            <span className="text-muted-foreground/30 text-sm">—</span>
            <input type="text" inputMode="decimal" placeholder={t("picker.filter.toShort", language)}
              value={byId.engine.answer.selected[1] ?? ""}
              onChange={e => setRange("engine", 1, e.target.value)}
              className={inputCls}
            />
          </div>
        </FilterSection>

        <FilterSection icon={Zap} title={t("picker.filter.minPower", language)}>
          <input type="text" inputMode="numeric" placeholder={t("picker.filter.hpExample", language)}
            value={byId.hp.answer.selected[0] ?? ""}
            onChange={e => setSingle("hp", e.target.value)}
            className={inputCls}
          />
        </FilterSection>
      </div>

      {/* ═══ STEP 05 — ТРАНСМІСІЯ + РОЗМІР ═══ */}
      <SectionHeader step="05" title={t("picker.sec.transSize", language)} hint={t("picker.sec.transSizeHint", language)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSection icon={Settings2} title={t("picker.filter.gearbox", language)}>
          <div className="flex flex-wrap gap-1.5">
            {QUESTIONS.find(q => q.id === "transmission")?.options.map(opt => (
              <FilterChip key={opt} label={tOpt(opt, language)}
                selected={byId.transmission.answer.selected.includes(opt)}
                onClick={() => toggle(byId.transmission.index, opt, true)}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection icon={Zap} title={t("picker.filter.drivetrain", language)}>
          <div className="flex flex-wrap gap-1.5">
            {["FWD", "RWD", "AWD"].map((opt, i) => {
              const full = QUESTIONS.find(q => q.id === "drive")?.options[i] ?? opt
              return (
                <FilterChip key={opt} label={opt}
                  selected={byId.drive.answer.selected.includes(full)}
                  onClick={() => toggle(byId.drive.index, full, true)}
                />
              )
            })}
          </div>
        </FilterSection>

        <FilterSection icon={DoorOpen} title={t("picker.filter.doors", language)}>
          <div className="flex flex-wrap gap-1.5">
            {QUESTIONS.find(q => q.id === "doors")?.options.map(opt => (
              <FilterChip key={opt} label={opt}
                selected={byId.doors.answer.selected.includes(opt)}
                onClick={() => toggle(byId.doors.index, opt, false)}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection icon={Users} title={t("picker.filter.seats", language)}>
          <div className="flex flex-wrap gap-1.5">
            {QUESTIONS.find(q => q.id === "seats")?.options.map(opt => (
              <FilterChip key={opt} label={opt}
                selected={byId.seats.answer.selected.includes(opt)}
                onClick={() => toggle(byId.seats.index, opt, false)}
              />
            ))}
          </div>
        </FilterSection>
      </div>

      {/* ═══ STEP 06 — ДЕТАЛІ: пробіг, колір, салон ═══ */}
      <SectionHeader step="06" title={t("picker.sec.details", language)} hint={t("picker.sec.detailsHint", language)} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FilterSection icon={Gauge} title={t("picker.filter.mileage", language)}>
          <div className="flex items-center gap-2">
            <input type="text" inputMode="numeric" placeholder={t("picker.filter.fromShort", language)}
              value={byId.mileage.answer.selected[0] ?? ""}
              onChange={e => setRange("mileage", 0, e.target.value)}
              className={inputCls}
            />
            <span className="text-muted-foreground/30 text-sm">—</span>
            <input type="text" inputMode="numeric" placeholder={t("picker.filter.mileageTo", language)}
              value={byId.mileage.answer.selected[1] ?? ""}
              onChange={e => setRange("mileage", 1, e.target.value)}
              className={inputCls}
            />
          </div>
        </FilterSection>

        <FilterSection icon={Palette} title={t("picker.filter.bodyColor", language)}>
          <div className="flex flex-wrap gap-2">
            {QUESTIONS.find(q => q.id === "color")?.options.map(opt => {
              const selected = byId.color.answer.selected.includes(opt)
              return (
                <button
                  key={opt}
                  onClick={() => toggle(byId.color.index, opt, true)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium transition-all cursor-pointer ${
                    selected
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full border border-white/10"
                    style={{ backgroundColor: COLOR_HEX[opt] ?? "#888" }}
                  />
                  {tOpt(opt, language)}
                </button>
              )
            })}
          </div>
        </FilterSection>

        <FilterSection icon={Armchair} title={t("picker.filter.interior", language)}>
          <div className="flex flex-wrap gap-2">
            {QUESTIONS.find(q => q.id === "interior")?.options.map(opt => (
              <FilterChip key={opt} label={tOpt(opt, language)}
                selected={byId.interior.answer.selected.includes(opt)}
                onClick={() => toggle(byId.interior.index, opt, true)}
              />
            ))}
          </div>
        </FilterSection>
      </div>

      {/* ═══ BOTTOM CTA — primary action (Clear-all lives at TOP now) ═══ */}
      <div className="sticky bottom-4 mt-4">
        <button
          onClick={onSubmit}
          disabled={loading}
          className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-primary/20"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              {t("picker.searching", language)}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4" /> {t("picker.findBest", language)}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

type Phase = "form" | "suggestions" | "results"

export default function UnifiedPicker({ onSelectCar }: { onSelectCar: (car: CarType) => void }) {
  const { language } = useSettings()
  const [answers, setAnswers] = useState<Answer[]>(EMPTY_ANSWERS)
  const [freeText, setFreeText] = useState("")
  const [results, setResults] = useState<CarType[]>([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [phase, setPhase] = useState<Phase>("form")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [approvedIndices, setApprovedIndices] = useState<Set<number>>(new Set())
  const [searchingIndex, setSearchingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aiUnavailable, setAiUnavailable] = useState(false)
  const [userBudget, setUserBudget] = useState<{ min?: number; max?: number }>({})
  const abortRef = useRef<AbortController | null>(null)

  const updateAnswer = useCallback((idx: number, ans: Answer) => {
    setAnswers(prev => prev.map((a, i) => (i === idx ? ans : a)))
  }, [])

  // ── Step 1: After questionnaire → get AI suggestions ──────────────────
  const fetchSuggestions = useCallback(async (finalAnswers: Answer[]) => {
    setPhase("suggestions")
    setLoadingSuggestions(true)
    try {
      // Build preferences from answers
      const byId = Object.fromEntries(finalAnswers.map(a => [a.questionId, a]))
      const fuelMap: Record<string, string> = {
        "Бензин": "Petrol", "Дизель": "Diesel", "Електро": "Electric",
        "Гібрид": "Hybrid", "Plug-in гібрид": "Hybrid",
        "Газ (LPG)": "LPG", "Газ (CNG)": "CNG", "Етанол": "Ethanol", "Водень": "Hydrogen",
      }
      const bodyMap: Record<string, string> = {
        "Седан": "Sedan", "Хетчбек": "Hatchback", "Універсал": "Estate",
        "Позашляховик": "SUV", "Купе": "Coupe", "Кабріолет": "Convertible",
        "Мікроавтобус": "Van", "Пікап": "Pickup", "Вантажівка": "Truck",
        "Автобус": "Bus", "Мотоцикл": "Motorcycle", "Багі": "Buggy", "Спецтехніка": "Special",
      }
      const transMap: Record<string, string> = {
        "Автомат": "Automatic", "Механіка": "Manual",
        "Робот (DSG/DCT)": "Automatic", "Варіатор (CVT)": "Automatic",
      }
      const driveMap: Record<string, string> = {
        "Передній (FWD)": "FWD", "Задній (RWD)": "RWD", "Повний (AWD/4WD)": "AWD",
      }

      // Budget: selected[0] = "від" (e.g., "30 000"), selected[1] = "до" (e.g., "50 000" or "")
      const cleanNum = (s: string) => {
        const digits = s.replace(/[^\d]/g, "")
        return digits ? parseInt(digits) : NaN
      }
      const cleanFloat = (s: string) => {
        const norm = s.replace(/,/g, ".").replace(/[^\d.]/g, "")
        const n = parseFloat(norm)
        return isNaN(n) ? NaN : n
      }
      const budgetFromStr = byId.budget?.selected[0] ?? ""
      const budgetToStr = byId.budget?.selected[1] ?? ""
      let budgetMin: number | undefined
      let budgetMax: number | undefined
      const bFrom = cleanNum(budgetFromStr)
      const bTo = cleanNum(budgetToStr)
      if (!isNaN(bFrom) && bFrom > 0) budgetMin = bFrom
      if (!isNaN(bTo) && bTo > 0) budgetMax = bTo

      // Mileage range (km)
      const mileageMin = cleanNum(byId.mileage?.selected[0] ?? "")
      const mileageMax = cleanNum(byId.mileage?.selected[1] ?? "")

      // Engine volume (liters)
      const engineMin = cleanFloat(byId.engine?.selected[0] ?? "")
      const engineMax = cleanFloat(byId.engine?.selected[1] ?? "")

      // HP min
      const hpMin = cleanNum(byId.hp?.selected[0] ?? "")

      // Doors + seats (chips, stored as string)
      const doorsStr = byId.doors?.selected[0] ?? ""
      const doors = doorsStr ? parseInt(doorsStr) : NaN
      const seatsStr = byId.seats?.selected[0] ?? ""
      const seatsMinManual = seatsStr === "7+" ? 7 : seatsStr ? parseInt(seatsStr) : NaN

      // Color (UA → EN)
      const colorMap: Record<string, string> = {
        "Білий": "White", "Чорний": "Black", "Сірий": "Grey",
        "Сріблястий": "Silver", "Синій": "Blue", "Червоний": "Red",
        "Зелений": "Green", "Коричневий": "Brown", "Бежевий": "Beige",
        "Жовтий": "Yellow",
      }
      const color = colorMap[byId.color?.selected[0] ?? ""] ?? null

      // Interior material (UA → EN)
      const interiorMap: Record<string, string> = {
        "Шкіра": "Leather", "Екошкіра": "Eco-leather", "Тканина": "Fabric",
        "Велюр": "Velour", "Алькантара": "Alcantara",
        "Комбінований": "Combination", "Карбон": "Carbon",
      }
      const interior = interiorMap[byId.interior?.selected[0] ?? ""] ?? null

      // Save user budget for later use in handleApproveSuggestion
      setUserBudget({ min: budgetMin, max: budgetMax })

      // Cancel previous request if any
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setError(null)

      // If we already know AI is down and the form has at least one structured
      // filter, skip the suggest call entirely and search via parser directly.
      const hasFormFilters = Boolean(
        budgetMax || budgetMin ||
        byId.fuel?.selected[0] || byId.body?.selected[0] ||
        byId.year?.selected[0] || byId.transmission?.selected[0] ||
        byId.drive?.selected[0]
      )
      if (aiUnavailable && hasFormFilters) {
        setLoadingSuggestions(false)
        setPhase("results")
        setLoadingResults(true)
        setResults([])
        const accumulated: CarType[] = []
        const seenIds = new Set<string>()
        let receivedAny = false
        await streamSearch(
          {
            make: null, model: null,
            fuel: fuelMap[byId.fuel?.selected[0] ?? ""] ?? null,
            body_type: bodyMap[byId.body?.selected[0] ?? ""] ?? null,
            transmission: transMap[byId.transmission?.selected[0] ?? ""] ?? null,
            drive: driveMap[byId.drive?.selected[0] ?? ""] ?? null,
            color: color ?? null,
            year_from: byId.year?.selected[0] ? parseInt(byId.year.selected[0]) : null,
            year_to: byId.year?.selected[1] ? parseInt(byId.year.selected[1]) : null,
            budget_min: budgetMin || null,
            budget_max: budgetMax || null,
          },
          controller.signal,
          {
            onCars: (cars) => {
              receivedAny = true
              for (const c of cars) {
                const id = (c as any).source_url ?? (c as any).id
                if (id && seenIds.has(id)) continue
                if (id) seenIds.add(id)
                accumulated.push(c)
              }
              setResults([...accumulated])
            },
            onDone: () => {
              setLoadingResults(false)
              if (!receivedAny) setError("За вашими параметрами авто не знайдено. Спробуйте розширити критерії.")
            },
            onError: (msg) => {
              if (!receivedAny) setError("Не вдалося з'єднатися з парсером. " + msg)
              setLoadingResults(false)
            },
          },
        )
        return
      }

      // Shared helper: run parser directly via SSE streaming. Cars appear as
      // each source completes (cache → AS24 → Bytbil → Blocket), so the user
      // sees something quickly even when the cold scrape takes 10+ seconds.
      const runDirectSearch = async () => {
        setLoadingSuggestions(false)
        setPhase("results")
        setLoadingResults(true)
        setResults([])

        const accumulated: CarType[] = []
        const seenIds = new Set<string>()
        let receivedAny = false

        await streamSearch(
          {
            make: null,
            model: null,
            fuel: fuelMap[byId.fuel?.selected[0] ?? ""] ?? null,
            body_type: bodyMap[byId.body?.selected[0] ?? ""] ?? null,
            transmission: transMap[byId.transmission?.selected[0] ?? ""] ?? null,
            drive: driveMap[byId.drive?.selected[0] ?? ""] ?? null,
            color: color ?? null,
            year_from: byId.year?.selected[0] ? parseInt(byId.year.selected[0]) : null,
            year_to: byId.year?.selected[1] ? parseInt(byId.year.selected[1]) : null,
            budget_min: budgetMin || null,
            budget_max: budgetMax || null,
          },
          controller.signal,
          {
            onCars: (cars) => {
              receivedAny = true
              for (const c of cars) {
                const id = (c as any).source_url ?? (c as any).id
                if (id && seenIds.has(id)) continue
                if (id) seenIds.add(id)
                accumulated.push(c)
              }
              setResults([...accumulated])
            },
            onDone: () => {
              setLoadingResults(false)
              if (!receivedAny) setError("За вашими параметрами авто не знайдено. Спробуйте розширити критерії.")
            },
            onError: (msg) => {
              if (!receivedAny) setError("Не вдалося з'єднатися з парсером. " + msg)
              setLoadingResults(false)
            },
          },
        )
      }

      // ── Streaming SSE suggest call ─────────────────────────────────────────
      // Suggestions arrive one-by-one as Claude generates them; each is shown
      // immediately rather than waiting for all three.
      const res = await fetch("/api/ai-picker/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: {
            fuel: fuelMap[byId.fuel?.selected[0] ?? ""] ?? null,
            body_type: bodyMap[byId.body?.selected[0] ?? ""] ?? null,
            // Send null (not 20000) when user did not specify a budget — the
            // suggest endpoint treats null as "no budget constraint" and lets
            // Claude propose real market prices. The old fallback to 20000
            // made Claude treat €20k as the user's budget, so any realistic
            // premium suggestion got tagged "+over budget" against a value
            // the user never set.
            budget_min: budgetMin || null,
            budget_max: budgetMax || null,
            year_from: byId.year?.selected[0] ? parseInt(byId.year.selected[0]) : null,
            year_to: byId.year?.selected[1] ? parseInt(byId.year.selected[1]) : null,
            transmission: transMap[byId.transmission?.selected[0] ?? ""] ?? null,
            drive: driveMap[byId.drive?.selected[0] ?? ""] ?? null,
            purpose_body_types: byId.purpose?.selected ?? [],
            mileage_min: isNaN(mileageMin) ? null : mileageMin,
            mileage_max: isNaN(mileageMax) ? null : mileageMax,
            displacement_min: isNaN(engineMin) ? null : engineMin,
            displacement_max: isNaN(engineMax) ? null : engineMax,
            hp_min: isNaN(hpMin) ? null : hpMin,
            doors: isNaN(doors) ? null : doors,
            seats_min: isNaN(seatsMinManual) ? null : seatsMinManual,
            color,
            interior_material: interior,
          },
          answers: finalAnswers,
          freeText: freeText || undefined,
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        setError("Не вдалося з'єднатися з сервером. Спробуйте ще раз.")
        return
      }

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let lineBuf = ""
      const arrived: Suggestion[] = []
      let streamDone = false

      while (!streamDone) {
        const { done, value } = await reader.read()
        if (done) break

        lineBuf += dec.decode(value, { stream: true })
        const lines = lineBuf.split("\n")
        lineBuf = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === "suggestion" && event.suggestion) {
              arrived.push(event.suggestion as Suggestion)
              setSuggestions([...arrived])
              // Keep loading=true until the 'done' event — so the UI can show a
              // "loading more…" indicator under the partial list and the user
              // sees that more suggestions are still streaming in.
            } else if (event.type === "fallback" && event.fallback === "ai_unavailable") {
              setAiUnavailable(true)
              if (!hasFormFilters) {
                setLoadingSuggestions(false)
                setPhase("form")
                setSuggestions([])
              } else {
                await runDirectSearch()
              }
              streamDone = true
              break
            } else if (event.type === "done") {
              setLoadingSuggestions(false)
              streamDone = true
              break
            } else if (event.type === "error") {
              setError(event.message || "Помилка AI. Спробуйте ще раз.")
              setLoadingSuggestions(false)
              streamDone = true
              break
            }
          } catch { /* skip malformed event */ }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError("Не вдалося з'єднатися з сервером. Спробуйте ще раз.")
        setSuggestions([])
      }
    } finally {
      setLoadingSuggestions(false)
    }
  }, [freeText, aiUnavailable])

  // ── Step 2: User approves a suggestion → targeted parse ───────────────
  const handleApproveSuggestion = useCallback(async (idx: number) => {
    const suggestion = suggestions[idx]
    if (!suggestion) return

    // Cancel any in-flight approval/search before starting a new one. Without this,
    // tapping a second card while the first parser call is still running causes the
    // late response to overwrite the new one.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSearchingIndex(idx)  // Show loading spinner immediately

    // Extract user's form filters to include in chatPreferences (respects detailed filters)
    const byId = Object.fromEntries(answers.map(a => [a.questionId, a]))
    const cleanInt = (s: string) => { const n = parseInt(s.replace(/[^\d]/g, "")); return isNaN(n) ? null : n }
    const cleanFlt = (s: string) => { const n = parseFloat(s.replace(/,/g, ".").replace(/[^\d.]/g, "")); return isNaN(n) ? null : n }
    const colorMap: Record<string, string> = {
      "Білий": "White", "Чорний": "Black", "Сірий": "Grey", "Сріблястий": "Silver",
      "Синій": "Blue", "Червоний": "Red", "Зелений": "Green",
      "Коричневий": "Brown", "Бежевий": "Beige", "Жовтий": "Yellow",
    }
    const interiorMap: Record<string, string> = {
      "Шкіра": "Leather", "Екошкіра": "Eco-leather", "Тканина": "Fabric",
      "Велюр": "Velour", "Алькантара": "Alcantara",
      "Комбінований": "Combination", "Карбон": "Carbon",
    }
    const formMileageMin = cleanInt(byId.mileage?.selected[0] ?? "")
    const formMileageMax = cleanInt(byId.mileage?.selected[1] ?? "")
    const formEngineMin = cleanFlt(byId.engine?.selected[0] ?? "")
    const formEngineMax = cleanFlt(byId.engine?.selected[1] ?? "")
    const formHpMin = cleanInt(byId.hp?.selected[0] ?? "")
    const doorsRaw = byId.doors?.selected[0] ?? ""
    const formDoors = doorsRaw ? parseInt(doorsRaw) : null
    const seatsRaw = byId.seats?.selected[0] ?? ""
    const formSeatsMin = seatsRaw === "7+" ? 7 : seatsRaw ? parseInt(seatsRaw) : null
    const formColor = colorMap[byId.color?.selected[0] ?? ""] ?? null
    const formInterior = interiorMap[byId.interior?.selected[0] ?? ""] ?? null
    // Year — user's form value wins over AI suggestion. AI sometimes narrows
    // a "2017+" form input down to "2018-2020" inside the suggestion, which
    // then excludes the very cars (2021+) that exist in the user's budget.
    const formYearFrom = byId.year?.selected[0] ? parseInt(byId.year.selected[0]) : null
    const formYearTo = byId.year?.selected[1] ? parseInt(byId.year.selected[1]) : null

    try {
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [],
          answers,
          triggerSearch: true,
          clientOrderId: makeUuid(),
          chatPreferences: {
            pairs: [{ make: suggestion.searchParams.make, model: suggestion.searchParams.model }],
            fuel: suggestion.searchParams.fuel ?? null,
            body_type: suggestion.searchParams.body_type ?? null,
            // Use USER's budget from questionnaire, not Claude's price estimate
            budget_min: userBudget.min || suggestion.searchParams.budget_min || 20000,
            budget_max: userBudget.max || suggestion.searchParams.budget_max || undefined,
            // AI's yearRange ("2018-2020", "2019-2021" etc.) is treated as
            // descriptive — what the AI imagines the user might want — NOT a
            // hard filter. We pass to the parser ONLY what the user explicitly
            // typed in the form. This way niche models (Infiniti, Mercedes
            // E-Class) where AI tends to over-narrow the year window don't
            // come back empty just because AI's guess (2018-2020) excluded
            // the actually-on-the-market 2021+ stock.
            //
            // If user wants a year filter, they can fill it in the picker form.
            year_from: formYearFrom,
            year_to: formYearTo,
            transmission: suggestion.searchParams.transmission ?? null,
            drive: suggestion.searchParams.drive ?? null,
            budget: null,
            color: formColor,
            mileage_min: formMileageMin,
            mileage_max: formMileageMax,
            required_options: [],
            displacement_min: formEngineMin,
            displacement_max: formEngineMax,
            hp_min: formHpMin,
            seats_min: formSeatsMin,
            doors: formDoors,
            interior_material: formInterior,
            purpose_body_types: [],
          },
        }),
      })
      const data = await res.json()
      const newCars = (data.cars ?? []).map(mapApiCar)

      // Merge new + old, with two safeguards:
      //   1. New cars go FIRST so the latest pick tops the list.
      //   2. Old cars are kept only if they still match the NEW pick's
      //      budget + year envelope. Without this, switching from a 40-60k
      //      suggestion to an 80-100k one left 40k cars below the new
      //      80k+ results — confusing for the user.
      const sp = suggestion.searchParams
      const newBudgetMin = sp.budget_min ?? null
      const newBudgetMax = sp.budget_max ?? null
      const newYearFrom = sp.year_from ?? null
      const newYearTo = sp.year_to ?? null

      const matchesNewCriteria = (c: CarType): boolean => {
        const price = (c as any).price ?? c.price
        if (typeof price === "number") {
          if (newBudgetMin != null && price < newBudgetMin) return false
          if (newBudgetMax != null && price > newBudgetMax) return false
        }
        const year = (c as any).year ?? c.year
        if (typeof year === "number") {
          if (newYearFrom != null && year < newYearFrom) return false
          if (newYearTo   != null && year > newYearTo)   return false
        }
        return true
      }

      setResults(prev => {
        const newUrls = new Set(newCars.map((c: CarType) => c.sourceUrl || (c as any).source_url))
        const keptOld = prev
          .filter(c => !newUrls.has(c.sourceUrl || (c as any).source_url))
          .filter(matchesNewCriteria)
        return [...newCars, ...keptOld]
      })

      if (newCars.length > 0) {
        // Success — mark approved and switch to results
        setApprovedIndices(prev => new Set(prev).add(idx))
        setPhase("results")
        setLoadingResults(false)
      } else {
        // No cars found — show message, DON'T mark as approved
        setError(data.message || `За параметрами ${suggestion.make} ${suggestion.model} авто не знайдено. Спробуйте інший варіант.`)
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(`Не вдалося знайти ${suggestion.make} ${suggestion.model}. Спробуйте інший варіант.`)
      }
    } finally {
      // Only clear spinner if this call wasn't aborted by a newer one — otherwise
      // we'd hide the spinner the new call just turned on.
      if (!controller.signal.aborted) setSearchingIndex(null)
    }
  }, [suggestions, answers])

  // ── Fallback: search all without suggestions ──────────────────────────
  const handleSearchAll = useCallback(async () => {
    setPhase("results")
    setLoadingResults(true)
    setError(null)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Pass freeText as a user message so the backend's extractFromChat
      // can pull brand/model/year/etc. out of it — otherwise this button
      // only used form answers and ignored everything the user typed in
      // the AI prompt (e.g. "Infiniti SUV від 2018").
      const userMsg = freeText?.trim()
        ? [{ role: "user" as const, content: freeText.trim() }]
        : []
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: userMsg,
          answers,
          triggerSearch: true,
          clientOrderId: makeUuid(),
        }),
        signal: controller.signal,
      })
      const data = await res.json()
      setResults((data.cars ?? []).map(mapApiCar))
      if (data.cars?.length === 0) {
        setError("За вашими параметрами авто поки не знайдено. Спробуйте змінити критерії.")
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError("Помилка пошуку. Перевірте з'єднання та спробуйте ще раз.")
        setResults([])
      }
    } finally {
      setLoadingResults(false)
    }
  }, [answers, freeText])

  const goBackToForm = useCallback(() => {
    abortRef.current?.abort()
    setPhase("form")
    setSuggestions([])
    setApprovedIndices(new Set())
    setSearchingIndex(null)
    setError(null)
    // Keep answers + freeText so user can adjust them
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setPhase("form")
    setFreeText("")
    setAnswers(EMPTY_ANSWERS)
    setResults([])
    setSuggestions([])
    setApprovedIndices(new Set())
    setSearchingIndex(null)
    setError(null)
  }, [])

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-8" aria-label="AI підбір автомобіля">
      {/* Header */}
      <header className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">AI-підбір</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Знайдіть авто з Європи
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {phase === "form"
            ? "Вкажіть параметри — AI знайде найкращі варіанти з 4 європейських майданчиків"
            : phase === "suggestions"
            ? "AI підібрав моделі під ваші параметри. Оберіть — і ми знайдемо реальні пропозиції"
            : `Знайдено ${results.length} авто з AutoScout24, Mobile.de, Bytbil та Blocket`
          }
        </p>
      </header>

      {/* AI-down banner: shown after a failed AI request — user must fill the form below. */}
      {phase === "form" && aiUnavailable && (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] p-4 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="flex-1">
              <p className="font-semibold text-amber-100">AI зараз недоступний</p>
              <p className="mt-1 text-amber-200/80">
                Не можемо обробити вільний опис автоматично. Заповніть параметри у формі нижче (бюджет, тип кузова, паливо, рік) — система пошукає авто за вашими полями напряму, без AI.
              </p>
            </div>
            <button
              onClick={() => setAiUnavailable(false)}
              className="text-amber-300/70 hover:text-amber-100 text-xs"
              aria-label="Закрити"
            >✕</button>
          </div>
        </div>
      )}

      {/* Filter form */}
      {phase === "form" && (
        <div className="mb-6 rounded-3xl border border-border bg-card/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <AllFiltersForm
            answers={answers}
            onChange={updateAnswer}
            freeText={freeText}
            onFreeTextChange={setFreeText}
            onSubmit={() => {
              try { localStorage.setItem("freshAutoSearch", JSON.stringify(answers)) } catch {}
              fetchSuggestions(answers)
            }}
            onClear={() => {
              setAnswers(EMPTY_ANSWERS)
              setFreeText("")
              setError(null)
              try { localStorage.removeItem("freshAutoSearch") } catch {}
            }}
            loading={loadingSuggestions}
            language={language}
          />
        </div>
      )}

      {/* Suggestions */}
      {phase === "suggestions" && (
        <div className="rounded-3xl border border-border bg-card/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <SuggestionsScreen
            suggestions={suggestions}
            loading={loadingSuggestions}
            onApprove={handleApproveSuggestion}
            onSearchAll={handleSearchAll}
            onReset={reset}
            onBack={goBackToForm}
            onRefresh={() => {
              setApprovedIndices(new Set())
              setError(null)
              fetchSuggestions(answers)
            }}
            approvedIndices={approvedIndices}
            searchingIndex={searchingIndex}
            error={error}
          />
        </div>
      )}

      {/* Results */}
      {phase === "results" && (
        <div className="rounded-3xl border border-border bg-card/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <ResultsScreen
            answers={answers}
            cars={results}
            loading={loadingResults}
            onSelectCar={onSelectCar}
            onReset={reset}
            onBack={goBackToForm}
          />
        </div>
      )}
    </section>
  )
}