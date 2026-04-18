"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { User, Heart, Clock, Settings, Car, Gauge, Fuel, MapPin, Loader2, Save, Lock, Bell, LogOut, ChevronRight } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import { useSettings } from "@/lib/settings-context"
import { mapDbCar, type Car as CarType, formatMileage } from "@/lib/data"

const ORDER_STATUS_UA: Record<string, string> = {
  new_lead: "Новий",
  car_selection: "Підбір авто",
  payment: "Оплата",
  delivery: "Доставка",
  customs: "Розмитнення",
  delivered: "Передано",
}

const STATUS_COLORS: Record<string, string> = {
  new_lead: "bg-blue-500/15 text-blue-400",
  car_selection: "bg-amber-500/15 text-amber-400",
  payment: "bg-purple-500/15 text-purple-400",
  delivery: "bg-orange-500/15 text-orange-400",
  customs: "bg-yellow-500/15 text-yellow-400",
  delivered: "bg-emerald-500/15 text-emerald-400",
}

type Tab = "overview" | "saved" | "history" | "settings"

export default function ProfileClient() {
  const router = useRouter()
  const { user, profile, signOut, refreshProfile } = useAuth()
  const { formatPrice } = useSettings()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>("overview")
  const [savedCars, setSavedCars] = useState<CarType[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Edit profile state
  const [editName, setEditName] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [saving, setSaving] = useState(false)

  // Password change
  const [newPassword, setNewPassword] = useState("")
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState("")

  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name || "")
      setEditPhone(profile.phone || "")
    }
  }, [profile])

  useEffect(() => {
    if (!user) return
    setLoading(true)

    Promise.all([
      // Fetch saved cars
      supabase.from("saved_cars").select("car_id").eq("user_id", user.id).then(async ({ data }) => {
        if (!data?.length) return []
        const carIds = data.map(d => d.car_id)
        const { data: cars } = await supabase.from("cars").select("*").in("id", carIds)
        return (cars || []).map(mapDbCar)
      }),
      // Fetch orders
      supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => data || []),
    ]).then(([cars, ords]) => {
      setSavedCars(cars)
      setOrders(ords)
      setLoading(false)
    })
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveProfile = useCallback(async () => {
    if (!profile) return
    setSaving(true)
    await supabase.from("profiles").update({ full_name: editName, phone: editPhone }).eq("id", profile.id)
    await refreshProfile()
    setSaving(false)
  }, [profile, editName, editPhone, supabase, refreshProfile])

  const handleChangePassword = useCallback(async () => {
    if (newPassword.length < 8) return
    setPwSaving(true)
    setPwMsg("")
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwMsg(error ? error.message : "Пароль змінено!")
    setNewPassword("")
    setPwSaving(false)
  }, [newPassword, supabase])

  const handleRemoveSaved = useCallback(async (carId: string) => {
    if (!user) return
    await supabase.from("saved_cars").delete().eq("user_id", user.id).eq("car_id", carId)
    setSavedCars(prev => prev.filter(c => c.id !== carId))
  }, [user, supabase])

  if (!user || !profile) return null

  const initials = profile.full_name
    ? profile.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : user.email?.[0]?.toUpperCase() || "?"

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: "Огляд", icon: User },
    { id: "saved", label: "Збережені", icon: Heart },
    { id: "history", label: "Замовлення", icon: Clock },
    { id: "settings", label: "Налаштування", icon: Settings },
  ]

  return (
    <div className="pt-24 pb-20 px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        {/* Header card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-card p-8 mb-6"
        >
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/[0.1] text-lg font-bold text-primary">
              {initials}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">{profile.full_name || "Користувач"}</h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              {profile.phone && <p className="text-xs text-muted-foreground/60 mt-0.5">{profile.phone}</p>}
            </div>
            <div className="hidden sm:flex gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-foreground">{savedCars.length}</div>
                <div className="text-[10px] text-muted-foreground">Збережених</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{orders.length}</div>
                <div className="text-[10px] text-muted-foreground">Замовлень</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl border border-border bg-card p-1 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium transition-all cursor-pointer ${
                tab === t.id ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* OVERVIEW */}
            {tab === "overview" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <button onClick={() => setTab("saved")} className="rounded-2xl border border-border bg-card p-5 text-left hover:border-primary/20 transition-colors cursor-pointer">
                    <Heart className="h-5 w-5 text-primary mb-3" />
                    <div className="text-lg font-bold text-foreground">{savedCars.length}</div>
                    <div className="text-xs text-muted-foreground">Збережених авто</div>
                  </button>
                  <button onClick={() => setTab("history")} className="rounded-2xl border border-border bg-card p-5 text-left hover:border-primary/20 transition-colors cursor-pointer">
                    <Clock className="h-5 w-5 text-primary mb-3" />
                    <div className="text-lg font-bold text-foreground">{orders.length}</div>
                    <div className="text-xs text-muted-foreground">Замовлень</div>
                  </button>
                  <button onClick={() => router.push("/picker")} className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 text-left hover:bg-primary/[0.08] transition-colors cursor-pointer">
                    <Car className="h-5 w-5 text-primary mb-3" />
                    <div className="text-sm font-bold text-primary">AI Підбір</div>
                    <div className="text-xs text-muted-foreground">Знайти ідеальне авто</div>
                  </button>
                </div>

                {orders.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Останні замовлення</h3>
                    {orders.slice(0, 3).map((o) => (
                      <div key={o.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                        <div>
                          <p className="text-xs font-medium text-foreground">{o.customer_name || "Замовлення"}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleDateString("uk-UA")}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[o.status] || "bg-muted text-muted-foreground"}`}>
                          {ORDER_STATUS_UA[o.status] || o.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* SAVED CARS */}
            {tab === "saved" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {savedCars.length === 0 ? (
                  <div className="text-center py-16">
                    <Heart className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Поки немає збережених авто</p>
                    <button onClick={() => router.push("/catalog")} className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all cursor-pointer">
                      Перейти до каталогу
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {savedCars.map((car) => (
                      <div key={car.id} className="rounded-2xl border border-border bg-card overflow-hidden group">
                        <div className="relative aspect-[16/9] overflow-hidden">
                          {car.image && (
                            <img src={car.image} alt={`${car.make} ${car.model}`} crossOrigin="anonymous" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                          <div className="absolute bottom-3 left-3">
                            <h3 className="text-sm font-bold text-white drop-shadow">{car.make} {car.model} {car.year}</h3>
                          </div>
                          <button
                            onClick={() => handleRemoveSaved(car.id)}
                            className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                          >
                            <Heart className="h-4 w-4 fill-current" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Gauge className="h-3 w-3" />{formatMileage(car.mileage)}</span>
                            <span className="flex items-center gap-1"><Fuel className="h-3 w-3" />{car.fuelUa}</span>
                          </div>
                          <span className="text-sm font-bold text-foreground">{formatPrice(car.price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ORDER HISTORY */}
            {tab === "history" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {orders.length === 0 ? (
                  <div className="text-center py-16">
                    <Clock className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Поки немає замовлень</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((o) => (
                      <div key={o.id} className="rounded-2xl border border-border bg-card p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {o.car_id ? `Замовлення на авто` : "Нове замовлення"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(o.created_at).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[o.status] || "bg-muted text-muted-foreground"}`}>
                            {ORDER_STATUS_UA[o.status] || o.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">Оплата: </span>
                            <span className="text-foreground">{o.payment_method || "—"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Сума: </span>
                            <span className="font-medium text-foreground">{o.total_price ? formatPrice(o.total_price) : "—"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* SETTINGS */}
            {tab === "settings" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {/* Edit profile */}
                <div className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Профіль</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Ім'я</label>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-2.5 text-sm text-foreground focus:border-primary/40 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Телефон</label>
                      <input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-2.5 text-sm text-foreground focus:border-primary/40 focus:outline-none transition-colors"
                        placeholder="+380..."
                      />
                    </div>
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Зберегти
                    </button>
                  </div>
                </div>

                {/* Change password */}
                <div className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /> Безпека</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Новий пароль</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl border border-border bg-secondary/30 px-4 py-2.5 text-sm text-foreground focus:border-primary/40 focus:outline-none transition-colors"
                        placeholder="Мінімум 8 символів"
                      />
                    </div>
                    {pwMsg && <p className={`text-xs ${pwMsg.includes("Пароль") ? "text-emerald-400" : "text-destructive"}`}>{pwMsg}</p>}
                    <button
                      onClick={handleChangePassword}
                      disabled={newPassword.length < 8 || pwSaving}
                      className="flex items-center gap-2 rounded-xl bg-secondary px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/80 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {pwSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                      Змінити пароль
                    </button>
                  </div>
                </div>

                {/* Sign out */}
                <button
                  onClick={signOut}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/[0.04] py-3.5 text-sm font-medium text-destructive hover:bg-destructive/[0.08] transition-all cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Вийти з акаунту
                </button>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
