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

// Map Ukrainian UI values → DB values
const FUEL_MAP: Record<string, string[]> = {
  "Бензин":        ["Petrol", "petrol", "PETROL"],
  "Дизель":        ["Diesel", "diesel", "DIESEL"],
  "Електро":       ["Electric", "electric", "ELECTRIC"],
  "Гібрид":        ["Hybrid", "hybrid", "HYBRID"],
  "Plug-in гібрид": ["Hybrid", "hybrid", "HYBRID_PETROL", "HYBRID_DIESEL"],
}

const TRANSMISSION_MAP: Record<string, string[]> = {
  "Автомат":  ["Automatic", "automatic", "AUTOMATIC_GEAR"],
  "Механіка": ["Manual", "manual", "MANUAL_GEAR"],
  "Робот":    ["Automatic", "automatic", "ROBOT"],
  "Варіатор": ["Automatic", "automatic", "CVT"],
}

function parseBudget(budget: string): { min: number | null; max: number | null } {
  if (!budget) return { min: null, max: null }
  if (budget.includes("до"))       return { min: null, max: 15000 }
  if (budget.includes("15 000 –")) return { min: 15000, max: 30000 }
  if (budget.includes("30 000 –")) return { min: 30000, max: 60000 }
  if (budget.includes("60 000 –")) return { min: 60000, max: 100000 }
  if (budget.includes("понад"))    return { min: 100000, max: null }
  return { min: null, max: null }
}

export async function POST(req: Request) {
  const { answers }: { answers: Answer[] } = await req.json()

  const byId = Object.fromEntries(answers.map(a => [a.questionId, a]))

  const fuel        = byId.fuel?.selected ?? []
  const year        = byId.year?.selected[0] ?? byId.year?.custom ?? null
  const transmission = byId.transmission?.selected[0] ?? null
  const budget      = byId.budget?.selected[0] ?? byId.budget?.custom ?? null

  // Build query
  let query = supabase
    .from("cars")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20)

  // Year
  if (year) {
    const yearNum = parseInt(year)
    if (!isNaN(yearNum)) query = query.gte("year", yearNum)
  }

  // Budget
  const { min: priceMin, max: priceMax } = parseBudget(budget ?? "")
  if (priceMin) query = query.gte("price", priceMin)
  if (priceMax) query = query.lte("price", priceMax)

  // Fuel — OR across selected types
  if (fuel.length > 0) {
    const dbFuels = fuel.flatMap(f => FUEL_MAP[f] ?? [f])
    const unique = [...new Set(dbFuels)]
    query = query.in("fuel", unique)
  }

  // Transmission
  if (transmission) {
    const dbTransmissions = TRANSMISSION_MAP[transmission] ?? [transmission]
    query = query.in("transmission", dbTransmissions)
  }

  const { data, error } = await query

  if (error) {
    console.error("[ai-picker/search]", error)
    return NextResponse.json({ cars: [] })
  }

  return NextResponse.json({ cars: data ?? [] })
}