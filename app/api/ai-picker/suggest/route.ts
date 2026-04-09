import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { lookupPriceGuide } from "@/lib/constants"

// ═══════════════════════════════════════════════════════════════════════════════
//  AI Car Suggestion Endpoint
//  Returns 3-5 specific car model suggestions BEFORE any parsing happens.
//  Uses Claude + cached Supabase data for instant (2-3s) responses.
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
      temperature: 0.9,
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

    // ── Step 1: Build price guide from Supabase ──────────────────────────
    let priceGuideText = ""
    let cachedSummary = ""
    const dynamicPriceGuide = new Map<string, { min: number; max: number; count: number }>()

    try {
      const supabase = createClient(supabaseUrl, supabaseKey)

      const priceGuidePromise = supabase
        .from("cars")
        .select("make, model, price")
        .not("price", "is", null)
        .gt("price", 5000)
        .lt("price", 500000)
        .limit(500)

      let filteredQuery = supabase
        .from("cars")
        .select("make, model, year, price, mileage, fuel, body_type")
        .gte("price", prefs.budget_min ?? 20000)
      if (prefs.budget_max) filteredQuery = filteredQuery.lte("price", prefs.budget_max)
      if (prefs.year_from) filteredQuery = filteredQuery.gte("year", prefs.year_from)
      if (prefs.fuel) filteredQuery = filteredQuery.eq("fuel", prefs.fuel)
      if (prefs.body_type) filteredQuery = filteredQuery.eq("body_type", prefs.body_type)
      const filteredPromise = filteredQuery.limit(50).order("price", { ascending: true })

      const [priceResult, filteredResult] = await Promise.all([priceGuidePromise, filteredPromise])

      // Build dynamic price guide
      const pricesByModel = new Map<string, number[]>()
      for (const c of priceResult.data ?? []) {
        const key = `${c.make} ${c.model}`.toLowerCase()
        if (!pricesByModel.has(key)) pricesByModel.set(key, [])
        pricesByModel.get(key)!.push(c.price)
      }
      for (const [key, prices] of pricesByModel) {
        if (prices.length < 2) continue
        prices.sort((a, b) => a - b)
        const trimStart = Math.floor(prices.length * 0.1)
        const trimEnd = Math.max(trimStart + 1, Math.ceil(prices.length * 0.9))
        const trimmed = prices.slice(trimStart, trimEnd)
        dynamicPriceGuide.set(key, {
          min: trimmed[0],
          max: trimmed[trimmed.length - 1],
          count: prices.length,
        })
      }

      if (dynamicPriceGuide.size > 0) {
        const guideLines = [...dynamicPriceGuide.entries()]
          .filter(([_, v]) => v.count >= 2)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 50)
          .map(([name, d]) => `${name}: ${d.min}-${d.max} EUR (${d.count} авто)`)
        priceGuideText = `\n\nРЕАЛЬНІ РИНКОВІ ЦІНИ (з нашої бази):\n${guideLines.join("\n")}`
      }

      const cached = filteredResult.data ?? []
      if (cached.length > 0) {
        const counts: Record<string, { count: number; minPrice: number; maxPrice: number }> = {}
        for (const c of cached) {
          const key = `${c.make} ${c.model}`
          if (!counts[key]) counts[key] = { count: 0, minPrice: Infinity, maxPrice: 0 }
          counts[key].count++
          if (c.price < counts[key].minPrice) counts[key].minPrice = c.price
          if (c.price > counts[key].maxPrice) counts[key].maxPrice = c.price
        }
        const topModels = Object.entries(counts)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 8)
          .map(([name, d]) => `${name}: ${d.minPrice}-${d.maxPrice} EUR (${d.count} шт)`)
          .join("\n")
        cachedSummary = `\n\nДОСТУПНІ ЗАРАЗ В БЮДЖЕТІ КЛІЄНТА:\n${topModels}`
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
    if (prefs.purpose_body_types?.length) prefsDesc.push(`Ціль (кузови): ${prefs.purpose_body_types.join(", ")}`)

    const purposes = body.answers?.find(a => a.questionId === "purpose")?.selected ?? []
    if (purposes.length) prefsDesc.push(`Ціль: ${purposes.join(", ")}`)

    // ── Step 3: Ask Claude for suggestions ───────────────────────────────
    const systemPrompt = `Ти — автоексперт з 15+ років досвіду підбору авто з Європи (Німеччина, Швеція).

КРИТИЧНІ ПРАВИЛА:
1. Ціни ТІЛЬКИ в EUR.
2. Ціни мають бути РЕАЛЬНИМИ — перевіряй чи авто за таку ціну ІСНУЄ на ринку.
3. ВСІ пропозиції повинні ВМІЩУВАТИСЬ в бюджет клієнта.
4. Можеш пропонувати БУДЬ-ЯКІ моделі — але ЦІНА ПОВИННА бути реалістичною.
5. В полі model_display НЕ повторюй марку. Правильно: "3 Series Touring". Неправильно: "BMW 3 Series Touring".
6. Якщо клієнт вказав конкретні марки чи побажання в додатковому тексті — ОБОВ'ЯЗКОВО включи ці марки в рекомендації (мінімум 2-3 з 5).
7. Кожен раз пропонуй РІЗНІ конкретні моделі та комплектації. НЕ повторюй одні й ті самі 5 моделей. Будь креативним — пропонуй різні двигуни, покоління, версії.

Клієнт Fresh Auto шукає авто з Європи (Німеччина, Швеція).
${priceGuideText}
${cachedSummary}

ЗАДАЧА: Запропонуй РІВНО 5 моделей які ТОЧНО вміщуються в бюджет клієнта.

Для пошукових параметрів (model_search):
- BMW: "3er", "5er", "x3", "x5". Mercedes: "c-klasse", "e-klasse", "glc". VW: "golf", "passat", "tiguan". Audi: "a4", "a6", "q5". Volvo: "v60", "xc60". Skoda: "octavia", "superb". Toyota: "rav4", "corolla". Porsche: "cayenne", "macan".

Поверни ТІЛЬКИ JSON масив:
[
  {
    "make": "...",
    "model_display": "повна назва для відображення",
    "model_search": "модель для пошуку на AS24/Mobile.de",
    "yearRange": "2020-2023",
    "priceRange": "25000-32000",
    "whyRecommended": "2-3 речення українською ЧОМУ ця модель підходить.",
    "concerns": "1 речення про нюанси/ризики.",
    "confidence": "high|medium|low"
  }
]`

    // Free text from user (e.g. "щось із мерседеса або ауді")
    const freeTextNote = body.freeText?.trim()
      ? `\n\nКЛІЄНТ НАПИСАВ ДОДАТКОВО: "${body.freeText.trim()}" — це ПРІОРИТЕТ, обов'язково врахуй це побажання при виборі моделей!`
      : ""

    const userMessage = `Параметри клієнта:\n${prefsDesc.join("\n") || "Не вказані конкретні параметри, запропонуй різноманітні варіанти в діапазоні 20000-40000 EUR"}${freeTextNote}`

    console.log("[suggest] preferences:", JSON.stringify(prefs))
    console.log("[suggest] userMessage:", userMessage)

    const raw = await callClaude(systemPrompt, userMessage, 2500)
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()

    const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error("[suggest] No JSON array found:", raw.slice(0, 300))
      return NextResponse.json({
        suggestions: [],
        message: "Не вдалося згенерувати рекомендації. Спробуйте ще раз.",
      })
    }

    let parsed: any[]
    try {
      parsed = JSON.parse(jsonMatch[0])
      if (!Array.isArray(parsed)) throw new Error("Expected JSON array")
    } catch (parseErr) {
      console.error("[suggest] Failed to parse JSON:", parseErr)
      return NextResponse.json({
        suggestions: [],
        message: "AI повернув невалідну відповідь. Спробуйте ще раз.",
      })
    }

    const suggestions: CarSuggestion[] = parsed.map((s: any) => {
      let modelDisplay = s.model_display ?? s.model ?? ""
      const make = s.make ?? ""
      if (modelDisplay.toLowerCase().startsWith(make.toLowerCase())) {
        modelDisplay = modelDisplay.slice(make.length).trim()
      }
      return {
        make,
        model: modelDisplay,
        yearRange: s.yearRange ?? "",
        priceRange: s.priceRange ?? "",
        whyRecommended: s.whyRecommended ?? "",
        concerns: s.concerns ?? "",
        searchParams: {
          make: s.make,
          model: s.model_search ?? s.model ?? "",
          year_from: (() => { const v = parseInt(String(s.yearRange ?? "").split("-")[0]?.replace(/\D/g, "")); return !isNaN(v) && v > 1990 ? v : prefs.year_from ?? 2018; })(),
          year_to: (() => { const v = parseInt(String(s.yearRange ?? "").split("-")[1]?.replace(/\D/g, "") ?? ""); return !isNaN(v) && v > 1990 ? v : prefs.year_to ?? undefined; })(),
          budget_min: (() => { const v = parseInt(String(s.priceRange ?? "").split("-")[0]?.replace(/\D/g, "")); return !isNaN(v) && v > 0 ? v : prefs.budget_min ?? 20000; })(),
          budget_max: (() => { const v = parseInt(String(s.priceRange ?? "").split("-")[1]?.replace(/\D/g, "") ?? ""); return !isNaN(v) && v > 0 ? v : prefs.budget_max ?? undefined; })(),
          fuel: prefs.fuel || undefined,
          transmission: prefs.transmission || undefined,
          body_type: prefs.body_type || undefined,
          drive: prefs.drive || undefined,
        },
      }
    })

    // ── Validate + correct prices ────────────────────────────────────────
    const userMin = prefs.budget_min ?? 20000
    const userMax = prefs.budget_max ?? 999999

    const corrected = suggestions.map(s => {
      const dbKey = `${s.make} ${s.model}`.toLowerCase()
      const dbPrice = dynamicPriceGuide.get(dbKey)
      const staticPrice = lookupPriceGuide(s.make, s.searchParams.model)
      const realPrice = (dbPrice && dbPrice.count >= 2) ? dbPrice : staticPrice

      if (realPrice) {
        s.priceRange = `${realPrice.min}-${realPrice.max}`
        s.searchParams.budget_min = realPrice.min
        s.searchParams.budget_max = realPrice.max
      }
      return s
    }).filter(s => {
      const modelMin = s.searchParams.budget_min ?? 0
      return modelMin <= userMax * 1.15
    })

    return NextResponse.json({
      suggestions: corrected.slice(0, 5),
      cachedCount: 0,
      message: corrected.length === 0
        ? "Не знайдено рекомендацій за цими параметрами. Спробуйте розширити бюджет або змінити тип палива."
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
