import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify admin/manager role
  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).single()
  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [ordersRes, leadsRes, customersRes] = await Promise.all([
    supabase.from("orders").select("status, total_price, created_at, manager_id"),
    supabase.from("leads").select("status, source"),
    supabase.from("profiles").select("id").eq("role", "user"),
  ])

  const orders = ordersRes.data || []
  const leads = leadsRes.data || []

  return NextResponse.json({
    total_orders: orders.length,
    active_orders: orders.filter(o => o.status !== "delivered").length,
    total_revenue: orders.filter(o => o.status === "delivered").reduce((s, o) => s + (o.total_price || 0), 0),
    total_leads: leads.length,
    new_leads: leads.filter(l => l.status === "new").length,
    total_customers: customersRes.data?.length || 0,
    orders_by_status: Object.fromEntries(
      ["new_lead", "car_selection", "payment", "delivery", "customs", "delivered"].map(s => [s, orders.filter(o => o.status === s).length])
    ),
  })
}
