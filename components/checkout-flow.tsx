"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Shield,
  Landmark,
  Building2,
  Banknote,
  RefreshCw,
  CreditCard,
  User,
  FileText,
  PenTool,
} from "lucide-react"
import { type Car } from "@/lib/data"
import { useSettings } from "@/lib/settings-context"

interface CheckoutFlowProps {
  car: Car | null
  onClose: () => void
}

const paymentMethods = [
  { id: "swift", label: "SWIFT переказ", icon: Landmark, desc: "Міжнародний банківський переказ" },
  { id: "leasing", label: "Лізинг", icon: Building2, desc: "Корпоративний або приватний лізинг" },
  { id: "tradein", label: "Trade-In + доплата", icon: RefreshCw, desc: "Обмін вашого авто з доплатою" },
  { id: "cash", label: "Безготівкова оплата", icon: Banknote, desc: "Оплата на рахунок або при отриманні" },
]

export default function CheckoutFlow({ car, onClose }: CheckoutFlowProps) {
  const { formatPrice } = useSettings()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", company: "",
    paymentMethod: "",
    signed: false,
  })
  const [done, setDone] = useState(false)

  if (!car) {
    return (
      <section className="py-12 px-6">
        <div className="mx-auto max-w-2xl flex flex-col items-center justify-center py-24 text-center">
          <CreditCard className="h-10 w-10 text-muted-foreground/15 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Кошик порожній</h2>
          <p className="text-xs text-muted-foreground mb-6">Оберіть авто з каталогу</p>
          <button onClick={onClose} className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground cursor-pointer hover:brightness-110 transition-all">
            Каталог <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    )
  }

  const steps = [
    { label: "Дані", icon: User },
    { label: "Оплата", icon: CreditCard },
    { label: "Договір", icon: FileText },
  ]

  const canNext =
    (step === 0 && form.firstName && form.lastName && form.email && form.phone) ||
    (step === 1 && form.paymentMethod) ||
    (step === 2 && form.signed)

  if (done) {
    return (
      <section className="py-12 px-6">
        <div className="mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center py-20 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6"
            >
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </motion.div>
            <h2 className="text-xl font-semibold text-foreground mb-1">Замовлення оформлено</h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-8">
              {form.firstName}, ваше замовлення на {car.make} {car.model} прийнято. Менеджер зв{"'"}яжеться з вами найближчим часом.
            </p>
            <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-4 w-full max-w-sm">
              <div className="h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg">
                <img src={car.image} alt={`${car.make} ${car.model}`} crossOrigin="anonymous" className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium text-foreground truncate">{car.make} {car.model}</div>
                <div className="text-[11px] text-muted-foreground">{car.year}</div>
              </div>
              <div className="text-sm font-semibold text-primary">{formatPrice(car.price)}</div>
            </div>
            <button
              onClick={onClose}
              className="mt-8 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Повернутися до каталогу
            </button>
          </motion.div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-12 px-6">
      <div className="mx-auto max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Оформлення</h2>
        </motion.div>

        {/* Car summary */}
        <div className="mb-6 flex items-center gap-4 rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-3">
          <div className="h-12 w-18 flex-shrink-0 overflow-hidden rounded-lg">
            <img src={car.image} alt={`${car.make} ${car.model}`} crossOrigin="anonymous" className="h-full w-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{car.year} {car.make} {car.model}</div>
            <div className="text-[11px] text-muted-foreground">{car.engine}</div>
          </div>
          <div className="text-sm font-semibold text-primary">{formatPrice(car.price)}</div>
        </div>

        {/* Steps */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex h-7 items-center gap-1.5 rounded-full px-3 text-[11px] font-medium transition-all ${
                i === step ? "bg-primary/10 text-primary" : i < step ? "text-foreground/60" : "text-muted-foreground/30"
              }`}>
                {i < step ? <Check className="h-3 w-3 text-primary" /> : <s.icon className="h-3 w-3" />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`h-px w-6 ${i < step ? "bg-primary/30" : "bg-white/[0.06]"}`} />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#0A0A0A] p-6 sm:p-8 min-h-[280px]">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="contact" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground mb-5">Контактна інформація</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-muted-foreground uppercase tracking-wider">{"Ім'я"}</label>
                    <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full rounded-xl border border-white/[0.06] bg-transparent px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/30 focus:border-primary/20 focus:outline-none transition-colors" placeholder="Олександр" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-muted-foreground uppercase tracking-wider">Прізвище</label>
                    <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full rounded-xl border border-white/[0.06] bg-transparent px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/30 focus:border-primary/20 focus:outline-none transition-colors" placeholder="Коваленко" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-muted-foreground uppercase tracking-wider">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-white/[0.06] bg-transparent px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/30 focus:border-primary/20 focus:outline-none transition-colors" placeholder="oleksandr@example.ua" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-muted-foreground uppercase tracking-wider">Телефон</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-white/[0.06] bg-transparent px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/30 focus:border-primary/20 focus:outline-none transition-colors" placeholder="+380 67 XXX XXXX" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-muted-foreground uppercase tracking-wider">Компанія</label>
                    <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full rounded-xl border border-white/[0.06] bg-transparent px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/30 focus:border-primary/20 focus:outline-none transition-colors" placeholder="Необов'язково" />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <h3 className="text-sm font-semibold text-foreground mb-5">Спосіб оплати</h3>
                <div className="space-y-2">
                  {paymentMethods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setForm({ ...form, paymentMethod: m.id })}
                      className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer ${
                        form.paymentMethod === m.id ? "border-primary/20 bg-primary/[0.04]" : "border-white/[0.06] hover:border-white/[0.1]"
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${form.paymentMethod === m.id ? "bg-primary/10" : "bg-white/[0.03]"}`}>
                        <m.icon className={`h-4 w-4 ${form.paymentMethod === m.id ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1">
                        <div className={`text-xs font-medium ${form.paymentMethod === m.id ? "text-foreground" : "text-foreground/80"}`}>{m.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</div>
                      </div>
                      {form.paymentMethod === m.id && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="contract" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <h3 className="text-sm font-semibold text-foreground mb-5">Договір</h3>
                <div className="rounded-xl bg-white/[0.02] p-5 mb-5 text-[11px] text-muted-foreground space-y-2 max-h-44 overflow-y-auto font-mono">
                  <p className="text-foreground font-sans text-xs font-medium">Договір купівлі-продажу ТЗ</p>
                  <p>{"Договір №: FA-2026-"}{car.id.padStart(5, "0")}</p>
                  <p>Покупець: {form.firstName} {form.lastName}</p>
                  <p>ТЗ: {car.year} {car.make} {car.model}</p>
                  <p>VIN: {car.vin}</p>
                  <p>Вартість: {formatPrice(car.price)}</p>
                  <p>Оплата: {paymentMethods.find((m) => m.id === form.paymentMethod)?.label}</p>
                  <p className="border-t border-white/[0.04] pt-2">
                    Покупець зобов{"'"}язується здійснити оплату протягом 14 робочих днів. Fresh Auto гарантує стан ТЗ відповідно до звіту CarVertical.
                  </p>
                </div>
                <button
                  onClick={() => setForm({ ...form, signed: !form.signed })}
                  className={`flex w-full items-center gap-4 rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                    form.signed ? "border-primary/20 bg-primary/[0.04]" : "border-white/[0.06] hover:border-white/[0.1]"
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${form.signed ? "bg-primary/10" : "bg-white/[0.03]"}`}>
                    <PenTool className={`h-4 w-4 ${form.signed ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className={`text-xs font-medium ${form.signed ? "text-foreground" : "text-foreground/80"}`}>
                      {form.signed ? "Підписано" : "Підписати договір"}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {form.signed ? `${form.firstName} ${form.lastName}` : "Цифровий підпис"}
                    </div>
                  </div>
                  {form.signed && <Check className="h-4 w-4 text-primary" />}
                </button>
                <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
                  <Shield className="h-3 w-3" />
                  256-бітне SSL шифрування
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={() => step === 0 ? onClose() : setStep(step - 1)}
            className="flex items-center gap-2 rounded-full border border-white/[0.06] px-5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" />
            {step === 0 ? "Скасувати" : "Назад"}
          </button>
          {step < 2 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground hover:brightness-110 transition-all disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
            >
              Далі <ArrowRight className="h-3 w-3" />
            </button>
          ) : (
            <button
              onClick={() => setDone(true)}
              disabled={!form.signed}
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs font-medium text-primary-foreground hover:brightness-110 transition-all disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
            >
              Оформити <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
