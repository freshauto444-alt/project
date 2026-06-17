import {
  BRAND_ALIASES,
  detectBrandGroups,
  normalizeBrand,
  normalizeColor,
  KNOWN_BRAND_SET,
  KNOWN_BRANDS_LOWER,
} from "@/lib/picker/normalize"
import { callClaude } from "@/lib/picker/claude"
import type { CarPair, ChatMessage, ChatPreferences } from "@/lib/picker/types"

// ═══════════════════════════════════════════════════════════════════════════════
//  Extract preferences from chat — CUMULATIVE
// ═══════════════════════════════════════════════════════════════════════════════

export interface JourneyContext {
  freeText?: string | null
  approvedSuggestion?: { make: string; model: string; yearRange?: string; whyRecommended?: string } | null
  rejectedSuggestions?: { make: string; model: string }[]
}

export async function extractFromChat(
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
8. **АЛЬТЕРНАТИВИ ВІДКРИВАЮТЬ МАРКИ.** Якщо клієнт каже «альтернативи», «які ще варіанти», «інші марки», «що ще є», «схожі моделі», «що порадите окрім», «крім цього» — ОЧИСТИ pairs (постав []), щоб парсер шукав по всіх марках у тому ж класі+бюджеті+році. Body_type, budget, year_from/to ЗАЛИШАЮТЬСЯ. ВИНЯТОК: якщо клієнт явно назвав конкретну марку для альтернативи («альтернативи від BMW») — pairs стає [{make: "BMW", model: null}].

ПРОБІГ:
- "пробіг більше 150к" / "від 150 тис км" → mileage_min: 150000, mileage_max: null
- "пробіг до 100к" → mileage_max: 100000, mileage_min: null
- "будь-який пробіг" / "без урахування пробігу" → mileage_min: null, mileage_max: null

ОБ'ЄМ ДВИГУНА:
- "від 2-х літрів" / "двигун від 2л" / "2.0 і вище" → displacement_min: 2.0, displacement_max: null
- "до 1.6л" / "не більше 1.6" → displacement_min: null, displacement_max: 1.6
- "2.0 TDI" / "2.0 дизель" → displacement_min: 2.0, displacement_max: 2.0
- "1.5-2.0л" → displacement_min: 1.5, displacement_max: 2.0

РІК ВИПУСКУ (важливо — "від X" це НИЖНЯ межа, НЕ фіксований рік):
- "від 2019" / "з 2019 року" / "2019+" / "новіше 2019" → year_from: 2019, year_to: null
- "до 2021" / "не старше 2021" → year_to: 2021, year_from: null
- "2019-2022" / "між 2019 і 2022" → year_from: 2019, year_to: 2022
- "2020 рік" (один конкретний рік) → year_from: 2020, year_to: 2020
- НІКОЛИ не став year_to рівним year_from для запиту "від X" — це обмежує вибірку одним роком.

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
    // KNOWN_BRAND_SET is the shared source of truth (lib/picker/normalize.ts) — the
    // regex fallback derives its list from the same place, so an exotic brand like
    // "Aston Martin" can't be parsed here yet silently dropped there.
    const pairs: CarPair[] = Array.isArray(parsed.pairs)
      ? parsed.pairs
          .filter((p: any) => p.make || p.model)
          .map((p: any) => ({
            make: p.make ? normalizeBrand(p.make) : null,
            model: p.model ?? null,
          }))
          .filter((p: CarPair) => !p.make || KNOWN_BRAND_SET.has(p.make))  // reject hallucinated brands
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

    // Concern term ("ВАГ") in the client's words → expand to ALL group brands so
    // the search covers the whole concern, not just Volkswagen. Deterministic and
    // independent of what Claude returned for pairs (it doesn't know our group map).
    const groupMakes = detectBrandGroups(userText)
    const finalPairs: CarPair[] = groupMakes.length > 0
      ? groupMakes.map(make => ({ make, model: null }))
      : orderedPairs

    // Rule 8: when the client asks for alternatives ("які ще варіанти", "інші
    // марки"…), the AI returns an EMPTY pairs array so the parser searches the
    // whole class instead of one make. But a bare [] is ambiguous — the AI also
    // returns [] when it simply forgot to echo the previous pick. So we only honor
    // the clear when the latest message actually expresses an alternatives intent;
    // otherwise we keep the previous pairs (the safety net for a forgetful echo).
    const lastUserText = (
      messages.filter(m => m.role === "user").slice(-1)[0]?.content ?? ""
    ).toLowerCase()
    const wantsAlternatives =
      /альтернатив|які ще|інші марки|що ще|схож|порадите окрім|крім цього|alternativ|other options/i.test(lastUserText)
    const aiClearedPairs = Array.isArray(parsed.pairs) && parsed.pairs.length === 0

    return {
      pairs: finalPairs.length > 0
        ? finalPairs
        : (wantsAlternatives && aiClearedPairs ? [] : prev.pairs),
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

  // Brand detection — KNOWN_BRANDS_LOWER is derived from the shared canonical
  // list (lib/picker/normalize.ts) and pre-sorted longest-first, so "mercedes-benz"
  // wins over "mercedes" and "land rover" over a stray "rover".
  let detectedMake: string | null = null
  for (const b of KNOWN_BRANDS_LOWER) {
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

  // Concern term ("ВАГ") expands to all group brands — same rule as the Claude
  // path, so the fallback behaves identically when Claude is unreachable.
  const groupMakes = detectBrandGroups(text)

  return {
    ...prev,
    pairs: groupMakes.length > 0
      ? groupMakes.map(make => ({ make, model: null }))
      : detectedMake ? [{ make: detectedMake, model: null }] : prev.pairs,
    budget_min: budgetMin,
    budget_max: budgetMax,
    year_from: yearFrom,
    year_to: yearTo,
  }
}
