import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { lookupPriceGuide } from "@/lib/constants"

// ═══════════════════════════════════════════════════════════════════════════════
//  AI Car Suggestion Endpoint — v2
//  Strategy: DB-first (real inventory matching user filters exactly).
//  Claude only fills gaps when DB has < 5 models that match strict constraints.
//  Price bounds are intersected with user budget so suggestions never exceed it.
// ═══════════════════════════════════════════════════════════════════════════════

interface CarSuggestion {
  make: string
  model: string
  yearRange: string
  priceRange: string
  whyRecommended: string
  concerns: string
  searchParams: {
    make: string
    model: string
    year_from: number
    year_to?: number
    budget_min?: number
    budget_max?: number
    fuel?: string
    transmission?: string
    body_type?: string
    drive?: string
  }
}

interface SuggestRequest {
  preferences: {
    fuel?: string | null
    body_type?: string | null
    budget_min?: number | null
    budget_max?: number | null
    year_from?: number | null
    year_to?: number | null
    transmission?: string | null
    drive?: string | null
    purpose_body_types?: string[]
  }
  answers?: { questionId: string; selected: string[]; custom: string }[]
  freeText?: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error("[suggest:claude] ANTHROPIC_API_KEY not found")
    return ""
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  })
  const data = await res.json()
  if (data.error) {
    console.error("[suggest:claude] API error:", JSON.stringify(data.error))
    return ""
  }
  return data.content?.[0]?.text?.trim() ?? ""
}

interface DbModelStats {
  make: string
  model: string
  count: number
  minPrice: number
  maxPrice: number
  medianPrice: number
  minYear: number
  maxYear: number
  bodyTypes: Set<string>
  sampleFuel: string | null
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export async function POST(req: Request) {
  try {
    const body: SuggestRequest = await req.json()
    const prefs = body.preferences ?? {}

    const userMin = prefs.budget_min ?? 0
    const userMax = prefs.budget_max ?? 999999
    const bodyTypeFilter = prefs.body_type?.toLowerCase().trim() || null

    // ── Step 1: Query DB with STRICT filters matching user's criteria ────
    const dbStats = new Map<string, DbModelStats>()
    let strictMatchCount = 0

    try {
      const supabase = createClient(supabaseUrl, supabaseKey)

      let q = supabase
        .from("cars")
        .select("make, model, year, price, fuel, body_type")
        .not("price", "is", null)
        .not("make", "is", null)
        .not("model", "is", null)

      if (userMin > 0) q = q.gte("price", userMin)
      if (prefs.budget_max) q = q.lte("price", userMax)
      if (prefs.year_from) q = q.gte("year", prefs.year_from)
      if (prefs.year_to) q = q.lte("year", prefs.year_to)
      if (prefs.fuel) q = q.eq("fuel", prefs.fuel)
      if (prefs.body_type) q = q.eq("body_type", prefs.body_type)

      const { data: strictData, error: strictErr } = await q.limit(1500)
      if (strictErr) console.error("[suggest] strict query error:", strictErr)

      const rows = strictData ?? []
      strictMatchCount = rows.length

      // Group by make+model
      const grouped = new Map<string, { make: string; model: string; prices: number[]; years: number[]; bodyTypes: Set<string>; fuel: string | null }>()
      for (const r of rows) {
        if (!r.make || !r.model || r.price == null) continue
        const key = `${r.make.toLowerCase()}|${r.model.toLowerCase()}`
        let g = grouped.get(key)
        if (!g) {
          g = { make: r.make, model: r.model, prices: [], years: [], bodyTypes: new Set(), fuel: r.fuel ?? null }
          grouped.set(key, g)
        }
        g.prices.push(r.price)
        if (r.year) g.years.push(r.year)
        if (r.body_type) g.bodyTypes.add(r.body_type)
      }

      for (const [key, g] of grouped) {
        if (g.prices.length < 1) continue
        g.prices.sort((a, b) => a - b)
        // Trim outliers 10%-90% when we have enough samples
        let trimmed = g.prices
        if (g.prices.length >= 5) {
          const a = Math.floor(g.prices.length * 0.1)
          const b = Math.max(a + 1, Math.ceil(g.prices.length * 0.9))
          trimmed = g.prices.slice(a, b)
        }
        dbStats.set(key, {
          make: g.make,
          model: g.model,
          count: g.prices.length,
          minPrice: trimmed[0],
          maxPrice: trimmed[trimmed.length - 1],
          medianPrice: median(trimmed),
          minYear: g.years.length ? Math.min(...g.years) : 0,
          maxYear: g.years.length ? Math.max(...g.years) : 0,
          bodyTypes: g.bodyTypes,
          sampleFuel: g.fuel,
        })
      }
    } catch (e) {
      console.error("[suggest] Supabase error:", e)
    }

    // ── Step 2: Build preferences description ───────────────────────────
    const prefsDesc: string[] = []
    if (prefs.budget_min || prefs.budget_max) {
      prefsDesc.push(`Бюджет: ${prefs.budget_min ?? "?"} - ${prefs.budget_max ?? "?"} EUR`)
    }
    if (prefs.fuel) prefsDesc.push(`Паливо: ${prefs.fuel}`)
    if (prefs.body_type) prefsDesc.push(`Кузов: ${prefs.body_type}`)
    if (prefs.year_from) prefsDesc.push(`Рік від: ${prefs.year_from}`)
    if (prefs.year_to) prefsDesc.push(`Рік до: ${prefs.year_to}`)
    if (prefs.transmission) prefsDesc.push(`КПП: ${prefs.transmission}`)
    if (prefs.drive) prefsDesc.push(`Привід: ${prefs.drive}`)
    const purposes = body.answers?.find(a => a.questionId === "purpose")?.selected ?? []
    if (purposes.length) prefsDesc.push(`Ціль: ${purposes.join(", ")}`)

    console.log("[suggest] prefs:", JSON.stringify(prefs))
    console.log("[suggest] DB strict match count:", strictMatchCount, "unique models:", dbStats.size)

    // ── Step 3: Select top DB-backed suggestions ────────────────────────
    // Rank by: count (popularity) * year recency bonus, and require price fits user window
    const dbCandidates = [...dbStats.values()]
      .filter(s => {
        // Already filtered by query, but re-check intersection
        return s.minPrice <= userMax && s.maxPrice >= userMin
      })
      .sort((a, b) => {
        // Prefer models with more samples (more inventory = more confidence)
        if (b.count !== a.count) return b.count - a.count
        return b.maxYear - a.maxYear
      })

    // Helper to build a suggestion from DB stats
    const buildFromDb = (s: DbModelStats): CarSuggestion => {
      // Intersect with user budget for precise bounds
      const pmin = Math.max(s.minPrice, userMin)
      const pmax = Math.min(s.maxPrice, userMax)
      const yFrom = s.minYear || prefs.year_from || 2018
      const yTo = s.maxYear || prefs.year_to || undefined
      const bodyStr = s.bodyTypes.size ? [...s.bodyTypes].join("/") : ""
      return {
        make: s.make,
        model: s.model,
        yearRange: yTo ? `${yFrom}-${yTo}` : `${yFrom}`,
        priceRange: `${Math.round(pmin)}-${Math.round(pmax)}`,
        whyRecommended: `В нашій базі ${s.count} ${s.count === 1 ? "авто" : "авто"} ${s.make} ${s.model} під ваші критерії${bodyStr ? ` (${bodyStr})` : ""}. Медіанна ціна ~${Math.round(s.medianPrice)} EUR.`,
        concerns: "Перевірте історію сервісу та комплектацію перед купівлею.",
        searchParams: {
          make: s.make,
          model: s.model,
          year_from: yFrom,
          year_to: yTo,
          budget_min: Math.round(pmin),
          budget_max: Math.round(pmax),
          fuel: prefs.fuel || undefined,
          transmission: prefs.transmission || undefined,
          body_type: prefs.body_type || undefined,
          drive: prefs.drive || undefined,
        },
      }
    }

    // ── Hybrid mix: take max 2 from DB, let Claude freely propose the rest ──
    // This way користувач бачить і "реальні з бази", і свіжі AI-рекомендації
    // (марка/модель/роки/ціна без точної модифікації).
    const DB_SLOTS = Math.min(2, dbCandidates.length)
    const suggestions: CarSuggestion[] = dbCandidates.slice(0, DB_SLOTS).map(buildFromDb)

    // ── Step 4: Always ask Claude for fresh suggestions (fills 3-5 slots) ──
    const needed = 5 - suggestions.length
    if (needed > 0) {
      const existingKeys = new Set(suggestions.map(s => `${s.make.toLowerCase()}|${s.model.toLowerCase()}`))

      // Tell Claude what we already have & strict constraints
      const existingText = suggestions.length
        ? `Вже вибрані з бази (НЕ повторюй):\n${suggestions.map(s => `- ${s.make} ${s.model} (${s.priceRange} EUR)`).join("\n")}`
        : "Наша база не має жодних авто під ці критерії — запропонуй РЕАЛЬНІ моделі які точно продаються в цьому бюджеті."

      const strictConstraints = [
        userMin > 0 && `Ціна ВІД ${userMin} EUR`,
        prefs.budget_max && `Ціна ДО ${userMax} EUR`,
        prefs.body_type && `Тип кузова: ТІЛЬКИ ${prefs.body_type} (SUV/Estate/Sedan/etc — строго)`,
        prefs.fuel && `Паливо: ТІЛЬКИ ${prefs.fuel}`,
        prefs.year_from && `Рік ВІД ${prefs.year_from}`,
        prefs.year_to && `Рік ДО ${prefs.year_to}`,
      ].filter(Boolean).join("\n")

      const systemPrompt = `Ти — автоексперт з 15+ років підбору авто з Європи (Німеччина, Швеція). Клієнт Fresh Auto.

КРИТИЧНІ ПРАВИЛА:
1. Запропонуй РІВНО ${needed} ${needed === 1 ? "модель" : "моделі"} які ТОЧНО продаються в бюджеті клієнта.
2. ВСІ запропоновані моделі ПОВИННІ мати ціновий діапазон ПОВНІСТЮ всередині бюджету клієнта. НЕ виходь за межі.
3. Для кожної моделі вкажи ВУЗЬКИЙ реалістичний ціновий діапазон (різниця min-max не більше 35% від min). Не "22000-90000" — а "38000-46000".
4. Тип кузова МУСИТЬ точно відповідати — якщо клієнт вибрав SUV, пропонуй ТІЛЬКИ позашляховики (X3, Q5, GLC, XC60, RAV4, Tucson тощо). Якщо Estate — ТІЛЬКИ універсали.
5. В model_display НЕ повторюй марку. Правильно: "X3". Неправильно: "BMW X3".
6. Достатньо вказати марку + модель + діапазон років + діапазон цін. НЕ обов'язково вказувати точну модифікацію двигуна (можеш, якщо впевнений). Це будуть опорні точки для пошуку клієнта.
7. Різноманітність: пропонуй моделі РІЗНИХ брендів, не 5 BMW поспіль.

СТРОГІ КРИТЕРІЇ КЛІЄНТА:
${strictConstraints}

${existingText}

Поверни ТІЛЬКИ JSON масив:
[
  {
    "make": "BMW",
    "model_display": "X3 xDrive20d",
    "model_search": "x3",
    "yearRange": "2020-2022",
    "priceRange": "42000-48000",
    "whyRecommended": "2-3 речення українською чому ця модель підходить клієнту.",
    "concerns": "1 речення про нюанси.",
    "body_type_match": "SUV"
  }
]`

      const freeTextNote = body.freeText?.trim()
        ? `\n\nДОДАТКОВО КЛІЄНТ НАПИСАВ: "${body.freeText.trim()}" — врахуй обов'язково!`
        : ""

      const userMessage = `Параметри клієнта:\n${prefsDesc.join("\n") || "Не вказані конкретні параметри"}${freeTextNote}\n\nЗапропонуй ${needed} ${needed === 1 ? "модель" : "моделі"}.`

      const raw = await callClaude(systemPrompt, userMessage, 2000)
      const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/)

      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          if (Array.isArray(parsed)) {
            for (const s of parsed) {
              let modelDisplay = s.model_display ?? s.model ?? ""
              const make = s.make ?? ""
              if (modelDisplay.toLowerCase().startsWith(make.toLowerCase())) {
                modelDisplay = modelDisplay.slice(make.length).trim()
              }
              const key = `${make.toLowerCase()}|${modelDisplay.toLowerCase()}`
              if (existingKeys.has(key)) continue

              const parseRange = (str: string): [number, number] => {
                const parts = String(str ?? "").split("-").map(p => parseInt(p.replace(/\D/g, "")))
                return [parts[0] || 0, parts[1] || 0]
              }
              const [claimMin, claimMax] = parseRange(s.priceRange)
              const [yFrom, yTo] = parseRange(s.yearRange)

              // Intersect with user budget — ignore Claude's range if it exceeds it
              let finalMin = claimMin && claimMin >= userMin ? claimMin : userMin
              let finalMax = claimMax && claimMax <= userMax ? claimMax : userMax

              // If the claimed range doesn't overlap with user budget, check static guide and try to fit
              if (claimMax && claimMax < userMin) {
                // Claude suggested something below budget — skip
                continue
              }
              if (claimMin && claimMin > userMax) {
                // Claude suggested something above budget — skip
                continue
              }

              // Cross-check with static price guide
              const staticGuide = lookupPriceGuide(make, s.model_search ?? modelDisplay)
              if (staticGuide) {
                // If the entire static range is outside user budget — skip this model
                if (staticGuide.min > userMax || staticGuide.max < userMin) {
                  continue
                }
                // Tighten bounds to the intersection of static guide and user budget
                finalMin = Math.max(staticGuide.min, userMin, finalMin)
                finalMax = Math.min(staticGuide.max, userMax, finalMax || userMax)
              }

              if (finalMin > finalMax) continue

              suggestions.push({
                make,
                model: modelDisplay,
                yearRange: yTo ? `${yFrom}-${yTo}` : `${yFrom || prefs.year_from || 2018}`,
                priceRange: `${finalMin}-${finalMax}`,
                whyRecommended: s.whyRecommended ?? "",
                concerns: s.concerns ?? "",
                searchParams: {
                  make,
                  model: s.model_search ?? modelDisplay,
                  year_from: yFrom > 1990 ? yFrom : prefs.year_from ?? 2018,
                  year_to: yTo > 1990 ? yTo : prefs.year_to ?? undefined,
                  budget_min: finalMin,
                  budget_max: finalMax,
                  fuel: prefs.fuel || undefined,
                  transmission: prefs.transmission || undefined,
                  body_type: prefs.body_type || undefined,
                  drive: prefs.drive || undefined,
                },
              })
              existingKeys.add(key)
              if (suggestions.length >= 5) break
            }
          }
        } catch (err) {
          console.error("[suggest] Claude JSON parse error:", err)
        }
      }
    }

    // ── Step 5: Final hard filter — no suggestion can exceed user budget ─
    const final = suggestions
      .filter(s => {
        const min = s.searchParams.budget_min ?? 0
        const max = s.searchParams.budget_max ?? 999999
        return min <= userMax && max >= userMin
      })
      .slice(0, 5)

    console.log("[suggest] returning", final.length, "suggestions (DB:", dbCandidates.slice(0, 5).length, ", AI fill:", final.length - Math.min(5, dbCandidates.length), ")")

    return NextResponse.json({
      suggestions: final,
      cachedCount: strictMatchCount,
      message: final.length === 0
        ? "Не знайдено рекомендацій під ці критерії. Спробуйте розширити бюджет або змінити фільтри."
        : undefined,
    })
  } catch (e) {
    console.error("[suggest] Error:", e)
    return NextResponse.json(
      { suggestions: [], message: "Виникла помилка. Спробуйте ще раз." },
      { status: 500 },
    )
  }
}
