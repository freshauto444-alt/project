"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight, ChevronLeft, Sparkles, Check, Send, RotateCcw,
  Car, Fuel, Settings2, Calendar, Zap, DollarSign, Search,
  SlidersHorizontal, Gauge,
} from "lucide-react"
import type { Car as CarType } from "@/lib/data"

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
    id: "purpose",
    icon: Car,
    title: "Яка ціль придбання автомобіля?",
    subtitle: "Можна обрати декілька або написати свій варіант",
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
    title: "Який тип кузова вас цікавить?",
    subtitle: "Можна обрати декілька або написати свій варіант",
    multi: true,
    options: ["Купе", "Седан", "Позашляховик", "Хетчбек", "Універсал", "Кабріолет"],
  },
  {
    id: "fuel",
    icon: Fuel,
    title: "Тип палива",
    subtitle: "Можна обрати декілька або написати свій варіант",
    multi: true,
    options: ["Бензин", "Дизель", "Електро", "Гібрид", "Plug-in гібрид"],
  },
  {
    id: "year",
    icon: Calendar,
    title: "Від якого року випуску?",
    subtitle: "Оберіть мінімальний рік або напишіть свій",
    multi: false,
    options: ["2018", "2019", "2020", "2021", "2022", "2023", "2024"],
  },
  {
    id: "transmission",
    icon: Settings2,
    title: "Тип трансмісії",
    subtitle: "Оберіть один або напишіть свій варіант",
    multi: false,
    options: ["Автомат", "Механіка", "Робот", "Варіатор"],
  },
  {
    id: "drive",
    icon: Zap,
    title: "Який привід?",
    subtitle: "Оберіть один або напишіть свій варіант",
    multi: false,
    options: ["Передній (FWD)", "Задній (RWD)", "Повний (AWD/4WD)"],
  },
  {
    id: "budget",
    icon: DollarSign,
    title: "Який ваш бюджет?",
    subtitle: "Вкажіть діапазон в EUR",
    multi: false,
    options: [
      "20 000 – 25 000 EUR",
      "25 000 – 30 000 EUR",
      "30 000 – 40 000 EUR",
      "40 000 – 60 000 EUR",
      "60 000 – 80 000 EUR",
      "понад 80 000 EUR",
    ],
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
    a.selected.forEach(s => tags.push(s))
    if (a.custom.trim()) tags.push(a.custom.trim())
  })
  return tags
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 font-mono text-[11px] tracking-widest text-[#00e5b4]/55">
        ПИТАННЯ {current + 1}&nbsp;/&nbsp;{total}
      </span>
      <div className="relative h-px flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-[#00e5b4]/50"
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

function YearScrollPicker({ selected, onSelect }: { selected: string; onSelect: (y: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Only commit selection after the user actually interacts with the picker.
  // Scroll-snap can fire spurious scroll events on mount — ignore those.
  const hasInteracted = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const idx = selected ? YEARS.indexOf(selected) : 0
    if (idx >= 0) el.scrollTop = idx * YEAR_ITEM_H
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
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07]" style={{ height: 5 * YEAR_ITEM_H }}>
      {/* Selected row highlight */}
      <div
        className="pointer-events-none absolute inset-x-0 z-10 border-y border-[#00e5b4]/20 bg-[#00e5b4]/[0.04]"
        style={{ top: 2 * YEAR_ITEM_H, height: YEAR_ITEM_H }}
      />

      <div
        ref={containerRef}
        onScroll={handleScroll}
        onPointerDown={handleInteract}
        onTouchStart={handleInteract}
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
              y === selected ? "text-[#00e5b4]" : "text-white/35"
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
          ? "border-[#00e5b4]/35 bg-[#00e5b4]/[0.07] text-[#00e5b4]"
          : "border-white/[0.07] bg-white/[0.025] text-white/50 hover:border-white/[0.12] hover:text-white/70"
      }`}
    >
      <AnimatePresence>
        {selected && (
          <motion.span
            key="check"
            initial={{ scale: 0, width: 0 }}
            animate={{ scale: 1, width: 16 }}
            exit={{ scale: 0, width: 0 }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#00e5b4]/20"
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
  const canProceed = isYearQuestion || answer.selected.length > 0 || answer.custom.trim().length > 0

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
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[#00e5b4]/20 bg-[#00e5b4]/[0.07]">
          <Icon className="h-4 w-4 text-[#00e5b4]/65" />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-snug text-white">{question.title}</h2>
          <p className="mt-0.5 text-sm text-white/30">{question.subtitle}</p>
        </div>
      </div>

      {/* Options or Year Scroll Picker */}
      {question.id === "year" ? (
        <YearScrollPicker
          selected={answer.selected[0] ?? ""}
          onSelect={y => onChange({ ...answer, selected: [y], custom: "" })}
        />
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
            className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-sm text-white placeholder:text-white/18 outline-none transition-all focus:border-[#00e5b4]/22 focus:bg-white/[0.04]"
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
              ? "bg-[#00e5b4] text-black hover:brightness-110"
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

      {/* Progress bar */}
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

// ─── AIChat ───────────────────────────────────────────────────────────────────

function AIChat({
  answers,
  cars,
  onNewCars,
}: {
  answers: Answer[]
  cars: CarType[]
  onNewCars: (cars: CarType[]) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [clientOrderId, setClientOrderId] = useState<string | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length > 1) return
    const tags = buildTags(answers)
    const intro =
      tags.length > 0
        ? `Знайдено ${cars.length} варіантів за вашими критеріями (${tags.slice(0, 3).join(", ")}${tags.length > 3 ? " та інші" : ""}).${
            cars.length === 0
              ? " Можу запустити пошук на Bytbil, Blocket, AutoScout24 та Mobile.de — знайдемо свіжі авто під ваш запит."
              : " Можу детально розповісти про будь-яке авто або допомогти уточнити підбір."
          }`
        : "Привіт! Я AI-асистент Fresh Auto. Розкажіть що шукаєте — і я підберу найкращі варіанти."
    setMessages([{ role: "assistant", content: intro }])
  }, [cars.length])

  useEffect(() => {
    const el = messagesContainerRef.current; if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading, searching])

  // Після того як AI сказав TRIGGER_SEARCH — запускаємо реальний парсер
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
        }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: "assistant", content: data.message }])
      onNewCars(data.cars ?? [])
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Помилка під час пошуку. Спробуйте ще раз." }])
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
        body: JSON.stringify({ messages: next, answers, cars: cars.slice(0, 8) }),
      })
      const data = await res.json()

      // AI вирішив запустити парсер
      if (data.searching && data.clientOrderId) {
        setMessages(m => [...m, { role: "assistant", content: data.message }])
        setClientOrderId(data.clientOrderId)
        runSearch(data.clientOrderId, next)
        return
      }

      setMessages(m => [...m, { role: "assistant", content: data.message ?? "Вибачте, спробуйте ще раз." }])
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Сталася помилка. Спробуйте ще раз." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015]">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.05] px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#00e5b4]/18 bg-[#00e5b4]/[0.07]">
          <Sparkles className="h-3.5 w-3.5 text-[#00e5b4]" />
        </div>
        <div>
          <div className="text-sm font-medium text-white">AI-асистент</div>
          <div className="flex items-center gap-1 text-[10px] text-white/22">
            <motion.span
              animate={{ opacity: searching ? [0.4, 1, 0.4] : 1 }}
              transition={{ duration: 1.2, repeat: searching ? Infinity : 0 }}
              className={`h-1.5 w-1.5 rounded-full ${searching ? "bg-amber-400" : "bg-[#00e5b4]/55"}`}
            />
            {searching ? "Шукаю авто…" : "Fresh Auto • онлайн"}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex max-h-72 flex-col gap-2.5 overflow-y-auto p-4 scrollbar-thin">
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

        {/* Звичайний typing indicator */}
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

        {/* Банер пошуку на сайтах */}
        {searching && <SearchingBanner />}

        
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-white/[0.05] p-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          disabled={searching}
          placeholder={searching ? "Шукаю авто на майданчиках…" : "Задайте питання про авто..."}
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

// ─── ResultCard ───────────────────────────────────────────────────────────────

function ResultCard({ car, onClick }: { car: CarType; onClick: () => void }) {
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
      </div>
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-3 text-[11px] text-white/32">
          {car.mileage && (
            <span className="flex items-center gap-1">
              <Gauge className="h-3 w-3" />
              {(car.mileage / 1000).toFixed(0)}k km
            </span>
          )}
          {/* @ts-ignore */}
          {(car.fuelUa || car.fuel) && <span>{car.fuelUa || car.fuel}</span>}
          {car.transmission && <span>{car.transmission}</span>}
        </div>
        <div className="text-sm font-semibold text-white">
          {car.price ? `€${car.price.toLocaleString("uk-UA")}` : "—"}
        </div>
      </div>
    </div>
  )
}

// ─── ResultsScreen ────────────────────────────────────────────────────────────

function ResultsScreen({
  answers, cars, loading, onSelectCar, onReset,
}: {
  answers: Answer[]
  cars: CarType[]
  loading: boolean
  onSelectCar: (car: CarType) => void
  onReset: () => void
}) {
  const [allCars, setAllCars] = useState<CarType[]>(cars)
  useEffect(() => { setAllCars(cars) }, [cars])
  const handleNewCars = useCallback((newCars: CarType[]) => {
    setAllCars(newCars)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col gap-5"
    >
      <CriteriaBar answers={answers} onReset={onReset} />

      <AIChat answers={answers} cars={allCars} onNewCars={handleNewCars} />

      {/* Results header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">
          {loading ? "Шукаємо…" : `Знайдено: ${allCars.length} авто`}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {allCars.filter(car => car.image).map((car, i) => (
            <motion.div
              key={car.id ?? `car-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <ResultCard car={car} onClick={() => onSelectCar(car)} />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function UnifiedPicker({ onSelectCar }: { onSelectCar: (car: CarType) => void }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>(EMPTY_ANSWERS)
  const [results, setResults] = useState<CarType[]>([])
  const [loadingResults, setLoadingResults] = useState(false)

  const isDone = step >= QUESTIONS.length

  const updateAnswer = useCallback((idx: number, ans: Answer) => {
    setAnswers(prev => prev.map((a, i) => (i === idx ? ans : a)))
  }, [])

  const fetchResults = useCallback(async (finalAnswers: Answer[]) => {
    setLoadingResults(true)
    try {
      const res = await fetch("/api/ai-picker/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers }),
      })
      const data = await res.json()
      setResults(data.cars ?? [])
    } catch {
      setResults([])
    } finally {
      setLoadingResults(false)
    }
  }, [])

  const goNext = useCallback(() => {
    if (step === QUESTIONS.length - 1) {
      setStep(QUESTIONS.length)
      fetchResults(answers)
    } else {
      setStep(s => s + 1)
    }
  }, [step, answers, fetchResults])

  const goBack = useCallback(() => setStep(s => Math.max(0, s - 1)), [])

  const reset = useCallback(() => {
    setStep(0)
    setAnswers(EMPTY_ANSWERS)
    setResults([])
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-white">AI Підбір автомобіля</h1>
        <p className="mt-2 text-base text-white/32">
          Дайте відповіді на кілька питань і AI знайде ідеальний варіант.
        </p>
      </div>

      <div className="rounded-3xl border border-white/[0.06] bg-[#080808]/80 p-6 shadow-2xl backdrop-blur-xl">
        {!isDone && (
          <div className="mb-6">
            <ProgressBar current={step} total={QUESTIONS.length} />
          </div>
        )}

        <AnimatePresence mode="wait">
          {!isDone ? (
            <QuestionStep
              key={`q-${step}`}
              question={QUESTIONS[step]}
              answer={answers[step]}
              onChange={ans => updateAnswer(step, ans)}
              onNext={goNext}
              onBack={goBack}
              isFirst={step === 0}
              isLast={step === QUESTIONS.length - 1}
            />
          ) : (
            <ResultsScreen
              key="results"
              answers={answers}
              cars={results}
              loading={loadingResults}
              onSelectCar={onSelectCar}
              onReset={reset}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}