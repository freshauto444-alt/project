// lib/cars.ts
import { createClient } from "@/lib/supabase/server"
import { mapDbCar, type Car } from "@/lib/data"

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

// Cars in company's own inventory.
//   • Primary: source_type = "stock" — manually entered by admin / imported
//   • Fallback: any car with status = "In Stock" (covers cars without explicit
//     source_type = "stock" but marked as available — common when migrating data)
export async function getStockCars(): Promise<Car[]> {
  // Check env first — fail loud rather than silently return [] on misconfigured deploys
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("[cars] getStockCars: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
    return []
  }
  return withTimeout(
    (async () => {
      try {
        const supabase = await createClient()
        const { data, error } = await supabase
          .from("cars")
          .select("*")
          .or("source_type.eq.stock,status.eq.In Stock")
          .not("image", "is", null)
          .order("price", { ascending: true })

        if (error) {
          const formatted = formatDbError(error)
          if (formatted) console.warn(`[cars] getStockCars: ${formatted}`)
          return []
        }

        const cars = (data ?? []).map(mapDbCar).filter(c => c.image)
        console.log(`[cars] getStockCars: ${cars.length} cars (raw rows: ${data?.length ?? 0})`)
        return cars
      } catch (err) {
        const formatted = formatDbError(err)
        if (formatted) console.warn(`[cars] getStockCars threw: ${formatted}`)
        return []
      }
    })(),
    3000,
    [] as Car[],
  )
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
        const now = new Date().toISOString()
        // Fetch a wider pool than `limit` so client-side ranking by value-score
        // returns the best in the requested page slice. Capped at 200 per request.
        const fetchLimit = Math.min(200, offset + limit + 50)
        const { data, error, count } = await supabase
          .from("cars")
          .select("*", { count: "exact" })
          .in("source_type", ["parser_hot", "parser_featured"])
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .not("image", "is", null)
          .limit(fetchLimit)

        if (error) {
          const formatted = formatDbError(error)
          if (formatted) console.warn(`[cars] getFeaturedOrderCars: ${formatted}`)
          return { cars: [] as Car[], total: 0 }
        }

        const all = (data ?? []).map(mapDbCar).filter(c => c.image)
        all.sort((a, b) => calcValueScore(b) - calcValueScore(a))
        const sliced = all.slice(offset, offset + limit)
        console.log(`[cars] getFeaturedOrderCars(offset=${offset}, limit=${limit}): ${sliced.length} returned (pool: ${all.length}, count: ${count ?? "?"})`)
        return {
          cars: sliced,
          total: count ?? all.length,
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