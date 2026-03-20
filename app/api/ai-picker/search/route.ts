import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

interface Answer {
  questionId: string
  selected: string[]
  custom: string
}

const FUEL_MAP: Record<string, string[]> = {
  "Бензин":         ["Petrol", "petrol", "PETROL"],
  "Дизель":         ["Diesel", "diesel", "DIESEL"],
  "Електро":        ["Electric", "electric", "ELECTRIC"],
  "Гібрид":         ["Hybrid", "hybrid", "HYBRID"],
  "Plug-in гібрид": ["Hybrid", "hybrid", "HYBRID_PETROL", "HYBRID_DIESEL"],
}

const TRANSMISSION_MAP: Record<string, string[]> = {
  "Автомат":  ["Automatic", "automatic", "AUTOMATIC_GEAR"],
  "Механіка": ["Manual", "manual", "MANUAL_GEAR"],
  "Робот":    ["Automatic", "automatic", "ROBOT"],
  "Варіатор": ["Automatic", "automatic", "CVT"],
}

const BODY_MAP: Record<string, string[]> = {
  "Універсал":   ["Estate", "Station Wagon"],
  "Седан":       ["Sedan", "Saloon"],
  "Позашляховик": ["SUV"],
  "Хетчбек":     ["Hatchback"],
  "Купе":        ["Coupe"],
  "Кабріолет":   ["Convertible"],
  "Мінівен":     ["Van", "Minivan"],
}

function parseBudget(budget: string): { min: number | null; max: number | null } {
  if (!budget) return { min: null, max: null }
  const rangeMatch = budget.match(/([\d\s]+)\s*[–-]\s*([\d\s]+)/)
  if (rangeMatch) {
    return {
      min: parseInt(rangeMatch[1].replace(/\s/g, "")),
      max: parseInt(rangeMatch[2].replace(/\s/g, "")),
    }
  }
  if (budget.includes("понад")) {
    const m = budget.match(/([\d\s]+)/)
    return { min: m ? parseInt(m[1].replace(/\s/g, "")) : null, max: null }
  }
  const plain = parseInt(budget.replace(/\D/g, ""))
  if (!isNaN(plain) && plain > 0) return { min: null, max: plain }
  return { min: null, max: null }
}

async function extractMakeModelFromAnswers(answers: Answer[]): Promise<{ make: string | null; model: string | null }> {
  const customTexts = answers
    .map(a => a.custom?.trim())
    .filter(Boolean)
    .join(" ")

  if (!customTexts) return { make: null, model: null }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 40,
        system: 'Extract car make and model from text (Ukrainian/Russian/English). Examples: "пасат"→{"make":"Volkswagen","model":"Passat"}, "бмв х5"→{"make":"BMW","model":"X5"}, "audi a4"→{"make":"Audi","model":"A4"}. Return ONLY valid JSON: {"make":"...","model":"..."} or {"make":null,"model":null}.',
        messages: [{ role: "user", content: customTexts }],
      }),
    })
    const data = await res.json()
    return JSON.parse(data.content?.[0]?.text?.trim() ?? "{}")
  } catch {
    return { make: null, model: null }
  }
}

export async function POST(req: Request) {
  const { answers }: { answers: Answer[] } = await req.json()

  const byId = Object.fromEntries(answers.map(a => [a.questionId, a]))

  const fuel         = byId.fuel?.selected ?? []
  const body         = byId.body?.selected ?? []
  const year         = byId.year?.selected[0] ?? byId.year?.custom ?? null
  const transmission = byId.transmission?.selected[0] ?? null
  const budget       = byId.budget?.selected[0] ?? byId.budget?.custom ?? null

  const { make, model } = await extractMakeModelFromAnswers(answers)
  console.log("[search] extracted make/model:", { make, model })

  let query = supabase
    .from("cars")
    .select("*")
    .eq("status", "Available")
    .order("created_at", { ascending: false })
    .limit(20)

  if (make) query = query.ilike("make", `%${make}%`)
  if (model) query = query.ilike("model", `%${model}%`)

  if (year) {
    const yearNum = parseInt(year)
    if (!isNaN(yearNum)) query = query.gte("year", yearNum)
  }

  const { min: priceMin, max: priceMax } = parseBudget(budget ?? "")
  if (priceMin) query = query.gte("price", priceMin)
  if (priceMax) query = query.lte("price", priceMax)

  if (fuel.length > 0) {
    const dbFuels = fuel.flatMap(f => FUEL_MAP[f] ?? [f])
    query = query.in("fuel", [...new Set(dbFuels)])
  }

  if (transmission) {
    const dbTrans = TRANSMISSION_MAP[transmission] ?? [transmission]
    query = query.in("transmission", dbTrans)
  }

  // ── Фільтр по типу кузова ─────────────────────────────────────────────────
  if (body.length > 0) {
    const dbBodies = body.flatMap(b => BODY_MAP[b] ?? [b])
    query = query.in("body_type", [...new Set(dbBodies)])
  }

  const { data, error } = await query

  if (error) {
    console.error("[ai-picker/search]", error)
    return NextResponse.json({ cars: [] })
  }

  return NextResponse.json({ cars: data ?? [] })
}