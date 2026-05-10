"use client"

import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"

export const ORDER_STATUS_UA: Record<string, string> = {
  new_lead: "Новий лід",
  car_selection: "Підбір авто",
  payment: "Оплата",
  delivery: "Доставка",
  customs: "Розмитнення",
  delivered: "Передано клієнту",
}

export const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new_lead: { label: "Новий лід", color: "text-blue-400", bg: "bg-blue-500/15" },
  car_selection: { label: "Підбір авто", color: "text-amber-400", bg: "bg-amber-500/15" },
  payment: { label: "Оплата", color: "text-purple-400", bg: "bg-purple-500/15" },
  delivery: { label: "Доставка", color: "text-orange-400", bg: "bg-orange-500/15" },
  customs: { label: "Розмитнення", color: "text-yellow-400", bg: "bg-yellow-500/15" },
  delivered: { label: "Передано", color: "text-emerald-400", bg: "bg-emerald-500/15" },
}

export const LEAD_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: "Новий", color: "text-blue-400", bg: "bg-blue-500/15" },
  contacted: { label: "Зв'язались", color: "text-amber-400", bg: "bg-amber-500/15" },
  qualified: { label: "Кваліфікований", color: "text-purple-400", bg: "bg-purple-500/15" },
  converted: { label: "Конвертований", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  lost: { label: "Втрачений", color: "text-red-400", bg: "bg-red-500/15" },
}

export function StatusBadge({ status, config }: { status: string; config: Record<string, { label: string; color: string; bg: string }> }) {
  const c = config[status]
  if (!c) return <span className="text-xs text-muted-foreground">{status}</span>
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${c.bg} ${c.color}`}>
      {c.label}
    </span>
  )
}

export function StatCard({ icon: Icon, label, value, change, positive }: {
  icon: LucideIcon
  label: string
  value: string | number
  change?: string
  positive?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/[0.08] border border-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        {change && (
          <span className={`text-[10px] font-medium ${positive ? "text-emerald-400" : "text-red-400"}`}>
            {positive ? "+" : ""}{change}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
    </motion.div>
  )
}

export function ManagerAvatar({ name }: { name: string | null }) {
  const initials = name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?"
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/[0.1] text-[9px] font-bold text-primary" title={name || ""}>
      {initials}
    </div>
  )
}
