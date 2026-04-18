"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"

export function useSavedCars() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [savedCarIds, setSavedCarIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setSavedCarIds(new Set())
      return
    }
    supabase.from("saved_cars").select("car_id").eq("user_id", user.id).then(({ data }) => {
      setSavedCarIds(new Set((data || []).map(d => d.car_id)))
    })
  }, [user, supabase])

  const toggleSave = useCallback(async (carId: string) => {
    if (!user) {
      toast.info("Увійдіть, щоб зберігати авто")
      router.push("/login?redirect=" + encodeURIComponent(window.location.pathname))
      return
    }

    setLoading(true)
    const isSaved = savedCarIds.has(carId)

    if (isSaved) {
      await supabase.from("saved_cars").delete().eq("user_id", user.id).eq("car_id", carId)
      setSavedCarIds(prev => { const next = new Set(prev); next.delete(carId); return next })
      toast.success("Видалено зі збережених")
    } else {
      await supabase.from("saved_cars").insert({ user_id: user.id, car_id: carId })
      setSavedCarIds(prev => new Set(prev).add(carId))
      toast.success("Авто збережено")
    }
    setLoading(false)
  }, [user, savedCarIds, supabase, router])

  return { savedCarIds, toggleSave, loading }
}
