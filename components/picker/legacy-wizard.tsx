"use client"

// ═══════════════════════════════════════════════════════════════════════════════
//  LEGACY step-by-step survey wizard (ProgressBar, YearScrollPicker, Chip,
//  QuestionStep). Superseded by the single-page AllFiltersForm — currently NOT
//  rendered anywhere (no "questions" phase). Preserved here in case the stepped
//  flow is brought back; safe to delete if it stays unused.
// ═══════════════════════════════════════════════════════════════════════════════

import { useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Check, ChevronLeft } from "lucide-react"
import { tOpt, tp } from "@/lib/i18n"
import { useSettings } from "@/lib/settings-context"
import { QUESTIONS, type Answer, type Question } from "./shared"

// ─── ProgressBar ─────────────────────────────────────────────────────────────

export function ProgressBar({ current, total }: { current: number; total: number }) {
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

export function YearScrollPicker({
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

export function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
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

export function QuestionStep({
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
