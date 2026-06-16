"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight, ChevronLeft, ChevronRight, ChevronDown, Sparkles, Check, Send, RotateCcw,
  Car, Search, SlidersHorizontal, Gauge,
} from "lucide-react"
import { type Car as CarType, formatCarTitle } from "@/lib/data"
import { calcTotalCost, SOURCE_SITES, ratePriceVsMarket, PRICE_RATING_CONFIG } from "@/lib/constants"
import { upgradeBbcdnUrl } from "@/lib/image-upgrade"
import { t, tOpt, tp, type Language } from "@/lib/i18n"
import { useSettings } from "@/lib/settings-context"
import {
  mapApiCar, streamSearch, makeUuid, buildTags,
  QUESTIONS, EMPTY_ANSWERS,
  type Answer, type Question, type RetrySuggestion, type ChatMessage,
} from "./picker/shared"
import { SuggestionsScreen, type Suggestion } from "./picker/suggestions"
import { AllFiltersForm } from "./picker/filters-form"
import { ResultCard } from "./picker/result-card"

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
  freeText,
  approvedSuggestion,
  rejectedSuggestions,
}: {
  answers: Answer[]
  cars: CarType[]
  onNewCars: (cars: CarType[]) => void
  onPrefsChange?: (prefs: any) => void
  // Journey context — what the user told us up to this point, so the chat
  // doesn't ask things we already know.
  freeText?: string
  approvedSuggestion?: { make: string; model: string; yearRange: string; whyRecommended: string } | null
  rejectedSuggestions?: { make: string; model: string }[]
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
    let intro: string
    if (approvedSuggestion && language === "uk") {
      // Reference the picked card so the chat picks up where the picker left
      // off instead of acting like a stranger. whyRecommended is the AI's own
      // earlier reasoning — repeating it confirms continuity.
      const why = approvedSuggestion.whyRecommended?.split(/[.!?]/)[0]?.trim()
      intro = `Бачу, обрали ${approvedSuggestion.make} ${approvedSuggestion.model} (${approvedSuggestion.yearRange}). ${
        why ? why + ". " : ""
      }Знайдено ${cars.length} варіантів. Можу заглибитись у конкретне авто, порівняти з альтернативою або підстроїти підбір — що цікаво?`
    } else if (approvedSuggestion) {
      intro = `Picked ${approvedSuggestion.make} ${approvedSuggestion.model} (${approvedSuggestion.yearRange}). ${cars.length} matches. Want a deep dive, a comparison, or to refine?`
    } else if (tags.length > 0) {
      intro = language === "uk"
        ? `Знайдено ${cars.length} варіантів за вашими критеріями (${tags.slice(0, 3).join(", ")}${tags.length > 3 ? " та інші" : ""}).${
            cars.length === 0
              ? " Можу запустити пошук на європейських майданчиках — зазвичай знаходжу 15-30 свіжих варіантів. Скажіть що шукаєте."
              : " Можу детально розповісти про будь-яке авто або уточнити підбір."
          }`
        : `Found ${cars.length} matches for your criteria (${tags.slice(0, 3).join(", ")}${tags.length > 3 ? " and more" : ""}).${
            cars.length === 0
              ? " I can search European marketplaces — usually 15-30 fresh options. Tell me what you need."
              : " I can dive into any car or refine the selection."
          }`
    } else {
      intro = tp("chat_intro", language)
    }
    setMessages([{ role: "assistant", content: intro }])
  }, [cars.length, language, approvedSuggestion])

  useEffect(() => {
    const el = messagesContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading, searching])

  // Compact journey-context blob — passed with every chat-side request so
  // the server prompt knows what the user told us before reaching the chat.
  // Keeps server payload stable and easy to drop into a single prompt block.
  const journey = {
    freeText: freeText?.trim() || null,
    approvedSuggestion: approvedSuggestion ?? null,
    rejectedSuggestions: rejectedSuggestions ?? [],
  }

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
          journey,
          prevCount: cars.length, // so the assistant can admit when results didn't change
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
          journey,
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
          journey,
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

function ResultsScreen({
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
  // Set when the suggest stream reports the request is infeasible at the given
  // budget (every pick over budget) — drives the honest "over budget → under-
  // order / widen" banner. NOT triggered by thin parse-history coverage anymore.
  const [thinInfo, setThinInfo] = useState<{ reason?: string; shown: number } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // T9 learning loop: one session id per picker mount + fire-and-forget event
  // logging. Never awaited, never throws — telemetry must not affect the UX.
  const sessionIdRef = useRef<string>(makeUuid())
  const logPickerEvent = useCallback((kind: string, extra: Record<string, unknown>) => {
    try {
      fetch("/api/ai-picker/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ kind, session_id: sessionIdRef.current, ...extra }),
      }).catch(() => {})
    } catch { /* ignore */ }
  }, [])

  const updateAnswer = useCallback((idx: number, ans: Answer) => {
    setAnswers(prev => prev.map((a, i) => (i === idx ? ans : a)))
  }, [])

  // ── Step 1: After questionnaire → get AI suggestions ──────────────────
  const fetchSuggestions = useCallback(async (finalAnswers: Answer[]) => {
    setPhase("suggestions")
    setLoadingSuggestions(true)
    setThinInfo(null)
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
      let thinShown = false // T10: tracked locally (state setter is async)

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
            } else if (event.type === "thin") {
              // Request is infeasible at this budget (all picks over budget) —
              // show the honest "over budget → under-order / widen" note. Arrives
              // before "done".
              setThinInfo({ reason: event.reason, shown: event.shown ?? 0 })
              thinShown = true
            } else if (event.type === "done") {
              setLoadingSuggestions(false)
              streamDone = true
              // T10: funnel entry — how many shown, how many grounded, was it thin.
              logPickerEvent("suggestions_shown", {
                shown: arrived.length,
                grounded: arrived.filter(s => (s as any).grounded).length,
                meta: { thin: thinShown },
              })
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

    // T9: strongest learning signal — the user picked THIS model. Biases future
    // suggestions (read back in /suggest). Fire-and-forget.
    logPickerEvent("suggestion_approved", {
      make: suggestion.make,
      model: suggestion.model,
      body_type: suggestion.searchParams?.body_type ?? null,
      budget_min: suggestion.searchParams?.budget_min ?? null,
      budget_max: suggestion.searchParams?.budget_max ?? null,
      meta: { yearRange: suggestion.yearRange, grounded: (suggestion as any).grounded ?? null },
    })

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

    // Approve search budget. If the user gave their OWN budget → use it strictly.
    // Otherwise fall back to the AI's proposed priceRange, widened by a tiered
    // tolerance that scales with the price level (so the band isn't artificially
    // tight on pricey cars): <50k fixed, 50-100k ±5k, 100-200k ±10k, 200k+ ±20k.
    // Tier is keyed off the range's upper bound. The 20k turnkey floor always holds.
    const hasUserBudget = userBudget.min != null || userBudget.max != null
    let searchBudgetMin = 20000
    let searchBudgetMax: number | undefined = undefined
    if (hasUserBudget) {
      searchBudgetMin = userBudget.min || 20000
      searchBudgetMax = userBudget.max || undefined
    } else {
      const aiMin = suggestion.searchParams.budget_min
      const aiMax = suggestion.searchParams.budget_max
      if (typeof aiMin === "number" && typeof aiMax === "number") {
        const tol = aiMax < 50000 ? 0 : aiMax < 100000 ? 5000 : aiMax < 200000 ? 10000 : 20000
        searchBudgetMin = Math.max(20000, aiMin - tol)
        searchBudgetMax = aiMax + tol
      }
    }

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
            // User's budget if given, else AI range + tiered tolerance (computed above).
            budget_min: searchBudgetMin,
            budget_max: searchBudgetMax,
            // Year filter precedence: explicit form value > AI's yearRange.
            // Passing AI's yearRange to the parser lets AutoScout24 (fregfrom)
            // and mobile.de (minFirstRegistrationDate) filter at the source —
            // way less wasted traffic than tugging all years and filtering
            // client-side. Niche models (Infiniti, narrow E-Class trims) are
            // protected on the server via searchWithFallback's step 3, which
            // drops year if the windowed search returns 0.
            year_from: formYearFrom ?? suggestion.searchParams.year_from ?? null,
            year_to: formYearTo ?? suggestion.searchParams.year_to ?? null,
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

      // T10: conversion + 0-result signal — did the approved pick actually find cars?
      logPickerEvent("search_completed", {
        make: suggestion.make,
        model: suggestion.model,
        found: newCars.length,
        meta: { via: "approve" },
      })

      // Merge new + old, with three safeguards:
      //   1. New cars go FIRST so the latest pick tops the list.
      //   2. Old cars are kept only if their MAKE matches the new pick.
      //      Without this, a Skoda search left old Skodas in the list when
      //      the user switched to a MINI Cooper search — the relevance
      //      sort then bubbled the newer Skodas above the older MINIs.
      //   3. Old cars also have to fit the new pick's budget + year window.
      const sp = suggestion.searchParams
      const newMake = (sp.make ?? "").toLowerCase()
      const newBudgetMin = sp.budget_min ?? null
      const newBudgetMax = sp.budget_max ?? null
      const newYearFrom = sp.year_from ?? null
      const newYearTo = sp.year_to ?? null

      const matchesNewCriteria = (c: CarType): boolean => {
        if (newMake) {
          const carMake = (c.make ?? "").toLowerCase()
          if (carMake && carMake !== newMake && !carMake.includes(newMake) && !newMake.includes(carMake)) {
            return false
          }
        }
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
      const allCars = (data.cars ?? []).map(mapApiCar)
      setResults(allCars)
      logPickerEvent("search_completed", { found: allCars.length, meta: { via: "search_all" } })
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
            thin={thinInfo}
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
            onSelectCar={(car) => {
              // T10: deepest funnel step — a suggestion led to a car the user opened.
              logPickerEvent("car_clicked", {
                make: (car as any).make ?? null,
                model: (car as any).model ?? null,
                meta: { id: (car as any).id ?? null },
              })
              onSelectCar(car)
            }}
            onReset={reset}
            onBack={goBackToForm}
            freeText={freeText}
            approvedSuggestion={(() => {
              const idx = [...approvedIndices][approvedIndices.size - 1]
              const s = idx != null ? suggestions[idx] : null
              return s ? { make: s.make, model: s.model, yearRange: s.yearRange, whyRecommended: s.whyRecommended } : null
            })()}
            rejectedSuggestions={suggestions
              .filter((_, i) => !approvedIndices.has(i))
              .map(s => ({ make: s.make, model: s.model }))}
          />
        </div>
      )}
    </section>
  )
}