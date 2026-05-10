// lib/constants.ts
// Single source of truth for all business constants.

export const PRICING = {
  MIN_BUDGET_EUR: 20000,
  DUTY_PERCENT: 0.10,
  EXCISE_PERCENT: 0.05,
  VAT_PERCENT: 0.20,
  DELIVERY_FEE: 2500,
  BROKER_FEE: 800,
  CERTIFICATION_FEE: 1200,
} as const

export const FUEL_MAP: Record<string, string> = {
  "Бензин": "Petrol", "Дизель": "Diesel",
  "Електро": "Electric", "Гібрид": "Hybrid", "Plug-in гібрид": "Hybrid",
}

export const BODY_MAP: Record<string, string> = {
  "Седан": "Sedan", "Хетчбек": "Hatchback", "Універсал": "Estate",
  "Позашляховик": "SUV", "Кросовер": "SUV", "Мінівен": "Van",
  "Купе": "Coupe", "Кабріолет": "Convertible",
}

export const TRANSMISSION_MAP: Record<string, string> = {
  "Автомат": "Automatic", "Механіка": "Manual",
  "Робот": "Automatic", "Варіатор": "Automatic",
}

export const DRIVE_MAP: Record<string, string> = {
  "Передній (FWD)": "FWD", "Задній (RWD)": "RWD", "Повний (AWD/4WD)": "AWD",
}

export const BRAND_ALIASES: Record<string, string> = {
  "ваг": "Volkswagen", "вольксваген": "Volkswagen", "фольксваген": "Volkswagen", "vw": "Volkswagen",
  "бмв": "BMW", "бэмвэ": "BMW",
  "мерс": "Mercedes-Benz", "мерседес": "Mercedes-Benz",
  "ауді": "Audi", "ауди": "Audi",
  "тойота": "Toyota", "шкода": "Skoda", "škoda": "Skoda",
  "вольво": "Volvo", "кіа": "Kia", "кия": "Kia",
  "хюндай": "Hyundai", "хундай": "Hyundai", "хендай": "Hyundai",
  "форд": "Ford", "пежо": "Peugeot", "рено": "Renault",
  "опель": "Opel", "порше": "Porsche", "тесла": "Tesla",
  "лексус": "Lexus", "субару": "Subaru", "мазда": "Mazda",
  "нісан": "Nissan", "ніссан": "Nissan", "альфа": "Alfa Romeo",
  "ситроен": "Citroen", "сітроен": "Citroen",
}

export const COLOR_ALIASES: Record<string, string> = {
  "чорний": "Black", "чорна": "Black", "черний": "Black", "black": "Black",
  "білий": "White", "біла": "White", "белый": "White", "white": "White",
  "сірий": "Grey", "сіра": "Grey", "серый": "Grey", "grey": "Grey", "gray": "Grey",
  "синій": "Blue", "синя": "Blue", "синий": "Blue", "blue": "Blue",
  "червоний": "Red", "червона": "Red", "красный": "Red", "red": "Red",
  "зелений": "Green", "зелена": "Green", "зеленый": "Green", "green": "Green",
  "коричневий": "Brown", "коричнева": "Brown", "brown": "Brown",
  "бежевий": "Beige", "бежева": "Beige", "beige": "Beige",
  "сріблястий": "Silver", "срібний": "Silver", "silver": "Silver",
  "помаранчевий": "Orange", "оранжевий": "Orange", "orange": "Orange",
  "жовтий": "Yellow", "жовта": "Yellow", "yellow": "Yellow",
}

// ── Cost calculation (import to Ukraine) ─────────────────────────────────────

export function calcTotalCost(priceEur: number) {
  const duty = Math.round(priceEur * PRICING.DUTY_PERCENT)
  const excise = Math.round(priceEur * PRICING.EXCISE_PERCENT)
  const vat = Math.round((priceEur + duty + excise) * PRICING.VAT_PERCENT)
  const total = priceEur + duty + excise + vat + PRICING.DELIVERY_FEE + PRICING.CERTIFICATION_FEE + PRICING.BROKER_FEE
  return { price: priceEur, duty, excise, vat, delivery: PRICING.DELIVERY_FEE, certification: PRICING.CERTIFICATION_FEE, broker: PRICING.BROKER_FEE, total }
}

// Reverse of calcTotalCost: given a turnkey budget (what the Ukrainian buyer actually pays),
// return the maximum RAW EU source price so the parser filters correctly.
// Formula: total = eu * (1 + duty + excise) * (1 + vat) + fixed_fees
// => eu = (total - fixed_fees) / multiplier
export function euPriceFromTurnkey(turnkeyEur: number): number {
  const fixed = PRICING.DELIVERY_FEE + PRICING.BROKER_FEE + PRICING.CERTIFICATION_FEE
  // multiplier = (1 + duty + excise) * (1 + vat) = 1.15 * 1.20 = 1.38
  const mult = (1 + PRICING.DUTY_PERCENT + PRICING.EXCISE_PERCENT) * (1 + PRICING.VAT_PERCENT)
  return Math.max(0, Math.round((turnkeyEur - fixed) / mult))
}

// ── Source site display ──────────────────────────────────────────────────────

export const SOURCE_SITES: Record<string, { name: string; flag: string; country: string }> = {
  "autoscout24.com": { name: "AutoScout24", flag: "🇩🇪", country: "Germany" },
  "mobile.de": { name: "Mobile.de", flag: "🇩🇪", country: "Germany" },
  "bytbil.com": { name: "Bytbil", flag: "🇸🇪", country: "Sweden" },
  "blocket.se": { name: "Blocket", flag: "🇸🇪", country: "Sweden" },
}

// ── Price rating ─────────────────────────────────────────────────────────────

export type PriceRating = "great" | "good" | "fair" | "high"

/**
 * Rate a listing against comparable-market prices.
 *
 * Returns a 4-class rating (great/good/fair/high) plus:
 *   • `percentile` — where the listing sits in the sorted comparable set
 *   • `median`     — market median
 *   • `pct`        — signed % diff from median (negative = below market)
 *
 * Thresholds are calibrated against EU used-car variance (±8% band around median
 * ≈ 70% of listings, ±12% ≈ 90%). Requires ≥3 comparable data points to produce
 * a non-"fair" rating — smaller samples are unreliable.
 */
export function ratePriceVsMarket(
  price: number,
  allPrices: number[]
): { rating: PriceRating; percentile: number; median: number; pct: number } {
  if (!price || price <= 0 || allPrices.length < 3) {
    return { rating: "fair", percentile: 50, median: price || 0, pct: 0 }
  }
  const sorted = [...allPrices].filter(p => p > 0).sort((a, b) => a - b)
  if (sorted.length < 3) return { rating: "fair", percentile: 50, median: price, pct: 0 }

  const median = sorted[Math.floor(sorted.length / 2)]
  const rank = sorted.filter(p => p <= price).length
  const percentile = Math.round((rank / sorted.length) * 100)
  const pct = Math.round(((price - median) / median) * 100)

  // EU used-car realistic bands: ±4% = market, -12…-4% = below, <-12% = great, +4…+8% = above→high.
  let rating: PriceRating
  if (pct <= -12) rating = "great"
  else if (pct <= -4) rating = "good"
  else if (pct <= 8) rating = "fair"
  else rating = "high"

  return { rating, percentile, median, pct }
}

// Labels are i18n keys — use t(PRICE_RATING_CONFIG[r].labelKey, language) at render time.
// `label` is kept as a Ukrainian fallback for code paths that haven't been i18n-threaded yet.
export const PRICE_RATING_CONFIG: Record<
  PriceRating,
  { labelKey: "price.excellent" | "price.below" | "price.market" | "price.above"; label: string; labelEn: string; color: string }
> = {
  great: { labelKey: "price.excellent", label: "Вигідна ціна", labelEn: "Great price", color: "#00e5b4" },
  good:  { labelKey: "price.below",     label: "Нижче ринку",  labelEn: "Below market", color: "#4ade80" },
  fair:  { labelKey: "price.market",    label: "Ринкова ціна", labelEn: "Market price", color: "#94a3b8" },
  high:  { labelKey: "price.above",     label: "Вище ринку",   labelEn: "Above market", color: "#f59e0b" },
}

// ── Static price guide (~80 models, EUR, used 2020-2024 Europe) ──────────────
// Used as fallback when Supabase has no data. Updated manually.
// Source: AutoScout24, Mobile.de market averages 2024-2026.

// Real prices from AutoScout24 + Bytbil + Blocket + Mobile.de (April 2026, used 2019-2026)
export const STATIC_PRICE_GUIDE = new Map<string, { min: number; max: number }>([
  // BMW — from real scraping data
  ["bmw 1 series", { min: 18000, max: 32000 }],
  ["bmw 2 series", { min: 22000, max: 38000 }],
  ["bmw 3 series", { min: 22000, max: 90000 }],
  ["bmw 3", { min: 22000, max: 90000 }],
  ["bmw 4 series", { min: 23000, max: 85000 }],
  ["bmw 4", { min: 23000, max: 85000 }],
  ["bmw 5 series", { min: 27000, max: 77000 }],
  ["bmw 5", { min: 27000, max: 77000 }],
  ["bmw 7 series", { min: 45000, max: 120000 }],
  ["bmw x1", { min: 22000, max: 42000 }],
  ["bmw x3", { min: 32000, max: 70000 }],
  ["bmw x5", { min: 62000, max: 100000 }],
  ["bmw x6", { min: 55000, max: 95000 }],
  ["bmw m2", { min: 50000, max: 72000 }],
  ["bmw m3", { min: 76000, max: 132000 }],
  ["bmw m4", { min: 53000, max: 124000 }],
  ["bmw m5", { min: 60000, max: 110000 }],
  ["bmw z4", { min: 35000, max: 58000 }],
  ["bmw i4", { min: 35000, max: 58000 }],
  ["bmw ix", { min: 48000, max: 85000 }],
  // Mercedes-Benz
  ["mercedes-benz a-class", { min: 20000, max: 35000 }],
  ["mercedes-benz c-class", { min: 28000, max: 86000 }],
  ["mercedes-benz c", { min: 28000, max: 86000 }],
  ["mercedes-benz e-class", { min: 28000, max: 86000 }],
  ["mercedes-benz e", { min: 28000, max: 86000 }],
  ["mercedes-benz s-class", { min: 60000, max: 140000 }],
  ["mercedes-benz cla", { min: 24000, max: 42000 }],
  ["mercedes-benz glc", { min: 36000, max: 86000 }],
  ["mercedes-benz gle", { min: 48000, max: 95000 }],
  ["mercedes-benz gls", { min: 65000, max: 120000 }],
  ["mercedes-benz c43 amg", { min: 42000, max: 62000 }],
  ["mercedes-benz c63 amg", { min: 55000, max: 85000 }],
  ["mercedes-benz e63 amg", { min: 70000, max: 110000 }],
  ["mercedes-benz amg gt", { min: 80000, max: 150000 }],
  ["mercedes-benz eqc", { min: 28000, max: 48000 }],
  ["mercedes-benz eqs", { min: 55000, max: 100000 }],
  // Audi
  ["audi a3", { min: 20000, max: 35000 }],
  ["audi a4", { min: 25000, max: 37000 }],
  ["audi a5", { min: 26000, max: 61000 }],
  ["audi a6", { min: 31000, max: 67000 }],
  ["audi a7", { min: 38000, max: 72000 }],
  ["audi a8", { min: 48000, max: 95000 }],
  ["audi q3", { min: 24000, max: 40000 }],
  ["audi q5", { min: 42000, max: 69000 }],
  ["audi q7", { min: 56000, max: 101000 }],
  ["audi q8", { min: 55000, max: 85000 }],
  ["audi rs4", { min: 60000, max: 90000 }],
  ["audi rs6", { min: 85000, max: 140000 }],
  ["audi e-tron", { min: 28000, max: 52000 }],
  ["audi e-tron gt", { min: 65000, max: 110000 }],
  // Volkswagen
  ["volkswagen golf", { min: 17000, max: 35000 }],
  ["volkswagen passat", { min: 19000, max: 41000 }],
  ["volkswagen tiguan", { min: 27000, max: 45000 }],
  ["volkswagen t-roc", { min: 18000, max: 30000 }],
  ["volkswagen touareg", { min: 40000, max: 70000 }],
  ["volkswagen id.4", { min: 25000, max: 42000 }],
  ["volkswagen arteon", { min: 25000, max: 42000 }],
  // Volvo
  ["volvo s60", { min: 24000, max: 40000 }],
  ["volvo s90", { min: 30000, max: 50000 }],
  ["volvo v60", { min: 26000, max: 40000 }],
  ["volvo v90", { min: 30000, max: 50000 }],
  ["volvo xc40", { min: 26000, max: 36000 }],
  ["volvo xc60", { min: 34000, max: 60000 }],
  ["volvo xc90", { min: 38000, max: 68000 }],
  // Toyota
  ["toyota corolla", { min: 22000, max: 34000 }],
  ["toyota rav4", { min: 23000, max: 41000 }],
  ["toyota camry", { min: 24000, max: 38000 }],
  ["toyota land cruiser", { min: 50000, max: 90000 }],
  ["toyota supra", { min: 42000, max: 65000 }],
  ["toyota gr86", { min: 28000, max: 38000 }],
  // Skoda
  ["skoda octavia", { min: 15000, max: 30000 }],
  ["skoda superb", { min: 23000, max: 47000 }],
  ["skoda kodiaq", { min: 22000, max: 40000 }],
  ["skoda karoq", { min: 18000, max: 30000 }],
  // Porsche
  ["porsche 911", { min: 80000, max: 180000 }],
  ["porsche cayenne", { min: 73000, max: 148000 }],
  ["porsche macan", { min: 66000, max: 118000 }],
  ["porsche taycan", { min: 55000, max: 110000 }],
  ["porsche panamera", { min: 55000, max: 100000 }],
  ["porsche cayman", { min: 50000, max: 82000 }],
  ["porsche boxster", { min: 45000, max: 78000 }],
  // Hyundai / Kia
  ["hyundai tucson", { min: 27000, max: 40000 }],
  ["hyundai ioniq 5", { min: 28000, max: 48000 }],
  ["hyundai i30", { min: 15000, max: 25000 }],
  ["kia sportage", { min: 28000, max: 39000 }],
  ["kia ev6", { min: 32000, max: 50000 }],
  ["kia ceed", { min: 15000, max: 25000 }],
  // Others
  ["ford mustang", { min: 32000, max: 58000 }],
  ["ford focus", { min: 14000, max: 24000 }],
  ["ford kuga", { min: 22000, max: 35000 }],
  ["mazda cx-5", { min: 24000, max: 38000 }],
  ["mazda 3", { min: 20000, max: 30000 }],
  ["nissan qashqai", { min: 20000, max: 32000 }],
  ["peugeot 3008", { min: 22000, max: 38000 }],
  ["peugeot 508", { min: 22000, max: 35000 }],
  ["alfa romeo giulia", { min: 24000, max: 45000 }],
  ["alfa romeo stelvio", { min: 28000, max: 48000 }],
  ["tesla model 3", { min: 24000, max: 37000 }],
  ["tesla model y", { min: 32000, max: 52000 }],
  ["tesla model s", { min: 42000, max: 75000 }],
  ["jaguar f-pace", { min: 30000, max: 55000 }],
  ["land rover range rover", { min: 60000, max: 130000 }],
  ["land rover defender", { min: 50000, max: 88000 }],
  ["dacia duster", { min: 12000, max: 22000 }],
  ["mini cooper", { min: 18000, max: 32000 }],
  ["lexus nx", { min: 32000, max: 50000 }],
  ["lexus rx", { min: 38000, max: 60000 }],
])

// Lookup price by fuzzy key match
export function lookupPriceGuide(make: string, model: string): { min: number; max: number } | null {
  const key = `${make} ${model}`.toLowerCase().trim()
  // Exact match
  if (STATIC_PRICE_GUIDE.has(key)) return STATIC_PRICE_GUIDE.get(key)!
  // Partial match (e.g., "bmw 320" matches "bmw 3 series")
  for (const [k, v] of STATIC_PRICE_GUIDE) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return null
}

export const KNOWN_BRANDS = new Set([
  "BMW", "Audi", "Mercedes-Benz", "Volkswagen", "Volvo", "Toyota",
  "Honda", "Mazda", "Skoda", "SEAT", "Cupra", "Ford", "Opel",
  "Peugeot", "Renault", "Citroen", "Hyundai", "Kia", "Nissan",
  "Mitsubishi", "Subaru", "Lexus", "Porsche", "Tesla", "MINI",
  "Jeep", "Land Rover", "Jaguar", "Alfa Romeo", "Saab", "Suzuki",
  "Dacia", "Fiat", "Chrysler", "Dodge", "Chevrolet", "Genesis",
])
