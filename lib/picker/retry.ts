// ═══════════════════════════════════════════════════════════════════════════════
//  One-click retry suggestions — when a search returns 0 / few cars, identify
//  the tightest constraint and propose ONE concrete adjustment the frontend can
//  apply. UI chip labels (not AI prompts). Extracted from route.ts.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ChatPreferences } from "./types"

export interface RetrySuggestion {
  label: string                         // UI button label
  prefs: Partial<ChatPreferences>       // diff to merge into current preferences
}

// One-tap "widen the year window" — offered when a search returns few cars and
// the year is likely the limiter. Lowers year_from by 2 and opens the top a bit.
export function buildWidenYearSuggestion(prefs: ChatPreferences): RetrySuggestion {
  const curFrom = prefs.year_from ?? null
  const curTo = prefs.year_to ?? null
  const thisYear = new Date().getFullYear()
  const newFrom = curFrom != null ? Math.max(2010, curFrom - 2) : null
  const newTo = curTo != null ? Math.min(thisYear, curTo + 2) : null
  const range = newFrom != null ? `${newFrom}–${newTo ?? "тепер"}` : `до ${newTo}`
  return {
    label: `Розширити роки (${range})`,
    prefs: { year_from: newFrom, year_to: newTo },
  }
}

export function buildRetrySuggestion(prefs: ChatPreferences | null): RetrySuggestion | null {
  if (!prefs) return null
  // Pick the single tightest constraint to loosen (most likely to unlock results).
  // Always returns SOMETHING — never returns null just because nothing looks tight.
  if (prefs.budget_max != null && prefs.budget_max < 30000) {
    const newMax = prefs.budget_max + 5000
    return { label: `+€5 000 до бюджету (до €${newMax.toLocaleString("uk-UA")} під ключ)`, prefs: { budget_max: newMax } }
  }
  if (prefs.year_from != null && prefs.year_from >= 2022) {
    const newYear = prefs.year_from - 2
    return { label: `Рік від ${newYear} замість ${prefs.year_from}`, prefs: { year_from: newYear } }
  }
  if (prefs.mileage_max != null && prefs.mileage_max < 100000) {
    const newMax = prefs.mileage_max + 50000
    return { label: `+50k пробігу (до ${Math.round(newMax / 1000)}k км)`, prefs: { mileage_max: newMax } }
  }
  if (prefs.color) {
    return { label: `Без обмеження кольору (зараз "${prefs.color}")`, prefs: { color: null } }
  }
  if (prefs.drive === "AWD") {
    return { label: `Будь-який привід (зараз тільки AWD)`, prefs: { drive: null } }
  }
  if (prefs.hp_min != null && prefs.hp_min > 180) {
    const newHp = Math.max(120, prefs.hp_min - 60)
    return { label: `Мін. потужність ${newHp} к.с. замість ${prefs.hp_min}`, prefs: { hp_min: newHp } }
  }
  if (prefs.fuel === "Diesel" || prefs.fuel === "Petrol") {
    return { label: `Будь-яке паливо (зараз "${prefs.fuel === "Diesel" ? "Дизель" : "Бензин"}")`, prefs: { fuel: null } }
  }
  // Fallback: if user has a specific make+model, suggest removing the model constraint
  // (keeps the brand, opens up all models within it).
  if (prefs.pairs && prefs.pairs.length > 0 && prefs.pairs[0].model) {
    const newPairs = prefs.pairs.map(p => ({ make: p.make, model: null }))
    const brands = prefs.pairs.map(p => p.make).filter(Boolean).join(", ")
    return { label: `Усі моделі ${brands || "цього бренду"} (без обмеження моделі)`, prefs: { pairs: newPairs } }
  }
  // Last resort: bump budget +€5k if set; else suggest relaxing year.
  if (prefs.budget_max != null) {
    const newMax = prefs.budget_max + 5000
    return { label: `+€5 000 до бюджету (до €${newMax.toLocaleString("uk-UA")} під ключ)`, prefs: { budget_max: newMax } }
  }
  if (prefs.year_from != null) {
    const newYear = Math.max(2015, prefs.year_from - 2)
    return { label: `Рік від ${newYear}`, prefs: { year_from: newYear } }
  }
  return null
}
