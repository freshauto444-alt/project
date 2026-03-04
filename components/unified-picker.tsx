"use client"

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Send, Bot, User, Sparkles, RotateCcw, SlidersHorizontal,
  Check, ArrowRight, Gauge, Fuel, Shield, FileText, Calculator,
  Search, X, ChevronDown, ChevronRight, Phone, MessageCircle,
  Zap, Car as CarIcon, MapPin, Calendar,
} from "lucide-react"
import {
  cars, type Car, makes, modelsByMake, bodyTypes, bodyTypesMap,
  fuelTypes, fuelTypesMap, driveTypes, driveLabels,
  transmissionTypes, conditionTypes, countries,
  formatMileage, formatPrice as formatPriceDefault,
} from "@/lib/data"
import { useSettings } from "@/lib/settings-context"

interface UnifiedPickerProps {
  onSelectCar: (car: Car) => void
}

/* ---- Cost calculator ---- */
function calcTotalCost(price: number) {
  const duty = Math.round(price * 0.1)
  const excise = Math.round(price * 0.05)
  const vat = Math.round((price + duty + excise) * 0.2)
  const delivery = 2500
  const certification = 1200
  const broker = 800
  const total = price + duty + excise + vat + delivery + certification + broker
  return { price, duty, excise, vat, delivery, certification, broker, total }
}

const CostBreakdown = memo(function CostBreakdown({ car }: { car: Car }) {
  const { formatPrice } = useSettings()
  const c = calcTotalCost(car.price)
  const rows = [
    { label: "Вартість авто", value: c.price },
    { label: "Мито (10%)", value: c.duty },
    { label: "Акциз (5%)", value: c.excise },
    { label: "ПДВ (20%)", value: c.vat },
    { label: "Доставка", value: c.delivery },
    { label: "Сертифікація", value: c.certification },
    { label: "Брокер", value: c.broker },
  ]
  return (
    <div className="rounded-xl border border-border bg-secondary/50 p-5 mt-3">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-4 w-4 text-primary/60" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{"Повна вартість під ключ"}</span>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="text-foreground tabular-nums">{formatPrice(r.value)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-2 mt-2">
          <span className="text-foreground font-medium">{"Разом"}</span>
          <span className="text-primary font-semibold tabular-nums">{formatPrice(c.total)}</span>
        </div>
      </div>
    </div>
  )
})

const CarResultCard = memo(function CarResultCard({ car, onSelect }: { car: Car; onSelect: (car: Car) => void }) {
  const { formatPrice } = useSettings()
  const [showCost, setShowCost] = useState(false)
  return (
    <div className="rounded-2xl border border-border bg-secondary/30 overflow-hidden transition-colors hover:border-primary/20">
      {/* Horizontal layout: large image left, info right */}
      <div className="flex flex-col sm:flex-row">
        <button
          onClick={() => onSelect(car)}
          className="relative w-full sm:w-[340px] flex-shrink-0 aspect-[16/9] overflow-hidden cursor-pointer group"
        >
          <img
            src={car.image}
            alt={`${car.make} ${car.model}`}
            crossOrigin="anonymous"
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          {car.verified && (
            <span className="absolute top-3 left-3 rounded-lg bg-emerald-500/80 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm flex items-center gap-1">
              <Shield className="h-3 w-3" />{"Перевірений"}
            </span>
          )}
        </button>
        <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <button
              onClick={() => onSelect(car)}
              className="text-base sm:text-lg font-bold text-foreground hover:text-primary transition-colors cursor-pointer text-left"
              style={{ letterSpacing: "-0.01em" }}
            >
              {car.make} {car.model} {car.year}
            </button>
            <p className="text-xs text-muted-foreground mt-0.5">
              {car.engine} {"\u00B7"} {car.horsepower} {"к.с."} {"\u00B7"} {car.bodyTypeUa}
            </p>
            {/* Price */}
            <div className="mt-2">
              <span className="text-lg font-extrabold tabular-nums" style={{ color: "#00D2C6" }}>{formatPrice(car.price)}</span>
            </div>
            {/* Specs */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Gauge className="h-3.5 w-3.5" />{formatMileage(car.mileage)}</span>
              <span className="flex items-center gap-1"><Fuel className="h-3.5 w-3.5" />{car.fuelUa}</span>
              <span>{car.drive}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{car.countryUa}</span>
            </div>
            {/* Tags */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                car.status === "In Stock" ? "bg-emerald-500/10 text-emerald-400" :
                car.status === "In Transit" ? "bg-amber-500/10 text-amber-400" :
                "bg-primary/10 text-primary"
              }`}>{car.statusUa}</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/[0.04] text-muted-foreground">{car.transmission}</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/[0.04] text-muted-foreground">{car.colorUa}</span>
            </div>
          </div>
          {/* Bottom row */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.04]">
            <button onClick={() => setShowCost(!showCost)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <FileText className="h-3.5 w-3.5" />
              {showCost ? "Сховати" : "Під ключ"}
            </button>
            <button onClick={() => onSelect(car)} className="ml-auto text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer transition-colors flex items-center gap-1">
              {"Детальніше"} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
      {showCost && <div className="border-t border-white/[0.04] px-4 pb-4"><CostBreakdown car={car} /></div>}
    </div>
  )
})

/* ═══════════════════════════════════════════
   ENHANCED AI ENGINE
   ═══════════════════════════════════════════ */

interface Message {
  id: string
  role: "user" | "assistant"
  text: string
  cars?: Car[]
  options?: string[]
  multiSelect?: boolean
  freeInput?: boolean
}

const INTENT_KEYWORDS: Record<string, { keywords: string[]; weight: number }> = {
  sport: { keywords: ["спорт", "швидк", "драйв", "потужн", "трек", "адреналін", "гонк", "дріфт", "розгон", "динамік", "агресив", "купе", "coupe", "gt", "rs", "amg", "турбо", "суперкар", "заряджен", "емоц", "кайф"], weight: 5 },
  family: { keywords: ["сім'я", "сімей", "діт", "подорож", "простор", "великий", "зручн", "комфорт", "безпечн", "багажник", "suv", "позашляхов", "кросовер", "практичн", "щоденн", "місто", "міськ"], weight: 5 },
  business: { keywords: ["бізнес", "представниц", "клієнт", "статус", "імідж", "престиж", "розкіш", "люкс", "vip", "седан", "елегантн", "стильн", "солідн", "преміум"], weight: 4 },
  eco: { keywords: ["еколог", "електр", "гібрид", "зелен", "зарядк", "батаре", "ev", "e-tron", "taycan", "електромобіль", "без бензин", "тих", "безшумн"], weight: 8 },
  cheap: { keywords: ["дешев", "бюджет", "доступн", "недорог", "економ", "вигідн"], weight: 6 },
  power: { keywords: ["потужн", "700", "600", "800", "найпотужніш", "максимальн"], weight: 5 },
  new: { keywords: ["нов", "2025", "2026", "свіж", "останн", "актуальн"], weight: 3 },
  available: { keywords: ["наявн", "зараз", "готов", "сьогодні", "швидко", "терміново", "негайно", "забрати"], weight: 5 },
  lowmileage: { keywords: ["мало пробіг", "малий пробіг", "без пробіг", "нульов", "мінімальн пробіг"], weight: 5 },
  verified: { keywords: ["перевірен", "CarVertical", "гарант", "сертиф", "діагност", "звіт", "історі"], weight: 3 },
}

const BRAND_ALIASES: Record<string, string> = {
  "порше": "Porsche", "бмв": "BMW", "мерседес": "Mercedes-Benz", "мерс": "Mercedes-Benz",
  "ауді": "Audi", "ламборгіні": "Lamborghini", "ламбо": "Lamborghini",
  "феррарі": "Ferrari", "макларен": "McLaren", "porsche": "Porsche", "bmw": "BMW",
  "mercedes": "Mercedes-Benz", "audi": "Audi", "lamborghini": "Lamborghini",
  "ferrari": "Ferrari", "mclaren": "McLaren", "фольксваген": "Volkswagen", "vw": "Volkswagen",
  "тойота": "Toyota", "toyota": "Toyota", "volkswagen": "Volkswagen",
  "хонда": "Honda", "honda": "Honda", "хюндай": "Hyundai", "hyundai": "Hyundai",
  "кіа": "Kia", "kia": "Kia", "ніссан": "Nissan", "nissan": "Nissan",
  "мазда": "Mazda", "mazda": "Mazda", "шкода": "Skoda", "skoda": "Skoda",
  "вольво": "Volvo", "volvo": "Volvo", "лексус": "Lexus", "lexus": "Lexus",
  "ленд ровер": "Land Rover", "land rover": "Land Rover", "джип": "Jeep", "jeep": "Jeep",
  "тесла": "Tesla", "tesla": "Tesla",
}

function detectIntents(text: string): Record<string, number> {
  const q = text.toLowerCase()
  const intents: Record<string, number> = {}
  for (const [intent, { keywords, weight }] of Object.entries(INTENT_KEYWORDS)) {
    let count = 0
    for (const kw of keywords) { if (q.includes(kw)) count++ }
    if (count > 0) intents[intent] = count * weight
  }
  return intents
}

function detectBrands(text: string): string[] {
  const q = text.toLowerCase()
  const brands: string[] = []
  for (const [alias, brand] of Object.entries(BRAND_ALIASES)) {
    if (q.includes(alias) && !brands.includes(brand)) brands.push(brand)
  }
  for (const car of cars) {
    if (q.includes(car.make.toLowerCase()) && !brands.includes(car.make)) brands.push(car.make)
    if (q.includes(car.model.toLowerCase()) && !brands.includes(car.make)) brands.push(car.make)
  }
  return brands
}

function detectBudget(text: string): { min: number; max: number } | null {
  const q = text.toLowerCase()
  let match = q.match(/до\s*(\d+)\s*k/i) || q.match(/до\s*(\d+)\s*тис/) || q.match(/до\s*(\d{6,})/)
  if (match) { const v = parseInt(match[1]); return { min: 0, max: v < 1000 ? v * 1000 : v } }
  match = q.match(/від\s*(\d+)\s*(?:k|тис)?\s*до\s*(\d+)\s*(?:k|тис)?/)
  if (match) { let min = parseInt(match[1]), max = parseInt(match[2]); if (min < 1000) min *= 1000; if (max < 1000) max *= 1000; return { min, max } }
  if (q.includes("бюджет не обмежен") || q.includes("будь-як")) return null
  if (q.includes("до 200")) return { min: 0, max: 200000 }
  if (q.includes("до 300")) return { min: 0, max: 300000 }
  if (q.includes("до 150")) return { min: 0, max: 150000 }
  if (q.includes("до 100")) return { min: 0, max: 100000 }
  if (q.includes("до 50")) return { min: 0, max: 50000 }
  if (q.includes("до 400")) return { min: 0, max: 400000 }
  if (q.includes("50 000 - 150 000") || q.includes("50-150")) return { min: 50000, max: 150000 }
  if (q.includes("150 000 - 250 000") || q.includes("150-250")) return { min: 150000, max: 250000 }
  if (q.includes("250 000 - 400 000") || q.includes("250-400")) return { min: 250000, max: 400000 }
  return null
}

function scoreCarAdvanced(car: Car, allText: string, intents: Record<string, number>, brands: string[], budget: { min: number; max: number } | null): number {
  let score = 0
  if (brands.length > 0) { if (brands.includes(car.make)) score += 25; else score -= 10 }
  if (budget) { if (car.price >= budget.min && car.price <= budget.max) score += 15; else if (car.price > budget.max) score -= 20; else score -= 5 }
  if (intents.sport) { if (car.horsepower >= 600) score += intents.sport * 2; else if (car.horsepower >= 500) score += intents.sport; if (car.bodyType === "Coupe") score += intents.sport; if (car.drive === "RWD") score += intents.sport * 0.5 }
  if (intents.family) { if (car.bodyType === "SUV") score += intents.family * 2; else if (car.bodyType === "Sedan") score += intents.family; if (car.drive === "AWD") score += intents.family * 0.5; if (car.bodyType === "Coupe") score -= intents.family }
  if (intents.business) { if (car.bodyType === "Sedan") score += intents.business * 1.5; if (car.price >= 150000) score += intents.business; if (["Mercedes-Benz", "BMW", "Audi", "Porsche"].includes(car.make)) score += intents.business }
  if (intents.eco) { if (car.fuel === "Electric") score += intents.eco * 2; else if (car.fuel === "Hybrid") score += intents.eco; else score -= intents.eco }
  if (intents.cheap) { score += Math.max(0, (350000 - car.price) / 10000) * intents.cheap * 0.3 }
  if (intents.power) { score += (car.horsepower / 100) * intents.power * 0.5 }
  if (intents.new) { if (car.year >= 2025) score += intents.new * 2; else if (car.year === 2024) score += intents.new }
  if (intents.available) { if (car.status === "In Stock") score += intents.available * 2; else if (car.status === "Verified") score += intents.available; else score -= intents.available }
  if (intents.lowmileage) { if (car.mileage < 1000) score += intents.lowmileage * 2; else if (car.mileage < 3000) score += intents.lowmileage; else if (car.mileage > 5000) score -= intents.lowmileage * 0.5 }
  if (intents.verified) { if (car.verified) score += intents.verified * 2 }
  const q = allText.toLowerCase()
  if (q.includes("повний привід") || q.includes("awd") || q.includes("4x4")) { if (car.drive === "AWD" || car.drive === "4WD") score += 8; else score -= 3 }
  if (q.includes("задній привід") || q.includes("rwd")) { if (car.drive === "RWD") score += 8; else score -= 3 }
  return score
}

/* ---- Guided quiz flow (7 questions) ---- */

interface QuizQuestion {
  id: string
  question: string
  options: string[]
  multiSelect: boolean
  skipLabel: string
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "purpose",
    question: "Яка ціль придбання автомобіля?",
    options: ["Щоденні поїздки по місту", "Далекі подорожі та автобани", "Спорт та драйв", "Бізнес та представницький клас", "Для сім'ї з дітьми", "Інвестиція / колекціонування"],
    multiSelect: true,
    skipLabel: "Будь-яка ціль",
  },
  {
    id: "body",
    question: "Який тип кузова вас цікавить?",
    options: ["Купе", "Седан", "Позашляховик", "Хетчбек", "Універсал", "Кабріолет"],
    multiSelect: true,
    skipLabel: "Будь-який кузов",
  },
  {
    id: "fuel",
    question: "Який тип палива?",
    options: ["Бензин", "Дизель", "Електро", "Гібрид", "Plug-in Гібрид"],
    multiSelect: true,
    skipLabel: "Будь-яке паливо",
  },
  {
    id: "year",
    question: "Від якого року випуску розглядаєте?",
    options: ["2026", "2025", "2024", "2023", "2022", "2020 і старше"],
    multiSelect: false,
    skipLabel: "Будь-який рік",
  },
  {
    id: "transmission",
    question: "Тип трансмісії?",
    options: ["Автомат", "Механіка", "Робот", "Варіатор"],
    multiSelect: true,
    skipLabel: "Будь-яка трансмісія",
  },
  {
    id: "drive",
    question: "Який привід?",
    options: ["Передній (FWD)", "Задній (RWD)", "Повний (AWD)", "Повний (4WD)"],
    multiSelect: true,
    skipLabel: "Будь-який привід",
  },
  {
    id: "budget",
    question: "Який бюджет ви розглядаєте?",
    options: ["До 50 000 EUR", "50 000 - 150 000 EUR", "150 000 - 250 000 EUR", "250 000 - 400 000 EUR", "Бюджет не обмежений"],
    multiSelect: false,
    skipLabel: "Бюджет не обмежений",
  },
]

/* ---- Quiz-based filter from answers ---- */
const DRIVE_MAP: Record<string, string> = { "Передній (FWD)": "FWD", "Задній (RWD)": "RWD", "Повний (AWD)": "AWD", "Повний (4WD)": "4WD" }

function filterCarsFromQuiz(answers: Record<string, string[]>): Car[] {
  return cars.filter(car => {
    // Body type
    const body = answers["body"]
    if (body && body.length > 0 && !body.some(b => b.toLowerCase().includes("будь"))) {
      if (!body.some(b => { const mapped = bodyTypesMap[b]; return mapped ? car.bodyType === mapped : car.bodyTypeUa === b })) return false
    }
    // Fuel
    const fuel = answers["fuel"]
    if (fuel && fuel.length > 0 && !fuel.some(f => f.toLowerCase().includes("будь"))) {
      if (!fuel.some(f => { const mapped = fuelTypesMap[f]; return mapped ? car.fuel === mapped : car.fuelUa === f })) return false
    }
    // Year
    const year = answers["year"]
    if (year && year.length > 0 && !year.some(y => y.toLowerCase().includes("будь"))) {
      const y = year[0]
      if (y.includes("старше")) { if (car.year > 2020) return false }
      else { const minYear = parseInt(y); if (!isNaN(minYear) && car.year < minYear) return false }
    }
    // Transmission
    const trans = answers["transmission"]
    if (trans && trans.length > 0 && !trans.some(t => t.toLowerCase().includes("будь"))) {
      if (!trans.some(t => car.transmission.toLowerCase().includes(t.toLowerCase()))) return false
    }
    // Drive
    const drive = answers["drive"]
    if (drive && drive.length > 0 && !drive.some(d => d.toLowerCase().includes("будь"))) {
      if (!drive.some(d => { const mapped = DRIVE_MAP[d]; return mapped ? car.drive === mapped : car.drive === d })) return false
    }
    // Budget
    const budget = answers["budget"]
    if (budget && budget.length > 0) {
      const b = budget[0]
      if (b.includes("50 000 - 150 000")) { if (car.price < 50000 || car.price > 150000) return false }
      else if (b.includes("150 000 - 250 000")) { if (car.price < 150000 || car.price > 250000) return false }
      else if (b.includes("250 000 - 400 000")) { if (car.price < 250000 || car.price > 400000) return false }
      else if (b.includes("До 50 000")) { if (car.price > 50000) return false }
      // "Бюджет не обмежений" -- no filter
    }
    return true
  })
}

function generateSmartResponse(conversation: Message[], quizAnswers: Record<string, string[]>): { text: string; cars: Car[]; options?: string[]; multiSelect?: boolean; freeInput?: boolean; isQuizQuestion?: number } {
  const allUserText = conversation.filter(m => m.role === "user").map(m => m.text).join(" ")
  const lastUser = conversation.filter(m => m.role === "user").pop()?.text || ""
  const lastLower = lastUser.toLowerCase()
  const userMsgCount = conversation.filter(m => m.role === "user").length

  // Command handling
  if (lastLower.includes("спочатку") || lastLower.includes("заново") || lastLower.includes("скинути") || lastLower.includes("з початку")) {
    return { text: "", cars: [], isQuizQuestion: -1 }
  }

  // Post-quiz commands
  const quizDone = Object.keys(quizAnswers).length >= QUIZ_QUESTIONS.length
  if (quizDone) {
    if (lastLower.includes("покажіть все") || lastLower.includes("всі авто") || lastLower.includes("покажи все")) {
      return { text: `У каталозі ${cars.length} перевірених автомобілів:`, cars: [...cars], options: ["Детальніше про перший", "Почати спочатку"], freeInput: true }
    }
    if (lastLower.includes("порівн")) {
      const prevCars = conversation.flatMap(m => m.cars || [])
      if (prevCars.length >= 2) {
        const c1 = prevCars[0], c2 = prevCars[1]
        return { text: `Порівняння:\n\n${c1.make} ${c1.model}:\n  ${c1.horsepower} к.с. | ${formatMileage(c1.mileage)} | ${c1.fuelUa} | ${formatPriceDefault(c1.price)}\n\n${c2.make} ${c2.model}:\n  ${c2.horsepower} к.с. | ${formatMileage(c2.mileage)} | ${c2.fuelUa} | ${formatPriceDefault(c2.price)}`, cars: [c1, c2], options: ["Який краще для міста?", "Покажи щось інше", "Почати спочатку"], freeInput: true }
      }
    }
    if (lastLower.includes("детальніше") || lastLower.includes("розкажи більше") || lastLower.includes("про перший")) {
      const prevCars = conversation.flatMap(m => m.cars || [])
      if (prevCars.length > 0) {
        const car = prevCars[0]
        return {
          text: `${car.year} ${car.make} ${car.model}\n\nДвигун: ${car.engine}, ${car.horsepower} к.с.\nПаливо: ${car.fuelUa} | Привід: ${car.drive}\nПробіг: ${formatMileage(car.mileage)} | Колір: ${car.colorUa}\nОснащення: ${car.featuresUa.join(", ")}\n\nВартість під ключ: ${formatPriceDefault(calcTotalCost(car.price).total)}\n\nАвтомобіль ${car.verified ? "перевірено через CarVertical, без ДТП" : "очікує перевірку"}.`,
          cars: [car], options: ["Є щось подібне?", "Порівняй з іншим", "Хочу цей, що далі?"], freeInput: true,
        }
      }
    }
    if (lastLower.includes("хочу цей") || lastLower.includes("що далі") || lastLower.includes("як купити")) {
      return { text: "Для оформлення зв'яжіться з нашим менеджером:\n\n098 708 19 19 -- Ігор Юрійович\n067 816 05 05 -- Руслан Петрович\n\nТакож можете написати в Instagram @freshauto_ua.", cars: [], options: ["Покажи ще варіанти", "Почати спочатку"], freeInput: true }
    }
    if (lastLower.includes("дешевше") || lastLower.includes("найдешев")) {
      const filtered = filterCarsFromQuiz(quizAnswers).sort((a, b) => a.price - b.price).slice(0, 5)
      return { text: "Найдоступніші з підібраних:", cars: filtered, options: ["Детальніше про перший", "Покажи потужніші", "Почати спочатку"], freeInput: true }
    }
    if (lastLower.includes("потужніш") || lastLower.includes("найпотужніш")) {
      const filtered = filterCarsFromQuiz(quizAnswers).sort((a, b) => b.horsepower - a.horsepower).slice(0, 5)
      return { text: "Найпотужніші з підібраних:", cars: filtered, options: ["Детальніше про перший", "Покажи дешевші", "Почати спочатку"], freeInput: true }
    }

    // General fallback with quiz filters + NLP scoring
    const intents = detectIntents(allUserText)
    const brands = detectBrands(allUserText)
    const budget = detectBudget(allUserText)
    const quizFiltered = filterCarsFromQuiz(quizAnswers)
    const scored = quizFiltered.map(c => ({ car: c, score: scoreCarAdvanced(c, allUserText, intents, brands, budget) })).sort((a, b) => b.score - a.score)
    const results = scored.slice(0, 6).map(s => s.car)
    const txt = results.length > 0
      ? `Ось ${results.length} варіантів за вашим запитом:`
      : "На жаль, за цим запитом нічого не знайшов. Спробуйте інакше або почніть спочатку."
    return { text: txt, cars: results, options: ["Детальніше про перший", "Порівняй", "Покажи дешевші", "Хочу цей, що далі?", "Почати спочатку"], freeInput: true }
  }

  // Should not reach here during quiz (handled in component), but fallback:
  return { text: "Продовжуємо підбір...", cars: [], options: QUIZ_QUESTIONS[0].options, multiSelect: true, freeInput: true }
}

/* ═══════════════════════════════════════════
   AI CHAT TAB  (Quiz-first flow)
   ═══════════════════════════════════════════ */

function AiChatTab({ onSelectCar }: { onSelectCar: (car: Car) => void }) {
  const [quizStep, setQuizStep] = useState(0) // 0..6 = quiz, 7+ = chat mode
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string[]>>({})
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [customInput, setCustomInput] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const quizDone = quizStep >= QUIZ_QUESTIONS.length

  /* Track whether user has sent a follow-up chat message (not the initial results) */
  const userChatCount = messages.filter(m => m.role === "user").length

  /* During quiz: scroll to top so question is visible.
     When quiz just finished (results shown): scroll to top so user sees results from the start.
     During follow-up chat: scroll to bottom so latest message is visible. */
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [quizStep])

  useEffect(() => {
    if (quizDone && userChatCount > 0) {
      endRef.current?.scrollIntoView({ behavior: "smooth" })
    } else if (quizDone && userChatCount === 0) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [messages, quizDone, userChatCount])

  useEffect(() => {
    if (typing && quizDone && userChatCount > 0) {
      endRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [typing, quizDone, userChatCount])

  /* Submit quiz answer */
  const submitQuizAnswer = useCallback((answers: string[]) => {
    const q = QUIZ_QUESTIONS[quizStep]
    const newAnswers = { ...quizAnswers, [q.id]: answers }
    setQuizAnswers(newAnswers)
    setSelectedOptions([])
    setCustomInput("")
    const nextStep = quizStep + 1

    if (nextStep >= QUIZ_QUESTIONS.length) {
      // Quiz complete -- show results
      setQuizStep(nextStep)
      setTyping(true)
      setTimeout(() => {
        const filtered = filterCarsFromQuiz(newAnswers)
        const intents = detectIntents(answers.join(" "))
        const scored = filtered.map(c => ({ car: c, score: scoreCarAdvanced(c, Object.values(newAnswers).flat().join(" "), intents, [], null) })).sort((a, b) => b.score - a.score)
        const results = scored.slice(0, 6).map(s => s.car)
        const text = results.length > 0
          ? `Готово! За вашими критеріями підібрав ${results.length} автомобілів.\nКожен пройшов перевірку та має звіт CarVertical:`
          : "На жаль, точних збігів не знайшов. Спробуйте змінити критерії або перегляньте весь каталог."
        setMessages([{
          id: "results",
          role: "assistant",
          text,
          cars: results.length > 0 ? results : undefined,
          options: results.length > 0
            ? ["Детальніше про перший", "Порівняй", "Покажи дешевші", "Покажи потужніші", "Хочу цей, що далі?", "Почати спочатку"]
            : ["Покажи всі авто", "Почати спочатку"],
          freeInput: true,
        }])
        setTyping(false)
      }, 500)
    } else {
      setQuizStep(nextStep)
    }
  }, [quizStep, quizAnswers])

  /* Send free text in chat mode (after quiz) */
  const send = useCallback((text: string) => {
    if (!text.trim()) return
    const userMsg: Message = { id: Date.now().toString(), role: "user", text: text.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput("")
    setSelectedOptions([])
    setTyping(true)
    setTimeout(() => {
      const lower = text.toLowerCase()
      if (lower.includes("спочатку") || lower.includes("заново") || lower.includes("з початку")) {
        setQuizStep(0); setQuizAnswers({}); setMessages([]); setSelectedOptions([]); setTyping(false); return
      }
      const result = generateSmartResponse(next, quizAnswers)
      if (result.isQuizQuestion === -1) {
        setQuizStep(0); setQuizAnswers({}); setMessages([]); setSelectedOptions([]); setTyping(false); return
      }
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: result.text,
        cars: result.cars.length ? result.cars : undefined,
        options: result.options,
        multiSelect: result.multiSelect,
        freeInput: result.freeInput,
      }])
      setTyping(false)
    }, 400 + Math.random() * 400)
  }, [messages, quizAnswers])

  const toggleOption = useCallback((opt: string) => {
    setSelectedOptions(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt])
  }, [])

  const resetAll = useCallback(() => {
    setQuizStep(0); setQuizAnswers({}); setMessages([]); setSelectedOptions([]); setInput(""); setCustomInput("")
  }, [])

  const currentQ = !quizDone ? QUIZ_QUESTIONS[quizStep] : null

  return (
    <div className="flex flex-col" style={{ height: "min(75vh, 720px)" }}>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 will-change-transform overscroll-contain">

        {/* ─── Quiz Mode ─── */}
        {!quizDone && currentQ && (
          <div className="flex flex-col gap-4 max-w-lg mx-auto w-full py-2">
            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">
                {"Питання"} {quizStep + 1} / {QUIZ_QUESTIONS.length}
              </span>
              <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((quizStep + 1) / QUIZ_QUESTIONS.length) * 100}%` }}
                  transition={{ type: "spring", bounce: 0.1, duration: 0.5 }}
                />
              </div>
            </div>

            {/* Bot avatar + question */}
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex gap-3"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/[0.08]">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground leading-relaxed">{currentQ.question}</p>
                {currentQ.multiSelect && (
                  <p className="text-[11px] text-muted-foreground mt-1">{"Можна обрати декілька або написати свій варіант"}</p>
                )}
              </div>
            </motion.div>

            {/* Options */}
            <motion.div
              key={`opts-${currentQ.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="flex flex-wrap gap-2"
            >
              {currentQ.options.map((o, i) => {
                const isSelected = selectedOptions.includes(o)
                return (
                  <motion.button
                    key={o}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.08 * i, duration: 0.2 }}
                    onClick={() => {
                      if (currentQ.multiSelect) {
                        toggleOption(o)
                      } else {
                        submitQuizAnswer([o])
                      }
                    }}
                    className={`rounded-xl border px-4 py-2.5 text-xs font-medium transition-all cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-primary/20 hover:bg-secondary/50"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                    {o}
                  </motion.button>
                )
              })}
            </motion.div>

            {/* Custom input for this question */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && customInput.trim()) {
                    e.preventDefault()
                    submitQuizAnswer([customInput.trim()])
                  }
                }}
                placeholder="Або напишіть свій варіант..."
                className="flex-1 rounded-xl border border-border bg-transparent px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/30 focus:border-primary/20 focus:outline-none transition-colors"
              />
            </div>

            {/* Action buttons row */}
            <div className="flex items-center gap-2 flex-wrap">
              {currentQ.multiSelect && selectedOptions.length > 0 && (
                <button
                  onClick={() => submitQuizAnswer(selectedOptions)}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:brightness-110 transition-all cursor-pointer"
                >
                  {"Далі"} ({selectedOptions.length}) <ArrowRight className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => submitQuizAnswer([currentQ.skipLabel])}
                className="rounded-xl border border-border px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/20 transition-all cursor-pointer"
              >
                {"Пропустити"}
              </button>
              {quizStep > 0 && (
                <button
                  onClick={() => { setQuizStep(quizStep - 1); setSelectedOptions([]); setCustomInput("") }}
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer ml-auto"
                >
                  {"Назад"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── Chat Mode (after quiz) ─── */}
        {quizDone && (
          <>
            {/* Summary of quiz answers */}
            {messages.length <= 1 && (
              <div className="rounded-xl border border-border bg-secondary/30 p-4 mb-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{"Ваші критерії"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(quizAnswers).map(([key, vals]) => {
                    return vals.filter(v => !v.toLowerCase().includes("будь")).map(v => (
                      <span key={`${key}-${v}`} className="rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-[10px] text-primary font-medium">
                        {v}
                      </span>
                    ))
                  })}
                </div>
              </div>
            )}
            {messages.map((msg) => {
              const isLast = msg.id === messages[messages.length - 1]?.id
              return (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${msg.role === "assistant" ? "bg-primary/[0.08]" : "bg-secondary"}`}>
                    {msg.role === "assistant" ? <Bot className="h-3.5 w-3.5 text-primary" /> : <User className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div className={`max-w-[88%] flex flex-col gap-2 ${msg.role === "user" ? "items-end" : ""}`}>
                    <div className={`inline-block rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-line ${msg.role === "user" ? "bg-primary/10 text-foreground rounded-br-md" : "bg-secondary/50 text-foreground rounded-bl-md"}`}>
                      {msg.text}
                    </div>
                    {msg.cars && msg.cars.length > 0 && (
                      <div className="flex flex-col gap-2 w-full">
                        {msg.cars.map((car) => <CarResultCard key={car.id} car={car} onSelect={onSelectCar} />)}
                      </div>
                    )}
                    {msg.options && isLast && (
                      <div className="w-full">
                        <div className="flex flex-wrap gap-1.5">
                          {msg.options.map((o) => (
                            <button key={o} onClick={() => send(o)} className="rounded-full border border-border bg-secondary/30 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/20 transition-all cursor-pointer">{o}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {typing && (
          <div className="flex gap-2.5">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/[0.08]"><Bot className="h-3.5 w-3.5 text-primary" /></div>
            <div className="rounded-2xl bg-secondary/50 px-4 py-2.5 rounded-bl-md">
              <div className="flex items-center gap-1">{[0, 1, 2].map((i) => <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} className="h-1.5 w-1.5 rounded-full bg-primary/50" />)}</div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input bar -- only visible after quiz */}
      {quizDone && (
        <div className="border-t border-border p-4">
          <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex items-center gap-2">
            <button type="button" onClick={resetAll} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary/50 transition-colors cursor-pointer" aria-label="Reset"><RotateCcw className="h-3.5 w-3.5" /></button>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Уточніть запит або задайте питання..." disabled={typing} className="flex-1 rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:border-primary/20 focus:outline-none transition-colors" />
            <button type="submit" disabled={!input.trim() || typing} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:opacity-20 cursor-pointer" aria-label="Send"><Send className="h-3.5 w-3.5" /></button>
          </form>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   SEARCHABLE SELECT (auto.ria / mobile.de style)
   ═══════════════════════════════════════════ */

function SearchableSelect({ items, selected, onToggle, placeholder, multi = true }: {
  items: string[]; selected: Set<string>; onToggle: (v: string) => void; placeholder: string; multi?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = query
    ? items.filter(i => i.toLowerCase().includes(query.toLowerCase()))
    : items

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 cursor-pointer hover:border-white/[0.14] transition-colors"
      >
        {selected.size > 0 ? (
          <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
            {Array.from(selected).slice(0, 3).map(s => (
              <span key={s} className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs text-primary">
                {s}
                <button onClick={(e) => { e.stopPropagation(); onToggle(s) }} className="hover:text-primary/60 cursor-pointer"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {selected.size > 3 && <span className="text-xs text-muted-foreground">+{selected.size - 3}</span>}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground/50 flex-1">{placeholder}</span>
        )}
        <ChevronDown className={`h-4 w-4 text-muted-foreground/40 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
          >
            <div className="p-2.5 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                <input
                  type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Пошук..."
                  autoFocus
                  className="w-full rounded-xl bg-secondary/50 py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto overscroll-contain p-1.5">
              {selected.size > 0 && (
                <button
                  onClick={() => { items.forEach(i => { if (selected.has(i)) onToggle(i) }); setQuery("") }}
                  className="w-full text-left px-3.5 py-2.5 text-xs text-muted-foreground hover:bg-secondary/50 rounded-xl cursor-pointer transition-colors"
                >
                  {"Скинути вибір"}
                </button>
              )}
              {filtered.length === 0 && (
                <div className="px-3 py-5 text-center text-xs text-muted-foreground/50">{"Нічого не знайдено"}</div>
              )}
              {filtered.map((item) => (
                <button
                  key={item}
                  onClick={() => { onToggle(item); if (!multi) { setOpen(false); setQuery("") } }}
                  className={`flex items-center gap-3 w-full rounded-xl px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                    selected.has(item) ? "bg-primary/[0.06]" : "hover:bg-secondary/50"
                  }`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded-md flex-shrink-0 ${
                    selected.has(item) ? "bg-primary" : "border border-border"
                  }`}>
                    {selected.has(item) && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <span className={`text-sm ${selected.has(item) ? "text-foreground font-medium" : "text-muted-foreground"}`}>{item}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════
   FILTER TAB
   ═══════════════════════════════════════════ */

function FilterTab({ onSelectCar }: { onSelectCar: (car: Car) => void }) {
  const { formatPrice } = useSettings()
  const [selMakes, setSelMakes] = useState<Set<string>>(new Set())
  const [selModels, setSelModels] = useState<Set<string>>(new Set())
  const [selBody, setSelBody] = useState<Set<string>>(new Set())
  const [selFuel, setSelFuel] = useState<Set<string>>(new Set())
  const [selDrive, setSelDrive] = useState<Set<string>>(new Set())
  const [selTrans, setSelTrans] = useState<Set<string>>(new Set())
  const [budgetFrom, setBudgetFrom] = useState(0)
  const [budgetTo, setBudgetTo] = useState(500000)
  const [yearFrom, setYearFrom] = useState(2018)
  const [yearTo, setYearTo] = useState(new Date().getFullYear() + 1)
  const [hpFrom, setHpFrom] = useState(0)
  const [hpTo, setHpTo] = useState(1000)
  const [mileageFrom, setMileageFrom] = useState(0)
  const [mileageTo, setMileageTo] = useState(200000)
  const [selCond, setSelCond] = useState<Set<string>>(new Set())
  const [selCountry, setSelCountry] = useState<Set<string>>(new Set())
  const [showExtended, setShowExtended] = useState(false)

  const allMakes = makes
  const availableModels = useMemo(() => {
    if (selMakes.size === 0) return []
    const models: string[] = []
    selMakes.forEach(m => { if (modelsByMake[m]) models.push(...modelsByMake[m]) })
    return models
  }, [selMakes])

  const toggle = useCallback((set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, val: string) => {
    setFn(prev => {
      const next = new Set(prev)
      if (next.has(val)) next.delete(val); else next.add(val)
      return next
    })
  }, [])

  const filtered = useMemo(() => {
    return cars.filter(car => {
      if (selMakes.size > 0 && !selMakes.has(car.make)) return false
      if (selModels.size > 0 && !selModels.has(car.model)) return false
      if (selBody.size > 0) {
        const match = Array.from(selBody).some(b => { const mapped = bodyTypesMap[b]; return mapped ? car.bodyType === mapped : car.bodyTypeUa === b })
        if (!match) return false
      }
      if (selFuel.size > 0) {
        const match = Array.from(selFuel).some(f => { const mapped = fuelTypesMap[f]; return mapped ? car.fuel === mapped : car.fuelUa === f })
        if (!match) return false
      }
      if (selDrive.size > 0 && !selDrive.has(car.drive)) return false
      if (selTrans.size > 0 && !Array.from(selTrans).some(t => car.transmission.toLowerCase().includes(t.toLowerCase()))) return false
      if (car.price < budgetFrom || car.price > budgetTo) return false
      if (car.year < yearFrom || car.year > yearTo) return false
      if (car.horsepower < hpFrom || car.horsepower > hpTo) return false
      if (car.mileage < mileageFrom || car.mileage > mileageTo) return false
      return true
    })
  }, [selMakes, selModels, selBody, selFuel, selDrive, selTrans, budgetFrom, budgetTo, yearFrom, yearTo, hpFrom, hpTo, mileageFrom, mileageTo])

  const maxYear = new Date().getFullYear() + 1

  const clearAll = useCallback(() => {
    setSelMakes(new Set()); setSelModels(new Set()); setSelBody(new Set())
    setSelFuel(new Set()); setSelDrive(new Set()); setSelTrans(new Set())
    setSelCond(new Set()); setSelCountry(new Set())
    setBudgetFrom(0); setBudgetTo(500000)
    setYearFrom(1900); setYearTo(maxYear)
    setHpFrom(0); setHpTo(1000)
    setMileageFrom(0); setMileageTo(200000)
  }, [maxYear])

  const [showFilters, setShowFilters] = useState(false)

  const activeCount = [selMakes, selModels, selBody, selFuel, selDrive, selTrans, selCond, selCountry].filter(s => s.size > 0).length
    + (budgetFrom > 0 || budgetTo < 500000 ? 1 : 0)
    + (yearFrom > 1900 || yearTo < maxYear ? 1 : 0)
    + (hpFrom > 0 || hpTo < 1000 ? 1 : 0)
    + (mileageFrom > 0 || mileageTo < 200000 ? 1 : 0)

  const activeTags: string[] = []
  selMakes.forEach(m => activeTags.push(m))
  selModels.forEach(m => activeTags.push(m))
  selBody.forEach(b => activeTags.push(b))
  selFuel.forEach(f => activeTags.push(f))
  selDrive.forEach(d => activeTags.push(driveLabels[d] || d))
  selTrans.forEach(t => activeTags.push(t))
  if (budgetFrom > 0 || budgetTo < 500000) activeTags.push(`${formatPrice(budgetFrom)} \u2014 ${formatPrice(budgetTo)}`)
  if (yearFrom > 1900 || yearTo < maxYear) activeTags.push(`${yearFrom} \u2014 ${yearTo}`)
  if (hpFrom > 0 || hpTo < 1000) activeTags.push(`${hpFrom}\u2014${hpTo} к.с.`)
  if (mileageFrom > 0 || mileageTo < 200000) activeTags.push(`${(mileageFrom/1000).toFixed(0)}k\u2014${(mileageTo/1000).toFixed(0)}k km`)
  selCond.forEach(c => activeTags.push(c))
  selCountry.forEach(c => activeTags.push(c))

  /* Year dropdown helper */
  const yearsList = useMemo(() => { const a: number[] = []; for (let y = maxYear; y >= 1900; y--) a.push(y); return a }, [maxYear])
  const yearsToList = useMemo(() => { const a: number[] = []; for (let y = maxYear; y >= yearFrom; y--) a.push(y); return a }, [maxYear, yearFrom])

  const PickerYearDropdown = useCallback(({ value, onChange, years, label }: { value: number; onChange: (y: number) => void; years: number[]; label: string }) => {
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setEditing(false) } }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h) }, [])
    useEffect(() => { if (open && listRef.current) { const idx = years.indexOf(value); if (idx >= 0) { const el = listRef.current.children[idx] as HTMLElement; el?.scrollIntoView({ block: "center" }) } } }, [open, value, years])
    return (
      <div ref={ref} className="relative flex-1 min-w-0">
        {editing ? (
          <div className="flex flex-col gap-0.5 rounded-xl border border-primary/30 bg-card px-3.5 py-1.5">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{label}</span>
            <input autoFocus type="number" defaultValue={value}
              onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1900 && v <= maxYear) onChange(v); setEditing(false) }}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
              className="w-full bg-transparent text-sm text-foreground font-medium outline-none tabular-nums"
            />
          </div>
        ) : (
          <button onClick={() => setOpen(!open)} onDoubleClick={() => { setOpen(false); setEditing(true) }} className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2.5 text-left text-sm hover:bg-secondary/50 transition-all cursor-pointer">
            <div className="flex flex-col gap-0.5"><span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{label}</span><span className="text-foreground font-medium tabular-nums">{value}</span></div>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="p-2 border-b border-border">
                <input type="number" placeholder="Введіть рік..." onKeyDown={e => { if (e.key === "Enter") { const v = parseInt((e.target as HTMLInputElement).value); if (!isNaN(v) && v >= 1900 && v <= maxYear) { onChange(v); setOpen(false) } } }} className="w-full rounded-lg bg-secondary/30 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/30 tabular-nums" />
              </div>
              <div ref={listRef} className="max-h-52 overflow-y-auto overscroll-contain p-1.5 scrollbar-thin">
                {years.map(y => (
                  <button key={y} onClick={() => { onChange(y); setOpen(false) }} className={`flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2 text-left text-sm cursor-pointer transition-colors ${y === value ? "bg-primary/[0.1] text-primary font-medium" : "text-foreground/80 hover:bg-secondary/50"}`}>
                    <span className="tabular-nums">{y}</span>
                    {y === value && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }, [maxYear])

  /* Pill helper for picker */
  const PickerPill = useCallback(({ label: lbl, options, sel, onToggle: onT }: { label: string; options: string[]; sel: Set<string>; onToggle: (v: string) => void }) => (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground/70">{lbl}</span>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button key={o} onClick={() => onT(o)} className={`rounded-xl px-3.5 py-2 text-xs font-medium border transition-all cursor-pointer ${sel.has(o) ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary/30 text-muted-foreground hover:text-foreground border-border hover:border-primary/20"}`}>{driveLabels[o] || o}</button>
        ))}
      </div>
    </div>
  ), [])

  const filterContent = (
    <div>
      {/* ── Core Filters ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        {/* Make */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{"Марка"}</label>
          <SearchableSelect items={allMakes} selected={selMakes} onToggle={(v) => { setSelMakes(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n }); setSelModels(new Set()) }} placeholder="Оберіть марку..." />
        </div>
        {/* Model */}
        {availableModels.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{"Модель"}</label>
            <SearchableSelect items={availableModels} selected={selModels} onToggle={(v) => toggle(selModels, setSelModels, v)} placeholder="Оберіть модель..." />
          </div>
        )}
        <PickerPill label="Кузов" options={bodyTypes} sel={selBody} onToggle={v => toggle(selBody, setSelBody, v)} />
        <PickerPill label="Паливо" options={fuelTypes} sel={selFuel} onToggle={v => toggle(selFuel, setSelFuel, v)} />
        <PickerPill label="Привід" options={driveTypes} sel={selDrive} onToggle={v => toggle(selDrive, setSelDrive, v)} />
        <PickerPill label="КПП" options={transmissionTypes} sel={selTrans} onToggle={v => toggle(selTrans, setSelTrans, v)} />
        {/* Price */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground/70">{"Ціна"}</span>
          <div className="flex items-center gap-2.5">
            <div className="flex-1 min-w-0">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{"Від"}</span>
              <input type="number" value={budgetFrom} onChange={e => { const v = +e.target.value; if (!isNaN(v)) setBudgetFrom(Math.max(0, Math.min(v, budgetTo))) }} className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30 transition-colors tabular-nums" />
            </div>
            <span className="text-xs text-muted-foreground/30 flex-shrink-0 mt-4">{"\u2014"}</span>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{"До"}</span>
              <input type="number" value={budgetTo} onChange={e => { const v = +e.target.value; if (!isNaN(v)) setBudgetTo(Math.min(10000000, Math.max(v, budgetFrom))) }} className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30 transition-colors tabular-nums" />
            </div>
          </div>
        </div>
        {/* Year */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground/70">{"Рік випуску"}</span>
          <div className="flex items-center gap-2.5">
            <PickerYearDropdown value={yearFrom} onChange={v => { setYearFrom(v); if (v > yearTo) setYearTo(v) }} years={yearsList} label="Від" />
            <span className="text-xs text-muted-foreground/30 flex-shrink-0">{"\u2014"}</span>
            <PickerYearDropdown value={yearTo} onChange={v => setYearTo(v)} years={yearsToList} label="До" />
          </div>
        </div>
      </div>

      {/* ── Extended Filters ── */}
      <div className="mt-5 border-t border-border pt-4">
        <button onClick={() => setShowExtended(!showExtended)} className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer uppercase tracking-wider">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showExtended ? "rotate-180" : ""}`} />
          {"Розширені фільтри"}
        </button>
        <AnimatePresence>
          {showExtended && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }} className="overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 pt-4">
                {/* HP */}
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground/70">{"Потужність (к.с.)"}</span>
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{"Від"}</span>
                      <input type="number" value={hpFrom} onChange={e => { const v = +e.target.value; if (!isNaN(v)) setHpFrom(Math.max(0, Math.min(v, hpTo))) }} className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30 transition-colors tabular-nums" />
                    </div>
                    <span className="text-xs text-muted-foreground/30 flex-shrink-0 mt-4">{"\u2014"}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{"До"}</span>
                      <input type="number" value={hpTo} onChange={e => { const v = +e.target.value; if (!isNaN(v)) setHpTo(Math.max(v, hpFrom)) }} className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30 transition-colors tabular-nums" />
                    </div>
                  </div>
                </div>
                {/* Mileage */}
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground/70">{"Пробіг (km)"}</span>
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{"Від"}</span>
                      <input type="number" value={mileageFrom} onChange={e => { const v = +e.target.value; if (!isNaN(v)) setMileageFrom(Math.max(0, Math.min(v, mileageTo))) }} className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30 transition-colors tabular-nums" />
                    </div>
                    <span className="text-xs text-muted-foreground/30 flex-shrink-0 mt-4">{"\u2014"}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium">{"До"}</span>
                      <input type="number" value={mileageTo} onChange={e => { const v = +e.target.value; if (!isNaN(v)) setMileageTo(Math.max(v, mileageFrom)) }} className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/30 transition-colors tabular-nums" />
                    </div>
                  </div>
                </div>
                <PickerPill label="Стан" options={conditionTypes} sel={selCond} onToggle={v => { setSelCond(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n }) }} />
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">{"Країна"}</label>
                  <SearchableSelect items={countries} selected={selCountry} onToggle={v => { setSelCountry(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n }) }} placeholder="Німеччина, США..." />
                </div>
                <PickerPill label="Колір" options={["Чорний", "Білий", "Сірий", "Синій", "Червоний", "Зелений"]} sel={new Set()} onToggle={() => {}} />
                <PickerPill label="Безпека" options={["ABS", "ESP", "Airbags 6+", "360 камера", "Lane Assist"]} sel={new Set()} onToggle={() => {}} />
                <PickerPill label="Комфорт" options={["Клімат 2+", "Підігрів", "Люк", "Ел. сидіння", "Keyless"]} sel={new Set()} onToggle={() => {}} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )

  return (
    <div className="p-5" style={{ minHeight: "min(75vh, 720px)" }}>
      {/* ── Toolbar: filter toggle + active tags + count ── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all cursor-pointer ${
            showFilters ? "bg-primary/[0.1] text-primary ring-1 ring-primary/20" : "bg-white/[0.04] text-muted-foreground ring-1 ring-white/[0.06] hover:bg-white/[0.06]"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {"Фільтри"}
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{activeCount}</span>
          )}
        </button>
        {activeCount > 0 && (
          <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{"Скинути"}</button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{filtered.length} {"авто"}</span>
      </div>

      {/* ── Active filter tags ── */}
      {activeTags.length > 0 && !showFilters && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {activeTags.slice(0, 8).map(tag => (
            <span key={tag} className="rounded-lg bg-primary/[0.08] px-2.5 py-1 text-[10px] font-medium text-primary">{tag}</span>
          ))}
          {activeTags.length > 8 && <span className="text-[10px] text-muted-foreground/50 self-center">{`+${activeTags.length - 8}`}</span>}
        </div>
      )}

      {/* ── Collapsible filter panel ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden mb-5"
          >
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">{"Параметри пошуку"}</h3>
                <div className="flex items-center gap-3">
                  {activeCount > 0 && (
                    <button onClick={clearAll} className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer">{"Скинути все"}</button>
                  )}
                  <button
                    onClick={() => setShowFilters(false)}
                    className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:brightness-110 transition-all cursor-pointer"
                  >
                    {"Показати"} {filtered.length} {"авто"}
                  </button>
                </div>
              </div>
              {filterContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="h-8 w-8 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">{"Нічого не знайдено"}</p>
          <p className="text-xs text-muted-foreground/50 mt-1 max-w-xs">{"Спробуйте змінити фільтри або скиньте всі параметри"}</p>
          <button onClick={clearAll} className="mt-3 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer">{"Скинути фільтри"}</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(car => <CarResultCard key={car.id} car={car} onSelect={onSelectCar} />)}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   MAIN UNIFIED PICKER (AI-only)
   ═══════════════════════════════════════════ */

export default function UnifiedPicker({ onSelectCar }: UnifiedPickerProps) {
  return (
    <section className="py-12 px-6 lg:px-10">
      <div className="mx-auto max-w-6xl w-full">
        <div className="mb-8">
          <h2 className="font-extrabold tracking-tight text-foreground text-balance" style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)", letterSpacing: "-0.03em" }}>{"AI Підбір автомобіля"}</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{"Дайте відповіді на кілька питань і AI знайде ідеальний варіант."}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <AiChatTab onSelectCar={onSelectCar} />
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   CUSTOM ORDER (exported FilterTab)
   ═══════════════════════════════════════════ */

export function CustomOrderPage({ onSelectCar }: { onSelectCar: (car: Car) => void }) {
  return (
    <section className="py-12 px-6 lg:px-10">
      <div className="mx-auto max-w-6xl w-full">
        <div className="mb-8">
          <h2 className="font-extrabold tracking-tight text-foreground text-balance" style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)", letterSpacing: "-0.03em" }}>{"Під замовлення"}</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{"Оберіть параметри авто -- ми знайдемо та доставимо з Європи під ключ."}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <FilterTab onSelectCar={onSelectCar} />
        </div>
      </div>
    </section>
  )
}
