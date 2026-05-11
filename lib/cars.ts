// lib/cars.ts
import { createClient } from "@/lib/supabase/server"
import { mapDbCar, cars as seedCars, type Car } from "@/lib/data"

// Fast-fail wrapper — Supabase SDK's default fetch has no timeout, so a
// DNS-failed project (or unreachable DB) hangs server-side rendering for 15-30s.
// Cap at 3s: if DB is unreachable, page renders empty state immediately.
function withTimeout<T>(promise: Promise<T>, ms = 3000, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms)
    promise.then(
      (v) => { clearTimeout(t); resolve(v) },
      () => { clearTimeout(t); resolve(fallback) },
    )
  })
}

// Format unknown error into a loggable string, pulling out Supabase/fetch-specific fields.
// Returns `null` for "expected" unreachable-DB errors (DNS/fetch fail) so we stay quiet.
function formatDbError(err: unknown): string | null {
  const e = err as { message?: string; code?: string; details?: string; hint?: string; cause?: { code?: string } } | null
  if (!e) return "unknown error"
  const msg = e.message ?? ""
  // Swallow DNS/network failures silently — the DB is just unreachable (dev without backend).
  if (msg.includes("fetch failed") || e.cause?.code === "ENOTFOUND" || e.cause?.code === "ECONNREFUSED") {
    return null
  }
  const parts = [msg]
  if (e.code) parts.push(`code=${e.code}`)
  if (e.details) parts.push(e.details)
  if (e.hint) parts.push(`hint=${e.hint}`)
  return parts.filter(Boolean).join(" · ") || "empty error object"
}

// Company's own showroom inventory. Combines:
//   1. Static seed cars from lib/data.ts (12 premium showcase units —
//      Porsche, BMW, Mercedes, Lamborghini, Ferrari, McLaren). These are
//      hardcoded today; future admin UI can replace this with DB rows.
//   2. Any DB cars tagged source_type='stock' (when admin starts adding them).
//
// Parser-feed cars (parser_hot / parser_featured) are intentionally excluded
// here — they belong on /order. The split:
//   • /catalog → showroom inventory (this)
//   • /order   → parser feed, server-paginated
export async function getStockCars(): Promise<Car[]> {
  // Always include hardcoded showroom cars — these are the curated showcase.
  const showcase = seedCars.filter(c => c.image)

  // Try to enrich with any DB-tagged stock cars; fall back gracefully if DB
  // is unreachable or the env is missing.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn("[cars] getStockCars: NEXT_PUBLIC_SUPABASE_* missing — returning showcase only")
    return showcase
  }

  const dbStock = await withTimeout(
    (async () => {
      try {
        const supabase = await createClient()
        const { data, error } = await supabase
          .from("cars")
          .select("*")
          .eq("source_type", "stock")
          .not("image", "is", null)
          .order("price", { ascending: true })
          .limit(200)

        if (error) {
          const formatted = formatDbError(error)
          if (formatted) console.warn(`[cars] getStockCars: ${formatted}`)
          return [] as Car[]
        }
        return (data ?? []).map(mapDbCar).filter(c => c.image)
      } catch (err) {
        const formatted = formatDbError(err)
        if (formatted) console.warn(`[cars] getStockCars threw: ${formatted}`)
        return [] as Car[]
      }
    })(),
    3000,
    [] as Car[],
  )

  // Dedupe: DB cars take precedence over seed if same id (shouldn't happen
  // since seed ids are "1".."12", but safety-net).
  const seenIds = new Set(dbStock.map(c => c.id))
  const merged = [...dbStock, ...showcase.filter(c => !seenIds.has(c.id))]
  console.log(`[cars] getStockCars: ${merged.length} cars (db: ${dbStock.length}, showcase: ${showcase.length})`)
  return merged
}

/**
 * Price-quality score: newer + lower mileage + lower price + has image = better.
 * Range roughly 0–100, higher = better value.
 */
function calcValueScore(car: Car): number {
  let score = 0
  const currentYear = new Date().getFullYear()

  // Year: newer is better (max 30 pts for current year, 0 for 2010)
  if (car.year) {
    const age = currentYear - car.year
    score += Math.max(0, 30 - age * 3)
  }

  // Mileage: lower is better (max 25 pts for 0km, 0 for 300k+)
  if (car.mileage != null) {
    score += Math.max(0, 25 - (car.mileage / 12000))
  } else {
    score += 10 // unknown mileage gets middle score
  }

  // Price: lower price relative to year = better value (max 25 pts)
  if (car.price && car.year) {
    // Expected price: ~3000 EUR per year of age baseline
    const expectedPrice = Math.max(10000, (currentYear - car.year) * 4000 + 15000)
    const ratio = car.price / expectedPrice
    if (ratio <= 0.7) score += 25      // great deal
    else if (ratio <= 1.0) score += 20 // fair
    else if (ratio <= 1.3) score += 12 // slightly above
    else score += 5                    // expensive
  }

  // Has image: +10
  if (car.image) score += 10

  // Has features: +5
  if (car.safetyFeatures?.length > 0 || car.comfortFeatures?.length > 0) score += 5

  // Horsepower bonus: +5 for 150+
  if (car.horsepower >= 150) score += 5

  return score
}

export async function getFeaturedOrderCars(
  offset: number = 0,
  limit: number = 50,
): Promise<{ cars: Car[]; total: number }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("[cars] getFeaturedOrderCars: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
    return { cars: [], total: 0 }
  }
  return withTimeout(
    (async () => {
      try {
        const supabase = await createClient()
        // Server-side pagination via .range() — fetches exactly `limit` rows
        // per request instead of pulling a 200-row pool and slicing in memory.
        // This dodges Supabase's 1MB response cap (cars with 30+ photos in
        // their gallery weigh ~10KB each, so 200 rows can exceed the limit
        // and silently truncate, hiding heavy-photo cars from the listing).
        // Ordering by price keeps pagination stable across requests.
        const { data, error, count } = await supabase
          .from("cars")
          .select("*", { count: "exact" })
          .in("source_type", ["parser_hot", "parser_featured"])
          .not("image", "is", null)
          .order("price", { ascending: true, nullsFirst: false })
          .range(offset, offset + limit - 1)

        if (error) {
          const formatted = formatDbError(error)
          if (formatted) console.warn(`[cars] getFeaturedOrderCars: ${formatted}`)
          return { cars: [] as Car[], total: 0 }
        }

        const cars = (data ?? []).map(mapDbCar).filter(c => c.image)
        console.log(`[cars] getFeaturedOrderCars(offset=${offset}, limit=${limit}): ${cars.length} returned (count: ${count ?? "?"})`)
        return {
          cars,
          total: count ?? 0,
        }
      } catch (err) {
        const formatted = formatDbError(err)
        if (formatted) console.warn(`[cars] getFeaturedOrderCars threw: ${formatted}`)
        return { cars: [] as Car[], total: 0 }
      }
    })(),
    3000,
    { cars: [] as Car[], total: 0 },
  )
}

/** Used by /car/[id] — works for any source_type */
export async function getCar(id: string): Promise<Car | null> {
  return withTimeout(
    (async () => {
      try {
        const supabase = await createClient()
        const { data, error } = await supabase
          .from("cars")
          .select("*")
          .eq("id", id)
          .single()

        if (error || !data) return null
        return mapDbCar(data)
      } catch {
        return null
      }
    })(),
    3000,
    null as Car | null,
  )
}

/** @deprecated Use getStockCars() for /catalog or getFeaturedOrderCars() for /order */
export async function getCars(): Promise<Car[]> {
  return getStockCars()
}