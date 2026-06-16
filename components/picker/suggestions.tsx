"use client"

// ═══════════════════════════════════════════════════════════════════════════════
//  AI suggestion cards + the suggestions screen. Extracted from unified-picker.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from "framer-motion"
import { Check, ChevronLeft, RotateCcw, Search } from "lucide-react"
import { formatCarTitle } from "@/lib/data"

export interface Suggestion {
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

export function SuggestionsScreen({
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
  thin,
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
  thin: { reason?: string; shown: number } | null
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
          {!loading && thin && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
              <p className="text-sm font-medium text-amber-300">
                Саме таких авто у вказаному бюджеті зараз обмаль.
              </p>
              <p className="mt-1 text-sm text-white/55">
                Показані варіанти трохи дорожчі за вашу суму — це чесні ринкові ціни. Можемо підібрати під замовлення під ваш бюджет або трохи розширте суму, і виборів стане більше.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="/contacts"
                  className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/[0.1] px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/[0.18] transition-all"
                >
                  Підібрати під замовлення
                </a>
                <button
                  onClick={onBack}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Розширити критерії
                </button>
              </div>
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
