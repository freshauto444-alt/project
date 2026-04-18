import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ orders: [] })

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return NextResponse.json({ orders: data || [] })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const body = await request.json()

  const { data, error } = await supabase.from("orders").insert({
    user_id: user?.id || null,
    car_id: body.car_id || null,
    status: "new_lead",
    payment_method: body.payment_method || null,
    total_price: body.total_price || null,
    customer_name: body.customer_name || null,
    customer_email: body.customer_email || null,
    customer_phone: body.customer_phone || null,
    customer_company: body.customer_company || null,
    notes: body.notes || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ order: data })
}
