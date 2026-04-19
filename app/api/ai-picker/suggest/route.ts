import { NextResponse } from "next/server"

// ═══════════════════════════════════════════════════════════════════════════════
//  AI Car Suggestion Endpoint
//  Returns 5 car model suggestions based purely on Claude's market knowledge.
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
    hp_min?: number | null
    seats_min?: number | null
    displacement_min?: number | null
    purpose_body_types?: string[]
    pairs?: { make: string | null; model: string | null }[]
  }
  answers?: { questionId: string; selected: string[]; custom: string }[]
  freeText?: string
}

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
): Promise<string> {
  let apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
  if (!apiKey) {
    try {
      const fs = await import("fs")
      const path = await import("path")
      const envPath = path.default.join(process.cwd(), ".env.local")
      const envContent = fs.default.readFileSync(envPath, "utf8")
      const match = envContent.match(/ANTHROPIC_API_KEY=(.+)/)
      if (match) apiKey = match[1].trim()
    } catch {}
  }
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
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
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

export async function POST(req: Request) {
  try {
    const body: SuggestRequest = await req.json()
    const prefs = body.preferences ?? {}

    // ── Build preferences description ────────────────────────────────────
    // Fresh Auto minimum budget floor: 20 000 EUR
    const MIN_BUDGET = 20000
    const userMinBudget = Math.max(prefs.budget_min ?? MIN_BUDGET, MIN_BUDGET)
    const userMaxBudget = prefs.budget_max ?? null

    const prefsDesc: string[] = []
    prefsDesc.push(`Бюджет: ${userMinBudget}${userMaxBudget ? ` - ${userMaxBudget}` : "+"} EUR`)
    if (prefs.fuel) prefsDesc.push(`Паливо: ${prefs.fuel}`)
    if (prefs.body_type) prefsDesc.push(`Кузов: ${prefs.body_type}`)
    if (prefs.year_from) prefsDesc.push(`Рік від: ${prefs.year_from}`)
    if (prefs.year_to) prefsDesc.push(`Рік до: ${prefs.year_to}`)
    if (prefs.transmission) prefsDesc.push(`КПП: ${prefs.transmission}`)
    if (prefs.drive) prefsDesc.push(`Привід: ${prefs.drive}`)
    if (prefs.hp_min) prefsDesc.push(`Мін. к.с.: ${prefs.hp_min}`)
    if (prefs.seats_min) prefsDesc.push(`Мін. місць: ${prefs.seats_min}`)
    if (prefs.displacement_min) prefsDesc.push(`Об'єм від: ${prefs.displacement_min}л`)
    if (prefs.purpose_body_types?.length) prefsDesc.push(`Ціль: ${prefs.purpose_body_types.join(", ")}`)

    const purposes = body.answers?.find(a => a.questionId === "purpose")?.selected ?? []
    if (purposes.length) prefsDesc.push(`Призначення: ${purposes.join(", ")}`)

    if (body.freeText?.trim()) prefsDesc.push(`Коментар клієнта: "${body.freeText.trim()}"`)

    // ── Brand constraint ─────────────────────────────────────────────────
    const requestedMakes = (prefs.pairs ?? [])
      .map(p => p.make)
      .filter((m): m is string => !!m)

    const brandConstraint = requestedMakes.length > 0
      ? `\n\n!!! КЛІЄНТ ВКАЗАВ КОНКРЕТНУ МАРКУ: ${requestedMakes.join(", ")}. ВСІ 5 пропозицій — ТІЛЬКИ цієї марки. Пропонуй різні моделі/покоління/комплектації в межах марки. Інші марки — заборонено.`
      : ""

    const budgetConstraint = `\n\n!!! БЮДЖЕТ: ${userMinBudget}${userMaxBudget ? `–${userMaxBudget}` : "+"} EUR. Fresh Auto НЕ працює з авто дешевшими за ${userMinBudget} EUR.\nПропонуй ТІЛЬКИ моделі у яких на європейському ринку (AutoScout24, Mobile.de) реально існують пропозиції В МЕЖАХ ${userMinBudget}${userMaxBudget ? `–${userMaxBudget}` : "+"} EUR. Якщо модель має варіанти тільки ДЕШЕВШІ ${userMinBudget} EUR — не пропонуй. Якщо базова версія дорожча за ${userMaxBudget ?? "максимум"} — теж не пропонуй.`

    // ── Prompt ───────────────────────────────────────────────────────────
    const systemPrompt = `Ти — автоексперт з 15+ років досвіду підбору авто з Європи (Німеччина, Швеція). Знаєш ринкові ціни AutoScout24, Mobile.de, Bytbil, Blocket.

ПРАВИЛА:
1. Ціни ТІЛЬКИ в EUR.
2. priceRange — РЕАЛЬНИЙ ринковий діапазон моделі на європейських сайтах (від найдешевших старих до найновіших комплектацій). Чесно, без обрізання бюджетом.
3. Пропонуй ТІЛЬКИ моделі де нижня межа ринку ≤ бюджет клієнта, щоб пошук реально щось знайшов.
4. Можеш пропонувати будь-які моделі: базові, спортивні, рідкісні — аби ціна була реалістична.
5. В model_display НЕ повторюй марку. Правильно: "3 Series Touring". Неправильно: "BMW 3 Series Touring".
6. Враховуй паливо, кузов, привід, рік — якщо вказано, моделі мають відповідати.
${brandConstraint}${budgetConstraint}

ЗАДАЧА: Запропонуй РІВНО 5 моделей які справді вміщуються в бюджет клієнта на європейському вторинному ринку.

Пошукові параметри (model_search — як у пошуку на AS24/Mobile.de):
- BMW: "3er", "5er", "x3", "x5". Mercedes: "c-klasse", "e-klasse", "glc". VW: "golf", "passat", "tiguan". Audi: "a4", "a6", "q5". Volvo: "v60", "v90", "xc60", "xc90". Skoda: "octavia", "superb", "kodiaq". Toyota: "rav4", "corolla", "camry". Porsche: "cayenne", "macan".

Поверни ТІЛЬКИ JSON масив без markdown, без іншого тексту:
[
  {
    "make": "Volvo",
    "model_display": "V60 Estate (P1/P3)",
    "model_search": "v60",
    "yearRange": "2014-2019",
    "priceRange": "8000-25000",
    "whyRecommended": "2-3 речення українською чому ця модель підходить клієнту",
    "concerns": "1 речення про нюанси чи ризики",
    "confidence": "high|medium|low"
  }
]`

    const userMessage = `Параметри клієнта:\n${prefsDesc.join("\n")}`

    const raw = await callClaude(systemPrompt, userMessage, 2500)
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()

    const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error("[suggest] No JSON array:", raw.slice(0, 300))
      return NextResponse.json({
        suggestions: [],
        message: "Не вдалося згенерувати рекомендації. Спробуйте ще раз.",
      })
    }

    let parsed: any[]
    try {
      parsed = JSON.parse(jsonMatch[0])
      if (!Array.isArray(parsed)) throw new Error("Expected array")
    } catch (e) {
      console.error("[suggest] Parse error:", e, "Raw:", raw.slice(0, 500))
      return NextResponse.json({
        suggestions: [],
        message: "AI повернув невалідну відповідь. Спробуйте ще раз.",
      })
    }

    // ── Build suggestions ────────────────────────────────────────────────
    const userMax = userMaxBudget ?? 999999

    const suggestions: CarSuggestion[] = parsed.map((s: any) => {
      let modelDisplay = s.model_display ?? s.model ?? ""
      const make = s.make ?? ""
      if (modelDisplay.toLowerCase().startsWith(make.toLowerCase())) {
        modelDisplay = modelDisplay.slice(make.length).trim()
      }

      // Parse yearRange "2014-2019" → year_from/year_to
      const yearFromRaw = parseInt(String(s.yearRange ?? "").split("-")[0]?.replace(/\D/g, "") ?? "")
      const yearToRaw = parseInt(String(s.yearRange ?? "").split("-")[1]?.replace(/\D/g, "") ?? "")
      const yearFrom = !isNaN(yearFromRaw) && yearFromRaw > 1990 ? yearFromRaw : prefs.year_from ?? 2018
      const yearTo = !isNaN(yearToRaw) && yearToRaw > 1990 ? yearToRaw : prefs.year_to ?? undefined

      // Parse priceRange — capture market min/max for filtering
      const priceMin = parseInt(String(s.priceRange ?? "").split("-")[0]?.replace(/\D/g, "") ?? "")
      const priceMax = parseInt(String(s.priceRange ?? "").split("-")[1]?.replace(/\D/g, "") ?? "")
      const marketMin = !isNaN(priceMin) && priceMin > 0 ? priceMin : null
      const marketMax = !isNaN(priceMax) && priceMax > 0 ? priceMax : null

      // Clamp displayed priceRange to user's effective budget [userMinBudget, userMax]
      // so user doesn't see "12000-20000" when floor is 20k.
      let displayRange = s.priceRange ?? ""
      if (marketMin != null && marketMax != null) {
        const lo = Math.max(marketMin, userMinBudget)
        const hi = Math.min(marketMax, userMax)
        if (lo <= hi) displayRange = `${lo}-${hi}`
      }

      return {
        make,
        model: modelDisplay,
        yearRange: s.yearRange ?? "",
        priceRange: displayRange,
        whyRecommended: s.whyRecommended ?? "",
        concerns: s.concerns ?? "",
        searchParams: {
          make,
          model: s.model_search ?? s.model ?? "",
          year_from: yearFrom,
          year_to: yearTo,
          budget_min: userMinBudget,
          budget_max: userMax,
          fuel: prefs.fuel || undefined,
          transmission: prefs.transmission || undefined,
          body_type: (() => {
            // SUV-coupes (Cayenne Coupe, X6, X4, GLC Coupe, GLE Coupe, Q8, Macan) are
            // categorized as SUV on AS24/Mobile.de — don't pass body_type=Coupe or it'll return 0.
            const bt = prefs.body_type
            if (!bt) return undefined
            const mdl = (s.model_search ?? s.model ?? "").toLowerCase()
            const suvCoupePatterns = ["cayenne", "x6", "x4", "q8", "macan", "glc", "gle", "urus"]
            if (bt === "Coupe" && suvCoupePatterns.some(p => mdl.includes(p))) return undefined
            return bt
          })(),
          drive: prefs.drive || undefined,
        },
        _marketMin: marketMin,
        _marketMax: marketMax,
      } as CarSuggestion & { _marketMin: number | null; _marketMax: number | null }
    })

    // ── Hard filters: brand match + price range overlaps [userMin, userMax] ──
    const requestedMakesLower = requestedMakes.map(m => m.toLowerCase())

    const filtered = suggestions
      .filter(s => {
        if (requestedMakesLower.length === 0) return true
        return requestedMakesLower.includes((s.make ?? "").toLowerCase())
      })
      .filter(s => {
        const mMin = (s as any)._marketMin
        const mMax = (s as any)._marketMax
        // If AI didn't give a parseable price, trust it
        if (mMin == null && mMax == null) return true
        // Model's range must overlap with [userMinBudget, userMax]
        if (mMin != null && mMin > userMax) return false         // too expensive
        if (mMax != null && mMax < userMinBudget) return false   // too cheap (below 20k floor)
        return true
      })
      .map(s => {
        delete (s as any)._marketMin
        delete (s as any)._marketMax
        return s
      })

    return NextResponse.json({
      suggestions: filtered.slice(0, 5),
      message: filtered.length === 0
        ? "Не знайдено рекомендацій за цими параметрами. Спробуйте розширити бюджет або змінити критерії."
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
