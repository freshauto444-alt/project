"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import {
  BarChart3, TrendingUp, Users, Car, ShoppingCart, Eye,
  DollarSign, Clock, ArrowUp, ArrowDown, Activity,
  Globe, Smartphone, Monitor, MapPin, Search,
  MousePointer, Timer, Lock, Star,
  MessageCircle, Image, FileText, Zap, Shield,
  Percent, Target, Layers, RefreshCw,
} from "lucide-react"
import { cars } from "@/lib/data"
import { useSettings } from "@/lib/settings-context"

/* ---------- Mock analytics data ---------- */

const dailyVisitors = [
  { date: "Пн", visitors: 342, pageViews: 1240, orders: 3, aiSessions: 89, bounceRate: 32 },
  { date: "Вт", visitors: 428, pageViews: 1580, orders: 5, aiSessions: 112, bounceRate: 28 },
  { date: "Ср", visitors: 389, pageViews: 1390, orders: 2, aiSessions: 95, bounceRate: 35 },
  { date: "Чт", visitors: 512, pageViews: 1870, orders: 7, aiSessions: 134, bounceRate: 26 },
  { date: "Пт", visitors: 467, pageViews: 1650, orders: 4, aiSessions: 118, bounceRate: 30 },
  { date: "Сб", visitors: 623, pageViews: 2210, orders: 8, aiSessions: 156, bounceRate: 24 },
  { date: "Нд", visitors: 298, pageViews: 980, orders: 1, aiSessions: 67, bounceRate: 38 },
]

const monthlyRevenue = [
  { month: "Сер", value: 1240000 },
  { month: "Вер", value: 980000 },
  { month: "Жов", value: 1560000 },
  { month: "Лис", value: 1890000 },
  { month: "Гру", value: 2340000 },
  { month: "Січ", value: 1780000 },
  { month: "Лют", value: 2120000 },
]

const topCars = cars.slice(0, 5).map((car, i) => ({
  car,
  views: [1240, 980, 870, 760, 650][i],
  inquiries: [34, 28, 22, 18, 15][i],
  conversions: [8, 6, 5, 4, 3][i],
}))

const trafficSources = [
  { source: "Google Organic", visitors: 1890, pct: 38, change: 12 },
  { source: "Direct", visitors: 1240, pct: 25, change: 5 },
  { source: "Instagram", visitors: 870, pct: 17, change: 23 },
  { source: "Facebook", visitors: 560, pct: 11, change: -3 },
  { source: "Telegram", visitors: 440, pct: 9, change: 45 },
]

const devices = [
  { type: "Мобільний", icon: Smartphone, pct: 62, sessions: 3100 },
  { type: "Десктоп", icon: Monitor, pct: 31, sessions: 1550 },
  { type: "Планшет", icon: Monitor, pct: 7, sessions: 350 },
]

const geoData = [
  { city: "Київ", visitors: 2340, pct: 47 },
  { city: "Одеса", visitors: 680, pct: 14 },
  { city: "Дніпро", visitors: 520, pct: 10 },
  { city: "Харків", visitors: 480, pct: 10 },
  { city: "Львів", visitors: 430, pct: 9 },
  { city: "Інші", visitors: 550, pct: 11 },
]

const recentOrders = [
  { id: "FA-2026-00012", customer: "Олександр К.", car: "Porsche 911 GT3 RS", amount: 241300, status: "Оформлено", date: "24.02.2026" },
  { id: "FA-2026-00011", customer: "Марина П.", car: "BMW M4 CSL", amount: 148900, status: "Оплачено", date: "23.02.2026" },
  { id: "FA-2026-00010", customer: "Дмитро С.", car: "Mercedes AMG GT 63 S", amount: 189500, status: "Доставлено", date: "22.02.2026" },
  { id: "FA-2026-00009", customer: "Олена Т.", car: "Audi RS e-tron GT", amount: 164400, status: "В дорозі", date: "21.02.2026" },
  { id: "FA-2026-00008", customer: "Андрій В.", car: "Porsche Taycan Turbo S", amount: 197400, status: "Оплачено", date: "20.02.2026" },
]

const searchTerms = [
  { term: "Porsche 911", count: 234 },
  { term: "BMW M4", count: 187 },
  { term: "електромобіль", count: 156 },
  { term: "до 200 000", count: 134 },
  { term: "SUV", count: 112 },
  { term: "Mercedes AMG", count: 98 },
  { term: "Trade-In", count: 87 },
  { term: "Ferrari", count: 76 },
]

const aiChatStats = {
  totalSessions: 1240,
  avgMessages: 4.2,
  topIntents: [
    { intent: "Спортивні авто", count: 340, pct: 27 },
    { intent: "Бюджет запит", count: 280, pct: 23 },
    { intent: "Електромобілі", count: 210, pct: 17 },
    { intent: "Бізнес-клас", count: 190, pct: 15 },
    { intent: "Сімейні авто", count: 130, pct: 10 },
    { intent: "Інше", count: 90, pct: 7 },
  ],
  conversionRate: 18.5,
  avgResponseTime: "0.6с",
  satisfactionRate: 94.2,
}

const pagePerformance = [
  { page: "Головна", views: 4580, avgTime: "2:45", bounceRate: 28 },
  { page: "Каталог", views: 3210, avgTime: "4:12", bounceRate: 22 },
  { page: "AI Підбір", views: 1890, avgTime: "5:38", bounceRate: 15 },
  { page: "Контакти", views: 890, avgTime: "1:20", bounceRate: 45 },
  { page: "Блог", views: 670, avgTime: "3:15", bounceRate: 35 },
]

const conversionFunnel = [
  { stage: "Відвідування", count: 5000, pct: 100 },
  { stage: "Перегляд каталогу", count: 3200, pct: 64 },
  { stage: "Деталі авто", count: 1800, pct: 36 },
  { stage: "Оформлення", count: 420, pct: 8.4 },
  { stage: "Замовлення", count: 30, pct: 0.6 },
]

const recentReviews = [
  { name: "Андрій М.", text: "Весь процес від підбору до реєстрації зайняв лише 2 тижні.", rating: 5, source: "Google", date: "24.02.2026" },
  { name: "Олена К.", text: "Професійний підхід та повна прозорість.", rating: 5, source: "Trustpilot", date: "23.02.2026" },
  { name: "Дмитро С.", text: "Третій автомобіль через Fresh Auto.", rating: 5, source: "Google", date: "22.02.2026" },
]

/* ---------- Components ---------- */

function StatCard({ label, value, change, icon: Icon, prefix }: {
  label: string; value: string; change?: number; icon: React.ElementType; prefix?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/[0.08]">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-0.5 text-[11px] font-medium ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div className="text-xl font-semibold text-foreground tabular-nums">{prefix}{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  )
}

function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-secondary">
      <div
        className="h-full rounded-full bg-primary/50 transition-all duration-500"
        style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }}
      />
    </div>
  )
}

const fadeIn = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4 },
})

type AdminTab = "overview" | "analytics" | "content" | "performance"

export default function AdminDashboard() {
  const { formatPrice } = useSettings()
  const [period, setPeriod] = useState<"week" | "month" | "year">("week")
  const [adminTab, setAdminTab] = useState<AdminTab>("overview")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")

  // Simple admin auth gate
  if (!isAuthenticated) {
    return (
      <section className="py-12 px-6">
        <div className="mx-auto max-w-sm">
          <motion.div {...fadeIn(0)} className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.08] mx-auto mb-5">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">{"Адмін панель"}</h2>
            <p className="text-xs text-muted-foreground mb-6">{"Доступ тільки для адміністраторів."}</p>
            <form onSubmit={(e) => { e.preventDefault(); if (password === "admin") setIsAuthenticated(true) }} className="flex flex-col gap-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
                className="w-full rounded-xl border border-border bg-transparent px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/30 focus:border-primary/20 focus:outline-none transition-colors text-center"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-primary py-2.5 text-xs font-medium text-primary-foreground hover:brightness-110 transition-all cursor-pointer"
              >
                {"Увійти"}
              </button>
              <p className="text-[10px] text-muted-foreground/50">{"Hint: admin"}</p>
            </form>
          </motion.div>
        </div>
      </section>
    )
  }

  const totalVisitors = dailyVisitors.reduce((s, d) => s + d.visitors, 0)
  const totalPageViews = dailyVisitors.reduce((s, d) => s + d.pageViews, 0)
  const totalOrders = dailyVisitors.reduce((s, d) => s + d.orders, 0)
  const totalAiSessions = dailyVisitors.reduce((s, d) => s + d.aiSessions, 0)
  const maxVisitors = Math.max(...dailyVisitors.map(d => d.visitors))
  const avgBounce = (dailyVisitors.reduce((s, d) => s + d.bounceRate, 0) / dailyVisitors.length).toFixed(1)

  return (
    <section className="py-12 px-6">
      <div className="mx-auto max-w-7xl 2xl:max-w-[90rem]">
        {/* Header */}
        <motion.div {...fadeIn(0)} className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-[10px] text-primary font-medium uppercase tracking-wider">{"Admin Only"}</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{"Адмін панель"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{"Повна аналітика, статистика та управління контентом."}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/50 border border-border">
              {(["overview", "analytics", "content", "performance"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setAdminTab(tab)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                    adminTab === tab ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "overview" ? "Огляд" : tab === "analytics" ? "Аналітика" : tab === "content" ? "Контент" : "Швидкість"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/50 border border-border">
              {(["week", "month", "year"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                    period === p ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p === "week" ? "Тиждень" : p === "month" ? "Місяць" : "Рік"}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* KPI cards */}
        <motion.div {...fadeIn(0.05)} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 mb-6">
          <StatCard label="Відвідувачі" value={totalVisitors.toLocaleString()} change={14} icon={Users} />
          <StatCard label="Перегляди" value={totalPageViews.toLocaleString()} change={8} icon={Eye} />
          <StatCard label="Замовлення" value={totalOrders.toString()} change={22} icon={ShoppingCart} />
          <StatCard label="Дохід" value="2.12M" change={18} icon={DollarSign} />
          <StatCard label="AI сесії" value={totalAiSessions.toString()} change={34} icon={Zap} />
          <StatCard label="Конверсія" value="0.6%" change={12} icon={Target} />
          <StatCard label="Bounce" value={`${avgBounce}%`} change={-5} icon={Activity} />
          <StatCard label="Сер. сесія" value="3:42" icon={Timer} />
        </motion.div>

        {adminTab === "overview" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Left column (2/3) */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* Visitors chart */}
              <motion.div {...fadeIn(0.1)} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary/60" />
                    <h3 className="text-sm font-semibold text-foreground">{"Відвідувачі за тиждень"}</h3>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{totalVisitors} всього</span>
                </div>
                <div className="flex items-end gap-2 h-32">
                  {dailyVisitors.map((d, i) => {
                    const h = (d.visitors / maxVisitors) * 100
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <div className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">{d.visitors}</div>
                        <div
                          className="w-full rounded-t-lg bg-primary/20 group-hover:bg-primary/35 transition-colors"
                          style={{ height: `${h}%` }}
                        />
                        <span className="text-[10px] text-muted-foreground">{d.date}</span>
                      </div>
                    )
                  })}
                </div>
              </motion.div>

              {/* Revenue chart */}
              <motion.div {...fadeIn(0.15)} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary/60" />
                    <h3 className="text-sm font-semibold text-foreground">{"Дохід по місяцях (EUR)"}</h3>
                  </div>
                </div>
                <div className="flex items-end gap-3 h-28">
                  {monthlyRevenue.map((m, i) => {
                    const max = Math.max(...monthlyRevenue.map(r => r.value))
                    const h = (m.value / max) * 100
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <div className="text-[9px] text-primary opacity-0 group-hover:opacity-100 transition-opacity tabular-nums font-medium">{(m.value / 1000).toFixed(0)}K</div>
                        <div
                          className="w-full rounded-t-lg transition-colors"
                          style={{
                            height: `${h}%`,
                            background: i === monthlyRevenue.length - 1 ? "hsl(var(--primary) / 0.4)" : "hsl(var(--primary) / 0.15)"
                          }}
                        />
                        <span className="text-[10px] text-muted-foreground">{m.month}</span>
                      </div>
                    )
                  })}
                </div>
              </motion.div>

              {/* Conversion Funnel */}
              <motion.div {...fadeIn(0.17)} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Layers className="h-4 w-4 text-primary/60" />
                  <h3 className="text-sm font-semibold text-foreground">{"Воронка конверсії"}</h3>
                </div>
                <div className="flex flex-col gap-2">
                  {conversionFunnel.map((stage, i) => (
                    <div key={stage.stage} className="flex items-center gap-3">
                      <span className="text-[11px] text-muted-foreground w-36 flex-shrink-0 truncate">{stage.stage}</span>
                      <div className="flex-1 h-6 rounded-lg bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-lg bg-primary/30 flex items-center pl-2"
                          style={{ width: `${stage.pct}%` }}
                        >
                          {stage.pct > 10 && <span className="text-[9px] text-foreground font-medium tabular-nums">{stage.count}</span>}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums w-12 text-right">{stage.pct}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Recent orders */}
              <motion.div {...fadeIn(0.2)} className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary/60" />
                    <h3 className="text-sm font-semibold text-foreground">{"Останні замовлення"}</h3>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{recentOrders.length} записів</span>
                </div>
                <div className="divide-y divide-border">
                  {recentOrders.map(order => (
                    <div key={order.id} className="flex items-center gap-4 px-5 py-3 hover:bg-secondary/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">{order.customer}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{order.id}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{order.car} &middot; {order.date}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-semibold text-foreground tabular-nums">{formatPrice(order.amount)}</div>
                        <div className={`text-[10px] font-medium mt-0.5 ${
                          order.status === "Оплачено" ? "text-emerald-400" :
                          order.status === "Доставлено" ? "text-primary" :
                          order.status === "В дорозі" ? "text-amber-400" :
                          "text-muted-foreground"
                        }`}>{order.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Top cars */}
              <motion.div {...fadeIn(0.25)} className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary/60" />
                    <h3 className="text-sm font-semibold text-foreground">{"Популярні авто"}</h3>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {topCars.map(({ car, views, inquiries, conversions }, i) => (
                    <div key={car.id} className="flex items-center gap-4 px-5 py-3 hover:bg-secondary/30 transition-colors">
                      <span className="text-[11px] text-muted-foreground/50 w-4 tabular-nums">{i + 1}</span>
                      <div className="h-10 w-14 flex-shrink-0 overflow-hidden rounded-lg">
                        <img src={car.image} alt={car.model} crossOrigin="anonymous" className="h-full w-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">{car.make} {car.model}</div>
                        <div className="text-[10px] text-muted-foreground">{formatPrice(car.price)}</div>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-shrink-0">
                        <div className="text-center hidden sm:block">
                          <div className="text-foreground font-medium tabular-nums">{views}</div>
                          <div>{"переглядів"}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-foreground font-medium tabular-nums">{inquiries}</div>
                          <div>{"запитів"}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-primary font-medium tabular-nums">{conversions}</div>
                          <div>{"продажів"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Right column (1/3) */}
            <div className="flex flex-col gap-5">
              {/* AI Chat stats */}
              <motion.div {...fadeIn(0.1)} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-4 w-4 text-primary/60" />
                  <h3 className="text-sm font-semibold text-foreground">{"AI Чат аналітика"}</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="rounded-xl bg-secondary/50 p-3 text-center">
                    <div className="text-sm font-semibold text-foreground tabular-nums">{aiChatStats.totalSessions}</div>
                    <div className="text-[10px] text-muted-foreground">{"сесій"}</div>
                  </div>
                  <div className="rounded-xl bg-secondary/50 p-3 text-center">
                    <div className="text-sm font-semibold text-primary tabular-nums">{aiChatStats.conversionRate}%</div>
                    <div className="text-[10px] text-muted-foreground">{"конверсія"}</div>
                  </div>
                  <div className="rounded-xl bg-secondary/50 p-3 text-center">
                    <div className="text-sm font-semibold text-foreground tabular-nums">{aiChatStats.avgResponseTime}</div>
                    <div className="text-[10px] text-muted-foreground">{"відповідь"}</div>
                  </div>
                  <div className="rounded-xl bg-secondary/50 p-3 text-center">
                    <div className="text-sm font-semibold text-emerald-400 tabular-nums">{aiChatStats.satisfactionRate}%</div>
                    <div className="text-[10px] text-muted-foreground">{"задоволеність"}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {aiChatStats.topIntents.map(intent => (
                    <div key={intent.intent}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] text-foreground">{intent.intent}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{intent.pct}%</span>
                      </div>
                      <ProgressBar pct={intent.pct} />
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Traffic sources */}
              <motion.div {...fadeIn(0.15)} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="h-4 w-4 text-primary/60" />
                  <h3 className="text-sm font-semibold text-foreground">{"Джерела трафіку"}</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {trafficSources.map(s => (
                    <div key={s.source}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-foreground">{s.source}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground tabular-nums">{s.visitors}</span>
                          <span className={`text-[10px] font-medium ${s.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {s.change >= 0 ? "+" : ""}{s.change}%
                          </span>
                        </div>
                      </div>
                      <ProgressBar pct={s.pct} />
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Devices */}
              <motion.div {...fadeIn(0.2)} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Smartphone className="h-4 w-4 text-primary/60" />
                  <h3 className="text-sm font-semibold text-foreground">{"Пристрої"}</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {devices.map(d => (
                    <div key={d.type} className="flex items-center gap-3">
                      <d.icon className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-foreground">{d.type}</span>
                          <span className="text-[11px] text-primary font-medium tabular-nums">{d.pct}%</span>
                        </div>
                        <ProgressBar pct={d.pct} />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Geography */}
              <motion.div {...fadeIn(0.25)} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-4 w-4 text-primary/60" />
                  <h3 className="text-sm font-semibold text-foreground">{"Географія"}</h3>
                </div>
                <div className="flex flex-col gap-2">
                  {geoData.map(g => (
                    <div key={g.city} className="flex items-center justify-between">
                      <span className="text-[11px] text-foreground">{g.city}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground tabular-nums">{g.visitors}</span>
                        <span className="text-[10px] text-muted-foreground/50 tabular-nums w-8 text-right">{g.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Search terms */}
              <motion.div {...fadeIn(0.3)} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Search className="h-4 w-4 text-primary/60" />
                  <h3 className="text-sm font-semibold text-foreground">{"Популярні запити"}</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {searchTerms.map(t => (
                    <span key={t.term} className="rounded-full bg-secondary/70 px-2.5 py-1 text-[10px] text-muted-foreground">
                      {t.term} <span className="text-foreground font-medium">{t.count}</span>
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* Recent reviews */}
              <motion.div {...fadeIn(0.35)} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-4 w-4 text-primary/60" />
                  <h3 className="text-sm font-semibold text-foreground">{"Останні відгуки"}</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {recentReviews.map((r, i) => (
                    <div key={i} className="rounded-xl bg-secondary/30 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-foreground">{r.name}</span>
                        <span className="text-[9px] text-muted-foreground/50">{r.source} &middot; {r.date}</span>
                      </div>
                      <div className="flex items-center gap-0.5 mb-1">
                        {Array.from({ length: r.rating }).map((_, j) => (
                          <Star key={j} className="h-2 w-2 fill-primary text-primary" />
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{r.text}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {adminTab === "analytics" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* AI Chat detailed */}
            <motion.div {...fadeIn(0.1)} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary/60" />
                {"AI Чат -- детальна аналітика"}
              </h3>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-xl bg-secondary/50 p-3 text-center">
                  <div className="text-lg font-semibold text-foreground tabular-nums">{aiChatStats.avgMessages}</div>
                  <div className="text-[9px] text-muted-foreground">{"повідом/сесію"}</div>
                </div>
                <div className="rounded-xl bg-secondary/50 p-3 text-center">
                  <div className="text-lg font-semibold text-primary tabular-nums">{aiChatStats.avgResponseTime}</div>
                  <div className="text-[9px] text-muted-foreground">{"час відповіді"}</div>
                </div>
                <div className="rounded-xl bg-secondary/50 p-3 text-center">
                  <div className="text-lg font-semibold text-emerald-400 tabular-nums">{aiChatStats.satisfactionRate}%</div>
                  <div className="text-[9px] text-muted-foreground">{"задоволеність"}</div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {aiChatStats.topIntents.map(intent => (
                  <div key={intent.intent} className="flex items-center gap-3">
                    <span className="text-[11px] text-foreground w-28 truncate">{intent.intent}</span>
                    <div className="flex-1"><ProgressBar pct={intent.pct} /></div>
                    <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{intent.count}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Daily AI sessions */}
            <motion.div {...fadeIn(0.15)} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary/60" />
                {"AI сесії по днях"}
              </h3>
              <div className="flex items-end gap-2 h-32">
                {dailyVisitors.map((d, i) => {
                  const maxAi = Math.max(...dailyVisitors.map(x => x.aiSessions))
                  const h = (d.aiSessions / maxAi) * 100
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                      <div className="text-[9px] text-primary opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">{d.aiSessions}</div>
                      <div className="w-full rounded-t-lg bg-primary/25 group-hover:bg-primary/40 transition-colors" style={{ height: `${h}%` }} />
                      <span className="text-[10px] text-muted-foreground">{d.date}</span>
                    </div>
                  )
                })}
              </div>
            </motion.div>

            {/* Bounce rate by day */}
            <motion.div {...fadeIn(0.2)} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary/60" />
                {"Bounce Rate по днях"}
              </h3>
              <div className="flex items-end gap-2 h-24">
                {dailyVisitors.map((d, i) => {
                  const h = d.bounceRate
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                      <div className="text-[9px] text-red-400 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">{d.bounceRate}%</div>
                      <div className="w-full rounded-t-lg bg-red-400/20 group-hover:bg-red-400/30 transition-colors" style={{ height: `${h * 2}%` }} />
                      <span className="text-[10px] text-muted-foreground">{d.date}</span>
                    </div>
                  )
                })}
              </div>
            </motion.div>

            {/* Traffic by country */}
            <motion.div {...fadeIn(0.25)} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary/60" />
                {"Трафік по містах"}
              </h3>
              <div className="flex flex-col gap-2">
                {geoData.map(g => (
                  <div key={g.city} className="flex items-center gap-3">
                    <span className="text-[11px] text-foreground w-16">{g.city}</span>
                    <div className="flex-1"><ProgressBar pct={g.pct} /></div>
                    <span className="text-[10px] text-muted-foreground tabular-nums w-12 text-right">{g.visitors}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {adminTab === "content" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <motion.div {...fadeIn(0.1)} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Star className="h-4 w-4 text-primary/60" />
                {"Управління відгуками"}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">{"Відгуки збираються з Google, Trustpilot та додаються адміністратором."}</p>
              <div className="flex flex-col gap-3">
                {recentReviews.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-secondary/30 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-foreground">{r.name}</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: r.rating }).map((_, j) => <Star key={j} className="h-2 w-2 fill-primary text-primary" />)}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{r.text}</p>
                    </div>
                    <span className="text-[9px] text-muted-foreground/50 flex-shrink-0 ml-2">{r.source}</span>
                  </div>
                ))}
              </div>
              <button className="mt-3 w-full rounded-xl border border-dashed border-border py-3 text-[11px] text-muted-foreground hover:text-primary hover:border-primary/20 transition-all cursor-pointer">
                {"+ Додати відгук"}
              </button>
            </motion.div>

            <motion.div {...fadeIn(0.15)} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Image className="h-4 w-4 text-primary/60" />
                {"Галерея (Instagram)"}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">{"Фото парсяться з Instagram та відображаються в розділі \"Клієнти\"."}</p>
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="aspect-square rounded-lg bg-secondary/50 flex items-center justify-center">
                    <Image className="h-4 w-4 text-muted-foreground/20" />
                  </div>
                ))}
              </div>
              <button className="mt-3 w-full rounded-xl border border-dashed border-border py-3 text-[11px] text-muted-foreground hover:text-primary hover:border-primary/20 transition-all cursor-pointer">
                {"+ Додати фото"}
              </button>
            </motion.div>

            <motion.div {...fadeIn(0.2)} className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary/60" />
                {"Управління блогом"}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">{"Статті блогу з фото. Кожна новина має зображення."}</p>
              <div className="flex flex-col gap-2">
                {["Нові правила розмитнення 2026", "Porsche 911 GT3 RS: огляд та тест", "Електромобілі в 2026", "Як обрати авто для бізнесу?"].map((title, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-secondary/30 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-12 rounded bg-secondary/70 flex-shrink-0" />
                      <span className="text-[11px] text-foreground">{title}</span>
                    </div>
                    <span className="text-[10px] text-emerald-400">{"Опубліковано"}</span>
                  </div>
                ))}
              </div>
              <button className="mt-3 w-full rounded-xl border border-dashed border-border py-3 text-[11px] text-muted-foreground hover:text-primary hover:border-primary/20 transition-all cursor-pointer">
                {"+ Додати статтю"}
              </button>
            </motion.div>
          </div>
        )}

        {adminTab === "performance" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <motion.div {...fadeIn(0.1)} className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary/60" />
                {"Продуктивність сторінок"}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2.5 text-left font-medium text-muted-foreground">{"Сторінка"}</th>
                      <th className="py-2.5 text-right font-medium text-muted-foreground">{"Перегляди"}</th>
                      <th className="py-2.5 text-right font-medium text-muted-foreground">{"Сер. час"}</th>
                      <th className="py-2.5 text-right font-medium text-muted-foreground">{"Bounce"}</th>
                      <th className="py-2.5 text-right font-medium text-muted-foreground">{"Оцінка"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pagePerformance.map(p => (
                      <tr key={p.page} className="hover:bg-secondary/20 transition-colors">
                        <td className="py-2.5 text-foreground font-medium">{p.page}</td>
                        <td className="py-2.5 text-right text-muted-foreground tabular-nums">{p.views}</td>
                        <td className="py-2.5 text-right text-muted-foreground tabular-nums">{p.avgTime}</td>
                        <td className="py-2.5 text-right tabular-nums">
                          <span className={p.bounceRate < 30 ? "text-emerald-400" : p.bounceRate < 40 ? "text-amber-400" : "text-red-400"}>
                            {p.bounceRate}%
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                            p.bounceRate < 25 ? "bg-emerald-400/10 text-emerald-400" :
                            p.bounceRate < 35 ? "bg-primary/10 text-primary" :
                            "bg-amber-400/10 text-amber-400"
                          }`}>
                            {p.bounceRate < 25 ? "Чудово" : p.bounceRate < 35 ? "Добре" : "Покращити"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            <motion.div {...fadeIn(0.15)} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary/60" />
                {"Час завантаження"}
              </h3>
              <div className="flex flex-col gap-3">
                {[
                  { metric: "First Contentful Paint", value: "0.8s", status: "good" },
                  { metric: "Largest Contentful Paint", value: "1.2s", status: "good" },
                  { metric: "Cumulative Layout Shift", value: "0.02", status: "good" },
                  { metric: "First Input Delay", value: "12ms", status: "good" },
                  { metric: "Time to Interactive", value: "1.8s", status: "ok" },
                ].map(m => (
                  <div key={m.metric} className="flex items-center justify-between">
                    <span className="text-[11px] text-foreground">{m.metric}</span>
                    <span className={`text-[11px] font-medium tabular-nums ${m.status === "good" ? "text-emerald-400" : "text-amber-400"}`}>{m.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeIn(0.2)} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary/60" />
                {"Безпека"}</h3>
              <div className="flex flex-col gap-3">
                {[
                  { item: "SSL Certificate", status: "Активний", ok: true },
                  { item: "Security Headers", status: "Налаштовано", ok: true },
                  { item: "HSTS", status: "Увімкнено", ok: true },
                  { item: "CSP Headers", status: "Базовий", ok: true },
                  { item: "Rate Limiting", status: "Активне", ok: true },
                  { item: "XSS Protection", status: "Увімкнено", ok: true },
                ].map(s => (
                  <div key={s.item} className="flex items-center justify-between">
                    <span className="text-[11px] text-foreground">{s.item}</span>
                    <span className={`text-[10px] font-medium ${s.ok ? "text-emerald-400" : "text-red-400"}`}>{s.status}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </section>
  )
}
