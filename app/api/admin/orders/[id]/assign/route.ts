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

  const { manager_id } = await request.json()

  const { error } = await supabase.from("orders").update({ manager_id }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get manager name
  const { data: mgr } = await supabase.from("profiles").select("full_name").eq("id", manager_id).single()

  await supabase.from("order_notes").insert({
    order_id: id,
    author_id: profile.id,
    content: `Призначено менеджера: ${mgr?.full_name || "—"}`,
    note_type: "assignment",
  })

  return NextResponse.json({ success: true })
}
