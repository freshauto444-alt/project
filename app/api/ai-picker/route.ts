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
  drive: string | null
  displacement_min: number | null
  displacement_max: number | null
  hp_min: number | null
  seats_min: number | null
  doors: number | null
  interior_material: string | null
  purpose_body_types: string[]
  offset?: number
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Config
// ═══════════════════════════════════════════════════════════════════════════════

// Parser URL/key from env so deployment isn't locked to localhost.
// Evaluated at module load — Next.js hot-reloads modules on env change.
const PARSER_URL = process.env.PARSER_API_URL || "http://localhost:8000"
const PARSER_KEY = process.env.PARSER_API_KEY || "freshauto_secret_2024"
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
  // Premium & exotic — Cyrillic aliases
  "астон": "Aston Martin", "астон мартін": "Aston Martin", "астон мартин": "Aston Martin",
  "бентлі": "Bentley", "бентли": "Bentley",
  "феррарі": "Ferrari", "феррари": "Ferrari",
  "ламборгіні": "Lamborghini", "ламборгини": "Lamborghini", "ламбо": "Lamborghini",
  "мазераті": "Maserati", "мазерати": "Maserati",
  "роллс-ройс": "Rolls-Royce", "роллс ройс": "Rolls-Royce", "ролс": "Rolls-Royce",
  "інфініті": "Infiniti", "инфинити": "Infiniti", "інфініти": "Infiniti",
  "акура": "Acura",
  "смарт": "Smart",
  "абарт": "Abarth",
  "альпін": "Alpine", "альпин": "Alpine",
  "купра": "Cupra",
  "ленд ровер": "Land Rover", "ленд-ровер": "Land Rover", "ровер": "Land Rover",
  "ягуар": "Jaguar",
  "мітсубісі": "Mitsubishi", "мицубиси": "Mitsubishi", "мітсу": "Mitsubishi",
  "сузукі": "Suzuki", "сузуки": "Suzuki",
  "дачія": "Dacia", "дачия": "Dacia",
  "фіат": "Fiat", "фиат": "Fiat",
  "дженезіс": "Genesis", "дженезис": "Genesis",
  "крайслер": "Chrysler",
  "додж": "Dodge",
  "сеат": "SEAT", "сіат": "SEAT",
  "сааб": "Saab",
  "хонда": "Honda",
  "міні": "MINI", "мини": "MINI",
  "джип": "Jeep",
  "дс": "DS Automobiles", "ds": "DS Automobiles",
}

function normalizeBrand(raw: string): string {
  const key = raw.trim().toLowerCase()
  return BRAND_ALIASES[key] ?? raw.trim()
}

// Strip trailing generation markers from model slugs so AS24/mobile.de
// receive valid paths. AI sometimes returns "passat b9" / "x5 g05" / "a4 b9"
// instead of the base model — AS24 has no /volkswagen/passat-b9 page, so the
// whole search returns 0 even though /volkswagen/passat is the correct URL.
// Matches: B9, W213, F30, G05, C8, E46 — letter + 1-3 digits at the end of
// the model, separated by space or hyphen. Single-word models are unchanged.
//
// Exception: AMG/M/RS performance trims look the same syntactically (e63, m5)
// but are model variants, not generation codes — preserve them when the prefix
// is a performance label or empty.
function stripGenerationSuffix(model: string | null | undefined): string | null {
  if (!model) return model ?? null
  const trimmed = model.trim()
  // Body-type suffix: "Cooper 3 Door" / "C3 5-Door" — AI sometimes tacks the
  // body variant onto the model name. Parser then asks AS24 for /mini/3-door
  // (404). Strip the suffix; downstream body_type filter still narrows.
  const noBody = trimmed.replace(/[\s-]+[35][\s-]?door[s]?$/i, "").trim() || trimmed
  const match = noBody.match(/^(.*?)[\s-]+[bwfgce]\d{1,3}$/i)
  if (!match) return noBody
  const base = match[1].trim()
  // Performance prefixes — "amg e63", "m e63" etc. keep the full string.
  if (/^(amg|m|rs|s|gt)$/i.test(base)) return noBody
  return base || noBody
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

// Purpose presets — SOFT recommendations only (body types).
// hp_min/displacement removed: they filter out too many valid results.
// AI suggestion prompt uses purpose for better recommendations instead.
const PURPOSE_PRESETS: Record<string, PurposePreset> = {
  "Місто": {
    body_types: ["Hatchback", "Sedan", "SUV"],
  },
  "Подорожі": {
    body_types: ["Sedan", "Estate", "SUV"],
  },
  "Спорт": {
    body_types: ["Coupe", "Sedan", "Hatchback", "Convertible"],
  },
  "Бізнес": {
    body_types: ["Sedan", "SUV"],
  },
  "Сім'я": {
    body_types: ["SUV", "Van", "Estate"],
    seats_min: 5,
  },
  "Робота": {
    body_types: ["Van", "Estate", "Pickup"],
  },
  "Інвестиція": {
    body_types: ["Coupe", "Convertible", "Sedan"],
  },
}

function extractSearchParams(answers: Answer[]) {
  const byId = Object.fromEntries(answers.map(a => [a.questionId, a]))
  const cleanNum = (s: string) => parseInt(s.replace(/[\s\u00a0\u2009,.]/g, "").replace(/\D/g, ""))
  let budgetMin: number | null = null
  let budgetMax: number | null = null

  // Picker stores budget as two separate slots: selected[0]=from, selected[1]=to.
  // PRIMARY path — read both independently. Previously we only looked at
  // selected[0] and parsed a range string from it, which meant a "до 40k"
  // filter (which lives in selected[1]) was silently dropped.
  const fromSlot = byId.budget?.selected[0] ?? ""
  const toSlot = byId.budget?.selected[1] ?? ""
  if (fromSlot || toSlot) {
    const fromVal = cleanNum(fromSlot)
    const toVal = cleanNum(toSlot)
    if (!isNaN(fromVal) && fromVal > 0) budgetMin = fromVal
    if (!isNaN(toVal) && toVal > 0) budgetMax = toVal
  }

  // FALLBACK — legacy single-string budget ("30000-50000", "до 40000", "понад 50k")
  // for older payload shapes. Only kicks in if the two-slot read produced nothing.
  if (budgetMin === null && budgetMax === null) {
    const budgetStr = byId.budget?.custom ?? byId.budget?.selected[0] ?? ""
    const rangeMatch = budgetStr.match(/([\d\s\u00a0\u2009,.]+)\s*[–\-—]\s*([\d\s\u00a0\u2009,.]+)/)
    if (rangeMatch) {
      const min = cleanNum(rangeMatch[1])
      const max = cleanNum(rangeMatch[2])
      if (!isNaN(min) && min > 0) budgetMin = min
      if (!isNaN(max) && max > 0) budgetMax = max
    } else if (/понад|більше|від|more|from/i.test(budgetStr)) {
      const m = budgetStr.match(/([\d\s\u00a0,.]+)/)
      if (m) { const v = cleanNum(m[1]); if (!isNaN(v) && v > 0) budgetMin = v }
    } else if (/до|менше|less|under|max/i.test(budgetStr)) {
      const m = budgetStr.match(/([\d\s\u00a0,.]+)/)
      if (m) { const v = cleanNum(m[1]); if (!isNaN(v) && v > 0) budgetMax = v }
    } else {
      const plain = cleanNum(budgetStr)
      if (!isNaN(plain) && plain > 0) budgetMax = plain
    }
  }
  const yearFromStr = byId.year?.selected[0] ?? byId.year?.custom ?? ""
  const yearToStr = byId.year?.selected[1] ?? ""
  const yearFrom = yearFromStr ? parseInt(yearFromStr) : null
  const yearTo = yearToStr ? parseInt(yearToStr) : null

  const fuelMap: Record<string, string> = {
    "Бензин": "Petrol", "Дизель": "Diesel",
    "Електро": "Electric", "Гібрид": "Hybrid", "Plug-in гібрид": "Hybrid",
    "Газ (LPG)": "LPG", "Газ (CNG)": "CNG",
    "Етанол": "Ethanol", "Водень": "Hydrogen",
  }
  const transmissionMap: Record<string, string> = {
    "Автомат": "Automatic", "Механіка": "Manual",
    "Робот": "Automatic", "Варіатор": "Automatic",
    "Робот (DSG/DCT)": "Automatic", "Варіатор (CVT)": "Automatic",
  }
  const bodyMap: Record<string, string> = {
    "Седан": "Sedan", "Хетчбек": "Hatchback", "Універсал": "Estate",
    "Позашляховик": "SUV", "Кросовер": "SUV", "Мінівен": "Van",
    "Мікроавтобус": "Van", "Купе": "Coupe", "Кабріолет": "Convertible",
    "Пікап": "Pickup", "Вантажівка": "Truck", "Автобус": "Bus",
    "Мотоцикл": "Motorcycle", "Багі": "Buggy", "Спецтехніка": "Special",
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
    // Use MIN across purposes (user wants cars matching ANY purpose, not strictest)
    if (preset.hp_min && (purposeHpMin == null || preset.hp_min < purposeHpMin))
      purposeHpMin = preset.hp_min
    if (preset.displacement_min && (purposeDisplacementMin == null || preset.displacement_min < purposeDisplacementMin))
      purposeDisplacementMin = preset.displacement_min
    if (preset.seats_min && (purposeSeatsMin == null || preset.seats_min > purposeSeatsMin))
      purposeSeatsMin = preset.seats_min
  }
  // Deduplicate body types from purposes
  purposeBodyTypes = Array.from(new Set(purposeBodyTypes))

  // ── New filter fields (mileage, engine, hp, doors, seats, color, interior) ─
  const cleanInt = (s: string) => { const n = parseInt(s.replace(/[^\d]/g, "")); return isNaN(n) ? null : n }
  const cleanFlt = (s: string) => { const n = parseFloat(s.replace(/,/g, ".").replace(/[^\d.]/g, "")); return isNaN(n) ? null : n }

  const mileageMin = cleanInt(byId.mileage?.selected[0] ?? "")
  const mileageMax = cleanInt(byId.mileage?.selected[1] ?? "")
  const engineMin = cleanFlt(byId.engine?.selected[0] ?? "")
  const engineMax = cleanFlt(byId.engine?.selected[1] ?? "")
  const hpMinForm = cleanInt(byId.hp?.selected[0] ?? "")
  const doorsStr = byId.doors?.selected[0] ?? ""
  const doors = doorsStr ? parseInt(doorsStr) : null
  const seatsStr = byId.seats?.selected[0] ?? ""
  const seatsMinForm = seatsStr === "7+" ? 7 : seatsStr ? parseInt(seatsStr) : null
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
  const color = colorMap[byId.color?.selected[0] ?? ""] ?? null
  const interior = interiorMap[byId.interior?.selected[0] ?? ""] ?? null

  // Form-level HP/seats override purpose presets if explicitly set
  const hpMinFinal = hpMinForm != null ? hpMinForm : purposeHpMin
  const seatsMinFinal = seatsMinForm != null ? seatsMinForm : purposeSeatsMin
  const displacementMinFinal = engineMin != null ? engineMin : purposeDisplacementMin

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
    hp_min: hpMinFinal,
    displacement_min: displacementMinFinal,
    displacement_max: engineMax,
    seats_min: seatsMinFinal,
    mileage_min: mileageMin,
    mileage_max: mileageMax,
    doors,
    interior_material: interior,
    color,
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
  // Trim chat history to last 12 messages to avoid huge payloads
  const trimmedMessages = messages.slice(-12)

  if (!process.env.ANTHROPIC_API_KEY) {
    const { logError } = await import("@/lib/logger")
    await logError({ source: "ai", level: "error", msg: "ANTHROPIC_API_KEY missing", details: { endpoint: "ai-picker/route" } })
    return ""
  }

  // User wants ≤ 10s responses. Sonnet 4.6 with thinking disabled + effort=low
  // finishes conversational chat in 3-8s. 15s is a firm ceiling for timeouts.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        // System prompt is ~1500 tokens of stable text (rules, market context,
        // funnel scripts). Wrap it in a content block with cache_control so
        // Anthropic caches the prefix for 5 min — repeat calls within that window
        // pay 0.1× input cost on the cached portion (~90% savings).
        system: [
          { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
        ],
        messages: trimmedMessages.map(m => ({ role: m.role, content: m.content })),
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      const { logError } = await import("@/lib/logger")
      await logError({
        source: "ai",
        level: "error",
        msg: `Claude HTTP ${res.status}`,
        details: { body: body.slice(0, 500), endpoint: "ai-picker/route" },
      })
      return ""
    }

    const data = await res.json()
    if (data.error) {
      const { logError } = await import("@/lib/logger")
      await logError({
        source: "ai",
        level: "error",
        msg: `Claude API error: ${data.error.type}`,
        details: { message: data.error.message, endpoint: "ai-picker/route" },
      })
      return ""
    }
    // With adaptive thinking, content[0] is a `thinking` block. Find the text block.
    const textBlock = data.content?.find((b: any) => b?.type === "text")
    return textBlock?.text?.trim() ?? ""
  } catch (e: any) {
    const isTimeout = e?.name === "AbortError"
    const { logError } = await import("@/lib/logger")
    await logError({
      source: "ai",
      level: "error",
      msg: isTimeout ? "Claude timeout (15s)" : `Claude request failed: ${e?.message ?? e}`,
      stack: e?.stack,
      details: { endpoint: "ai-picker/route" },
    })
    return ""
  } finally {
    clearTimeout(timeout)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Build a one-click retry suggestion when 0 cars — identifies the tightest
//  constraint and proposes ONE concrete adjustment the frontend can apply.
// ═══════════════════════════════════════════════════════════════════════════════

interface RetrySuggestion {
  label: string                         // UI button label
  prefs: Partial<ChatPreferences>       // diff to merge into current preferences
}

function buildRetrySuggestion(prefs: ChatPreferences | null): RetrySuggestion | null {
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
    // Identify tightest constraint — suggest loosening ONE specific thing instead of vague advice
    const constraints: string[] = []
    if (prefs?.budget_max && prefs.budget_max < 30000) constraints.push(`бюджет під ключ до €${prefs.budget_max} (рідкісний діапазон)`)
    if (prefs?.year_from && prefs.year_from >= 2022) constraints.push(`рік від ${prefs.year_from} (новіші дорожчі)`)
    if (prefs?.mileage_max && prefs.mileage_max < 80000) constraints.push(`пробіг до ${Math.round(prefs.mileage_max / 1000)}k`)
    if (prefs?.color) constraints.push(`колір ${prefs.color}`)
    if (prefs?.drive === "AWD") constraints.push(`повний привід`)

    const prompt = `Ти — старший менеджер Fresh Auto (8+ років на ринку імпорту авто з Європи). Клієнт щойно натиснув пошук, результат: 0 авто.

Параметри клієнта: ${JSON.stringify(prefs)}
Анкета: ${tags.join(", ") || "не заповнена"}
${constraints.length ? `Найжорсткіші обмеження (кандидати на послаблення): ${constraints.join(", ")}` : ""}

Напиши 3-4 речення українською як живий менеджер:

1. ПОЯСНИ ЧОМУ саме ця комбінація рідкісна — ринковий факт. Приклади:
   • "Дизель + AWD + до €25k — це 2 з 100 авто на ринку, бо AWD сам по собі піднімає ціну на 15%."
   • "Чорний колір + кабріолет — рідкість: лише ~5% преміум-кабріо чорні, більшість світлі."
   • "Рік від 2023 + пробіг до 30k + під €25k — такі авто на аукціонах коштують €28-32k без розмитнення."
   • "Дизель 2.5л+ — в Європі таких майже не роблять з 2019, ринок обмежений."

2. Назви ОДИН конкретний параметр який варто послабити (з найжорсткіших вище) + ЦИФРОЮ наскільки: "+€3k до бюджету", "рік 2020 замість 2022", "пробіг до 120k", "будь-який темний колір".

3. Скажи що це РЕАЛІСТИЧНО дасть (скільки варіантів зʼявиться орієнтовно).

4. Заверши впевнено — як менеджер, не як бот. Наприклад: "Скажіть, адаптуємо і запускаю пошук знову."

БЕЗ емодзі, markdown, зірочок, нумерації в відповіді. Одним природнім абзацом. Говори як жива людина, що знає ринок — з фактами і цифрами, не ваніль.`
    // 350 tokens — 3-4 Ukrainian sentences fit comfortably and respond fast.
    const msg = await callClaude(prompt, [{ role: "user", content: "Шукаю авто" }], 350)
    return msg || "За цими точними критеріями зараз немає. Спробуйте збільшити бюджет на €2-3k або послабити пробіг — зазвичай це одразу відкриває 5-10 варіантів."
  }

  // Compute turnkey price for each car so Claude quotes final Ukrainian price, not raw EU.
  const { calcTotalCost } = await import("@/lib/constants")
  const carsDesc = foundCars.slice(0, 6).map((c: any, i: number) => {
    const turnkey = typeof c.price === "number" ? calcTotalCost(c.price).total : null
    const parts = [
      `${i + 1}. ${c.year ?? "?"} ${c.make} ${c.model}`,
      turnkey ? `€${turnkey.toLocaleString()} під ключ` : `€${c.price?.toLocaleString() ?? "?"}`,
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

  const prompt = `Ти — старший менеджер Fresh Auto, 8+ років у підборі авто з ЄС. Клієнт щойно запустив пошук, знайдено ${totalCount} варіантів.

Параметри клієнта: ${JSON.stringify(prefs)}
Анкета: ${tags.join(", ") || "не заповнена"}

Топ-6 знайдених авто (ціни ВЖЕ ПІД КЛЮЧ — фінальна ціна в Україні з митом, доставкою, реєстрацією):
${carsDesc}

КРИТИЧНО — ЦІНИ:
• Усі ціни вище — під ключ (фінальна в Україні).
• Коли згадуєш конкретне авто — ПИШИ "€X під ключ" (наприклад: "Марка Модель за €31k під ключ").
• НЕ переводь назад в EU-ціну, не додавай фрази "з ЄС вийде €X".
• Клієнт оперує тільки turnkey — це те що він фактично заплатить.

Напиши відповідь (3-5 речень) українською — як менеджер старій клієнтці, не як бот:

1. Коротко — скільки знайдено (одним реченням, без переліку критеріїв — клієнт знає що шукав).
2. Виділи 1-2 КОНКРЕТНІ авто з переліку вище (за номером/маркою/ціною під ключ). Поясни ЧОМУ — через конкретну характеристику + що це дає клієнту. Приклади:
   • "Марка Модель 2021 за €31k під ключ — пробіг 65k у такого класу рідкість, Коробка(назва) вже без проблем 2014-2018 серії."
   • "Марка Модель за €29k під ключ зверніть увагу — Euro NCAP 5/5, мертва точка + автопарковка, для поїздок з дітьми плюс."
3. Попередь про нюанс ЯКЩО він є в конкретному авто зі списку: дорожчий ТО цієї марки, пробіг на межі, рідкісні запчастини. М'яко, без лякання.
4. Заверши конкретною дією: "Скажіть якщо хочете глибше перевірити цей варіант", "Можна звузити до дизелів якщо важлива економія", "Розглянете темно-сірий — вибірка зросте вдвічі".

ЗАБОРОНЕНО:
- Повторювати список критеріїв пошуку (клієнт їх знає)
- Казати "перегляньте нижче" (авто вже під чатом)
- Емодзі, markdown, зірочки, нумерація в відповіді
- Ваніль ("гарні варіанти", "непогані авто")
- Шаблонні закінчення типу "успіху у виборі"
- Ціни в EU ("€22k з ЄС") — тільки turnkey
- Конкретні суми ремонтів (€2-3k) і коди моторів (N47, OM651) — лякає

Говори ОДНИМ природнім абзацом. Як жива людина, що знає ринок і конкретні моделі.`

  try {
    // 400 tokens — fits a 3-5 sentence answer that mentions 1-2 specific cars.
    // Lower cap = faster response (user wants ≤ 10s total including parser).
    const comment = await callClaude(prompt, [{ role: "user", content: "Що знайшлось?" }], 400)
    return comment || `Знайшов ${totalCount} варіантів. Подивіться що підходить, і скажіть якщо потрібно уточнити.`
  } catch {
    return `Знайшов ${totalCount} варіантів. Подивіться що підходить, і скажіть якщо потрібно уточнити.`
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Extract preferences from chat — CUMULATIVE
// ═══════════════════════════════════════════════════════════════════════════════

interface JourneyContext {
  freeText?: string | null
  approvedSuggestion?: { make: string; model: string; yearRange?: string; whyRecommended?: string } | null
  rejectedSuggestions?: { make: string; model: string }[]
}

async function extractFromChat(
  messages: ChatMessage[],
  previous: ChatPreferences | null,
  journey: JourneyContext | null = null,
): Promise<ChatPreferences> {
  const empty: ChatPreferences = {
    pairs: [], fuel: null, body_type: null, budget: null,
    budget_min: null, budget_max: null,
    color: null, mileage_max: null, mileage_min: null,
    required_options: [], year_from: null, year_to: null, transmission: null,
    drive: null, displacement_min: null, displacement_max: null,
    hp_min: null, seats_min: null, doors: null, interior_material: null,
    purpose_body_types: [],
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

    // Journey context — earlier pick on the picker stage. Lets the extractor
    // infer body_type/class when the user switches make mid-conversation
    // ("Porsche instead of X5" → keep body_type=SUV so we get Cayenne/Macan
    // not Taycan/Panamera).
    let journeyContext = ""
    if (journey?.approvedSuggestion) {
      const s = journey.approvedSuggestion
      journeyContext = `\n\nКОНТЕКСТ ВИБОРУ (раніше клієнт обрав ${s.make} ${s.model}${s.yearRange ? ` ${s.yearRange}` : ""}). Це означає клас/тип авто з якого клієнт стартував — використай його для умовиводів про body_type і бюджет.`
    }
    if (journey?.freeText) {
      journeyContext += `\nПочатковий запит клієнта: "${journey.freeText}"`
    }

    const text = await callClaude(
      `Ти витягуєш параметри пошуку авто з повідомлень клієнта. Клієнт пише українською/російською/англійською.
${prevContext}${journeyContext}

КРИТИЧНІ ПРАВИЛА (ДОТРИМУЙСЯ СТРОГО):
1. Якщо клієнт ДОДАЄ параметр — зберігай усі попередні, додай новий
2. Якщо клієнт ЗМІНЮЄ параметр — заміни тільки його
3. Якщо клієнт СКАСОВУЄ параметр ("будь-який пробіг", "неважливо", "без обмежень") → постав ЯВНО null
4. ЗАВЖДИ зберігай fuel якщо він вже є в попередніх параметрах, навіть якщо клієнт не згадує його знову
5. ЗАВЖДИ зберігай марку/модель якщо вони вже є в попередніх параметрах
6. КЛАС/ТИП АВТО переноситься між марками. Якщо клієнт раніше обирав SUV (X5, Q7, GLE, Cayenne) і питає "схоже у Porsche" / "схожа марка" / "альтернатива" → body_type ОБОВ'ЯЗКОВО лишається SUV. Якщо було Sedan і клієнт каже "інше" — лишається Sedan. Без явного скасування ("неважливо який кузов") клас не змінюється.
7. БЮДЖЕТ переноситься. Якщо клієнт сказав «схоже до X» без нової ціни — budget_min/budget_max з попередніх параметрів зберігається, навіть якщо марка змінилась.

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

КУЗОВНІ ВАРІАНТИ (3 Door, 5 Door, Estate, Avant) — НЕ пиши їх у model, це body_type:
- "MINI Cooper 3 Door" → make: "MINI", model: "Cooper"
- "Audi A4 Avant" → make: "Audi", model: "A4"
- "BMW 3 Series Touring" → make: "BMW", model: "3 Series"

ПЕРФОРМАНС-ВАРІАНТИ (AMG / M / RS / S / GT) — ЗБЕРІГАЙ trim-цифри, не нормалізуй до базового класу:
- "мерс е63" / "e63" / "amg e63" → make: "Mercedes-Benz", model: "E 63"
- "мерс с63" / "c63 amg" → make: "Mercedes-Benz", model: "C 63"
- "м5" / "bmw m5" → make: "BMW", model: "M5"
- "м3" / "bmw m3" → make: "BMW", model: "M3"
- "рс6" / "audi rs6" → make: "Audi", model: "RS6"
- "s3" / "audi s3" → make: "Audi", model: "S3"
- "гольф r" / "golf r" → make: "Volkswagen", model: "Golf R"
- НЕ перетворюй E63 на "E-Class" — клієнт хоче конкретно AMG-версію, базовий клас занадто широкий.

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
  "budget": число EUR ПІД КЛЮЧ або null (клієнт завжди думає в фінальній ціні в Україні — не в EU-прайсі),
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

    // Normalize brands + validate against known brands (guard against hallucination).
    // Keep this in sync with regexFallbackExtract's KNOWN_BRANDS — otherwise an
    // exotic brand like "Aston Martin" gets parsed correctly by Claude but
    // silently dropped here, leaving the parser URL without a make filter.
    const _KNOWN = new Set([
      "BMW", "Audi", "Mercedes-Benz", "Volkswagen", "Volvo", "Toyota",
      "Honda", "Mazda", "Skoda", "SEAT", "Cupra", "Ford", "Opel",
      "Peugeot", "Renault", "Citroen", "Hyundai", "Kia", "Nissan",
      "Mitsubishi", "Subaru", "Lexus", "Porsche", "Tesla", "MINI",
      "Jeep", "Land Rover", "Jaguar", "Alfa Romeo", "Saab", "Suzuki",
      "Dacia", "Fiat", "Genesis", "Chrysler", "Dodge",
      // Premium / exotic
      "Aston Martin", "Bentley", "Ferrari", "Lamborghini", "Maserati",
      "Rolls-Royce", "Infiniti", "Acura", "Smart", "Abarth", "Alpine",
      "DS Automobiles",
    ])
    const pairs: CarPair[] = Array.isArray(parsed.pairs)
      ? parsed.pairs
          .filter((p: any) => p.make || p.model)
          .map((p: any) => ({
            make: p.make ? normalizeBrand(p.make) : null,
            model: p.model ?? null,
          }))
          .filter((p: CarPair) => !p.make || _KNOWN.has(p.make))  // reject hallucinated brands
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

    // Reorder pairs so any newly-added pick (not in prev.pairs) goes LAST.
    // The /triggerParser merger iterates results in reverse, so the latest
    // user pick ends up at the top of the displayed list. Without this
    // reordering, the AI sometimes returns the new pair in arbitrary
    // position and the user sees their just-selected brand below older ones.
    const prevPairKeys = new Set(
      (previous?.pairs ?? []).map(p => `${(p.make || "").toLowerCase()}|${(p.model || "").toLowerCase()}`)
    )
    const pairKey = (p: CarPair) => `${(p.make || "").toLowerCase()}|${(p.model || "").toLowerCase()}`
    const orderedPairs = [
      ...pairs.filter(p => prevPairKeys.has(pairKey(p))),
      ...pairs.filter(p => !prevPairKeys.has(pairKey(p))),
    ]

    return {
      pairs: orderedPairs.length > 0 ? orderedPairs : prev.pairs,
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
      doors: prev.doors,  // only from form, not from chat
      interior_material: prev.interior_material,  // only from form, not from chat
      purpose_body_types: prev.purpose_body_types,  // only from purpose presets
    }
  } catch (e: any) {
    const { logError } = await import("@/lib/logger")
    await logError({ source: "ai", level: "error", msg: `extractFromChat failed: ${e?.message ?? e}`, stack: e?.stack, details: { endpoint: "ai-picker/route" } })
    // Claude unavailable (rate-limited, out of tokens, network) — fall back to
    // a small regex-based extractor so the search still uses basic filters
    // (brand, budget, year) instead of returning an empty payload that
    // makes the parser scrape all 1700+ cars regardless of user intent.
    return regexFallbackExtract(messages, previous)
  }
}

// ── Regex-only fallback when Claude is unreachable ──
// Pulls brand, budget bounds, and year hints from the latest user message.
// Conservative: extracts only what's unambiguous, leaves everything else null.
function regexFallbackExtract(messages: ChatMessage[], previous: ChatPreferences | null): ChatPreferences {
  const emptyPrefs: ChatPreferences = {
    pairs: [], fuel: null, body_type: null, budget: null,
    budget_min: null, budget_max: null,
    color: null, mileage_max: null, mileage_min: null,
    required_options: [], year_from: null, year_to: null, transmission: null,
    drive: null, displacement_min: null, displacement_max: null,
    hp_min: null, seats_min: null, doors: null, interior_material: null,
    purpose_body_types: [],
  }
  const prev = previous ?? emptyPrefs
  const lastUser = messages.filter(m => m.role === "user").slice(-1)[0]?.content ?? ""
  if (!lastUser.trim()) return prev

  const text = lastUser.toLowerCase()

  // Brand detection — match longest known brand first to avoid "Audi"
  // matching "Audi" in "Audi RS4 Avant" but also catch e.g. "Mercedes-Benz".
  const KNOWN_BRANDS = [
    "mercedes-benz", "mercedes", "land rover", "alfa romeo", "ds automobiles",
    "bmw", "audi", "volkswagen", "vw", "volvo", "toyota", "honda", "mazda",
    "skoda", "seat", "cupra", "ford", "opel", "peugeot", "renault", "citroen",
    "hyundai", "kia", "nissan", "mitsubishi", "subaru", "lexus", "porsche",
    "tesla", "mini", "jeep", "jaguar", "saab", "suzuki", "dacia", "fiat",
    "genesis", "chrysler", "dodge", "infiniti", "acura", "smart", "abarth",
    "alpine", "bentley", "ferrari", "lamborghini", "maserati", "rolls-royce",
    "aston martin",
  ].sort((a, b) => b.length - a.length)

  let detectedMake: string | null = null
  for (const b of KNOWN_BRANDS) {
    if (text.includes(b)) {
      detectedMake = b.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")
      if (b === "vw") detectedMake = "Volkswagen"
      if (b === "mercedes") detectedMake = "Mercedes-Benz"
      break
    }
  }
  // Cyrillic / UA-RU brand spellings — pull from BRAND_ALIASES so the regex
  // fallback recognises "астон мартін", "бентлі", "інфініті" etc. on its own
  // (Claude path also uses BRAND_ALIASES, but if Claude is unreachable we
  // still want the search URL to carry the right make).
  if (!detectedMake) {
    const aliasKeys = Object.keys(BRAND_ALIASES).sort((a, b) => b.length - a.length)
    for (const k of aliasKeys) {
      if (text.includes(k)) { detectedMake = BRAND_ALIASES[k]; break }
    }
  }

  // Budget: "від 60к", "до 30k", "60-80к", "60000 - 80000 євро"
  const parseAmount = (s: string): number | null => {
    const n = parseInt(s.replace(/[^\d]/g, ""))
    if (isNaN(n) || n <= 0) return null
    return /[kк]/i.test(s) && n < 1000 ? n * 1000 : n
  }
  let budgetMin: number | null = prev.budget_min
  let budgetMax: number | null = prev.budget_max
  const rangeMatch = text.match(/(\d[\d\s]*[kк]?)\s*[-–—]\s*(\d[\d\s]*[kк]?)/)
  if (rangeMatch) {
    const a = parseAmount(rangeMatch[1])
    const b = parseAmount(rangeMatch[2])
    if (a && b) { budgetMin = Math.min(a, b); budgetMax = Math.max(a, b) }
  } else {
    const fromMatch = text.match(/(?:від|from|больше|понад|over)\s+(\d[\d\s]*[kк]?)/i)
    const toMatch = text.match(/(?:до|under|less than|max|менше)\s+(\d[\d\s]*[kк]?)/i)
    if (fromMatch) {
      const v = parseAmount(fromMatch[1])
      if (v) budgetMin = v
    }
    if (toMatch) {
      const v = parseAmount(toMatch[1])
      if (v) budgetMax = v
    }
  }

  // Year: "від 2018", "2020-2023"
  let yearFrom: number | null = prev.year_from
  let yearTo: number | null = prev.year_to
  const yearRange = text.match(/(20[1-2]\d)\s*[-–—]\s*(20[1-2]\d)/)
  if (yearRange) {
    yearFrom = parseInt(yearRange[1])
    yearTo = parseInt(yearRange[2])
  } else {
    const yFrom = text.match(/(?:від|from|after|після)\s*(20[1-2]\d)/i)
    const yTo = text.match(/(?:до|until|before|до)\s*(20[1-2]\d)/i)
    if (yFrom) yearFrom = parseInt(yFrom[1])
    if (yTo) yearTo = parseInt(yTo[1])
  }

  return {
    ...prev,
    pairs: detectedMake ? [{ make: detectedMake, model: null }] : prev.pairs,
    budget_min: budgetMin,
    budget_max: budgetMax,
    year_from: yearFrom,
    year_to: yearTo,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Parser API call
// ═══════════════════════════════════════════════════════════════════════════════

async function callParserInstant(
  payload: Record<string, unknown>,
): Promise<{ count: number; cars: any[] } | null> {
  if (!PARSER_URL) return null
  try {
    // Build query string for GET /search/instant
    const params = new URLSearchParams()
    if (payload.make) params.set("make", String(payload.make))
    if (payload.model) params.set("model", String(payload.model))
    if (payload.year_from) params.set("year_from", String(payload.year_from))
    if (payload.year_to) params.set("year_to", String(payload.year_to))
    // Use `!= null` (not truthy check) so budget_min=0 is sent explicitly.
    // The parser API defaults to 5000 EUR when price_min is omitted, which
    // would re-introduce a floor we deliberately wanted to drop in the
    // fallback step of searchWithFallback.
    if (payload.budget_min != null) params.set("price_min", String(payload.budget_min))
    if (payload.budget_max) params.set("price_max", String(payload.budget_max))
    if (payload.fuel) params.set("fuel", String(payload.fuel))
    if (payload.transmission) params.set("transmission", String(payload.transmission))
    if (payload.body_type) params.set("body_type", String(payload.body_type))
    if (payload.drive) params.set("drive", String(payload.drive))
    params.set("limit", "100")

    const url = `${PARSER_URL}/search/instant?${params}`
    // Diagnostic — log every parser call so you can correlate "0 cars found"
    // red messages with the exact URL that was hit. Visible in Vercel runtime
    // logs under `[picker] parser →`.
    console.log(`[picker] parser → ${url.replace(PARSER_URL, "")}`)
    const res = await fetch(url, {
      headers: PARSER_KEY ? { "x-api-key": PARSER_KEY } : {},
    })
    if (!res.ok) {
      const { logError } = await import("@/lib/logger")
      await logError({ source: "site-api", level: "error", msg: `Parser /search/instant HTTP ${res.status}`, details: { endpoint: "ai-picker/route", url } })
      return null
    }
    const data = await res.json()
    if (data.count > 0) return data
    return null
  } catch (err: any) {
    const { logError } = await import("@/lib/logger")
    await logError({ source: "site-api", level: "error", msg: `Parser /search/instant failed: ${err?.message ?? err}`, stack: err?.stack, details: { endpoint: "ai-picker/route" } })
    return null
  }
}

// callParser + pollJobResults removed: searchWithFallback in triggerParser
// uses only callParserInstant now (strict 2-step cascade). If both attempts
// return empty, the frontend shows '0 results' instead of the heavier sync
// /search and job-queue paths.

async function triggerParser(
  answers: Answer[],
  clientOrderId: string,
  chat: ChatPreferences,
  skipCache: boolean = false,
) {
  if (!PARSER_URL) {
    const { logError } = await import("@/lib/logger")
    await logError({ source: "site-api", level: "error", msg: "No PARSER_URL configured", details: { endpoint: "ai-picker/route" } })
    return null
  }
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

  // User's budget is "turnkey" (final price inc. duty+excise+VAT+delivery).
  // Parser filters by raw EU source price, so reverse-calculate the EU ceiling/floor.
  // Formula: eu = (turnkey - fixed_fees) / 1.38 (see lib/constants.ts euPriceFromTurnkey)
  const { euPriceFromTurnkey } = await import("@/lib/constants")
  const euBudgetMin = budgetMin != null ? euPriceFromTurnkey(budgetMin) : null
  const euBudgetMax = budgetMax != null ? euPriceFromTurnkey(budgetMax) : null

  const commonPayload: Record<string, unknown> = {
    year_from: chat.year_from ?? base.year_from,
    year_to: chat.year_to ?? base.year_to,
    budget_min: euBudgetMin,  // raw EU ceiling, derived from user's turnkey budget
    budget_max: euBudgetMax,
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

  // Parallel search for multiple brand/model pairs. Bumped 3 → 8 — users legitimately
  // compare several brands at once (BMW/Audi/Mercedes, or 3er/5er/X3 within one brand).
  // Each parser /search/instant hits its per-brand cache independently, so 8 parallel
  // requests take ~same wall-clock time as 1 (they're I/O-bound, cache-hit dominant).
  const limitedPairs = pairs.slice(0, 8)

  // Strict 3-step search. Per explicit user request: only drop price_min on
  // fallback step 2, never year or upper budget. Better to show '0 results'
  // honestly than return cars outside the user's budget — the previous
  // aggressive cascade gave back Mazda 30k cars for a "Infiniti від 60k"
  // query and the user (rightly) called that misleading.
  //
  // Step 3 drops the year window for niche models (Infiniti, narrow trims)
  // where AI's yearRange ends up too tight for the actual stock. Without it
  // the user sees "0 results" even though cars exist in adjacent years.
  const hasYearWindow = commonPayload.year_from != null || commonPayload.year_to != null
  const searchWithFallback = async (p: CarPair) => {
    // Normalize trailing generation suffixes (e.g. "passat b9" → "passat").
    // AS24's slug map only has base model names; "passat-b9" resolves to a
    // non-existent URL and the whole 3-step cascade returns 0 even though
    // /volkswagen/passat has plenty of stock.
    const model = stripGenerationSuffix(p.model)

    // Step 1: AI/user criteria as-is
    const first = await callParserInstant({ ...commonPayload, make: p.make, model })
    if (first && first.count > 0) return first

    // Step 2: drop lower price bound only. Keep year_from/year_to/budget_max.
    // budget_min=0 (not null) — parser defaults to 5000 EUR when omitted.
    const second = await callParserInstant({ ...commonPayload, budget_min: 0, make: p.make, model })
    if (second && second.count > 0) return second

    // Step 3: drop year window too — only triggers if step 1/2 used a year
    // filter. Skip when no year was set in the first place (otherwise it's a
    // duplicate of step 2).
    if (hasYearWindow) {
      const third = await callParserInstant({
        ...commonPayload,
        budget_min: 0,
        year_from: null,
        year_to: null,
        make: p.make,
        model,
      })
      if (third && third.count > 0) return third
    }

    // All empty → return empty. Frontend shows the red "0 found" message.
    return { count: 0, cars: [] }
  }

  const results = await Promise.all(limitedPairs.map(searchWithFallback))

  // Deduplicate — iterate pairs in REVERSE chronological order so the
  // most-recently-added selection appears first in the merged list.
  //
  // Why this matters: when the chat is cumulative (user picked BMW first,
  // then Audi), `pairs` grows in the order they were added. If we kept
  // natural order, the old BMW results would still appear at the top
  // and the user would have to scroll past them to see the cars they
  // just asked about. Reversing puts the latest pick at the top of
  // each refresh, which matches user expectation.
  const seenUrls = new Set<string>()
  let allCars: any[] = []
  for (const r of [...results].reverse()) {
    if (!r) continue
    for (const car of r.cars ?? []) {
      const key = (car.url ?? car.source_url ?? car.id) as string
      if (key && seenUrls.has(key)) continue
      if (key) seenUrls.add(key)
      allCars.push(car)
    }
  }

  // ── Client-side filtering (params that parser doesn't support) ──────────
  // Merge survey-form values (from extractSearchParams) with chat-extracted prefs
  const filterPrefs: ChatPreferences = {
    ...chat,
    displacement_min: chat.displacement_min ?? base.displacement_min ?? null,
    displacement_max: chat.displacement_max ?? base.displacement_max ?? null,
    hp_min: chat.hp_min ?? base.hp_min ?? null,
    seats_min: chat.seats_min ?? base.seats_min ?? null,
    drive: chat.drive ?? base.drive ?? null,
    mileage_min: chat.mileage_min ?? base.mileage_min ?? null,
    mileage_max: chat.mileage_max ?? base.mileage_max ?? null,
    color: chat.color ?? base.color ?? null,
    doors: chat.doors ?? base.doors ?? null,
    interior_material: chat.interior_material ?? base.interior_material ?? null,
    purpose_body_types: chat.purpose_body_types.length > 0
      ? chat.purpose_body_types
      : base.purpose_body_types ?? [],
  }
  allCars = filterCarsClientSide(allCars, filterPrefs)

  // SOFT image preference: prefer cars with images at the TOP, but never drop
  // cars entirely — otherwise a partially-indexed DB returns "no cars found"
  // when cars actually exist (the bug user reported: "у відповідь нажаль немає авто").
  const withImg = allCars.filter(c => c.image)
  const withoutImg = allCars.filter(c => !c.image)
  allCars = [...withImg, ...withoutImg]

  return { count: allCars.length, cars: allCars }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Client-side filtering — mileage, color, options
// ═══════════════════════════════════════════════════════════════════════════════

function filterCarsClientSide(cars: any[], prefs: ChatPreferences): any[] {
  let filtered = [...cars]

  // Model filter — SOFT: parser already filtered by make/model in URL.
  // Make + Model filter — smart series matching
  // BMW "4er" → accepts "420", "430", "M4" but NOT "318", "X5"
  // Audi "a6" → accepts "A6", "A6 Avant" but NOT "A4", "Q5"
  if (prefs.pairs.length > 0) {
    const pairsLower = prefs.pairs
      .filter(p => p.make)
      .map(p => ({ make: p.make!.toLowerCase(), model: (p.model ?? "").toLowerCase() }))

    if (pairsLower.length > 0) {
      filtered = filtered.filter(c => {
        const carMake = (c.make ?? "").toLowerCase()
        const carModel = (c.model ?? "").toLowerCase()
        if (!carMake) return true

        return pairsLower.some(({ make: reqMake, model: reqModel }) => {
          // Make must match
          if (!carMake.includes(reqMake) && !reqMake.includes(carMake)) return false
          // If no specific model requested, accept all from this make
          if (!reqModel) return true

          // Extract series number: "3er" → "3", "4 series" → "4", "a6" → "a6"
          const seriesMatch = reqModel.match(/^(\d+)/)
          if (seriesMatch) {
            const series = seriesMatch[1]
            // BMW series: "4" matches "420", "430", "440", "M4", "Serie 4", "4er Reihe"
            // but NOT "X4", "318", "520". Guard against X-class (suv) with negative lookbehind.
            if (carModel.startsWith(series)) return true
            // M3 must match "M3 Competition" but NOT "M340i" / "M3 GTS"
            // Negative lookahead forbids trailing digit after the M-letter form.
            if (new RegExp(`m${series}(?![0-9])`, "i").test(carModel)) return true
            // Match "series N" / "serie N" / "Nreihe" / "Ner" anywhere
            const seriesRe = new RegExp(`(?:^|\\s|^serie\\s*|^series\\s*)${series}(?:er|e|\\s|$)`, "i")
            if (seriesRe.test(carModel)) return true
            return false
          }

          // Mercedes class slug ("c-klasse", "e-klasse", "gla-klasse", "cla-class"…).
          // Parser hits AS24/Bytbil with the class slug but returned cars come back
          // with the concrete designation ("C 300 T", "GLA 200", "CLA 180"), which
          // does NOT contain the literal "klasse"/"class" substring — so the generic
          // includes() check below would drop every Mercedes result. Match on the
          // class prefix followed by a space/dash/digit boundary so "c-klasse"
          // accepts "C 300 T" but not "CLA 200", and "cla-klasse" accepts "CLA 200"
          // but not "C 300 T".
          const mbClass = reqModel.match(/^([a-z]{1,3})[\s-]?(?:klasse|class)$/i)
          if (mbClass) {
            const cls = mbClass[1].toLowerCase()
            const carTrimmed = carModel.trim().toLowerCase()
            // Commercial / non-class models that start with the same letter
            // get pulled in by Bytbil free-text search. E-Klasse query brings
            // back "E Vito Tourer" (bytbil reuses the E letter for an
            // E-anything tag). Drop these explicitly.
            const COMMERCIAL_LOOKALIKES = [
              "vito", "v-class", "v klasse", "viano", "metris", "citan",
              "sprinter", "vario", "marco polo", "eqv",
            ]
            if (COMMERCIAL_LOOKALIKES.some(k => carTrimmed.includes(k))) return false
            if (new RegExp(`^${cls}(?:[\\s-]|\\d)`, "i").test(carTrimmed)) return true
            return false
          }

          // Non-numeric models: "a6" matches "A6", "A6 Avant", "A6 Allroad".
          // Word-token boundary via digit-guards: "m5" must not match "M50i",
          // "a6" must not match "a60" (rare but possible AS24 ID strings).
          // Preceding char: start-of-string OR non-digit. Trailing char: not a digit.
          const reqNorm = reqModel.replace(/[^a-z0-9]/g, "")
          const carNorm = carModel.replace(/[^a-z0-9]/g, "")
          const tokenRe = new RegExp(`(?:^|[^0-9])${reqNorm}(?![0-9])`, "i")
          if (tokenRe.test(carNorm)) return true

          return false
        })
      })
    }
  }

  // Year range — hard filter.
  // When the client asks for 2018+ (modern car), REJECT cars with missing
  // year. Otherwise Blocket's bare-bones listings (no regdate scraped on
  // many ancient Honda Accord/Toyota Avensis ads from 2003-2010) leak in
  // as if they matched a "Honda Accord 2019-2022" query. For older searches
  // (year_from < 2018) we still keep unknowns since that's the bulk of the
  // pre-2015 Swedish stock and dropping them empties the result.
  if (prefs.year_from != null) {
    const strictUnknown = prefs.year_from >= 2018
    filtered = filtered.filter(c => c.year ? c.year >= prefs.year_from! : !strictUnknown)
  }
  if (prefs.year_to != null) {
    filtered = filtered.filter(c => !c.year || c.year <= prefs.year_to!)
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
      // Extract displacement: "2.0 Diesel" → 2.0, "1.5L" → 1.5, "1998 ccm" → 2.0
      let liters: number | null = null
      const mDot = eng.match(/\b([1-9]\.\d+)\b/)
      if (mDot) liters = parseFloat(mDot[1])
      if (liters === null) {
        const mCc = eng.match(/(\d{3,4})\s*(?:cc|ccm)/i)
        if (mCc) liters = Math.round(parseInt(mCc[1]) / 100) / 10
      }
      if (liters === null) return true // keep if unknown
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

  // Drive (AWD/FWD/RWD) — keep unknowns only if most results lack drive data
  if (prefs.drive) {
    const carsWithDrive = filtered.filter(c => c.drive && c.drive !== "Unknown").length
    const keepUnknown = carsWithDrive < filtered.length * 0.3 // if <30% have drive data, keep unknowns
    filtered = filtered.filter(c => {
      const carDrive = (c.drive ?? "").toUpperCase()
      if (!carDrive || carDrive === "UNKNOWN") return keepUnknown
      const wanted = prefs.drive!.toUpperCase()
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

  // Doors
  if (prefs.doors != null) {
    filtered = filtered.filter(c => {
      if (!c.doors) return true // keep if unknown
      return c.doors === prefs.doors
    })
  }

  // Interior material
  if (prefs.interior_material) {
    const wanted = prefs.interior_material.toLowerCase()
    filtered = filtered.filter(c => {
      const mat = (c.seatMaterial ?? c.seat_material ?? c.interior_material ?? "").toLowerCase()
      if (!mat) return true
      return mat.includes(wanted)
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
  // Rate-limit per IP — 30 req/min. Anthropic account caps at 50/min; we want
  // headroom for legit concurrent users. Load test showed 142× 429s without this.
  const { tryAcquire, clientKey } = await import("@/lib/rate-limit")
  const rl = tryAcquire(`ai-picker:${clientKey(req)}`, 30)
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "rate_limited", retry_after: rl.resetIn }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(rl.resetIn) },
    })
  }

  const {
    messages,
    answers,
    cars,
    triggerSearch,
    clientOrderId,
    loadMore,
    chatPreferences,
    journey, // { freeText, approvedSuggestion, rejectedSuggestions }
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
    const chat = await extractFromChat(messages ?? [], prevPrefs, journey ?? null)

    // Merge survey answers as fallback — respect user's explicit chat preferences
    if (!chat.budget && base.budget_max) chat.budget = base.budget_max
    if (!chat.budget_min && base.budget_min) chat.budget_min = base.budget_min
    // Only set budget_max from survey if user didn't explicitly set min-only in chat
    // (user said "від 30к" = they want 30k+, don't cap from survey)
    if (!chat.budget_max && base.budget_max && !chat.budget_min) chat.budget_max = base.budget_max
    if (!chat.fuel && base.fuel) chat.fuel = base.fuel
    if (!chat.body_type && base.body_type) chat.body_type = base.body_type
    if (!chat.year_from && base.year_from) chat.year_from = base.year_from
    if (!chat.year_to && base.year_to) chat.year_to = base.year_to
    if (!chat.transmission && base.transmission) chat.transmission = base.transmission
    if (!chat.drive && base.drive) chat.drive = base.drive
    // Purpose presets → merge into chat if not overridden by explicit chat values
    if (chat.hp_min == null && base.hp_min != null) chat.hp_min = base.hp_min
    if (chat.seats_min == null && base.seats_min != null) chat.seats_min = base.seats_min
    if (chat.displacement_min == null && base.displacement_min != null) chat.displacement_min = base.displacement_min
    if (chat.purpose_body_types.length === 0 && base.purpose_body_types.length > 0)
      chat.purpose_body_types = base.purpose_body_types


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

    const result = await triggerParser(answers ?? [], orderId, chat, wantsMore || hasPreviousCars)
    const count = result?.count ?? 0
    const foundCars = result?.cars ?? []

    // Log search event — helps diagnose mismatched results (e.g. Golf GTI
    // suggestion that returns 2005/2009 Golfs because year/trim filters slipped).
    try {
      const { logSearchEvent } = await import("@/lib/logger")
      const years = foundCars.map((c: any) => c.year).filter((y: any) => typeof y === "number")
      const prices = foundCars.map((c: any) => c.price).filter((p: any) => typeof p === "number")
      // Suggestion-card searches arrive with empty messages[] + chatPreferences set.
      const eventSource: "chat" | "suggestion-card" | "load-more" | "other" =
        wantsMore ? "load-more"
        : (Array.isArray(messages) && messages.length === 0 && chatPreferences) ? "suggestion-card"
        : "chat"
      await logSearchEvent({
        orderId,
        source: eventSource,
        query: {
          pairs: chat.pairs,
          year_from: chat.year_from,
          year_to: chat.year_to,
          budget_min: chat.budget_min,
          budget_max: chat.budget_max,
          fuel: chat.fuel,
          body_type: chat.body_type,
          color: chat.color,
          mileage_max: chat.mileage_max,
          drive: chat.drive,
        },
        rawCount: count,
        yearMin: years.length ? Math.min(...years) : null,
        yearMax: years.length ? Math.max(...years) : null,
        priceMin: prices.length ? Math.min(...prices) : null,
        priceMax: prices.length ? Math.max(...prices) : null,
        cars: foundCars.slice(0, 8).map((c: any) => ({
          year: c.year ?? null,
          make: c.make ?? null,
          model: c.model ?? null,
          price: typeof c.price === "number" ? c.price : null,
          url: c.source_url ?? c.sourceUrl ?? null,
        })),
      })
    } catch {
      // Logging must never break the request.
    }

    const message = await generateSearchComment(foundCars, count, chat, tags)
    const retrySuggestion = count === 0 ? buildRetrySuggestion(chat) : null

    return NextResponse.json({
      message,
      searching: false,
      cars: foundCars,
      chatPreferences: chat,
      retrySuggestion,
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  LOAD MORE — button click, always skip cache
  // ═══════════════════════════════════════════════════════════════════════════

  if (loadMore && chatPreferences) {
    const orderId = clientOrderId ?? crypto.randomUUID()
    const result = await triggerParser(answers ?? [], orderId, chatPreferences, true)
    const count = result?.count ?? 0
    const foundCars = result?.cars ?? []
    const message = count > 0
      ? await generateSearchComment(foundCars, count, chatPreferences, tags)
      : "Більше варіантів за цими параметрами поки немає. Спробуйте трохи змінити критерії — наприклад розширити бюджет або додати ще один тип кузова."
    const retrySuggestion = count === 0 ? buildRetrySuggestion(chatPreferences) : null
    return NextResponse.json({
      message,
      searching: false,
      cars: result?.cars ?? [],
      chatPreferences,
      retrySuggestion,
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  REGULAR CHAT — decide: SEARCH or REPLY
  // ═══════════════════════════════════════════════════════════════════════════

  const hasNoCars = !cars || cars.length === 0
  // Limit cars context to 5 to keep chat payload small
  const carsContext = cars
    ?.slice(0, 5)
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

  // Journey context — what the picker stage already learned from the client.
  // Lets the chat reference the original free-text request, acknowledge the
  // suggestion the client approved, and steer away from cards they rejected.
  const journeyLines: string[] = []
  if (journey?.freeText) {
    journeyLines.push(`• Вільний опис на старті: "${journey.freeText}"`)
  }
  if (journey?.approvedSuggestion) {
    const s = journey.approvedSuggestion
    journeyLines.push(`• Клієнт обрав пропозицію: ${s.make} ${s.model} (${s.yearRange ?? "?"})`)
    if (s.whyRecommended) {
      journeyLines.push(`  Твоє попереднє обґрунтування: "${s.whyRecommended}"`)
    }
  }
  if (Array.isArray(journey?.rejectedSuggestions) && journey.rejectedSuggestions.length > 0) {
    const list = journey.rejectedSuggestions
      .map((s: { make: string; model: string }) => `${s.make} ${s.model}`)
      .join(", ")
    journeyLines.push(`• Відкинув альтернативи: ${list} — не повторюй ці моделі без вагомої причини`)
  }
  const journeyContext = journeyLines.length > 0
    ? `\n═══ КОНТЕКСТ ВИБОРУ КЛІЄНТА ═══\n${journeyLines.join("\n")}\nКористуйся цим — клієнт очікує, що ти пам'ятаєш про що ми домовилися. Якщо рекомендуєш інше, чесно скажи чому змінив думку.

ВАЖЛИВО: КЛАС І БЮДЖЕТ ТРИМАЙ. Якщо клієнт обрав SUV (X5, Cayenne, Q7) і питає альтернативу — пропонуй SUV (Macan, GLE, XC90), НЕ седан/купе. Якщо обрав седан — пропонуй седан. Бюджет: тримайся ±15% від того, у якому шукали раніше; різко вище ціни без пояснення = промах. Якщо реальна модель класу не вкладається у бюджет — чесно скажи "X не вписується в бюджет, але є Y близько за параметрами" замість того щоб мовчки показувати дорожче.\n`
    : ""

  const systemPrompt = `You are a senior car-import consultant at Fresh Auto, 8+ years sourcing from Germany / Sweden / Netherlands. Answer like a knowledgeable friend who knows the market — direct, specific, no fluff. Write plain prose paragraphs only: no emoji, no markdown headers, no bullet points, no asterisks, no numbered lists, no bold. Address the client formally (Ви in Ukrainian, Вы in Russian, you in English).

# RESPONSE LANGUAGE
Match the language of the client's LATEST message. Ukrainian → Ukrainian, Russian → Russian, English → English. Default to Ukrainian if unclear. Never switch language mid-conversation unless the client switches first. Use these Ukrainian terms when in Ukrainian: "під ключ" (turnkey), "ціна в ЄС" (EU price), "пробіг" (mileage), "ТО" (service), "до 80k" (mileage cap in thousands).

# CONTEXT YOU RECEIVE
Form criteria: ${tags.join(", ") || "не заповнені"}
${prefsContext}${journeyContext}
${hasNoCars
    ? "Current results: no cars match the active filters right now."
    : `Current results (showing ${Math.min(8, totalCarsCount)} of ${totalCarsCount}):\n${carsContext}`}

# ROUTING — TRIGGER_SEARCH vs PROSE REPLY
Reply with literally the word TRIGGER_SEARCH and nothing else ONLY when the client tightens or relaxes a filter without naming a new model/brand/segment. Examples that trigger search: "лише з панорамою", "пробіг до 80к", "хочу чорний", "ціна до 25000", "тільки повний привід". Everything else gets a prose reply: questions, comparisons, opinions, brand/model swaps, casual chat, objections.

# REPLY STYLE
Speak like a real consultant, not a chatbot. Always explain the WHY behind a recommendation with a concrete fact + benefit (mileage figure, engine code by year, market reality). Refer back to what the client told you (family, road trips, city use). Give confident advice — "беріть Skoda" not "Skoda мабуть непогано". End every substantive reply with ONE concrete next step (lock the price 48h, schedule Poland inspection, request docs, narrow the search). Never end with vague "якщо є питання".

# AFTER A SEARCH RAN (cars are visible)
Pick 1-2 specific cars from the current results sample. For each: name (year + model + €X під ключ), one concrete reason it's a good pick (specific feature → benefit), and one concrete concern only if it really applies (high mileage for that class, known engine pain by the year range). Then ONE next step. Do not rehearse the search criteria — the client typed them. Do not say "перегляньте нижче" / "see below". Vary phrasing across replies.

Good shape (Ukrainian example): "Беріть Skoda Superb 2021 за €22k під ключ — пробіг 65k для цього класу подарунок, DSG7 вже перероблений (проблему 2014-2018 виправили). Volvo V60 на €4k дорожче, але Euro NCAP 5 і мертва точка — кращий для частих поїздок з дітьми. Готовий зафіксувати ціну по Superb на 48 годин?"

# EXPERT KNOWLEDGE (use only when relevant to a car under discussion)
Reliability tiers (J.D. Power / ADAC consensus):
- Top: Toyota, Honda, Mazda, Lexus, Subaru — minimal issues to 200k km.
- Solid mid: Skoda, VW (post-2015 TSI), Volvo, Kia (from 2018), Hyundai (from 2019).
- Comfort over reliability: BMW, Audi, Mercedes — expect €2-5k maintenance window after 120k.
- Higher risk: Jaguar, Land Rover (esp. Evoque), Peugeot 1.2 PureTech 2014-2018, Opel Astra J Z14NET chain.

Known engine pain (mention ONLY if relevant to a car in the current results or asked):
- BMW N47 diesel ≤2013: timing chain.
- VW 1.2/1.4 TSI 2008-2014: water pump, chain. DSG7 ≤2014: mechatronik.
- Mercedes OM651 2009-2015: injectors. M271 ≤2011: chain.
- Ford 1.0 EcoBoost ≤2019: head gasket.
- Peugeot/Citroen 1.2 PureTech ≤2019: belt-in-oil.
- Renault/Nissan 1.5 dCi (K9K) after 150k: turbo, injectors.

Mileage reality: diesel 250-300k without overhaul, petrol 150-200k. Premium with 150k+ → plan €2-5k maintenance over 2 years. Always cross-check VIN in CarVertical + ADAC for tampered odometers.

Year-by-year features: 2020+ standard AEB/LKA (Euro NCAP 5), 2022+ wireless Android Auto / CarPlay norm, 2023+ matrix headlights common in mid-trims of mass-market models.

AWD costs: +10-15% fuel, +30% diff service (€300-600 per service). Needed for winter outside cities / mountains; in Kyiv/Lviv city use it's a premium without payoff.

Market context: depreciation 25-30% year 1 then 12-15% per year; popular models (Octavia, Golf, Passat, 3 Series, C-Class) hold value 5-8% better; niche (Alfa, DS, Ssangyong) drop faster but cheaper at entry. Diesel supply peak Germany Oct-Mar; AWD prices Nov-Feb +7-10%. "Свіжий пригон" = 3-6 months in EU.

# PRICE FORMULA (use when client asks "скільки під ключ", не вигадуй цифри інакше)
Turnkey EUR = EU_price × 1.38 + €4 500 fixed.
Breakdown: 1.38 = duty 10% + excise 5%, then VAT 20% stacked. €4 500 = €2 500 delivery + €800 broker + €1 200 registration.
Reverse: EU_price = (turnkey − 4 500) / 1.38.
Delivery time: 2-4 weeks order-to-keys. Poland inspection: +€150.

# CLARIFICATION DISCIPLINE
If a parameter is missing to make a real recommendation, ask exactly ONE question. Priority: purpose (city/family/road trips) → budget → mileage cap → fuel → brand. Never bombard with multiple questions. After the client answers, run the search immediately — don't double-check. If the client asks "а що б Ви взяли?" — give ONE concrete pick with reasoning, don't deflect by asking back.

# REJECTION LOOP (when the client says "не те" / "інше" / "не моє" / "спробуй ще")
Ask ONE pointed question to find what to change, then re-search. Do NOT repeat models already shown. The brand can stay (BMW has 1er/3er/5er/X1/X3/X5 — different cars), but the specific model swaps. Only drop the brand if the client explicitly says "не BMW" / "не німці". If all prior picks were one class (e.g. all business sedans), pivot to adjacent class (wagon, crossover) or a fresher year in the same class.

# CLASS + BUDGET CONTINUITY
If the journey block above shows the client approved an SUV (X5, Cayenne, Q7), keep suggesting SUVs (Macan, GLE, XC90) — never sedans/coupes. Same rule for sedan → sedan, wagon → wagon. Hold budget within ±15% of the prior search. If the brand they want only exists higher (Porsche under €30k = none), say so honestly and pivot to the closest adjacent option.

# OBJECTIONS — PRINCIPLES NOT SCRIPTS
- "Дорого" → break down the under-key price, offer an adjacent cheaper option in the same class.
- "Подумаю" → respect it, leave one useful market fact, no chasing.
- "Не те" → ask what specifically to change; don't restart from zero.
- "А що ви порадите?" → give ONE concrete recommendation with reason; don't bounce back the question.
- Skepticism about the company → state concrete checks (Poland inspection €150, CarVertical report, 7-day return after Ukraine arrival, 12-month legal guarantee). Don't get defensive.

# NON-CAR REQUESTS (motorcycles, vans, trucks, campers, heavy equipment)
You handle these too — same import math, same sources. Quick reference:
- Motorcycles: 125cc beginner, 300-500cc transitional, 600-1000cc full, 1000+ experienced. Honda/Yamaha most reliable; BMW GS needs specialist mechanic; Ducati expensive service. Mileage cap for sport bikes ~30k, others ~50-80k.
- Light commercial (≤3.5t): VW Transporter/Crafter, Sprinter, Transit, Master, Ducato, Boxer, Daily.
- Heavy trucks (Actros, FH, R-series, XF): 500k-1.5M km is normal. Check EURO standard (Ukraine accepts EURO-5 without surcharge).
- Heavy equipment: hours of operation, not km. CAT/Volvo/Komatsu/Hitachi/JCB excavators. Tractors: John Deere, Fendt, Claas.
- Campers: Hymer/Bürstner/Knaus/Dethleffs on Ducato or Sprinter base.
If client mentions a non-car vehicle, ask: vehicle type + budget + intended use, then trigger search.

# RED LINES (never violate)
- Never invent a specific car / VIN / price / delivery date. Never promise what isn't certain.
- Never use artificial urgency ("тільки сьогодні", "остання пропозиція"). The market always has the next car.
- If you don't know — say so: "це треба уточнити з технічним менеджером" (in the client's language).
- One concrete CTA per reply, not three.
- Honest about downsides — softly stated downsides build trust.
- Minimum budgets: passenger car €20k, motorcycle €5k, commercial €10k, heavy equipment €15k. Below that, explain market reality and pivot.
- Manager phone (098 708 19 19) is for order processing only — don't punt search questions to phone.

# OUTPUT FORMAT (strict)
1-4 short paragraphs of plain prose in the client's language. No emoji. No markdown headers (no \`#\`, no \`═══\`, no \`**bold**\`). No bullet points or numbered lists in the output. Use commas and periods. Specific numbers and model names beat generalities. Address the client formally (Ви/Вы/you).`

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

  // Single Claude call — returns either TRIGGER_SEARCH or a conversational reply.
  // 300 tokens used to truncate replies that recommended 2 cars with reasoning;
  // 700 covers a thoughtful answer comfortably without cost ballooning.
  const reply = await callClaude(systemPrompt, messages as ChatMessage[], 700)

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