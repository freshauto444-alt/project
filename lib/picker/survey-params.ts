// ═══════════════════════════════════════════════════════════════════════════════
//  Extract search params from survey answers. Pure mapping logic + the UA→EN
//  value maps and purpose presets. Extracted from route.ts. No prompt text.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Answer } from "./types"

// ── Purpose → implicit filter presets ────────────────────────────────────────
// Each purpose sets soft defaults that get merged with explicit user choices.
// Explicit survey answers (body, fuel, etc.) always override these.
interface PurposePreset {
  body_types?: string[]      // preferred body types
  hp_min?: number            // minimum horsepower
  displacement_min?: number  // minimum engine displacement (liters)
  seats_min?: number         // minimum seats
  drive?: string             // preferred drive type
  transmission?: string      // preferred transmission
}

// Purpose presets — SOFT recommendations only (body types).
// hp_min/displacement removed: they filter out too many valid results.
// AI suggestion prompt uses purpose for better recommendations instead.
const PURPOSE_PRESETS: Record<string, PurposePreset> = {
  "Місто": {
    body_types: ["Hatchback", "Sedan", "SUV"],
  },
  "Подорожі": {
    body_types: ["Sedan", "Estate", "SUV"],
  },
  "Спорт": {
    body_types: ["Coupe", "Sedan", "Hatchback", "Convertible"],
  },
  "Бізнес": {
    body_types: ["Sedan", "SUV"],
  },
  "Сім'я": {
    body_types: ["SUV", "Van", "Estate"],
    seats_min: 5,
  },
  "Робота": {
    body_types: ["Van", "Estate", "Pickup"],
  },
  "Інвестиція": {
    body_types: ["Coupe", "Convertible", "Sedan"],
  },
}

export function extractSearchParams(answers: Answer[]) {
  const byId = Object.fromEntries(answers.map(a => [a.questionId, a]))
  const cleanNum = (s: string) => parseInt(s.replace(/[\s\u00a0\u2009,.]/g, "").replace(/\D/g, ""))
  let budgetMin: number | null = null
  let budgetMax: number | null = null

  // Picker stores budget as two separate slots: selected[0]=from, selected[1]=to.
  // PRIMARY path — read both independently. Previously we only looked at
  // selected[0] and parsed a range string from it, which meant a "до 40k"
  // filter (which lives in selected[1]) was silently dropped.
  const fromSlot = byId.budget?.selected[0] ?? ""
  const toSlot = byId.budget?.selected[1] ?? ""
  if (fromSlot || toSlot) {
    const fromVal = cleanNum(fromSlot)
    const toVal = cleanNum(toSlot)
    if (!isNaN(fromVal) && fromVal > 0) budgetMin = fromVal
    if (!isNaN(toVal) && toVal > 0) budgetMax = toVal
  }

  // FALLBACK — legacy single-string budget ("30000-50000", "до 40000", "понад 50k")
  // for older payload shapes. Only kicks in if the two-slot read produced nothing.
  if (budgetMin === null && budgetMax === null) {
    const budgetStr = byId.budget?.custom ?? byId.budget?.selected[0] ?? ""
    const rangeMatch = budgetStr.match(/([\d\s\u00a0\u2009,.]+)\s*[–\-—]\s*([\d\s\u00a0\u2009,.]+)/)
    if (rangeMatch) {
      const min = cleanNum(rangeMatch[1])
      const max = cleanNum(rangeMatch[2])
      if (!isNaN(min) && min > 0) budgetMin = min
      if (!isNaN(max) && max > 0) budgetMax = max
    } else if (/понад|більше|від|more|from/i.test(budgetStr)) {
      const m = budgetStr.match(/([\d\s\u00a0,.]+)/)
      if (m) { const v = cleanNum(m[1]); if (!isNaN(v) && v > 0) budgetMin = v }
    } else if (/до|менше|less|under|max/i.test(budgetStr)) {
      const m = budgetStr.match(/([\d\s\u00a0,.]+)/)
      if (m) { const v = cleanNum(m[1]); if (!isNaN(v) && v > 0) budgetMax = v }
    } else {
      const plain = cleanNum(budgetStr)
      if (!isNaN(plain) && plain > 0) budgetMax = plain
    }
  }
  const yearFromStr = byId.year?.selected[0] ?? byId.year?.custom ?? ""
  const yearToStr = byId.year?.selected[1] ?? ""
  const yearFrom = yearFromStr ? parseInt(yearFromStr) : null
  const yearTo = yearToStr ? parseInt(yearToStr) : null

  const fuelMap: Record<string, string> = {
    "Бензин": "Petrol", "Дизель": "Diesel",
    "Електро": "Electric", "Гібрид": "Hybrid", "Plug-in гібрид": "Hybrid",
    "Газ (LPG)": "LPG", "Газ (CNG)": "CNG",
    "Етанол": "Ethanol", "Водень": "Hydrogen",
  }
  const transmissionMap: Record<string, string> = {
    "Автомат": "Automatic", "Механіка": "Manual",
    "Робот": "Automatic", "Варіатор": "Automatic",
    "Робот (DSG/DCT)": "Automatic", "Варіатор (CVT)": "Automatic",
  }
  const bodyMap: Record<string, string> = {
    "Седан": "Sedan", "Хетчбек": "Hatchback", "Універсал": "Estate",
    "Позашляховик": "SUV", "Кросовер": "SUV", "Мінівен": "Van",
    "Мікроавтобус": "Van", "Купе": "Coupe", "Кабріолет": "Convertible",
    "Пікап": "Pickup", "Вантажівка": "Truck", "Автобус": "Bus",
    "Мотоцикл": "Motorcycle", "Багі": "Buggy", "Спецтехніка": "Special",
  }
  const driveMap: Record<string, string> = {
    "Передній (FWD)": "FWD", "Задній (RWD)": "RWD", "Повний (AWD/4WD)": "AWD",
  }

  // ── Purpose presets ────────────────────────────────────────────────────
  const purposes = byId.purpose?.selected ?? []
  let purposeBodyTypes: string[] = []
  let purposeHpMin: number | null = null
  let purposeDisplacementMin: number | null = null
  let purposeSeatsMin: number | null = null

  for (const p of purposes) {
    const preset = PURPOSE_PRESETS[p]
    if (!preset) continue
    if (preset.body_types) purposeBodyTypes.push(...preset.body_types)
    // Use MIN across purposes (user wants cars matching ANY purpose, not strictest)
    if (preset.hp_min && (purposeHpMin == null || preset.hp_min < purposeHpMin))
      purposeHpMin = preset.hp_min
    if (preset.displacement_min && (purposeDisplacementMin == null || preset.displacement_min < purposeDisplacementMin))
      purposeDisplacementMin = preset.displacement_min
    if (preset.seats_min && (purposeSeatsMin == null || preset.seats_min > purposeSeatsMin))
      purposeSeatsMin = preset.seats_min
  }
  // Deduplicate body types from purposes
  purposeBodyTypes = Array.from(new Set(purposeBodyTypes))

  // ── New filter fields (mileage, engine, hp, doors, seats, color, interior) ─
  const cleanInt = (s: string) => { const n = parseInt(s.replace(/[^\d]/g, "")); return isNaN(n) ? null : n }
  const cleanFlt = (s: string) => { const n = parseFloat(s.replace(/,/g, ".").replace(/[^\d.]/g, "")); return isNaN(n) ? null : n }

  const mileageMin = cleanInt(byId.mileage?.selected[0] ?? "")
  const mileageMax = cleanInt(byId.mileage?.selected[1] ?? "")
  const engineMin = cleanFlt(byId.engine?.selected[0] ?? "")
  const engineMax = cleanFlt(byId.engine?.selected[1] ?? "")
  const hpMinForm = cleanInt(byId.hp?.selected[0] ?? "")
  const doorsStr = byId.doors?.selected[0] ?? ""
  const doors = doorsStr ? parseInt(doorsStr) : null
  const seatsStr = byId.seats?.selected[0] ?? ""
  const seatsMinForm = seatsStr === "7+" ? 7 : seatsStr ? parseInt(seatsStr) : null
  const colorMap: Record<string, string> = {
    "Білий": "White", "Чорний": "Black", "Сірий": "Grey", "Сріблястий": "Silver",
    "Синій": "Blue", "Червоний": "Red", "Зелений": "Green",
    "Коричневий": "Brown", "Бежевий": "Beige", "Жовтий": "Yellow",
  }
  const interiorMap: Record<string, string> = {
    "Шкіра": "Leather", "Екошкіра": "Eco-leather", "Тканина": "Fabric",
    "Велюр": "Velour", "Алькантара": "Alcantara",
    "Комбінований": "Combination", "Карбон": "Carbon",
  }
  const color = colorMap[byId.color?.selected[0] ?? ""] ?? null
  const interior = interiorMap[byId.interior?.selected[0] ?? ""] ?? null

  // Form-level HP/seats override purpose presets if explicitly set
  const hpMinFinal = hpMinForm != null ? hpMinForm : purposeHpMin
  const seatsMinFinal = seatsMinForm != null ? seatsMinForm : purposeSeatsMin
  const displacementMinFinal = engineMin != null ? engineMin : purposeDisplacementMin

  return {
    year_from: yearFrom && !isNaN(yearFrom) ? yearFrom : null,
    year_to: yearTo && !isNaN(yearTo) ? yearTo : null,
    budget_min: budgetMin,
    budget_max: budgetMax,
    fuel: fuelMap[byId.fuel?.selected[0] ?? ""] ?? null,
    transmission: transmissionMap[byId.transmission?.selected[0] ?? ""] ?? null,
    body_type: bodyMap[byId.body?.selected[0] ?? ""] ?? null,
    drive: driveMap[byId.drive?.selected[0] ?? ""] ?? null,
    purpose_body_types: purposeBodyTypes,
    hp_min: hpMinFinal,
    displacement_min: displacementMinFinal,
    displacement_max: engineMax,
    seats_min: seatsMinFinal,
    mileage_min: mileageMin,
    mileage_max: mileageMax,
    doors,
    interior_material: interior,
    color,
  }
}
