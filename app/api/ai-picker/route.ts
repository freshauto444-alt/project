import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
  drive: string | null
  displacement_min: number | null
  displacement_max: number | null
  hp_min: number | null
  seats_min: number | null
  purpose_body_types: string[]
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

// ── Purpose → implicit filter presets ────────────────────────────────────────
// Each purpose sets soft defaults that get merged with explicit user choices.
// Explicit survey answers (body, fuel, etc.) always override these.
interface PurposePreset {
  body_types?: string[]      // preferred body types
  hp_min?: number            // minimum horsepower
  displacement_min?: number  // minimum engine displacement (liters)
  seats_min?: number         // minimum seats
  drive?: string             // preferred drive type
  transmission?: string      // preferred transmission
}

const PURPOSE_PRESETS: Record<string, PurposePreset> = {
  "Щоденні поїздки по місту": {
    body_types: ["Hatchback", "Sedan", "SUV"],
    // compact, fuel-efficient — no hp/displacement constraints
  },
  "Далекі подорожі та автобани": {
    body_types: ["Sedan", "Estate", "SUV"],
    displacement_min: 2.0,
    hp_min: 150,
  },
  "Спорт та драйв": {
    body_types: ["Coupe", "Sedan", "Hatchback", "Convertible"],
    hp_min: 300,
    displacement_min: 2.0,
  },
  "Бізнес та представницький клас": {
    body_types: ["Sedan", "SUV"],
    hp_min: 200,
    displacement_min: 2.0,
  },
  "Для сім'ї з дітьми": {
    body_types: ["SUV", "Van", "Estate"],
    seats_min: 5,
  },
  "Інвестиція / колекціонування": {
    body_types: ["Coupe", "Convertible", "Sedan"],
    hp_min: 250,
  },
}

function extractSearchParams(answers: Answer[]) {
  const byId = Object.fromEntries(answers.map(a => [a.questionId, a]))
  // Budget: selected[0] = min, selected[1] = max (from two-input form)
  const budgetFromStr = byId.budget?.selected[0] ?? ""
  const budgetToStr = byId.budget?.selected[1] ?? byId.budget?.custom ?? ""
  let budgetMin: number | null = null
  let budgetMax: number | null = null

  // Try two separate fields first (new unified picker format)
  const bFrom = parseInt(budgetFromStr.replace(/\D/g, ""))
  const bTo = parseInt(budgetToStr.replace(/\D/g, ""))
  if (!isNaN(bFrom) && bFrom > 0) budgetMin = bFrom
  if (!isNaN(bTo) && bTo > 0) budgetMax = bTo

  // Fallback: legacy single-string format "30000 – 50000"
  if (budgetMin == null && budgetMax == null) {
    const combined = budgetFromStr || budgetToStr
    const rangeMatch = combined.match(/([\d\s]+)\s*[–-]\s*([\d\s]+)/)
    if (rangeMatch) {
      budgetMin = parseInt(rangeMatch[1].replace(/\s/g, ""))
      budgetMax = parseInt(rangeMatch[2].replace(/\s/g, ""))
    } else if (combined.includes("понад")) {
      const m = combined.match(/([\d\s]+)/)
      budgetMin = m ? parseInt(m[1].replace(/\s/g, "")) : null
    }
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
  const driveMap: Record<string, string> = {
    "Передній (FWD)": "FWD", "Задній (RWD)": "RWD", "Повний (AWD/4WD)": "AWD",
  }

  // ── Purpose presets ────────────────────────────────────────────────────
  const purposes = byId.purpose?.selected ?? []
  let purposeBodyTypes: string[] = []
  let purposeHpMin: number | null = null
  let purposeDisplacementMin: number | null = null
  let purposeSeatsMin: number | null = null

  for (const p of purposes) {
    const preset = PURPOSE_PRESETS[p]
    if (!preset) continue
    if (preset.body_types) purposeBodyTypes.push(...preset.body_types)
    if (preset.hp_min && (purposeHpMin == null || preset.hp_min > purposeHpMin))
      purposeHpMin = preset.hp_min
    if (preset.displacement_min && (purposeDisplacementMin == null || preset.displacement_min > purposeDisplacementMin))
      purposeDisplacementMin = preset.displacement_min
    if (preset.seats_min && (purposeSeatsMin == null || preset.seats_min > purposeSeatsMin))
      purposeSeatsMin = preset.seats_min
  }
  // Deduplicate body types from purposes
  purposeBodyTypes = Array.from(new Set(purposeBodyTypes))

  return {
    year_from: yearFrom && !isNaN(yearFrom) ? yearFrom : null,
    year_to: yearTo && !isNaN(yearTo) ? yearTo : null,
    budget_min: budgetMin,
    budget_max: budgetMax,
    fuel: fuelMap[byId.fuel?.selected[0] ?? ""] ?? null,
    transmission: transmissionMap[byId.transmission?.selected[0] ?? ""] ?? null,
    body_type: bodyMap[byId.body?.selected[0] ?? ""] ?? null,
    drive: driveMap[byId.drive?.selected[0] ?? ""] ?? null,
    purpose_body_types: purposeBodyTypes,
    hp_min: purposeHpMin,
    displacement_min: purposeDisplacementMin,
    seats_min: purposeSeatsMin,
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
//  Generate expert comment after search results
// ═══════════════════════════════════════════════════════════════════════════════

async function generateSearchComment(
  foundCars: any[],
  totalCount: number,
  prefs: ChatPreferences | null,
  tags: string[],
): Promise<string> {
  if (totalCount === 0) {
    // No results — still generate via Claude for natural phrasing
    const prompt = `Ти — досвідчений автоконсультант Fresh Auto. Клієнт шукав авто за параметрами: ${JSON.stringify(prefs)}, анкета: ${tags.join(", ") || "не заповнена"}.
Результатів 0. Напиши коротку (2-3 речення) відповідь українською:
- Скажи що за такими параметрами зараз немає авто
- Запропонуй КОНКРЕТНО що змінити (один параметр) щоб з'явились варіанти
Без емодзі, без markdown, без зірочок. Говори як живий консультант.`
    return callClaude(prompt, [], 200)
  }

  const carsDesc = foundCars.slice(0, 6).map((c: any, i: number) => {
    const parts = [
      `${i + 1}. ${c.year ?? "?"} ${c.make} ${c.model}`,
      `€${c.price?.toLocaleString() ?? "?"}`,
      c.mileage ? `${Math.round(c.mileage / 1000)}k км` : null,
      c.engine || null,
      c.horsepower ? `${c.horsepower} к.с.` : null,
      c.fuel_ua || c.fuel || null,
      c.body_type_ua || c.body_type || null,
      c.color_ua || c.color || null,
      c.country_ua || c.country || null,
    ]
    return parts.filter(Boolean).join(", ")
  }).join("\n")

  const prompt = `Ти — досвідчений автоконсультант Fresh Auto. Клієнт шукав авто, знайдено ${totalCount} варіантів.
Параметри: ${JSON.stringify(prefs)}
Анкета: ${tags.join(", ") || "не заповнена"}

Топ авто:
${carsDesc}

Напиши коротку відповідь (3-5 речень) українською:
1. Скажи скільки знайдено (одним словом, не перелічуй критерії — клієнт їх і так знає)
2. Виділи 1-2 найкращих варіанти і поясни ЧОМУ (ціна/якість, пробіг, надійність)
3. Якщо є нюанси — попередь (дорогий сервіс, великий пробіг, рідкісні запчастини)
4. Запропонуй одне уточнення або поради

НЕ повторюй список критеріїв пошуку. НЕ кажи "перегляньте нижче". НЕ використовуй емодзі, markdown, зірочки, нумерацію. Говори як живий експерт одним абзацом.`

  try {
    const comment = await callClaude(prompt, [], 300)
    return comment || `Знайшов ${totalCount} варіантів. Подивіться що підходить, і скажіть якщо потрібно уточнити.`
  } catch {
    return `Знайшов ${totalCount} варіантів. Подивіться що підходить, і скажіть якщо потрібно уточнити.`
  }
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
    drive: null, displacement_min: null, displacement_max: null,
    hp_min: null, seats_min: null, purpose_body_types: [],
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

ПРИВІД:
- "повний привід" / "4х4" / "AWD" → drive: "AWD"
- "передній" / "FWD" → drive: "FWD"
- "задній" / "RWD" → drive: "RWD"

ПОТУЖНІСТЬ:
- "від 300 коней" / "потужний" → hp_min: 300
- "від 200 к.с." → hp_min: 200

Поверни JSON (ОБОВ'ЯЗКОВО усі поля, null якщо не задано):
{
  "pairs": [{"make": "...", "model": "..."}],
  "budget": число EUR або null,
  "fuel": "Petrol"|"Diesel"|"Electric"|"Hybrid" або null,
  "body_type": "Sedan"|"Estate"|"SUV"|"Hatchback"|"Coupe"|"Convertible"|"Van" або null,
  "transmission": "Automatic"|"Manual" або null,
  "drive": "AWD"|"FWD"|"RWD" або null,
  "color": "Black"|"White"|"Grey"|"Blue"|"Red" тощо або null,
  "mileage_max": число км або null,
  "mileage_min": число км або null,
  "hp_min": число (к.с.) або null,
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
      drive: mergeField("drive", prev.drive),
      displacement_min: "displacement_min" in parsed
        ? (typeof parsed.displacement_min === "number" ? parsed.displacement_min : null)
        : prev.displacement_min,
      displacement_max: "displacement_max" in parsed
        ? (typeof parsed.displacement_max === "number" ? parsed.displacement_max : null)
        : prev.displacement_max,
      hp_min: "hp_min" in parsed
        ? (typeof parsed.hp_min === "number" ? parsed.hp_min : null)
        : prev.hp_min,
      seats_min: prev.seats_min,  // only from purpose presets, not from chat
      purpose_body_types: prev.purpose_body_types,  // only from purpose presets
    }
  } catch (e) {
    console.error("[extractFromChat]", e)
    return previous ?? empty
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Ensure client_orders record exists before parser saves cars
// ═══════════════════════════════════════════════════════════════════════════════

async function ensureClientOrder(
  orderId: string,
  searchParams: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = createClient()
    await supabase.from("client_orders").upsert(
      {
        id: orderId,
        client_order_id: orderId,
        status: "pending",
        search_params: searchParams,
      },
      { onConflict: "id" },
    )
  } catch (e) {
    console.error("[ai-picker] ensureClientOrder error:", e)
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
  skipCache: boolean = false,
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
    drive: chat.drive ?? base.drive ?? null,
    displacement_min: chat.displacement_min ?? base.displacement_min ?? null,
    displacement_max: chat.displacement_max ?? null,
    client_order_id: clientOrderId,
    skip_cache: skipCache,
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
  // Merge purpose presets into prefs for filtering
  const filterPrefs: ChatPreferences = {
    ...chat,
    displacement_min: chat.displacement_min ?? base.displacement_min ?? null,
    displacement_max: chat.displacement_max ?? null,
    hp_min: chat.hp_min ?? base.hp_min ?? null,
    seats_min: chat.seats_min ?? base.seats_min ?? null,
    drive: chat.drive ?? base.drive ?? null,
    purpose_body_types: chat.purpose_body_types.length > 0
      ? chat.purpose_body_types
      : base.purpose_body_types ?? [],
  }
  allCars = filterCarsClientSide(allCars, filterPrefs)

  // Only return cars with images (UI filters them out anyway)
  allCars = allCars.filter(c => c.image)

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

  // Year range — hard filter
  if (prefs.year_from != null) {
    filtered = filtered.filter(c => {
      if (!c.year) return true
      return c.year >= prefs.year_from!
    })
  }
  if (prefs.year_to != null) {
    filtered = filtered.filter(c => {
      if (!c.year) return true
      return c.year <= prefs.year_to!
    })
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

  // Drive (AWD/FWD/RWD)
  if (prefs.drive) {
    filtered = filtered.filter(c => {
      const carDrive = (c.drive ?? "").toUpperCase()
      if (!carDrive || carDrive === "UNKNOWN") return true
      const wanted = prefs.drive!.toUpperCase()
      // AWD also matches 4WD, 4x4
      if (wanted === "AWD") return ["AWD", "4WD", "4X4", "ALL"].some(k => carDrive.includes(k))
      return carDrive.includes(wanted)
    })
  }

  // Horsepower minimum (from purpose presets or chat)
  if (prefs.hp_min != null) {
    filtered = filtered.filter(c => {
      const hp = c.horsepower ?? c.hp
      if (!hp) return true // keep if unknown
      return hp >= prefs.hp_min!
    })
  }

  // Seats minimum (from purpose: "Для сім'ї з дітьми" → 5+)
  if (prefs.seats_min != null) {
    filtered = filtered.filter(c => {
      if (!c.seats) return true // keep if unknown
      return c.seats >= prefs.seats_min!
    })
  }

  // Purpose body types (soft filter: if car has known body type, it must match one)
  if (prefs.purpose_body_types.length > 0 && !prefs.body_type) {
    const allowed = prefs.purpose_body_types.map(b => b.toLowerCase())
    filtered = filtered.filter(c => {
      const carBody = (c.body_type ?? c.bodyType ?? "").toLowerCase()
      if (!carBody || carBody === "unknown" || carBody === "other") return true
      return allowed.some(a => carBody.includes(a))
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
    cacheOnly,
  } = await req.json()

  const tags: string[] = []
  answers?.forEach((a: Answer) => {
    a.selected?.forEach((s: string) => tags.push(s))
    if (a.custom?.trim()) tags.push(a.custom.trim())
  })

  // ═══════════════════════════════════════════════════════════════════════════
  //  CACHE ONLY — after survey, search existing DB results without parser
  // ═══════════════════════════════════════════════════════════════════════════

  if (cacheOnly) {
    const base = extractSearchParams(answers ?? [])
    const chat: ChatPreferences = {
      pairs: [],
      fuel: base.fuel, body_type: base.body_type,
      budget: base.budget_max, budget_min: base.budget_min, budget_max: base.budget_max,
      color: null, mileage_max: null, mileage_min: null,
      required_options: [], year_from: base.year_from, year_to: null,
      transmission: base.transmission, drive: base.drive,
      displacement_min: base.displacement_min, displacement_max: null,
      hp_min: base.hp_min, seats_min: base.seats_min,
      purpose_body_types: base.purpose_body_types,
    }

    // Query Supabase for existing parsed cars
    const supabase = createClient()
    let query = supabase
      .from("cars")
      .select("*")
      .in("source_type", ["parser_hot", "parser_featured", "parser_custom"])
      .not("image", "is", null)
      .gte("price", 20000)

    // Apply filters from survey
    const pairs = chat.pairs.filter(p => p.make)
    if (pairs.length === 1) {
      query = query.ilike("make", `%${pairs[0].make}%`)
      if (pairs[0].model) query = query.ilike("model", `%${pairs[0].model}%`)
    }
    if (chat.fuel) query = query.eq("fuel", chat.fuel)
    if (chat.year_from) query = query.gte("year", chat.year_from)
    if (chat.budget_max) query = query.lte("price", chat.budget_max)
    if (chat.budget_min) query = query.gte("price", chat.budget_min)

    const { data } = await query.order("price", { ascending: true }).limit(50)
    let cachedCars = data ?? []

    // Client-side filtering for fields Supabase can't easily filter
    cachedCars = filterCarsClientSide(cachedCars, chat)

    const count = cachedCars.length
    const message = count > 0
      ? await generateSearchComment(cachedCars, count, chat, tags)
      : "За вашими параметрами поки немає готових варіантів у каталозі. Напишіть у чат — я запущу пошук по європейських майданчиках і знайду свіжі пропозиції."

    return NextResponse.json({
      message,
      searching: false,
      cars: cachedCars,
      chatPreferences: chat,
    })
  }

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
    if (!chat.drive && base.drive) chat.drive = base.drive
    // Purpose presets → merge into chat if not overridden by explicit chat values
    if (chat.hp_min == null && base.hp_min != null) chat.hp_min = base.hp_min
    if (chat.seats_min == null && base.seats_min != null) chat.seats_min = base.seats_min
    if (chat.displacement_min == null && base.displacement_min != null) chat.displacement_min = base.displacement_min
    if (chat.purpose_body_types.length === 0 && base.purpose_body_types.length > 0)
      chat.purpose_body_types = base.purpose_body_types

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

    // Detect "more results" requests — skip cache so parser runs fresh
    const lastMsg = (messages as ChatMessage[])?.filter(m => m.role === "user").slice(-1)[0]?.content?.toLowerCase() ?? ""
    const wantsMore = /більше|ще авто|ще варіант|більше варіант|більше авто|more|знайди ще|шукай ще|мало результат/.test(lastMsg)
    const hasPreviousCars = cars && cars.length > 0

    await ensureClientOrder(orderId, chat as unknown as Record<string, unknown>)
    const result = await triggerParser(answers ?? [], orderId, chat, wantsMore || hasPreviousCars)
    const count = result?.count ?? 0
    const foundCars = result?.cars ?? []

    const message = await generateSearchComment(foundCars, count, chat, tags)

    return NextResponse.json({
      message,
      searching: false,
      cars: foundCars,
      chatPreferences: chat,
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  LOAD MORE — button click, always skip cache
  // ═══════════════════════════════════════════════════════════════════════════

  if (loadMore && chatPreferences) {
    const orderId = clientOrderId ?? crypto.randomUUID()
    await ensureClientOrder(orderId, chatPreferences as unknown as Record<string, unknown>)
    const result = await triggerParser(answers ?? [], orderId, chatPreferences, true)
    const count = result?.count ?? 0
    const foundCars = result?.cars ?? []
    const message = count > 0
      ? await generateSearchComment(foundCars, count, chatPreferences, tags)
      : "Більше варіантів за цими параметрами поки немає. Спробуйте трохи змінити критерії — наприклад розширити бюджет або додати ще один тип кузова."
    return NextResponse.json({
      message,
      searching: false,
      cars: result?.cars ?? [],
      chatPreferences,
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  REGULAR CHAT — decide: SEARCH or REPLY
  // ═══════════════════════════════════════════════════════════════════════════

  const hasNoCars = !cars || cars.length === 0
  const carsContext = cars
    ?.slice(0, 8)
    .map(
      (c: any, i: number) => {
        const parts = [
          `${i + 1}. ${c.year ?? "?"} ${c.make} ${c.model}`,
          `€${c.price?.toLocaleString() ?? "?"}`,
          c.mileage ? `${Math.round(c.mileage / 1000)}k км` : null,
          c.engine || null,
          c.horsepower ? `${c.horsepower} к.с.` : null,
          c.fuel_ua || c.fuel || null,
          c.transmission || null,
          c.drive || null,
          c.body_type_ua || c.body_type || null,
          c.color_ua || c.color || null,
          c.country_ua || c.country || null,
        ]
        return parts.filter(Boolean).join(", ")
      },
    )
    .join("\n") ?? ""
  const totalCarsCount = cars?.length ?? 0

  const prefsContext = chatPreferences
    ? `\nПоточні параметри пошуку: ${JSON.stringify(chatPreferences)}`
    : ""

  const systemPrompt = `Ти — досвідчений консультант Fresh Auto з 8-річним стажем підбору та імпорту авто з Європи. Спілкуєшся українською, дружньо але професійно. Не використовуєш емодзі, зірочки, markdown-розмітку.

Критерії клієнта з анкети: ${tags.join(", ") || "не заповнені"}
${prefsContext}

${hasNoCars
    ? "Зараз в каталозі Fresh Auto немає авто за цими критеріями."
    : `В каталозі Fresh Auto (показую ${Math.min(8, totalCarsCount)} з ${totalCarsCount}):\n${carsContext}`}

═══ КОЛИ ВІДПОВІДАТИ TRIGGER_SEARCH ═══

Відповідай ТІЛЬКИ словом TRIGGER_SEARCH (без будь-якого іншого тексту) якщо клієнт уточнює або доповнює параметри пошуку, але марку/модель/тип вже не згадує (тобто це НЕ перше повідомлення з параметром). Наприклад: "лише з панорамою", "пробіг до 80к", "хочу чорний", "ціна до 25000".

В усіх інших випадках відповідай ТІЛЬКИ звичайним текстом — система автоматично запустить пошук за ключовими словами.

═══ ПІСЛЯ ПОШУКУ — ОБОВ'ЯЗКОВО ═══

Після кожного пошуку ти МУСИШ:
1. Виділити 1-2 найкращі варіанти і пояснити ЧОМУ вони найкращі (ціна/якість, пробіг, надійність, комплектація).
2. Коротко попередити про нюанси якщо є (дороге обслуговування, типові проблеми моделі, великий пробіг, вік авто).
3. Запропонувати одне конкретне уточнення щоб покращити вибірку.

НЕ повторюй сухий список критеріїв ("Diesel / Estate / від 2020 / від 5 місць") — клієнт і так знає що шукав.
НЕ кажи "перегляньте нижче" — авто автоматично з'являються під чатом.
НЕ повторюй однакові формулювання — кожна відповідь має бути унікальною.

Приклади ГАРНИХ відповідей після пошуку:
- "Знайшов 12 варіантів. Найцікавіший — Skoda Superb 2021 за 22k, пробіг всього 65 тисяч. Для сімейного універсала це один з найнадійніших варіантів, і запчастини недорогі. Є ще Volvo V60, але він на 4 тисячі дорожчий — зате безпека на вищому рівні."
- "6 авто за вашим бюджетом. Зверніть увагу на Peugeot 3008 — він 2023 року з пробігом 63k, майже новий. Jaguar E-Pace дешевший, але пробіг 126 тисяч для Jaguar — це вже зона дорогого ТО, майте це на увазі."
- "Всього 2 варіанти — чорний універсал на дизелі до 25k це рідкість. Якщо розглянете темно-сірий, варіантів стане помітно більше."

═══ ЕКСПЕРТНІ ЗНАННЯ — використовуй їх ═══

Ти знаєш автомобілі і МУСИШ ділитися знаннями проактивно:
- Надійність: японські марки (Toyota, Honda, Mazda) — найменше проблем. Німецькі (BMW, Audi, Mercedes) — комфортніші, але сервіс дорожчий.
- Пробіг: дизель витримує 200-300k км без проблем, бензин 150-200k. Понад 150k для преміум-авто — зона ризику дорогих ремонтів.
- Вартість володіння: не тільки ціна купівлі, а й страховка, запчастини, витрата палива. Порш чи BMW M-серія — це подвійні витрати на ТО порівняно зі Skoda чи Volvo.
- Рік: авто 2020+ зазвичай мають сучасні системи безпеки (AEB, LKA). Для родини це важливо.
- Привід: AWD зручний взимку, але +10-15% витрата палива і складніший сервіс.

Якщо бачиш що клієнт обирає авто з потенційними проблемами — м'яко попередь. Але не лякай, а інформуй.

═══ СТРАТЕГІЯ УТОЧНЕНЬ ═══

Якщо бракує ключових параметрів — задавай ОДНЕ конкретне питання.
Пріоритет:
1. Марка/модель
2. Бюджет
3. Тип палива
4. Рік від якого
5. Максимальний пробіг

═══ СТИЛЬ ═══

Говори як живий автоексперт, НЕ як бот-довідник.
- Кожна відповідь різна за формулюванням — не повторюйся.
- Будь конкретним — називай моделі, цифри, факти.
- Коротко — 2-4 речення, не простирадла тексту.
- Якщо клієнт питає твою думку — давай чітку рекомендацію з обгрунтуванням.
- Якщо варіантів мало — сам пропонуй що змінити (колір, бюджет +2-3k, кузов) щоб побільшало.

НЕ кажи "я не маю доступу", "зверніться до менеджера" замість пошуку.
НЕ пропонуй зателефонувати ЗАМІСТЬ пошуку — тільки для оформлення.

Менеджер (098 708 19 19) — тільки для оформлення замовлення.
Ціна під ключ: авто + мито 10% + акциз 5% + ПДВ 20% + доставка ~2500 EUR.
Мінімальний бюджет: 20 000 EUR.`

  const lastUserMsg = (messages as ChatMessage[])
    .filter(m => m.role === "user")
    .slice(-1)[0]
    ?.content?.toLowerCase() ?? ""

  // Hard keyword fallback — bypass Claude entirely for obvious search intents
  const searchKeywords = [
    "знайди", "пошукай", "шукай", "більше", "ще авто", "інші варіанти",
    "давай", "так шукай", "покажи", "глянь", "подивись", "пробіг",
    "колір", "шкіра", "панорама", "камера",
    // car brands
    "bmw", "audi", "mercedes", "volkswagen", "vw", "volvo", "skoda", "ford",
    "toyota", "honda", "mazda", "hyundai", "kia", "opel", "renault", "peugeot",
    "seat", "porsche", "tesla", "nissan", "subaru", "mitsubishi", "lexus",
    "jeep", "jaguar", "land rover", "dacia", "fiat", "citroen", "mini",
    // Ukrainian/Russian brand names
    "пасат", "октавіа", "октавия", "гольф", "тигуан",
    "бмв", "ауді", "ауди", "мерс", "мерседес", "вольво", "шкода", "тойота",
    "хюндай", "хундай", "форд", "рено", "пежо", "опель", "нісан",
    "вольцваген", "фольксваген", "фольк",
    // fuel / type
    "дизель", "бензин", "електро", "гібрид", "седан", "суv", "хетч", "позашляховик",
    "універсал", "купе", "автомат", "механіка",
  ]
  const isDirectSearch = searchKeywords.some(k => lastUserMsg.includes(k))

  if (isDirectSearch) {
    return NextResponse.json({
      message: "Зараз гляну що є за вашими критеріями.",
      searching: true,
      clientOrderId: clientOrderId ?? crypto.randomUUID(),
      chatPreferences: chatPreferences ?? null,
    })
  }

  // Single Claude call — returns either TRIGGER_SEARCH or a conversational reply
  const reply = await callClaude(systemPrompt, messages as ChatMessage[], 300)

  if (!reply || reply.includes("TRIGGER_SEARCH")) {
    return NextResponse.json({
      message: "Зараз гляну що є за вашими критеріями.",
      searching: true,
      clientOrderId: clientOrderId ?? crypto.randomUUID(),
      chatPreferences: chatPreferences ?? null,
    })
  }

  return NextResponse.json({
    message: reply,
    chatPreferences: chatPreferences ?? null,
  })
}