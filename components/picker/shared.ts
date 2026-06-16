// ═══════════════════════════════════════════════════════════════════════════════
//  Shared foundation for the unified picker — API mapping, streaming search,
//  types, the survey question set and tag building. No JSX (imported by the
//  picker's client components). Extracted from unified-picker.tsx.
// ═══════════════════════════════════════════════════════════════════════════════

import type React from "react"
import {
  DollarSign, Sparkles, Car, Fuel, Calendar, Settings2, Zap, Gauge,
  SlidersHorizontal, DoorOpen, Users, Palette, Armchair,
} from "lucide-react"
import { type Car as CarType } from "@/lib/data"

// ─── API → CarType mapper ──────────────────────────────────────────────────────
// The parser API returns snake_case keys; CarType uses camelCase.
export function mapApiCar(raw: any): CarType {
  return {
    ...raw,
    colorUa: raw.colorUa ?? raw.color_ua,
    fuelUa: raw.fuelUa ?? raw.fuel_ua,
    bodyType: raw.bodyType ?? raw.body_type,
    bodyTypeUa: raw.bodyTypeUa ?? raw.body_type_ua,
    statusUa: raw.statusUa ?? raw.status_ua,
    featuresUa: raw.featuresUa ?? raw.features_ua ?? [],
    safetyFeatures: raw.safetyFeatures ?? raw.safety_features ?? [],
    comfortFeatures: raw.comfortFeatures ?? raw.comfort_features ?? [],
    infotainment: raw.infotainment ?? [],
    seatMaterial: raw.seatMaterial ?? raw.seat_material,
    seatMaterialUa: raw.seatMaterialUa ?? raw.seat_material_ua,
    countryUa: raw.countryUa ?? raw.country_ua,
    plateType: raw.plateType ?? raw.plate_type,
    sourceType: raw.sourceType ?? raw.source_type,
    sourceUrl: raw.sourceUrl ?? raw.source_url,
    sourceSite: raw.sourceSite ?? raw.source_site,
    features: raw.features ?? [],
    gallery: raw.gallery ?? [],
    history: raw.history ?? [],
  }
}

// Streaming search: opens SSE to /api/ai-picker/stream and invokes callbacks
// as each parser source completes. Lets the UI append cars progressively.
export interface StreamPayload {
  make?: string | null
  model?: string | null
  body_type?: string | null
  fuel?: string | null
  transmission?: string | null
  drive?: string | null
  color?: string | null
  vehicle_type?: string | null
  year_from?: number | null
  year_to?: number | null
  budget_min?: number | null
  budget_max?: number | null
}
export interface StreamCallbacks {
  onCars?: (cars: CarType[], source: string) => void
  onDone?: (total: number) => void
  onError?: (msg: string) => void
}
export async function streamSearch(
  payload: StreamPayload,
  signal: AbortSignal,
  cb: StreamCallbacks,
): Promise<void> {
  let res: Response
  try {
    res = await fetch("/api/ai-picker/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify(payload),
    })
  } catch (e: any) {
    if (e?.name !== "AbortError") cb.onError?.(e?.message ?? "Network error")
    return
  }
  if (!res.ok || !res.body) {
    cb.onError?.(`HTTP ${res.status}`)
    return
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split("\n")
      buf = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        try {
          const ev = JSON.parse(line.slice(6))
          if (ev.error) cb.onError?.(ev.error)
          if (ev.cars && Array.isArray(ev.cars) && ev.cars.length > 0) {
            cb.onCars?.(ev.cars.map(mapApiCar), ev.source ?? "?")
          }
          if (ev.done) cb.onDone?.(ev.total ?? 0)
        } catch { /* skip malformed event */ }
      }
    }
  } catch (e: any) {
    if (e?.name !== "AbortError") cb.onError?.(e?.message ?? "Stream error")
  }
}

// crypto.randomUUID is missing in Safari < 15.4 and older Android Chrome.
// Polyfill with a Math.random-based v4 — collision-safe enough for client_order_id.
export function makeUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Answer {
  questionId: string
  selected: string[]
  custom: string
}

export interface Question {
  id: string
  icon: React.ElementType
  title: string
  subtitle: string
  options: string[]
  multi: boolean
}

export interface RetrySuggestion {
  label: string
  prefs: Record<string, unknown>  // diff to merge into chatPreferences
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  retrySuggestion?: RetrySuggestion | null
}

// ─── Questions ────────────────────────────────────────────────────────────────

export const QUESTIONS: Question[] = [
  {
    id: "budget",
    icon: DollarSign,
    title: "Який ваш бюджет?",
    subtitle: "Вкажіть діапазон в EUR",
    multi: false,
    options: [], // Custom UI — rendered as two number inputs
  },
  {
    id: "purpose",
    icon: Sparkles,
    title: "Для чого авто?",
    subtitle: "Швидкий пресет — можна обрати декілька",
    multi: true,
    options: ["Місто", "Подорожі", "Спорт", "Сім'я", "Бізнес", "Робота", "Інвестиція"],
  },
  {
    id: "body",
    icon: Car,
    title: "Який тип транспорту?",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: [
      "Седан", "Хетчбек", "Універсал", "Позашляховик", "Купе", "Кабріолет",
      "Мікроавтобус", "Пікап", "Вантажівка", "Автобус", "Мотоцикл", "Багі", "Спецтехніка",
    ],
  },
  {
    id: "fuel",
    icon: Fuel,
    title: "Тип палива",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: ["Бензин", "Дизель", "Електро", "Гібрид", "Plug-in гібрид", "Газ (LPG)", "Газ (CNG)", "Етанол", "Водень"],
  },
  {
    id: "year",
    icon: Calendar,
    title: "Рік випуску",
    subtitle: "Оберіть діапазон — від та до",
    multi: false,
    options: [],
  },
  {
    id: "transmission",
    icon: Settings2,
    title: "Тип трансмісії",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: ["Автомат", "Механіка", "Робот (DSG/DCT)", "Варіатор (CVT)"],
  },
  {
    id: "drive",
    icon: Zap,
    title: "Який привід?",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: ["Передній (FWD)", "Задній (RWD)", "Повний (AWD/4WD)"],
  },
  {
    id: "mileage",
    icon: Gauge,
    title: "Пробіг",
    subtitle: "Діапазон в км",
    multi: false,
    options: [],
  },
  {
    id: "engine",
    icon: SlidersHorizontal,
    title: "Об'єм двигуна",
    subtitle: "Діапазон в літрах",
    multi: false,
    options: [],
  },
  {
    id: "hp",
    icon: Zap,
    title: "Потужність",
    subtitle: "Мінімум к.с.",
    multi: false,
    options: [],
  },
  {
    id: "doors",
    icon: DoorOpen,
    title: "Кількість дверей",
    subtitle: "Оберіть одну",
    multi: false,
    options: ["2", "3", "4", "5"],
  },
  {
    id: "seats",
    icon: Users,
    title: "Кількість місць",
    subtitle: "Оберіть одну",
    multi: false,
    options: ["2", "4", "5", "7+"],
  },
  {
    id: "color",
    icon: Palette,
    title: "Колір кузова",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: ["Білий", "Чорний", "Сірий", "Сріблястий", "Синій", "Червоний", "Зелений", "Коричневий", "Бежевий", "Жовтий"],
  },
  {
    id: "interior",
    icon: Armchair,
    title: "Матеріал салону",
    subtitle: "Можна обрати декілька",
    multi: true,
    options: ["Шкіра", "Екошкіра", "Тканина", "Велюр", "Алькантара", "Комбінований", "Карбон"],
  },
]

// Mapping: Ukrainian color names → English (for API)
export const COLOR_HEX: Record<string, string> = {
  "Білий": "#F5F5F5", "Чорний": "#1A1A1A", "Сірий": "#9CA3AF",
  "Сріблястий": "#C0C0C0", "Синій": "#3B82F6", "Червоний": "#EF4444",
  "Зелений": "#10B981", "Коричневий": "#92400E", "Бежевий": "#E8D9C0",
  "Жовтий": "#FBBF24",
}

export const EMPTY_ANSWERS: Answer[] = QUESTIONS.map(q => ({
  questionId: q.id,
  selected: [],
  custom: "",
}))

// Question IDs whose `selected` is a [from, to] range — render as "from – to"
// (or "from" / "to" when only one side is set). Without this, range answers
// produce duplicate tags like ["5", "5"] for engine 5–5.
export const RANGE_QUESTIONS = new Set(["year", "mileage", "engine", "budget"])

export function buildTags(answers: Answer[]): string[] {
  const tags: string[] = []
  answers.forEach(a => {
    if (RANGE_QUESTIONS.has(a.questionId)) {
      const from = a.selected[0] ?? ""
      const to = a.selected[1] ?? ""
      if (from && to) tags.push(from === to ? from : `${from} – ${to}`)
      else if (from || to) tags.push(from || to)
    } else {
      a.selected.forEach(s => tags.push(s))
      if (a.custom.trim()) tags.push(a.custom.trim())
    }
  })
  return tags
}
