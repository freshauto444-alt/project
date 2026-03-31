// lib/cars.ts
import { createClient } from "@/lib/supabase/server"
import { mapDbCar, type Car } from "@/lib/data"

export async function getStockCars(): Promise<Car[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .eq("source_type", "stock")
    .order("price", { ascending: true })

  if (error) {
    console.error("getStockCars error:", error)
    return []
  }

  return (data ?? []).map(mapDbCar)
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

export async function getFeaturedOrderCars(): Promise<Car[]> {
  const supabase = createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .in("source_type", ["parser_hot", "parser_featured"])
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .not("image", "is", null)
    .limit(200)

  if (error) {
    console.error("getFeaturedOrderCars error:", error)
    return []
  }

  const cars = (data ?? []).map(mapDbCar).filter(c => c.image)

  // Sort by value score (best deals first)
  cars.sort((a, b) => calcValueScore(b) - calcValueScore(a))

  return cars
}

/** Used by /car/[id] — works for any source_type */
export async function getCar(id: string): Promise<Car | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .eq("id", id)
    .single()

  if (error) return null
  return mapDbCar(data)
}

/** @deprecated Use getStockCars() for /catalog or getFeaturedOrderCars() for /order */
export async function getCars(): Promise<Car[]> {
  return getStockCars()
}