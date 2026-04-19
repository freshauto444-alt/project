"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight, ChevronLeft, Sparkles, Check, Send, RotateCcw,
  Car, Fuel, Settings2, Calendar, Zap, DollarSign, Search,
  SlidersHorizontal, Gauge,
} from "lucide-react"
import type { Car as CarType } from "@/lib/data"
import { calcTotalCost, SOURCE_SITES, ratePriceVsMarket, PRICE_RATING_CONFIG } from "@/lib/constants"

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

interface ChatMessage {
  role: "user" | "assistant"
  content: string
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
    icon: Car,
    title: "Яка ціль придбання?",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: [
      "Щоденні поїздки по місту",
      "Далекі подорожі та автобани",
      "Спорт та драйв",
      "Бізнес та представницький клас",
      "Для сім'ї з дітьми",
      "Інвестиція / колекціонування",
    ],
  },
  {
    id: "body",
    icon: Car,
    title: "Який тип кузова?",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: ["Купе", "Седан", "Позашляховик", "Хетчбек", "Універсал", "Кабріолет"],
  },
  {
    id: "fuel",
    icon: Fuel,
    title: "Тип палива",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: ["Бензин", "Дизель", "Електро", "Гібрид", "Plug-in гібрид"],
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
    subtitle: "Оберіть один",
    multi: false,
    options: ["Автомат", "Механіка", "Робот", "Варіатор"],
  },
  {
    id: "drive",
    icon: Zap,
    title: "Який привід?",
    subtitle: "Оберіть один",
    multi: false,
    options: ["Передній (FWD)", "Задній (RWD)", "Повний (AWD/4WD)"],
  },
]

const EMPTY_ANSWERS: Answer[] = QUESTIONS.map(q => ({
  questionId: q.id,
  selected: [],
  custom: "",
}))

// ─── Brand parsing from free-text input ──────────────────────────────────────
// "BMW X5" → [{make:"BMW", model:"X5"}], "ауді" → [{make:"Audi", model:null}]
const BRAND_ALIASES: Record<string, string> = {
  "bmw": "BMW", "бмв": "BMW",
  "audi": "Audi", "ауді": "Audi", "ауди": "Audi",
  "mercedes": "Mercedes-Benz", "mercedes-benz": "Mercedes-Benz",
  "мерседес": "Mercedes-Benz", "мерс": "Mercedes-Benz",
  "volkswagen": "Volkswagen", "vw": "Volkswagen",
  "фольксваген": "Volkswagen", "фольк": "Volkswagen", "вольксваген": "Volkswagen",
  "volvo": "Volvo", "вольво": "Volvo",
  "toyota": "Toyota", "тойота": "Toyota",
  "honda": "Honda", "хонда": "Honda",
  "mazda": "Mazda", "мазда": "Mazda",
  "skoda": "Skoda", "škoda": "Skoda", "шкода": "Skoda",
  "ford": "Ford", "форд": "Ford",
  "opel": "Opel", "опель": "Opel",
  "peugeot": "Peugeot", "пежо": "Peugeot",
  "renault": "Renault", "рено": "Renault",
  "hyundai": "Hyundai", "хюндай": "Hyundai", "хундай": "Hyundai",
  "kia": "Kia", "кіа": "Kia", "кия": "Kia",
  "nissan": "Nissan", "нісан": "Nissan", "ніссан": "Nissan",
  "subaru": "Subaru", "субару": "Subaru",
  "lexus": "Lexus", "лексус": "Lexus",
  "porsche": "Porsche", "порше": "Porsche",
  "tesla": "Tesla", "тесла": "Tesla",
  "mini": "MINI",
  "jeep": "Jeep", "джип": "Jeep",
  "seat": "SEAT",
  "cupra": "Cupra",
}

function parseFreeTextBrand(text: string): { make: string | null; model: string | null }[] {
  if (!text?.trim()) return []
  const lower = text.toLowerCase()
  // Tokenize on any non-letter/digit char — works for both Latin and Cyrillic
  // (\b doesn't work with Cyrillic in JS regex)
  const tokens = lower.split(/[^a-zа-яіїєёъ0-9\-]+/i).filter(Boolean)
  const pairs: { make: string | null; model: string | null }[] = []
  const seenMakes = new Set<string>()
  const stopWords = new Set(["до", "від", "from", "to", "купити", "шукаю", "хочу", "потрібен", "потрібно", "дизель", "бензин", "гібрид", "електро"])

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    const canonical = BRAND_ALIASES[tok]
    if (!canonical || seenMakes.has(canonical)) continue
    seenMakes.add(canonical)

    // Take next token as model if it looks like one
    let model: string | null = null
    const next = tokens[i + 1]
    if (next && !stopWords.has(next) && !/^\d+[кkк]?$/.test(next) && next.length <= 12) {
      model = next
    }
    pairs.push({ make: canonical, model })
  }
  return pairs
}

function buildTags(answers: Answer[]): string[] {
  const tags: string[] = []
  answers.forEach(a => {
    if (a.questionId === "year") {
      const from = a.selected[0] ?? ""
      const to = a.selected[1] ?? ""
      if (from || to) tags.push(from && to ? `${from} – ${to}` : from || to)
    } else if (a.questionId === "budget") {
      const fromRaw = (a.selected[0] ?? "").trim()
      const toRaw = (a.selected[1] ?? "").trim()
      const from = fromRaw || "20 000"
      const to = toRaw
      if (to) tags.push(`${from} – ${to} €`)
      else if (fromRaw) tags.push(`від ${from} €`)
    } else {
      a.selected.forEach(s => { if (s.trim()) tags.push(s) })
      if (a.custom.trim()) tags.push(a.custom.trim())
    }
  })
  return tags
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 font-mono text-[11px] tracking-widest text-primary/55">
        ПИТАННЯ {current + 1}&nbsp;/&nbsp;{total}
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
  const Icon = question.icon
  const isYearQuestion = question.id === "year"
  const isBudgetQuestion = question.id === "budget"
  const canProceed = isYearQuestion || isBudgetQuestion || answer.selected.length > 0 || answer.custom.trim().length > 0

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
          <h2 className="text-lg font-semibold leading-snug text-foreground">{question.title}</h2>
          <p className="mt-0.5 text-sm text-white/30">{question.subtitle}</p>
        </div>
      </div>

      {/* Options / Year Picker / Budget Picker */}
      {question.id === "budget" ? (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-white/35">Від, EUR</label>
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
              <label className="mb-1.5 block text-xs font-medium text-white/35">До, EUR</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="необмежено"
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
            <p className="text-center text-xs font-medium text-white/35">Від</p>
            <YearScrollPicker
              selected={answer.selected[0] ?? ""}
              defaultYear="2020"
              onSelect={y => onChange({ ...answer, selected: [y, answer.selected[1] ?? ""] })}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-center text-xs font-medium text-white/35">До</p>
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
                label={opt}
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
            placeholder="Або напишіть свій варіант..."
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
              Назад
            </button>
          )}
          <button
            onClick={() => {
              if (isYearQuestion) onChange({ ...answer, selected: [], custom: "" })
              onNext()
            }}
            className="text-sm text-white/20 transition-colors hover:text-white/40 cursor-pointer"
          >
            Пропустити
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
          {isLast ? "Знайти авто" : "Далі"}
          <ArrowRight className="h-3.5 w-3.5" />
        </motion.button>
      </div>
    </motion.div>
  )
}

// ─── CriteriaBar ──────────────────────────────────────────────────────────────

function CriteriaBar({ answers, onReset }: { answers: Answer[]; onReset: () => void }) {
  const tags = buildTags(answers)
  if (tags.length === 0) return null
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/22">Ваші критерії</span>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-[11px] text-white/28 transition-colors hover:text-white/55 cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
          Почати спочатку
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <span
            key={tag}
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
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState("Підключаюсь до майданчиків…")

  const steps = [
    { at: 5,  text: "Шукаю на AutoScout24…" },
    { at: 25, text: "Переглядаю оголошення…" },
    { at: 45, text: "Шукаю на Blocket та Bytbil…" },
    { at: 65, text: "Перевіряю Mobile.de…" },
    { at: 80, text: "Фільтрую результати…" },
    { at: 92, text: "Майже готово…" },
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

      <p className="text-[11px] text-white/25">Переглядаю сотні оголошень — зазвичай 1-3 хвилини</p>
    </motion.div>
  )
}

// ─── AIChat (замінити ТІЛЬКИ цей компонент в unified-picker.tsx) ──────────────

function AIChat({
  answers,
  cars,
  onNewCars,
  onPrefsChange,
  initialPrefs,
}: {
  answers: Answer[]
  cars: CarType[]
  onNewCars: (cars: CarType[]) => void
  onPrefsChange?: (prefs: any) => void
  initialPrefs?: any
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [clientOrderId, setClientOrderId] = useState<string | null>(null)
  const [chatPreferences, setChatPreferences] = useState<any>(initialPrefs ?? null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length > 1) return
    const tags = buildTags(answers)
    const intro =
      tags.length > 0
        ? `Знайдено ${cars.length} варіантів за вашими критеріями (${tags.slice(0, 3).join(", ")}${tags.length > 3 ? " та інші" : ""}).${
            cars.length === 0
              ? " Можу запустити пошук на європейських майданчиках — зазвичай знаходжу 15-30 свіжих варіантів. Скажіть що шукаєте."
              : " Можу детально розповісти про будь-яке авто або уточнити підбір."
          }`
        : "Вітаю! Я AI-консультант Fresh Auto. Розкажіть що шукаєте — марку, бюджет, тип кузова — і я підберу варіанти з європейських майданчиків."
    setMessages([{ role: "assistant", content: intro }])
  }, [cars.length])

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
      setMessages(m => [...m, { role: "assistant", content: data.message }])
      if (data.chatPreferences) { setChatPreferences(data.chatPreferences); onPrefsChange?.(data.chatPreferences) }
      onNewCars((data.cars ?? []).map(mapApiCar))
    } catch {
      setMessages(m => [
        ...m,
        { role: "assistant", content: "Виникла помилка під час пошуку. Спробуйте ще раз." },
      ])
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
        setMessages(m => [...m, { role: "assistant", content: data.message }])
        setClientOrderId(data.clientOrderId)
        runSearch(data.clientOrderId, next)
        return
      }

      setMessages(m => [
        ...m,
        { role: "assistant", content: data.message ?? "Перепрошую, спробуйте ще раз." },
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
            {searching ? "Шукаю авто на майданчиках…" : "Fresh Auto • онлайн"}
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
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "rounded-tr-sm bg-primary/[0.07] text-primary"
                  : "rounded-tl-sm bg-white/[0.04] text-white/70"
              }`}
            >
              {msg.content}
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
          placeholder={searching ? "Шукаю авто на майданчиках…" : "Напишіть що шукаєте..."}
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
  const totalCost = car.price ? calcTotalCost(car.price) : null
  const source = SOURCE_SITES[(car as any).sourceSite || (car as any).source_site || ""] || null

  // Price rating vs market
  const sameMakePrices = allCars
    .filter(c => c.make === car.make && c.price)
    .map(c => c.price!)
  const priceInfo = car.price ? ratePriceVsMarket(car.price, sameMakePrices) : null
  const ratingConfig = priceInfo ? PRICE_RATING_CONFIG[priceInfo.rating] : null

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
          {car.year} {car.make} {car.model}
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
              {(car.mileage / 1000).toFixed(0)}k km
            </span>
          )}
          {(car.fuelUa || car.fuel) && <span>{car.fuelUa || car.fuel}</span>}
          {car.transmission && <span>{car.transmission}</span>}
        </div>

        {/* Prices */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">
              {car.price ? `€${car.price.toLocaleString("uk-UA")}` : "—"}
            </div>
            {totalCost && (
              <div className="text-[11px] text-primary/70">
                ~€{totalCost.total.toLocaleString("uk-UA")} під ключ
              </div>
            )}
          </div>
          {/* Price rating */}
          {ratingConfig && priceInfo && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[10px] font-medium" style={{ color: ratingConfig.color }}>
                {ratingConfig.label}
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
  answers, cars, loading, onSelectCar, onReset, onBack, initialPrefs,
}: {
  answers: Answer[]
  cars: CarType[]
  loading: boolean
  onSelectCar: (car: CarType) => void
  onReset: () => void
  onBack: () => void
  initialPrefs?: any
}) {
  const [allCars, setAllCars] = useState<CarType[]>(cars)
  const [loadingMore, setLoadingMore] = useState(false)
  const [chatPrefsRef, setChatPrefsRef] = useState<any>(initialPrefs ?? null)
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
          const existingKeys = new Set(prev.map(c => (c as any).sourceUrl ?? (c as any).source_url ?? c.id))
          const fresh = mapped.filter(c => {
            const key = (c as any).sourceUrl ?? (c as any).source_url ?? c.id
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

      <AIChat answers={answers} cars={allCars} onNewCars={handleNewCars} onPrefsChange={setChatPrefsRef} initialPrefs={initialPrefs} />

      {/* Results header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          {loading ? "Шукаємо…" : `Знайдено: ${allCars.filter(c => c.image).length} авто`}
        </span>
        {!loading && allCars.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/40">
            <SlidersHorizontal className="h-3 w-3" />
            За релевантністю
          </span>
        )}
      </div>

      {loading ? (
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
                transition={{ delay: i * 0.06 }}
              >
                <ResultCard car={car} onClick={() => onSelectCar(car)} allCars={cars} />
              </motion.div>
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
  searchParams: Record<string, any>
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
      className={`rounded-2xl border p-4 transition-all ${
        approved
          ? "border-primary/40 bg-primary/[0.06]"
          : "border-border bg-white/[0.02] hover:border-white/[0.14]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">
            {suggestion.make} {suggestion.model}
          </h3>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-white/50">
              {suggestion.yearRange}
            </span>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-primary/70">
              {suggestion.priceRange} EUR
            </span>
          </div>
        </div>
        <button
          onClick={onApprove}
          disabled={loading}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
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
      {suggestion.concerns && (
        <p className="mt-1.5 text-[12px] text-white/30 italic">
          {suggestion.concerns}
        </p>
      )}
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
        <div className="flex items-center gap-2">
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
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
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
          {suggestions.length > 0 && approvedIndices.size === 0 && (
            <button
              onClick={onSearchAll}
              className="mt-2 rounded-xl border border-border py-3 text-sm text-white/40 hover:border-primary/20 hover:text-white/60 transition-all"
            >
              Або шукати за всіма параметрами без уточнення
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

function AllFiltersForm({
  answers,
  onChange,
  freeText,
  onFreeTextChange,
  onSubmit,
  loading,
}: {
  answers: Answer[]
  onChange: (idx: number, ans: Answer) => void
  freeText: string
  onFreeTextChange: (text: string) => void
  onSubmit: () => void
  loading: boolean
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

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: currentYear - 2014 }, (_, i) => String(currentYear - i))

  const inputCls = "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none transition-colors"
  const selectCls = "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary/40 focus:outline-none transition-colors"

  return (
    <div className="flex flex-col gap-4">
      {/* AI hint */}
      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" />
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Вкажіть бюджет та побажання — AI підбере <strong className="text-foreground">найкращі варіанти</strong> з AutoScout24, Mobile.de, Bytbil та Blocket
        </p>
      </div>

      {/* Budget + Year row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FilterSection icon={DollarSign} title="Бюджет, EUR">
          <div className="flex items-center gap-2">
            <input type="text" inputMode="numeric" placeholder="від 20 000"
              value={byId.budget.answer.selected[0] ?? ""}
              onChange={e => setBudget(0, e.target.value)}
              className={inputCls}
            />
            <span className="text-muted-foreground/30 text-sm">—</span>
            <input type="text" inputMode="numeric" placeholder="до"
              value={byId.budget.answer.selected[1] ?? ""}
              onChange={e => setBudget(1, e.target.value)}
              className={inputCls}
            />
          </div>
        </FilterSection>

        <FilterSection icon={Calendar} title="Рік випуску">
          <div className="flex items-center gap-2">
            <select value={byId.year.answer.selected[0] ?? ""} onChange={e => setYear(0, e.target.value)} className={selectCls}>
              <option value="">від</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-muted-foreground/30 text-sm">—</span>
            <select value={byId.year.answer.selected[1] ?? ""} onChange={e => setYear(1, e.target.value)} className={selectCls}>
              <option value="">до</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </FilterSection>
      </div>

      {/* Body type */}
      <FilterSection icon={Car} title="Тип кузова">
        <div className="flex flex-wrap gap-2">
          {QUESTIONS.find(q => q.id === "body")?.options.map(opt => (
            <FilterChip key={opt} label={opt}
              selected={byId.body.answer.selected.includes(opt)}
              onClick={() => toggle(byId.body.index, opt, true)}
            />
          ))}
        </div>
      </FilterSection>

      {/* Fuel + Transmission + Drive */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FilterSection icon={Fuel} title="Паливо">
          <div className="flex flex-wrap gap-1.5">
            {QUESTIONS.find(q => q.id === "fuel")?.options.map(opt => (
              <FilterChip key={opt} label={opt}
                selected={byId.fuel.answer.selected.includes(opt)}
                onClick={() => toggle(byId.fuel.index, opt, true)}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection icon={Settings2} title="КПП">
          <div className="flex flex-wrap gap-1.5">
            {QUESTIONS.find(q => q.id === "transmission")?.options.map(opt => (
              <FilterChip key={opt} label={opt}
                selected={byId.transmission.answer.selected.includes(opt)}
                onClick={() => toggle(byId.transmission.index, opt, false)}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection icon={Zap} title="Привід">
          <div className="flex flex-wrap gap-1.5">
            {["FWD", "RWD", "AWD"].map((opt, i) => {
              const full = QUESTIONS.find(q => q.id === "drive")?.options[i] ?? opt
              return (
                <FilterChip key={opt} label={opt}
                  selected={byId.drive.answer.selected.includes(full)}
                  onClick={() => toggle(byId.drive.index, full, false)}
                />
              )
            })}
          </div>
        </FilterSection>
      </div>

      {/* Free text + Submit */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
          <input
            value={freeText}
            onChange={e => onFreeTextChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onSubmit()}
            placeholder="BMW X5, сімейне авто, дизель з повним приводом..."
            className={`${inputCls} pl-10`}
          />
        </div>
        <button
          onClick={onSubmit}
          disabled={loading}
          className="shrink-0 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              AI шукає...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Підібрати авто
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
  const [userBudget, setUserBudget] = useState<{ min?: number; max?: number }>({})
  const [approvedPrefs, setApprovedPrefs] = useState<any>(null)
  const abortRef = useRef<AbortController | null>(null)

  const updateAnswer = useCallback((idx: number, ans: Answer) => {
    setAnswers(prev => prev.map((a, i) => (i === idx ? ans : a)))
  }, [])

  // ── Step 1: After questionnaire → get AI suggestions ──────────────────
  const fetchSuggestions = useCallback(async (finalAnswers: Answer[]) => {
    setPhase("suggestions")
    setLoadingSuggestions(true)
    // Fresh suggestion run → reset prior approvals & parser results so brands don't leak across criteria
    setResults([])
    setApprovedIndices(new Set())
    try {
      // Build preferences from answers
      const byId = Object.fromEntries(finalAnswers.map(a => [a.questionId, a]))
      const fuelMap: Record<string, string> = {
        "Бензин": "Petrol", "Дизель": "Diesel", "Електро": "Electric", "Гібрид": "Hybrid",
      }
      const bodyMap: Record<string, string> = {
        "Седан": "Sedan", "Хетчбек": "Hatchback", "Універсал": "Estate",
        "Позашляховик": "SUV", "Купе": "Coupe", "Кабріолет": "Convertible",
      }
      const transMap: Record<string, string> = {
        "Автомат": "Automatic", "Механіка": "Manual", "Робот": "Automatic", "Варіатор": "Automatic",
      }
      const driveMap: Record<string, string> = {
        "Передній (FWD)": "FWD", "Задній (RWD)": "RWD", "Повний (AWD/4WD)": "AWD",
      }

      // Budget: selected[0] = "від" (e.g., "30 000"), selected[1] = "до" (e.g., "50 000" or "")
      const cleanNum = (s: string) => {
        const digits = s.replace(/[^\d]/g, "")
        return digits ? parseInt(digits) : NaN
      }
      const budgetFromStr = byId.budget?.selected[0] ?? ""
      const budgetToStr = byId.budget?.selected[1] ?? ""
      let budgetMin: number | undefined
      let budgetMax: number | undefined
      const bFrom = cleanNum(budgetFromStr)
      const bTo = cleanNum(budgetToStr)
      if (!isNaN(bFrom) && bFrom > 0) budgetMin = bFrom
      if (!isNaN(bTo) && bTo > 0) budgetMax = bTo

      // Save user budget for later use in handleApproveSuggestion
      setUserBudget({ min: budgetMin, max: budgetMax })

      // Cancel previous request if any
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      // Extract make/model from free-text field (e.g. "BMW X5" → {make:"BMW", model:"X5"})
      const pairs = parseFreeTextBrand(freeText)

      setError(null)
      const res = await fetch("/api/ai-picker/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: {
            pairs,
            fuel: fuelMap[byId.fuel?.selected[0] ?? ""] ?? null,
            body_type: bodyMap[byId.body?.selected[0] ?? ""] ?? null,
            budget_min: budgetMin || 20000,
            budget_max: budgetMax || undefined,
            year_from: byId.year?.selected[0] ? parseInt(byId.year.selected[0]) : null,
            year_to: byId.year?.selected[1] ? parseInt(byId.year.selected[1]) : null,
            transmission: transMap[byId.transmission?.selected[0] ?? ""] ?? null,
            drive: driveMap[byId.drive?.selected[0] ?? ""] ?? null,
            purpose_body_types: byId.purpose?.selected ?? [],
          },
          answers: finalAnswers,
          freeText,
        }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (data.message && (!data.suggestions || data.suggestions.length === 0)) {
        setError(data.message)
      }
      setSuggestions(data.suggestions ?? [])
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError("Не вдалося з'єднатися з сервером. Спробуйте ще раз.")
        setSuggestions([])
      }
    } finally {
      setLoadingSuggestions(false)
    }
  }, [freeText])

  // ── Step 2: User approves a suggestion → targeted parse ───────────────
  const handleApproveSuggestion = useCallback(async (idx: number) => {
    const suggestion = suggestions[idx]
    if (!suggestion) return

    setSearchingIndex(idx)  // Show loading spinner immediately

    // Build preferences from the approved suggestion — these lock in the brand/model
    // for subsequent chat turns ("хочу більше", "є чорний?") so AIChat doesn't lose the Audi
    // when the user just says "більше".
    const prefsForApproval = {
      pairs: [{ make: suggestion.searchParams.make, model: suggestion.searchParams.model }],
      fuel: suggestion.searchParams.fuel ?? null,
      body_type: suggestion.searchParams.body_type ?? null,
      budget_min: userBudget.min || suggestion.searchParams.budget_min || 20000,
      budget_max: userBudget.max || suggestion.searchParams.budget_max || undefined,
      year_from: suggestion.searchParams.year_from,
      year_to: suggestion.searchParams.year_to,
      transmission: suggestion.searchParams.transmission ?? null,
      drive: suggestion.searchParams.drive ?? null,
      budget: null, color: null, mileage_max: null, mileage_min: null,
      required_options: [], displacement_min: null, displacement_max: null,
      hp_min: null, seats_min: null, purpose_body_types: [],
    }
    setApprovedPrefs(prefsForApproval)

    try {
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [],
          answers,
          triggerSearch: true,
          clientOrderId: crypto.randomUUID(),
          chatPreferences: prefsForApproval,
        }),
      })
      const data = await res.json()
      console.log("[picker] approve response:", { cars: data.cars?.length, searching: data.searching, message: data.message?.slice(0, 50) })

      // If API returned searching:true, it means async job — need to wait
      if (data.searching) {
        console.log("[picker] searching=true, waiting for results...")
        // Poll for results or just use what we got
      }

      const newCars = (data.cars ?? []).map(mapApiCar)
      console.log("[picker] mapped cars:", newCars.length)

      // Append to results
      setResults(prev => {
        const existingUrls = new Set(prev.map(c => (c as any).sourceUrl || (c as any).source_url))
        const unique = newCars.filter((c: CarType) => !existingUrls.has((c as any).sourceUrl || (c as any).source_url))
        return [...prev, ...unique]
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
      setSearchingIndex(null)
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
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [],
          answers,
          triggerSearch: true,
          clientOrderId: crypto.randomUUID(),
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
  }, [answers])

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
    <section className="mx-auto max-w-3xl px-4 py-12" aria-label="AI підбір автомобіля">
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
            loading={loadingSuggestions}
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
            initialPrefs={approvedPrefs}
          />
        </div>
      )}
    </section>
  )
}