import { NextResponse } from "next/server"

// ═══════════════════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════════════════

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface Answer {
  questionId: string
  selected: string[]
  custom: string
}

interface CarPair {
  make: string | null
  model: string | null
}

interface ChatPreferences {
  pairs: CarPair[]
  fuel: string | null
  body_type: string | null
  budget: number | null
  budget_min: number | null
  budget_max: number | null
  color: string | null
  mileage_max: number | null
  mileage_min: number | null
  required_options: string[]
  year_from: number | null
  year_to: number | null
  transmission: string | null
  displacement_min: number | null
  displacement_max: number | null
  offset?: number
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Config
// ═══════════════════════════════════════════════════════════════════════════════

const PARSER_URL = process.env.PARSER_API_URL ?? ""
const PARSER_KEY = process.env.PARSER_API_KEY ?? ""
const MIN_BUDGET = 20000

// ═══════════════════════════════════════════════════════════════════════════════
//  Aliases & Maps
// ═══════════════════════════════════════════════════════════════════════════════

const COLOR_ALIASES: Record<string, string> = {
  "чорний": "Black", "чорна": "Black", "черный": "Black", "black": "Black",
  "білий": "White", "біла": "White", "белый": "White", "white": "White",
  "сірий": "Grey", "сіра": "Grey", "серый": "Grey", "grey": "Grey", "gray": "Grey",
  "синій": "Blue", "синя": "Blue", "синий": "Blue", "blue": "Blue",
  "червоний": "Red", "червона": "Red", "красный": "Red", "red": "Red",
  "зелений": "Green", "зелена": "Green", "зеленый": "Green", "green": "Green",
  "коричневий": "Brown", "коричнева": "Brown", "brown": "Brown",
  "бежевий": "Beige", "бежева": "Beige", "beige": "Beige",
  "сріблястий": "Silver", "срібний": "Silver", "silver": "Silver",
  "помаранчевий": "Orange", "оранжевый": "Orange", "orange": "Orange",
  "жовтий": "Yellow", "жовта": "Yellow", "yellow": "Yellow",
}

const BRAND_ALIASES: Record<string, string> = {
  "ваг": "Volkswagen", "ваг група": "Volkswagen", "вольксваген": "Volkswagen",
  "фольксваген": "Volkswagen", "фольк": "Volkswagen", "vw": "Volkswagen",
  "бмв": "BMW", "бэмвэ": "BMW",
  "мерс": "Mercedes-Benz", "мерседес": "Mercedes-Benz", "мерсик": "Mercedes-Benz",
  "ауді": "Audi", "ауди": "Audi",
  "тойота": "Toyota", "шкода": "Skoda", "škoda": "Skoda",
  "вольво": "Volvo", "кіа": "Kia", "кия": "Kia",
  "хюндай": "Hyundai", "хундай": "Hyundai", "хендай": "Hyundai",
  "форд": "Ford", "пежо": "Peugeot", "рено": "Renault",
  "опель": "Opel", "порше": "Porsche", "тесла": "Tesla",
  "лексус": "Lexus", "субару": "Subaru", "мазда": "Mazda",
  "нісан": "Nissan", "ніссан": "Nissan", "альфа": "Alfa Romeo",
  "ситроен": "Citroen", "сітроен": "Citroen",
}

function normalizeBrand(raw: string): string {
  const key = raw.trim().toLowerCase()
  return BRAND_ALIASES[key] ?? raw.trim()
}

function normalizeColor(text: string): string | null {
  const words = text.toLowerCase().split(/\s+/)
  for (const word of words) {
    if (COLOR_ALIASES[word]) return COLOR_ALIASES[word]
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Extract params from survey answers
// ═══════════════════════════════════════════════════════════════════════════════

function extractSearchParams(answers: Answer[]) {
  const byId = Object.fromEntries(answers.map(a => [a.questionId, a]))
  const budgetStr = byId.budget?.selected[0] ?? byId.budget?.custom ?? ""
  const rangeMatch = budgetStr.match(/([\d\s]+)\s*[–-]\s*([\d\s]+)/)
  let budgetMin: number | null = null
  let budgetMax: number | null = null
  if (rangeMatch) {
    budgetMin = parseInt(rangeMatch[1].replace(/\s/g, ""))
    budgetMax = parseInt(rangeMatch[2].replace(/\s/g, ""))
  } else if (budgetStr.includes("понад")) {
    const m = budgetStr.match(/([\d\s]+)/)
    budgetMin = m ? parseInt(m[1].replace(/\s/g, "")) : null
  } else {
    const plain = parseInt(budgetStr.replace(/\D/g, ""))
    if (!isNaN(plain) && plain > 0) budgetMax = plain
  }
  const yearFromStr = byId.year?.selected[0] ?? byId.year?.custom ?? ""
  const yearToStr = byId.year?.selected[1] ?? ""
  const yearFrom = yearFromStr ? parseInt(yearFromStr) : null
  const yearTo = yearToStr ? parseInt(yearToStr) : null

  const fuelMap: Record<string, string> = {
    "Бензин": "Petrol", "Дизель": "Diesel",
    "Електро": "Electric", "Гібрид": "Hybrid", "Plug-in гібрид": "Hybrid",
  }
  const transmissionMap: Record<string, string> = {
    "Автомат": "Automatic", "Механіка": "Manual",
    "Робот": "Automatic", "Варіатор": "Automatic",
  }
  const bodyMap: Record<string, string> = {
    "Седан": "Sedan", "Хетчбек": "Hatchback", "Універсал": "Estate",
    "Позашляховик": "SUV", "Кросовер": "SUV", "Мінівен": "Van",
    "Купе": "Coupe", "Кабріолет": "Convertible",
  }

  return {
    year_from: yearFrom && !isNaN(yearFrom) ? yearFrom : null,
    year_to: yearTo && !isNaN(yearTo) ? yearTo : null,
    budget_min: budgetMin,
    budget_max: budgetMax,
    fuel: fuelMap[byId.fuel?.selected[0] ?? ""] ?? null,
    transmission: transmissionMap[byId.transmission?.selected[0] ?? ""] ?? null,
    body_type: bodyMap[byId.body?.selected[0] ?? ""] ?? null,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Claude API
// ═══════════════════════════════════════════════════════════════════════════════

async function callClaude(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  })
  const data = await res.json()
  return data.content?.[0]?.text?.trim() ?? ""
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Extract preferences from chat — CUMULATIVE
// ═══════════════════════════════════════════════════════════════════════════════

async function extractFromChat(
  messages: ChatMessage[],
  previous: ChatPreferences | null,
): Promise<ChatPreferences> {
  const empty: ChatPreferences = {
    pairs: [], fuel: null, body_type: null, budget: null,
    budget_min: null, budget_max: null,
    color: null, mileage_max: null, mileage_min: null,
    required_options: [], year_from: null, year_to: null, transmission: null,
    displacement_min: null, displacement_max: null,
  }

  try {
    const userText = messages
      .filter(m => m.role === "user")
      .slice(-8)
      .map(m => m.content)
      .join(" | ")
      .trim()

    if (!userText) return previous ?? empty

    // Include previous preferences as context for the AI
    const prevContext = previous
      ? `\nПопередні параметри клієнта (ЗБЕРІГАЙ якщо не змінено): ${JSON.stringify(previous)}`
      : ""

    const text = await callClaude(
      `Ти витягуєш параметри пошуку авто з повідомлень клієнта. Клієнт пише українською/російською/англійською.
${prevContext}

КРИТИЧНІ ПРАВИЛА (ДОТРИМУЙСЯ СТРОГО):
1. Якщо клієнт ДОДАЄ параметр — зберігай усі попередні, додай новий
2. Якщо клієнт ЗМІНЮЄ параметр — заміни тільки його
3. Якщо клієнт СКАСОВУЄ параметр ("будь-який пробіг", "неважливо", "без обмежень") → постав ЯВНО null
4. ЗАВЖДИ зберігай fuel якщо він вже є в попередніх параметрах, навіть якщо клієнт не згадує його знову
5. ЗАВЖДИ зберігай марку/модель якщо вони вже є в попередніх параметрах

ПРОБІГ:
- "пробіг більше 150к" / "від 150 тис км" → mileage_min: 150000, mileage_max: null
- "пробіг до 100к" → mileage_max: 100000, mileage_min: null
- "будь-який пробіг" / "без урахування пробігу" → mileage_min: null, mileage_max: null

ОБ'ЄМ ДВИГУНА:
- "від 2-х літрів" / "двигун від 2л" / "2.0 і вище" → displacement_min: 2.0, displacement_max: null
- "до 1.6л" / "не більше 1.6" → displacement_min: null, displacement_max: 1.6
- "2.0 TDI" / "2.0 дизель" → displacement_min: 2.0, displacement_max: 2.0
- "1.5-2.0л" → displacement_min: 1.5, displacement_max: 2.0

МАРКИ ТА МОДЕЛІ:
- "бмв 5 серії" / "п'ятірка бмв" → make: "BMW", model: "5 Series"
- "бмв 3" / "трійка бмв" → make: "BMW", model: "3 Series"
- "бмв х5" → make: "BMW", model: "X5"
- "ауді а4" → make: "Audi", model: "A4"
- "пасат" → make: "Volkswagen", model: "Passat"
- "октавія" / "октавия" → make: "Skoda", model: "Octavia"
- "мазда 6" → make: "Mazda", model: "6"

Поверни JSON (ОБОВ'ЯЗКОВО усі поля, null якщо не задано):
{
  "pairs": [{"make": "...", "model": "..."}],
  "budget": число EUR або null,
  "fuel": "Petrol"|"Diesel"|"Electric"|"Hybrid" або null,
  "body_type": "Sedan"|"Estate"|"SUV"|"Hatchback"|"Coupe"|"Convertible"|"Van" або null,
  "transmission": "Automatic"|"Manual" або null,
  "color": "Black"|"White"|"Grey"|"Blue"|"Red" тощо або null,
  "mileage_max": число км або null,
  "mileage_min": число км або null,
  "required_options": ["leather","panorama","carplay","navigation","camera","heated seats"] або [],
  "year_from": число або null,
  "year_to": число або null,
  "displacement_min": число (літри, напр. 2.0) або null,
  "displacement_max": число (літри, напр. 2.0) або null
}

Поверни ТІЛЬКИ JSON.`,
      [{ role: "user", content: userText }],
      350,
    )

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return previous ?? empty
    const parsed = JSON.parse(match[0])

    // Normalize brands
    const pairs: CarPair[] = Array.isArray(parsed.pairs)
      ? parsed.pairs
          .filter((p: any) => p.make || p.model)
          .map((p: any) => ({
            make: p.make ? normalizeBrand(p.make) : null,
            model: p.model ?? null,
          }))
      : previous?.pairs ?? []

    // Color from AI or fallback from text
    let color = parsed.color ?? null
    if (!color) {
      const fullText = messages.filter(m => m.role === "user").slice(-3).map(m => m.content).join(" ")
      color = normalizeColor(fullText)
    }

    // Merge with previous — RESPECT explicit nulls from AI (for parameter resets)
    const prev = previous ?? empty

    // Helper: if key exists in parsed AND is null → user cancelled it → use null
    // If key exists AND has value → user set it → use value
    // If key missing → AI didn't mention it → keep previous
    const mergeField = <T,>(key: string, prevVal: T): T | null => {
      if (key in parsed) return parsed[key] as T | null  // explicit null or new value
      return prevVal  // not mentioned → keep previous
    }

    return {
      pairs: pairs.length > 0 ? pairs : prev.pairs,
      fuel: mergeField("fuel", prev.fuel),
      body_type: mergeField("body_type", prev.body_type),
      budget: typeof parsed.budget === "number" ? parsed.budget : prev.budget,
      budget_min: prev.budget_min,
      budget_max: prev.budget_max,
      color: "color" in parsed ? (parsed.color ?? null) : (color ?? prev.color),
      mileage_max: mergeField("mileage_max", prev.mileage_max),
      mileage_min: mergeField("mileage_min", prev.mileage_min),
      required_options: Array.isArray(parsed.required_options) && parsed.required_options.length > 0
        ? parsed.required_options
        : ("required_options" in parsed && parsed.required_options === null) ? []
        : prev.required_options,
      year_from: "year_from" in parsed
        ? (typeof parsed.year_from === "number" ? parsed.year_from : null)
        : prev.year_from,
      year_to: "year_to" in parsed
        ? (typeof parsed.year_to === "number" ? parsed.year_to : null)
        : prev.year_to,
      transmission: mergeField("transmission", prev.transmission),
      displacement_min: "displacement_min" in parsed
        ? (typeof parsed.displacement_min === "number" ? parsed.displacement_min : null)
        : prev.displacement_min,
      displacement_max: "displacement_max" in parsed
        ? (typeof parsed.displacement_max === "number" ? parsed.displacement_max : null)
        : prev.displacement_max,
    }
  } catch (e) {
    console.error("[extractFromChat]", e)
    return previous ?? empty
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Parser API call
// ═══════════════════════════════════════════════════════════════════════════════

async function callParser(
  payload: Record<string, unknown>,
): Promise<{ count: number; cars: any[] } | null> {
  if (!PARSER_URL) return null
  try {
    const res = await fetch(`${PARSER_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(PARSER_KEY ? { "x-api-key": PARSER_KEY } : {}),
      },
      body: JSON.stringify(payload),
    })
    return await res.json()
  } catch (e) {
    console.error("[ai-picker] parser error:", e)
    return null
  }
}

async function triggerParser(
  answers: Answer[],
  clientOrderId: string,
  chat: ChatPreferences,
) {
  if (!PARSER_URL) return null
  const base = extractSearchParams(answers)

  // Budget: chat preferences > survey answers
  let budgetMin = chat.budget_min ?? base.budget_min
  let budgetMax = chat.budget_max ?? base.budget_max
  if (chat.budget != null && budgetMin == null && budgetMax == null) {
    const margin = Math.round(chat.budget * 0.05)
    budgetMin = Math.max(0, chat.budget - margin)
    budgetMax = chat.budget + margin
  }
  if (budgetMin != null) budgetMin = Math.max(budgetMin, MIN_BUDGET)

  const commonPayload: Record<string, unknown> = {
    year_from: chat.year_from ?? base.year_from,
    year_to: chat.year_to ?? base.year_to,
    budget_min: budgetMin,
    budget_max: budgetMax,
    fuel: chat.fuel ?? base.fuel,
    transmission: chat.transmission ?? base.transmission,
    body_type: chat.body_type ?? base.body_type,
    displacement_min: chat.displacement_min ?? null,
    displacement_max: chat.displacement_max ?? null,
    client_order_id: clientOrderId,
  }

  const pairs: CarPair[] = chat.pairs.length > 0 ? chat.pairs : [{ make: null, model: null }]

  const results = await Promise.all(
    pairs.map(p => callParser({ ...commonPayload, make: p.make, model: p.model })),
  )

  // Deduplicate
  const seenUrls = new Set<string>()
  let allCars: any[] = []
  for (const r of results) {
    if (!r) continue
    for (const car of r.cars ?? []) {
      const key = (car.url ?? car.source_url ?? car.id) as string
      if (key && seenUrls.has(key)) continue
      if (key) seenUrls.add(key)
      allCars.push(car)
    }
  }

  // ── Client-side filtering (params that parser doesn't support) ──────────
  allCars = filterCarsClientSide(allCars, chat)

  return { count: allCars.length, cars: allCars }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Client-side filtering — mileage, color, options
// ═══════════════════════════════════════════════════════════════════════════════

function filterCarsClientSide(cars: any[], prefs: ChatPreferences): any[] {
  let filtered = [...cars]

  // Model filter — if specific model requested, filter results
  if (prefs.pairs.length > 0) {
    const modelsRequested = prefs.pairs
      .filter(p => p.model)
      .map(p => p.model!.toLowerCase())
    
    if (modelsRequested.length > 0) {
      filtered = filtered.filter(c => {
        const carModel = (c.model ?? "").toLowerCase()
        const carMake = (c.make ?? "").toLowerCase()
        // Match if car model contains any of the requested models
        // "5 Series" matches "520d", "530i", "5 Series"
        // "A4" matches "A4", "A4 Avant"
        return modelsRequested.some(reqModel => {
          const reqParts = reqModel.split(/\s+/)
          const reqCore = reqParts[0] // "5" from "5 Series", "m5" from "m5"
          const escaped = reqModel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

          // Word-boundary match: "m5" must NOT match "m50", "m50d", etc.
          if (new RegExp(`\\b${escaped}\\b`).test(carModel)) return true

          // BMW numeric series: "5 series" matches "520d", "530i", "5er", etc.
          if (reqCore.match(/^\d+$/) && (
            carModel.match(new RegExp(`^${reqCore}[\\s\\d]`)) ||
            carModel === reqCore
          )) return true

          return false
        })
      })
    }
  }

  // Fuel — hard filter, never show petrol when diesel requested
  if (prefs.fuel) {
    filtered = filtered.filter(c => {
      const carFuel = (c.fuel ?? c.fuel_ua ?? "").toLowerCase()
      if (!carFuel || carFuel === "unknown") return true
      return carFuel.includes(prefs.fuel!.toLowerCase())
    })
  }

  // Engine displacement
  if (prefs.displacement_min != null || prefs.displacement_max != null) {
    filtered = filtered.filter(c => {
      const eng: string = (c.engine ?? "").toLowerCase()
      // Extract displacement number from engine string e.g. "2.0 Diesel" → 2.0
      const m = eng.match(/\b([1-9]\.\d)\b/)
      if (!m) return true // keep if unknown
      const liters = parseFloat(m[1])
      if (prefs.displacement_min != null && liters < prefs.displacement_min) return false
      if (prefs.displacement_max != null && liters > prefs.displacement_max) return false
      return true
    })
  }

  // Mileage max
  if (prefs.mileage_max) {
    filtered = filtered.filter(c => {
      const km = c.mileage ?? c.mileage_km
      return !km || km <= prefs.mileage_max!
    })
  }

  // Mileage min
  if (prefs.mileage_min) {
    filtered = filtered.filter(c => {
      const km = c.mileage ?? c.mileage_km
      return !km || km >= prefs.mileage_min!
    })
  }

  // Color
  if (prefs.color) {
    filtered = filtered.filter(c => {
      if (!c.color || c.color === "Unknown") return true // keep if unknown
      return c.color.toLowerCase() === prefs.color!.toLowerCase()
    })
  }

  // Required options
  if (prefs.required_options.length > 0) {
    filtered = filtered.filter(c => {
      const allFeatures = [
        ...(c.safety_features ?? []),
        ...(c.comfort_features ?? []),
        ...(c.infotainment ?? []),
        ...(c.features_ua ?? []),
      ].map((f: string) => f.toLowerCase())

      return prefs.required_options.every(opt => {
        const optLower = opt.toLowerCase()
        return allFeatures.some(f => f.includes(optLower))
      })
    })
  }

  return filtered
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Build description of active filters
// ═══════════════════════════════════════════════════════════════════════════════

function describeFilters(chat: ChatPreferences, base: ReturnType<typeof extractSearchParams>): string {
  const parts: string[] = []
  const makes = chat.pairs.map(p => [p.make, p.model].filter(Boolean).join(" ")).join(", ")
  if (makes) parts.push(makes)
  if (chat.fuel) parts.push(chat.fuel)
  if (chat.body_type) parts.push(chat.body_type)
  if (chat.transmission) parts.push(chat.transmission)
  if (chat.year_from && chat.year_to) parts.push(`${chat.year_from}–${chat.year_to}`)
  else if (chat.year_from) parts.push(`від ${chat.year_from}`)
  else if (chat.year_to) parts.push(`до ${chat.year_to}`)

  const bMin = chat.budget_min ?? base.budget_min
  const bMax = chat.budget_max ?? base.budget_max
  if (bMin && bMax) parts.push(`${bMin.toLocaleString()}–${bMax.toLocaleString()}€`)
  else if (bMax) parts.push(`до ${bMax.toLocaleString()}€`)
  else if (chat.budget) parts.push(`~${chat.budget.toLocaleString()}€`)

  if (chat.mileage_min) parts.push(`пробіг від ${(chat.mileage_min / 1000).toFixed(0)}k км`)
  if (chat.mileage_max) parts.push(`пробіг до ${(chat.mileage_max / 1000).toFixed(0)}k км`)
  if (chat.displacement_min != null && chat.displacement_max != null && chat.displacement_min === chat.displacement_max)
    parts.push(`${chat.displacement_min}л`)
  else if (chat.displacement_min != null && chat.displacement_max != null)
    parts.push(`${chat.displacement_min}–${chat.displacement_max}л`)
  else if (chat.displacement_min != null) parts.push(`від ${chat.displacement_min}л`)
  else if (chat.displacement_max != null) parts.push(`до ${chat.displacement_max}л`)
  if (chat.color) parts.push(chat.color)
  if (chat.required_options.length > 0) parts.push(chat.required_options.join(", "))

  return parts.join(" / ") || "без обмежень"
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: Request) {
  const {
    messages,
    answers,
    cars,
    triggerSearch,
    clientOrderId,
    loadMore,
    chatPreferences,
  } = await req.json()

  const tags: string[] = []
  answers?.forEach((a: Answer) => {
    a.selected?.forEach((s: string) => tags.push(s))
    if (a.custom?.trim()) tags.push(a.custom.trim())
  })

  // ═══════════════════════════════════════════════════════════════════════════
  //  TRIGGER SEARCH — parse websites
  // ═══════════════════════════════════════════════════════════════════════════

  if (triggerSearch) {
    const orderId = clientOrderId ?? crypto.randomUUID()
    const base = extractSearchParams(answers ?? [])

    // Extract from chat WITH previous preferences (cumulative)
    const prevPrefs: ChatPreferences | null = chatPreferences ?? null
    const chat = await extractFromChat(messages ?? [], prevPrefs)

    // Merge survey answers as fallback
    if (!chat.budget && base.budget_max) chat.budget = base.budget_max
    if (!chat.budget_min && base.budget_min) chat.budget_min = base.budget_min
    if (!chat.budget_max && base.budget_max) chat.budget_max = base.budget_max
    if (!chat.fuel && base.fuel) chat.fuel = base.fuel
    if (!chat.body_type && base.body_type) chat.body_type = base.body_type
    if (!chat.year_from && base.year_from) chat.year_from = base.year_from
    if (!chat.transmission && base.transmission) chat.transmission = base.transmission

    console.log("[ai-picker] search params:", JSON.stringify(chat))

    // Budget check
    const effectiveBudget = chat.budget ?? chat.budget_max ?? base.budget_max
    if (effectiveBudget != null && effectiveBudget < MIN_BUDGET) {
      return NextResponse.json({
        message: `Fresh Auto працює з авто від ${MIN_BUDGET.toLocaleString()} EUR. З меншим бюджетом складно забезпечити якість та гарантії. Якщо готові розглянути вищий діапазон — із задоволенням допоможу.`,
        searching: false,
        cars: [],
        chatPreferences: chat,
      })
    }

    const result = await triggerParser(answers ?? [], orderId, chat)
    const count = result?.count ?? 0
    const filterDesc = describeFilters(chat, base)

    let message: string
    if (count > 0) {
      message = `Готово, ${count} ${count === 1 ? "варіант" : count < 5 ? "варіанти" : "варіантів"} за критеріями: ${filterDesc}. Перегляньте нижче. Якщо потрібно звузити вибір — скажіть що саме важливо.`
    } else {
      message = `За параметрами (${filterDesc}) зараз нічого не знайшов. Рекомендую розширити пошук — наприклад збільшити бюджет, прибрати обмеження по пробігу або розглянути суміжні моделі. Що скоригуємо?`
    }

    return NextResponse.json({
      message,
      searching: false,
      cars: result?.cars ?? [],
      chatPreferences: chat,
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  LOAD MORE
  // ═══════════════════════════════════════════════════════════════════════════

  if (loadMore && chatPreferences) {
    const offset = chatPreferences.offset ?? 20
    const orderId = clientOrderId ?? crypto.randomUUID()
    const result = await triggerParser(answers ?? [], orderId, chatPreferences)
    const count = result?.count ?? 0
    return NextResponse.json({
      message: count > 0
        ? `Ще ${count} варіантів.`
        : "Всі доступні варіанти вже показані.",
      searching: false,
      cars: result?.cars ?? [],
      chatPreferences: { ...chatPreferences, offset: offset + 20 },
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  REGULAR CHAT — decide: SEARCH or REPLY
  // ═══════════════════════════════════════════════════════════════════════════

  const hasNoCars = !cars || cars.length === 0
  const carsContext = cars
    ?.slice(0, 6)
    .map(
      (c: any, i: number) =>
        `${i + 1}. ${c.year ?? "?"} ${c.make} ${c.model} — €${c.price?.toLocaleString() ?? "?"}, ${c.mileage ? Math.round(c.mileage / 1000) + "k км" : "пробіг ?"}, ${c.fuel_ua || c.fuel || "?"}, ${c.body_type_ua || c.body_type || "?"}, ${c.color_ua || c.color || "?"}`,
    )
    .join("\n") ?? ""

  const prefsContext = chatPreferences
    ? `\nПоточні параметри пошуку: ${JSON.stringify(chatPreferences)}`
    : ""

  const systemPrompt = `Ти — Олексій, досвідчений консультант Fresh Auto з 8-річним стажем підбору та імпорту авто з Європи. Спілкуєшся українською, дружньо але професійно. Не використовуєш емодзі, зірочки, markdown-розмітку.

Критерії клієнта з анкети: ${tags.join(", ") || "не заповнені"}
${prefsContext}

${hasNoCars
    ? "Зараз в каталозі Fresh Auto немає авто за цими критеріями."
    : `В каталозі Fresh Auto:\n${carsContext}`}

═══ ПРАВИЛА ПОШУКУ ═══

Відповідай ТІЛЬКИ словом TRIGGER_SEARCH (без іншого тексту) якщо:
- Клієнт назвав або уточнив конкретний параметр авто (марку, модель, паливо, бюджет, рік, пробіг, кузов, об'єм двигуна)
- Клієнт явно просить шукати / знайти / показати
- Клієнт уточнює або змінює вже задані параметри
- В каталозі є авто але клієнт просить звузити вибір

НЕ відповідай TRIGGER_SEARCH якщо:
- Клієнт написав лише "так" / "давай" / "добре" без конкретного параметру — в такому випадку задай уточнюючий питання
- Клієнт ставить питання або просить пояснення
- Клієнт вперше написав без жодних параметрів

═══ СТРАТЕГІЯ УТОЧНЕНЬ ═══

Якщо у клієнта бракує ключових параметрів — задавай ОДНЕ конкретне питання (не декілька одразу).
Пріоритет уточнень (питай в такому порядку якщо не задано):
1. Марка/модель (якщо не вказано)
2. Бюджет (якщо не вказано)
3. Тип палива — бензин, дизель, електро (якщо не вказано)
4. Рік — від якого (якщо не вказано)
5. Пробіг — максимальний (якщо не вказано і є авто з великим пробігом)

Приклади уточнень:
- "Є конкретна модель чи розглядаєте будь-який кросовер?"
- "Який бюджет орієнтовно?"
- "Бензин чи дизель — є перевага?"
- "Пробіг важливий? Є варіанти від 50k до 200k км."

═══ СТИЛЬ ═══

Ти НЕ бот. Думаєш як автоексперт, не як довідник. Приклади:
- "Octavia на дизелі — правильний вибір, практична і надійна. З якого року дивимось?"
- "Знайшов 20 варіантів. Більшість 1.6 TDI — якщо потрібен об'єм від 2.0, скажіть."
- "Розумію. Покажу тільки 2.0 TDI і вище."
- "З пробігом до 100k буде менше варіантів, але вибірка якісніша."

Після пошуку — коротко прокоментуй результат і запропонуй одне конкретне уточнення.

НЕ кажи "я не маю доступу", "зверніться до менеджера" замість пошуку.
НЕ пропонуй зателефонувати ЗАМІСТЬ пошуку — тільки для оформлення.

Менеджер (098 708 19 19) — тільки для оформлення замовлення.
Ціна під ключ: авто + мито 10% + акциз 5% + ПДВ 20% + доставка ~2500 EUR.
Мінімальний бюджет: 20 000 EUR.`

  const triggerCheck = await callClaude(systemPrompt, messages as ChatMessage[], 15)

  // Keyword fallback
  const lastUserMsg = (messages as ChatMessage[])
    .filter(m => m.role === "user")
    .slice(-1)[0]
    ?.content?.toLowerCase() ?? ""
  const searchKeywords = [
    "знайди", "пошукай", "шукай", "більше", "ще авто", "інші варіанти",
    "давай", "так шукай", "покажи", "глянь", "подивись", "пробіг",
    "від ", "до ", "колір", "шкіра", "панорама", "камера",
  ]
  const isDirectSearch = searchKeywords.some(k => lastUserMsg.includes(k))

  if (triggerCheck.includes("TRIGGER_SEARCH") || isDirectSearch) {
    return NextResponse.json({
      message: "Зараз гляну що є за вашими критеріями.",
      searching: true,
      clientOrderId: clientOrderId ?? crypto.randomUUID(),
      chatPreferences: chatPreferences ?? null,
    })
  }

  // Regular conversation
  const safePrompt =
    systemPrompt +
    "\n\nВАЖЛИВО: Зараз НЕ потрібен пошук. Не пиши TRIGGER_SEARCH. Дай корисну відповідь як консультант."
  const reply = await callClaude(safePrompt, messages as ChatMessage[], 500)
  return NextResponse.json({
    message: reply || "Перепрошую, спробуйте сформулювати інакше.",
    chatPreferences: chatPreferences ?? null,
  })
}