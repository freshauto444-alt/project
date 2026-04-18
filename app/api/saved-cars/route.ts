import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ids: [] })

  const { data } = await supabase.from("saved_cars").select("car_id").eq("user_id", user.id)
  return NextResponse.json({ ids: (data || []).map(d => d.car_id) })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { car_id } = await request.json()
  if (!car_id) return NextResponse.json({ error: "car_id required" }, { status: 400 })

  // Toggle: if exists delete, otherwise insert
  const { data: existing } = await supabase
    .from("saved_cars")
    .select("id")
    .eq("user_id", user.id)
    .eq("car_id", car_id)
    .single()

  if (existing) {
    await supabase.from("saved_cars").delete().eq("id", existing.id)
    return NextResponse.json({ saved: false })
  } else {
    await supabase.from("saved_cars").insert({ user_id: user.id, car_id })
    return NextResponse.json({ saved: true })
  }
}
