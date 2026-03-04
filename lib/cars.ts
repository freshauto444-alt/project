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

export async function getFeaturedOrderCars(): Promise<Car[]> {
  const supabase = createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .eq("source_type", "parser_hot")
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("price", { ascending: true })

  if (error) {
    console.error("getFeaturedOrderCars error:", error)
    return []
  }

  return (data ?? []).map(mapDbCar)
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