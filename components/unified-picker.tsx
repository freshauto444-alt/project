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

interface Suggestion {
  make: string
  model: string
  yearRange: string
  priceRange: string
  whyRecommended: string
  concerns: string
  searchParams: Record<string, any>
}

// ─── Questions ────────────────────────────────────────────────────────────────

const QUESTIONS: Question[] = [
  {
    id: "budget",
    icon: DollarSign,
    title: "Який ваш бюджет?",
    subtitle: "Вкажіть діапазон в EUR",
    multi: false,
    options: [],
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

function buildTags(answers: Answer[]): string[] {
  const tags: string[] = []
  answers.forEach(a => {
    if (a.questionId === "year") {
      const from = a.selected[0] ?? ""
      const to = a.selected[1] ?? ""
      if (from || to) tags.push(from && to ? `${from} – ${to}` : from || to)
    } else if (a.questionId === "budget") {
      const from = a.selected[0] ?? ""
      const to = a.selected[1] ?? ""
      if (from || to) tags.push(to ? `${from} – ${to} EUR` : `${from}+ EUR`)
    } else {
      a.selected.forEach(s => tags.push(s))
      if (a.custom.trim()) tags.push(a.custom.trim())
    }
  })
  return tags
}

// ─── FilterChip ─────────────────────────────────────────────────────────────

function FilterChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-[13px] font-medium transition-all cursor-pointer ${
        selected
          ? "border-[#00e5b4]/50 bg-[#00e5b4]/10 text-[#00e5b4]"
          : "border-white/[0.07] text-white/40 hover:border-[#00e5b4]/30 hover:text-white/70"
      }`}
    >
      {label}
    </button>
  )
}

// ─── FilterSection ──────────────────────────────────────────────────────────

function FilterSection({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <label className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/30">
        <Icon className="h-3.5 w-3.5 text-[#00e5b4]/60" />{title}
      </label>
      {children}
    </div>
  )
}

// ─── AllFiltersForm (single page with all filters) ──────────────────────────

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

  const inputCls = "w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#00e5b4]/40 focus:outline-none transition-colors"
  const selectCls = "w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-[#00e5b4]/40 focus:outline-none transition-colors [&>option]:bg-[#111] [&>option]:text-white"

  return (
    <div className="flex flex-col gap-4">
      {/* AI hint */}
      <div className="flex items-start gap-3 rounded-2xl border border-[#00e5b4]/20 bg-[#00e5b4]/[0.04] px-4 py-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#00e5b4]/60" />
        <p className="text-[13px] leading-relaxed text-white/50">
          Вкажіть бюджет та побажання — AI підбере <strong className="text-white">найкращі варіанти</strong> з AutoScout24, Mobile.de, Bytbil та Blocket
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
            <span className="text-white/20 text-sm">—</span>
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
            <span className="text-white/20 text-sm">—</span>
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
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
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
          className="shrink-0 rounded-xl bg-[#00e5b4] px-6 py-3 text-sm font-semibold text-black hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
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

// ─── SuggestionCard ─────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion, onApprove, approved, loading,
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
          ? "border-[#00e5b4]/40 bg-[#00e5b4]/[0.06]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">
            {suggestion.make} {suggestion.model}
          </h3>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-white/50">
              {suggestion.yearRange}
            </span>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-[#00e5b4]/70">
              {suggestion.priceRange} EUR
            </span>
          </div>
        </div>
        <button
          onClick={onApprove}
          disabled={loading}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
            approved
              ? "bg-[#00e5b4] text-black"
              : "border border-white/[0.07] text-white/70 hover:border-[#00e5b4]/40 hover:text-white"
          }`}
        >
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-[#00e5b4]" />
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

// ─── SuggestionsScreen ──────────────────────────────────────────────────────

function SuggestionsScreen({
  suggestions, loading, onApprove, onSearchAll, onReset, onBack,
  approvedIndices, searchingIndex, error,
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
      <div className="mb-5 flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">AI рекомендує для вас</h2>
          <p className="mt-1 text-sm text-white/35">
            Оберіть моделі, які цікавлять — система знайде найкращі пропозиції
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-xs font-medium text-white/40 hover:text-white hover:border-[#00e5b4]/30 transition-all cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Змінити критерії
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium text-white/25 hover:text-white/50 transition-colors cursor-pointer"
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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#00e5b4]" />
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
              className="mt-2 rounded-xl border border-white/[0.06] py-3 text-sm text-white/40 hover:border-[#00e5b4]/20 hover:text-white/60 transition-all cursor-pointer"
            >
              Або шукати за всіма параметрами без уточнення
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── CriteriaBar ──────────────────────────────────────────────────────────────

function CriteriaBar({ answers, onReset }: { answers: Answer[]; onReset: () => void }) {
  const tags = buildTags(answers)
  if (tags.length === 0) return null
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
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
            className="rounded-xl border border-[#00e5b4]/16 bg-[#00e5b4]/[0.045] px-2.5 py-1 text-[11px] text-[#00e5b4]/70"
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
      className="flex flex-col gap-3 rounded-2xl border border-[#00e5b4]/15 bg-[#00e5b4]/[0.03] p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.2 }}
                className="block h-1.5 w-1.5 rounded-full bg-[#00e5b4]"
              />
            ))}
          </div>
          <span className="text-sm text-white/70">{statusText}</span>
        </div>
        <span className="text-[11px] text-[#00e5b4]/60">{Math.round(progress)}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#00e5b4]/60 to-[#00e5b4]"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <p className="text-[11px] text-white/25">Переглядаю сотні оголошень — зазвичай 1-3 хвилини</p>
    </motion.div>
  )
}

// ─── AIChat ─────────────────────────────────────────────────────────────────

function AIChat({
  answers, cars, onNewCars, onPrefsChange, initialPrefs,
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
          chatPreferences,
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
          chatPreferences,
        }),
      })
      const data = await res.json()
      if (data.chatPreferences) { setChatPreferences(data.chatPreferences); onPrefsChange?.(data.chatPreferences) }
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
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015]">
      <div className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#00e5b4]/18 bg-[#00e5b4]/[0.07]">
          <Sparkles className="h-3.5 w-3.5 text-[#00e5b4]" />
        </div>
        <div>
          <div className="text-sm font-medium text-white">AI-консультант Fresh Auto</div>
          <div className="flex items-center gap-1 text-[10px] text-white/22">
            <motion.span
              animate={{ opacity: searching ? [0.4, 1, 0.4] : 1 }}
              transition={{ duration: 1.2, repeat: searching ? Infinity : 0 }}
              className={`h-1.5 w-1.5 rounded-full ${searching ? "bg-amber-400" : "bg-[#00e5b4]/55"}`}
            />
            {searching ? "Шукаю авто на майданчиках…" : "Fresh Auto • онлайн"}
          </div>
        </div>
      </div>
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
                  ? "rounded-tr-sm bg-[#00e5b4]/[0.07] text-[#00e5b4]"
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
      <div className="flex items-center gap-2 border-t border-white/[0.05] p-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          disabled={searching}
          placeholder={searching ? "Шукаю авто на майданчиках…" : "Напишіть що шукаєте..."}
          className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3.5 py-2.5 text-sm text-white placeholder:text-white/18 outline-none transition-all focus:border-[#00e5b4]/22 disabled:opacity-40"
        />
        <motion.button
          whileTap={{ scale: 0.91 }}
          onClick={send}
          disabled={!input.trim() || loading || searching}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all cursor-pointer ${
            input.trim() && !loading && !searching
              ? "bg-[#00e5b4]/[0.08] text-[#00e5b4] hover:bg-[#00e5b4]/[0.15]"
              : "bg-white/[0.03] text-white/15"
          }`}
        >
          <Send className="h-3.5 w-3.5" />
        </motion.button>
      </div>
    </div>
  )
}

// ─── ResultCard (with source badge + price rating) ──────────────────────────

function ResultCard({ car, onClick, allCars }: { car: CarType; onClick: () => void; allCars: CarType[] }) {
  const totalCost = car.price ? calcTotalCost(car.price) : null
  const source = SOURCE_SITES[(car as any).sourceSite || (car as any).source_site || ""] || null

  const sameMakePrices = allCars
    .filter(c => c.make === car.make && c.price)
    .map(c => c.price!)
  const priceInfo = car.price ? ratePriceVsMarket(car.price, sameMakePrices) : null
  const ratingConfig = priceInfo ? PRICE_RATING_CONFIG[priceInfo.rating] : null

  return (
    <div
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] cursor-pointer transition-all hover:border-white/[0.1] hover:bg-white/[0.03] hover:-translate-y-0.5"
    >
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

      <div className="flex flex-col gap-2 px-3.5 py-2.5">
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

        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm font-semibold text-white">
              {car.price ? `€${car.price.toLocaleString("uk-UA")}` : "—"}
            </div>
            {totalCost && (
              <div className="text-[11px] text-[#00e5b4]/70">
                ~€{totalCost.total.toLocaleString("uk-UA")} під ключ
              </div>
            )}
          </div>
          {ratingConfig && priceInfo && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[10px] font-medium" style={{ color: ratingConfig.color }}>
                {ratingConfig.label}
              </span>
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
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-xs font-medium text-white/40 hover:text-white hover:border-[#00e5b4]/30 transition-all cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Змінити критерії
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium text-white/25 hover:text-white/50 transition-colors cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
          Новий пошук
        </button>
      </div>

      <CriteriaBar answers={answers} onReset={onReset} />
      <AIChat answers={answers} cars={allCars} onNewCars={handleNewCars} onPrefsChange={setChatPrefsRef} initialPrefs={initialPrefs} />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">
          {loading ? "Шукаємо…" : `Знайдено: ${allCars.filter(c => c.image).length} авто`}
        </span>
        {!loading && allCars.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-white/22">
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
              className="rounded-2xl border border-white/[0.07] px-4 py-2 text-sm text-white/45 transition-all hover:border-white/[0.12] hover:text-white/70 cursor-pointer"
            >
              Почати спочатку
            </button>
            <a
              href="/catalog"
              className="rounded-2xl bg-[#00e5b4]/[0.07] px-4 py-2 text-sm text-[#00e5b4] transition-all hover:bg-[#00e5b4]/[0.13]"
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
                <ResultCard car={car} onClick={() => onSelectCar(car)} allCars={allCars} />
              </motion.div>
            ))}
          </div>
          {chatPrefsRef && (
            <div className="flex justify-center pt-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-2xl border border-white/[0.07] px-5 py-2.5 text-sm text-white/50 transition-all hover:border-[#00e5b4]/20 hover:text-[#00e5b4] cursor-pointer disabled:opacity-40"
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

// ─── Main export ──────────────────────────────────────────────────────────────

type Phase = "form" | "suggestions" | "results"

export default function UnifiedPicker({ onSelectCar }: { onSelectCar: (car: CarType) => void }) {
  const [answers, setAnswers] = useState<Answer[]>(EMPTY_ANSWERS)
  const [freeText, setFreeText] = useState("")
  const [results, setResults] = useState<CarType[]>([])
  const [initialPrefs, setInitialPrefs] = useState<any>(null)
  const [loadingResults, setLoadingResults] = useState(false)
  const [phase, setPhase] = useState<Phase>("form")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [approvedIndices, setApprovedIndices] = useState<Set<number>>(new Set())
  const [searchingIndex, setSearchingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userBudget, setUserBudget] = useState<{ min?: number; max?: number }>({})
  const abortRef = useRef<AbortController | null>(null)

  const updateAnswer = useCallback((idx: number, ans: Answer) => {
    setAnswers(prev => prev.map((a, i) => (i === idx ? ans : a)))
  }, [])

  // ── Step 1: After form → get AI suggestions ──────────────────────────
  const fetchSuggestions = useCallback(async (finalAnswers: Answer[], userFreeText?: string) => {
    setPhase("suggestions")
    setLoadingSuggestions(true)
    try {
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

      setUserBudget({ min: budgetMin, max: budgetMax })

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setError(null)

      const res = await fetch("/api/ai-picker/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: {
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
          freeText: userFreeText || undefined,
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
  }, [])

  // ── Step 2: User approves a suggestion → targeted parse ───────────────
  const handleApproveSuggestion = useCallback(async (idx: number) => {
    const suggestion = suggestions[idx]
    if (!suggestion) return

    setSearchingIndex(idx)

    try {
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [],
          answers,
          triggerSearch: true,
          clientOrderId: crypto.randomUUID(),
          chatPreferences: {
            pairs: [{
              make: suggestion.searchParams.make,
              model: suggestion.searchParams.model,
              variant: (suggestion.searchParams as any).model_variant ?? null,
            }],
            fuel: suggestion.searchParams.fuel ?? null,
            // Keep body_type from suggestion — it's already validated by suggest/route.ts
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
          },
        }),
      })
      const data = await res.json()
      const newCars = (data.cars ?? []).map(mapApiCar)

      // Save chatPreferences from suggestion so chat/loadMore inherits make/model
      const suggestionPrefs = data.chatPreferences ?? {
        pairs: [{
          make: suggestion.searchParams.make,
          model: suggestion.searchParams.model,
          variant: (suggestion.searchParams as any).model_variant ?? null,
        }],
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
      setInitialPrefs(suggestionPrefs)

      setResults(prev => {
        const existingUrls = new Set(prev.map(c => (c as any).sourceUrl || (c as any).source_url))
        const unique = newCars.filter((c: CarType) => !existingUrls.has((c as any).sourceUrl || (c as any).source_url))
        return [...prev, ...unique]
      })

      if (newCars.length > 0) {
        setApprovedIndices(prev => new Set(prev).add(idx))
        setPhase("results")
        setLoadingResults(false)
      } else {
        setError(data.message || `За параметрами ${suggestion.make} ${suggestion.model} авто не знайдено. Спробуйте інший варіант.`)
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(`Не вдалося знайти ${suggestion.make} ${suggestion.model}. Спробуйте інший варіант.`)
      }
    } finally {
      setSearchingIndex(null)
    }
  }, [suggestions, answers, userBudget])

  // ── Fallback: search all without suggestions ──────────────────────────
  const handleSearchAll = useCallback(async () => {
    setPhase("results")
    setLoadingResults(true)
    setError(null)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const byId = Object.fromEntries(answers.map(a => [a.questionId, a]))
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

    try {
      const res = await fetch("/api/ai-picker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [],
          answers,
          triggerSearch: true,
          clientOrderId: crypto.randomUUID(),
          chatPreferences: {
            pairs: [],
            fuel: fuelMap[byId.fuel?.selected[0] ?? ""] ?? null,
            body_type: bodyMap[byId.body?.selected[0] ?? ""] ?? null,
            budget_min: userBudget.min || 20000,
            budget_max: userBudget.max || undefined,
            year_from: byId.year?.selected[0] ? parseInt(byId.year.selected[0]) : null,
            year_to: byId.year?.selected[1] ? parseInt(byId.year.selected[1]) : null,
            transmission: transMap[byId.transmission?.selected[0] ?? ""] ?? null,
            drive: driveMap[byId.drive?.selected[0] ?? ""] ?? null,
            budget: null, color: null, mileage_max: null, mileage_min: null,
            required_options: [], displacement_min: null, displacement_max: null,
            hp_min: null, seats_min: null, purpose_body_types: [],
          },
        }),
        signal: controller.signal,
      })
      const data = await res.json()
      setResults((data.cars ?? []).map(mapApiCar))
      if (data.chatPreferences) setInitialPrefs(data.chatPreferences)
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
  }, [answers, userBudget])

  const goBackToForm = useCallback(() => {
    abortRef.current?.abort()
    setPhase("form")
    setSuggestions([])
    setApprovedIndices(new Set())
    setSearchingIndex(null)
    setError(null)
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
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00e5b4]/20 bg-[#00e5b4]/[0.06] px-4 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#00e5b4]" />
          <span className="text-xs font-medium text-[#00e5b4]">AI-підбір</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Знайдіть авто з Європи
        </h1>
        <p className="mt-2 text-base text-white/35">
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
        <div className="mb-6 rounded-3xl border border-white/[0.06] bg-[#080808]/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <AllFiltersForm
            answers={answers}
            onChange={updateAnswer}
            freeText={freeText}
            onFreeTextChange={setFreeText}
            onSubmit={() => {
              try { localStorage.setItem("freshAutoSearch", JSON.stringify(answers)) } catch {}
              fetchSuggestions(answers, freeText)
            }}
            loading={loadingSuggestions}
          />
        </div>
      )}

      {/* Suggestions */}
      {phase === "suggestions" && (
        <div className="rounded-3xl border border-white/[0.06] bg-[#080808]/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
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
        <div className="rounded-3xl border border-white/[0.06] bg-[#080808]/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <ResultsScreen
            answers={answers}
            cars={results}
            loading={loadingResults}
            onSelectCar={onSelectCar}
            onReset={reset}
            onBack={goBackToForm}
            initialPrefs={initialPrefs}
          />
        </div>
      )}
    </section>
  )
}
