import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("id, role").eq("user_id", user.id).single()
  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { status, note } = await request.json()
  const validStatuses = ["new_lead", "car_selection", "payment", "delivery", "customs", "delivered"]
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const { error } = await supabase.from("orders").update({ status }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create status change note
  await supabase.from("order_notes").insert({
    order_id: id,
    author_id: profile.id,
    content: note || `Статус змінено на: ${status}`,
    note_type: "status_change",
  })

  return NextResponse.json({ success: true })
}
