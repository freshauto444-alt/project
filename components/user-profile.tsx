"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  User, Settings, Heart, Clock, LogOut, ChevronRight,
  Shield, Star, Car as CarIcon, Phone, MessageCircle,
  Edit2, Bell, Globe, CreditCard, HelpCircle, Sparkles,
} from "lucide-react"
import { type Car } from "@/lib/data"
import { useSettings } from "@/lib/settings-context"
import type { AppView } from "@/lib/types"

interface UserProfileProps {
  onNavigate: (view: AppView) => void
  onSelectCar: (car: Car) => void
  user: { name: string; email: string }
  onLogout: () => void
}

const recentActivity = [
  { type: "view", label: "Переглянуто", car: "Porsche 911 GT3 RS", time: "2 год тому", price: 241300 },
  { type: "view", label: "Переглянуто", car: "BMW M4 CSL", time: "Вчора", price: 148900 },
  { type: "view", label: "Переглянуто", car: "Mercedes AMG GT 63 S", time: "3 дні тому", price: 189500 },
]

const savedCars = [
  { make: "Porsche", model: "Taycan Turbo S", year: 2025, price: 197400, image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&q=80" },
  { make: "Ferrari", model: "296 GTB", year: 2024, price: 378500, image: "https://images.unsplash.com/photo-1592198084033-aade902d1aae?w=400&q=80" },
]

const menuSections = [
  {
    title: "Акаунт",
    items: [
      { icon: Edit2, label: "Редагувати профіль", desc: "Ім'я, телефон, фото" },
      { icon: Bell, label: "Сповіщення", desc: "Нові авто, знижки, оновлення" },
      { icon: Globe, label: "Мова та валюта", desc: "Українська · EUR" },
      { icon: CreditCard, label: "Платежі", desc: "Способи оплати" },
    ],
  },
  {
    title: "Підтримка",
    items: [
      { icon: HelpCircle, label: "Допомога", desc: "FAQ та підтримка" },
      { icon: Shield, label: "Безпека", desc: "Пароль, сесії" },
      { icon: Phone, label: "Зв'язатись з нами", desc: "098 708 19 19" },
    ],
  },
]

export default function UserProfile({ onNavigate, onSelectCar, user, onLogout }: UserProfileProps) {
  const { formatPrice } = useSettings()
  const [activeTab, setActiveTab] = useState<"overview" | "saved" | "history" | "settings">("overview")

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <section className="py-12 px-6 lg:px-10 min-h-screen">
      <div className="mx-auto max-w-4xl w-full">

        {/* Header card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-border bg-card p-6 mb-6"
        >
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/[0.1] text-xl font-bold text-primary flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">{user.name}</h1>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/[0.08] px-2.5 py-1 rounded-full">
                  <Star className="h-3 w-3 fill-current" />
                  {"Premium клієнт"}
                </span>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer flex-shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              {"Вийти"}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { value: "2", label: "Збережено" },
              { value: "3", label: "Переглянуто" },
              { value: "0", label: "Замовлень" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-secondary/50 p-3 text-center">
                <div className="text-lg font-bold text-foreground">{s.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-card border border-border p-1 mb-6">
          {[
            { id: "overview" as const, label: "Огляд" },
            { id: "saved" as const, label: "Збережені" },
            { id: "history" as const, label: "Історія" },
            { id: "settings" as const, label: "Налаштування" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-primary/[0.1] text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: CarIcon, label: "Каталог", view: "catalog" as AppView },
                { icon: Sparkles, label: "AI Підбір", view: "picker" as AppView },
                { icon: Heart, label: "Збережені", tab: "saved" as const },
                { icon: Clock, label: "Перегляди", tab: "history" as const },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    if ("view" in action && action.view) onNavigate(action.view)
                    else setActiveTab(action.tab)
                  }}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 hover:border-primary/20 hover:bg-secondary/50 transition-all cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.06]">
                    <action.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-foreground">{action.label}</span>
                </button>
              ))}
            </div>

            {/* Recent activity */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">{"Остання активність"}</h3>
              <div className="flex flex-col gap-3">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-secondary/30 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/[0.06] flex-shrink-0">
                      <CarIcon className="h-4 w-4 text-primary/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{item.car}</p>
                      <p className="text-[10px] text-muted-foreground">{item.label} · {item.time}</p>
                    </div>
                    <span className="text-xs font-semibold text-primary flex-shrink-0">{formatPrice(item.price)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact CTA */}
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">{"Потрібна допомога з вибором?"}</h3>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                {"Наші менеджери готові підібрати ідеальне авто під ваші потреби та бюджет."}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="tel:+380987081919"
                  className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:brightness-110 transition-all"
                >
                  <Phone className="h-3 w-3" />
                  {"Зателефонувати"}
                </a>
                <a
                  href="https://www.instagram.com/freshauto_ua/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-all"
                >
                  <MessageCircle className="h-3 w-3" />
                  {"Instagram"}
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "saved" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{"Збережені автомобілі"}</h3>
            {savedCars.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-border bg-card">
                <Heart className="h-8 w-8 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">{"Немає збережених авто"}</p>
                <button onClick={() => onNavigate("catalog")} className="mt-3 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer">
                  {"Перейти до каталогу →"}
                </button>
              </div>
            ) : (
              savedCars.map((car, i) => (
                <div key={i} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:border-primary/20 transition-colors">
                  <div className="h-16 w-24 flex-shrink-0 rounded-xl overflow-hidden">
                    <img src={car.image} alt={`${car.make} ${car.model}`} crossOrigin="anonymous" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{car.make} {car.model}</p>
                    <p className="text-[11px] text-muted-foreground">{car.year}</p>
                    <p className="text-sm font-bold text-primary mt-1">{formatPrice(car.price)}</p>
                  </div>
                  <button
                    onClick={() => onNavigate("catalog")}
                    className="flex-shrink-0 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
                  >
                    {"Деталі"}
                  </button>
                </div>
              ))
            )}
          </motion.div>
        )}

        {activeTab === "history" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{"Історія переглядів"}</h3>
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.06] flex-shrink-0">
                  <Clock className="h-4 w-4 text-primary/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.car}</p>
                  <p className="text-[10px] text-muted-foreground">{item.time}</p>
                </div>
                <span className="text-xs font-semibold text-primary flex-shrink-0">{formatPrice(item.price)}</span>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === "settings" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            {menuSections.map((section) => (
              <div key={section.title} className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{section.title}</h3>
                </div>
                <div className="divide-y divide-border">
                  {section.items.map((item) => (
                    <button
                      key={item.label}
                      className="flex w-full items-center gap-4 px-5 py-4 hover:bg-secondary/50 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/[0.06] flex-shrink-0">
                        <item.icon className="h-4 w-4 text-primary/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Logout */}
            <button
              onClick={onLogout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              {"Вийти з акаунту"}
            </button>
          </motion.div>
        )}
      </div>
    </section>
  )
}