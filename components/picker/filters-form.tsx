"use client"

// ═══════════════════════════════════════════════════════════════════════════════
//  Single-page "all filters" form + its building blocks (FilterChip,
//  FilterSection, BodyTypeCard, body pictograms). Extracted from unified-picker.
// ═══════════════════════════════════════════════════════════════════════════════

import type React from "react"
import {
  Armchair, ArrowRight, Briefcase, Building2, Calendar, Check, DollarSign,
  DoorOpen, Fuel, Gauge, MessageSquare, Palette, Plane, RotateCcw, Settings2,
  SlidersHorizontal, Sparkles, TrendingUp, Users, Wrench, Zap,
} from "lucide-react"
import { t, tOpt, type Language } from "@/lib/i18n"
import { COLOR_HEX, QUESTIONS, type Answer } from "./shared"

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

export function AllFiltersForm({
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

