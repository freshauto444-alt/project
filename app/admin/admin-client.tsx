"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import {
  LayoutDashboard, Kanban, Users, UserCheck, BarChart3, Loader2,
  RefreshCw, DollarSign, ShoppingCart, TrendingUp, Clock, Plus,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import { StatCard, ORDER_STATUS_CONFIG, LEAD_STATUS_CONFIG, StatusBadge, ManagerAvatar } from "@/components/admin/ui"

type CrmTab = "overview" | "orders" | "leads" | "customers" | "analytics"

const ORDER_STATUSES = ["new_lead", "car_selection", "payment", "delivery", "customs", "delivered"] as const

export default function AdminClient() {
  const { user, profile } = useAuth()
  const supabase = createClient()

  const [tab, setTab] = useState<CrmTab>("overview")
  const [orders, setOrders] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [managers, setManagers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [ordersRes, leadsRes, customersRes, managersRes] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("role", "user").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").in("role", ["admin", "manager"]),
    ])
    setOrders(ordersRes.data || [])
    setLeads(leadsRes.data || [])
    setCustomers(customersRes.data || [])
    setManagers(managersRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const handleStatusChange = useCallback(async (orderId: string, newStatus: string) => {
    await supabase.from("orders").update({ status: newStatus }).eq("id", orderId)
    // Add note
    if (profile) {
      await supabase.from("order_notes").insert({
        order_id: orderId,
        author_id: profile.id,
        content: `Статус змінено на: ${ORDER_STATUS_CONFIG[newStatus]?.label || newStatus}`,
        note_type: "status_change",
      })
    }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
  }, [supabase, profile])

  const handleAssignManager = useCallback(async (orderId: string, managerId: string) => {
    await supabase.from("orders").update({ manager_id: managerId }).eq("id", orderId)
    if (profile) {
      const mgr = managers.find(m => m.id === managerId)
      await supabase.from("order_notes").insert({
        order_id: orderId,
        author_id: profile.id,
        content: `Призначено менеджера: ${mgr?.full_name || "—"}`,
        note_type: "assignment",
      })
    }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, manager_id: managerId } : o))
  }, [supabase, profile, managers])

  const handleLeadStatusChange = useCallback(async (leadId: string, newStatus: string) => {
    await supabase.from("leads").update({ status: newStatus }).eq("id", leadId)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
  }, [supabase])

  if (!user || !profile) return null

  // Stats
  const activeOrders = orders.filter(o => o.status !== "delivered").length
  const totalRevenue = orders.filter(o => o.status === "delivered").reduce((sum, o) => sum + (o.total_price || 0), 0)
  const newLeadsCount = leads.filter(l => l.status === "new").length

  const tabs: { id: CrmTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: "Огляд", icon: LayoutDashboard },
    { id: "orders", label: "Замовлення", icon: Kanban },
    { id: "leads", label: "Ліди", icon: Users },
    { id: "customers", label: "Клієнти", icon: UserCheck },
    { id: "analytics", label: "Аналітика", icon: BarChart3 },
  ]

  return (
    <div className="pt-24 pb-20 px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CRM Панель</h1>
            <p className="text-sm text-muted-foreground">{profile.full_name} &middot; {profile.role === "admin" ? "Адміністратор" : "Менеджер"}</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-xs font-medium text-foreground hover:bg-secondary/80 transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Оновити
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl border border-border bg-card p-1 mb-6 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                tab === t.id ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.id === "orders" && orders.length > 0 && (
                <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] text-primary">{activeOrders}</span>
              )}
              {t.id === "leads" && newLeadsCount > 0 && (
                <span className="ml-1 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] text-blue-400">{newLeadsCount}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ── OVERVIEW ── */}
            {tab === "overview" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatCard icon={ShoppingCart} label="Активні замовлення" value={activeOrders} />
                  <StatCard icon={DollarSign} label="Виручка (доставлені)" value={`€${totalRevenue.toLocaleString("uk-UA")}`} />
                  <StatCard icon={Users} label="Нові ліди" value={newLeadsCount} />
                  <StatCard icon={UserCheck} label="Клієнтів" value={customers.length} />
                </div>

                {/* Recent orders */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Останні замовлення</h3>
                  <div className="space-y-2">
                    {orders.slice(0, 8).map((o) => {
                      const mgr = managers.find(m => m.id === o.manager_id)
                      return (
                        <div key={o.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                          <div className="flex items-center gap-3">
                            {mgr && <ManagerAvatar name={mgr.full_name} />}
                            <div>
                              <p className="text-xs font-medium text-foreground">{o.customer_name || o.customer_email || "—"}</p>
                              <p className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleDateString("uk-UA")}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {o.total_price && <span className="text-xs font-medium text-foreground">€{Number(o.total_price).toLocaleString("uk-UA")}</span>}
                            <StatusBadge status={o.status} config={ORDER_STATUS_CONFIG} />
                          </div>
                        </div>
                      )
                    })}
                    {orders.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Поки немає замовлень</p>}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── KANBAN ORDERS ── */}
            {tab === "orders" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {ORDER_STATUSES.map((status) => {
                    const config = ORDER_STATUS_CONFIG[status]
                    const columnOrders = orders.filter(o => o.status === status)
                    return (
                      <div key={status} className="rounded-2xl border border-border bg-card/50 p-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-[11px] font-semibold ${config.color}`}>{config.label}</span>
                          <span className="text-[10px] text-muted-foreground">{columnOrders.length}</span>
                        </div>
                        <div className="space-y-2">
                          {columnOrders.map((o) => {
                            const mgr = managers.find(m => m.id === o.manager_id)
                            return (
                              <div key={o.id} className="rounded-xl border border-border bg-card p-3 hover:border-primary/20 transition-colors">
                                <p className="text-xs font-medium text-foreground truncate">{o.customer_name || o.customer_email || "—"}</p>
                                {o.total_price && <p className="text-[10px] font-semibold text-primary mt-1">€{Number(o.total_price).toLocaleString("uk-UA")}</p>}
                                <p className="text-[9px] text-muted-foreground mt-1">{new Date(o.created_at).toLocaleDateString("uk-UA")}</p>

                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                                  {/* Manager assign */}
                                  <select
                                    value={o.manager_id || ""}
                                    onChange={(e) => handleAssignManager(o.id, e.target.value)}
                                    className="flex-1 rounded-lg border border-border bg-secondary/30 px-1.5 py-1 text-[9px] text-foreground cursor-pointer"
                                  >
                                    <option value="">Менеджер</option>
                                    {managers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                                  </select>
                                  {/* Status change */}
                                  <select
                                    value={o.status}
                                    onChange={(e) => handleStatusChange(o.id, e.target.value)}
                                    className="flex-1 rounded-lg border border-border bg-secondary/30 px-1.5 py-1 text-[9px] text-foreground cursor-pointer"
                                  >
                                    {ORDER_STATUSES.map(s => (
                                      <option key={s} value={s}>{ORDER_STATUS_CONFIG[s].label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )
                          })}
                          {columnOrders.length === 0 && (
                            <p className="text-[10px] text-muted-foreground/40 text-center py-4">Порожньо</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* ── LEADS ── */}
            {tab === "leads" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ім'я</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Контакт</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Джерело</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Статус</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Дата</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Дії</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((l) => (
                          <tr key={l.id} className="border-b border-border last:border-0 hover:bg-foreground/[0.02]">
                            <td className="px-4 py-3 font-medium text-foreground">{l.name || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              <div>{l.email || "—"}</div>
                              {l.phone && <div className="text-[10px]">{l.phone}</div>}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground capitalize">{l.source}</td>
                            <td className="px-4 py-3">
                              <select
                                value={l.status}
                                onChange={(e) => handleLeadStatusChange(l.id, e.target.value)}
                                className="rounded-lg border border-border bg-secondary/30 px-2 py-1 text-[10px] text-foreground cursor-pointer"
                              >
                                {Object.entries(LEAD_STATUS_CONFIG).map(([k, v]) => (
                                  <option key={k} value={k}>{v.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{new Date(l.created_at).toLocaleDateString("uk-UA")}</td>
                            <td className="px-4 py-3">
                              <select
                                value={l.manager_id || ""}
                                onChange={async (e) => {
                                  await supabase.from("leads").update({ manager_id: e.target.value || null }).eq("id", l.id)
                                  setLeads(prev => prev.map(x => x.id === l.id ? { ...x, manager_id: e.target.value || null } : x))
                                }}
                                className="rounded-lg border border-border bg-secondary/30 px-2 py-1 text-[10px] text-foreground cursor-pointer"
                              >
                                <option value="">Менеджер</option>
                                {managers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                        {leads.length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Поки немає лідів</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── CUSTOMERS ── */}
            {tab === "customers" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ім'я</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Телефон</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Замовлень</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Реєстрація</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.map((c) => {
                          const userOrders = orders.filter(o => o.user_id === c.user_id)
                          return (
                            <tr key={c.id} className="border-b border-border last:border-0 hover:bg-foreground/[0.02]">
                              <td className="px-4 py-3">
                                <div className="font-medium text-foreground">{c.full_name || "—"}</div>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{c.phone || "—"}</td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">{userOrders.length}</span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString("uk-UA")}</td>
                            </tr>
                          )
                        })}
                        {customers.length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Поки немає клієнтів</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── ANALYTICS ── */}
            {tab === "analytics" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatCard icon={ShoppingCart} label="Всього замовлень" value={orders.length} />
                  <StatCard icon={DollarSign} label="Загальна виручка" value={`€${totalRevenue.toLocaleString("uk-UA")}`} />
                  <StatCard icon={TrendingUp} label="Конверсія" value={leads.length > 0 ? `${Math.round((orders.length / leads.length) * 100)}%` : "—"} />
                  <StatCard icon={Clock} label="Середній цикл" value={orders.length > 0 ? `${Math.round(orders.reduce((sum, o) => {
                    if (o.status !== "delivered") return sum
                    const days = (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24)
                    return sum + days
                  }, 0) / Math.max(1, orders.filter(o => o.status === "delivered").length))} днів` : "—"} />
                </div>

                {/* Orders by status */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Замовлення за статусом</h3>
                  <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
                    {ORDER_STATUSES.map((status) => {
                      const config = ORDER_STATUS_CONFIG[status]
                      const count = orders.filter(o => o.status === status).length
                      return (
                        <div key={status} className="text-center rounded-xl border border-border p-3">
                          <div className={`text-xl font-bold ${config.color}`}>{count}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">{config.label}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Manager performance */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Ефективність менеджерів</h3>
                  <div className="space-y-3">
                    {managers.map((m) => {
                      const mOrders = orders.filter(o => o.manager_id === m.id)
                      const mDelivered = mOrders.filter(o => o.status === "delivered")
                      const mRevenue = mDelivered.reduce((sum, o) => sum + (o.total_price || 0), 0)
                      return (
                        <div key={m.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                          <div className="flex items-center gap-3">
                            <ManagerAvatar name={m.full_name} />
                            <div>
                              <p className="text-xs font-medium text-foreground">{m.full_name}</p>
                              <p className="text-[10px] text-muted-foreground">{m.role === "admin" ? "Адмін" : "Менеджер"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-xs">
                            <div className="text-center">
                              <div className="font-bold text-foreground">{mOrders.length}</div>
                              <div className="text-[9px] text-muted-foreground">Замовлень</div>
                            </div>
                            <div className="text-center">
                              <div className="font-bold text-foreground">{mDelivered.length}</div>
                              <div className="text-[9px] text-muted-foreground">Завершено</div>
                            </div>
                            <div className="text-center">
                              <div className="font-bold text-primary">€{mRevenue.toLocaleString("uk-UA")}</div>
                              <div className="text-[9px] text-muted-foreground">Виручка</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Role management (admin only) */}
                {profile.role === "admin" && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-2">Управління ролями</h3>
                    <p className="text-[11px] text-muted-foreground mb-4">Щоб надати працівнику доступ до CRM, змініть його роль на "Менеджер".</p>
                    <div className="space-y-2">
                      {[...customers, ...managers].map((u) => (
                        <div key={u.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div>
                            <p className="text-xs font-medium text-foreground">{u.full_name || "—"}</p>
                            <p className="text-[10px] text-muted-foreground">{u.phone || ""}</p>
                          </div>
                          <select
                            value={u.role}
                            onChange={async (e) => {
                              await supabase.from("profiles").update({ role: e.target.value }).eq("id", u.id)
                              fetchData()
                            }}
                            className="rounded-lg border border-border bg-secondary/30 px-2 py-1 text-[10px] text-foreground cursor-pointer"
                          >
                            <option value="user">Користувач</option>
                            <option value="manager">Менеджер</option>
                            <option value="admin">Адмін</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
