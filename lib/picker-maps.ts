// Single source of truth for the picker's UA(form-option) → EN(parser) mappings.
//
// These used to be redefined inline in three separate call sites inside
// unified-picker.tsx (fetchSuggestions / handleApproveSuggestion / runDirectSearch)
// plus a divergent copy in the legacy /api/ai-picker/search route. Any edit to one
// silently desynced the others (e.g. "Мікроавтобус" vs "Мінівен", "Робот" vs
// "Робот (DSG/DCT)"). Keep every UA→EN translation here so all paths agree.

export const FUEL_MAP: Record<string, string> = {
  "Бензин": "Petrol",
  "Дизель": "Diesel",
  "Електро": "Electric",
  "Гібрид": "Hybrid",
  "Plug-in гібрид": "Hybrid",
  "Газ (LPG)": "LPG",
  "Газ (CNG)": "CNG",
  "Етанол": "Ethanol",
  "Водень": "Hydrogen",
}

export const BODY_MAP: Record<string, string> = {
  "Седан": "Sedan",
  "Хетчбек": "Hatchback",
  "Універсал": "Estate",
  "Позашляховик": "SUV",
  "Купе": "Coupe",
  "Кабріолет": "Convertible",
  "Мікроавтобус": "Van",
  "Пікап": "Pickup",
  "Вантажівка": "Truck",
  "Автобус": "Bus",
  "Мотоцикл": "Motorcycle",
  "Багі": "Buggy",
  "Спецтехніка": "Special",
}

export const TRANSMISSION_MAP: Record<string, string> = {
  "Автомат": "Automatic",
  "Механіка": "Manual",
  "Робот (DSG/DCT)": "Automatic",
  "Варіатор (CVT)": "Automatic",
}

export const DRIVE_MAP: Record<string, string> = {
  "Передній (FWD)": "FWD",
  "Задній (RWD)": "RWD",
  "Повний (AWD/4WD)": "AWD",
}

export const COLOR_MAP: Record<string, string> = {
  "Білий": "White",
  "Чорний": "Black",
  "Сірий": "Grey",
  "Сріблястий": "Silver",
  "Синій": "Blue",
  "Червоний": "Red",
  "Зелений": "Green",
  "Коричневий": "Brown",
  "Бежевий": "Beige",
  "Жовтий": "Yellow",
}

export const INTERIOR_MAP: Record<string, string> = {
  "Шкіра": "Leather",
  "Екошкіра": "Eco-leather",
  "Тканина": "Fabric",
  "Велюр": "Velour",
  "Алькантара": "Alcantara",
  "Комбінований": "Combination",
  "Карбон": "Carbon",
}

// ── Numeric parsing helpers shared by all picker call sites ──────────────────
// cleanInt: digits only ("30 000" → 30000). cleanFloat: decimal, comma→dot
// ("2,0" → 2.0). Both return null when there's nothing parseable.
export function cleanInt(s: string | undefined | null): number | null {
  if (!s) return null
  const n = parseInt(s.replace(/[^\d]/g, ""), 10)
  return isNaN(n) ? null : n
}

export function cleanFloat(s: string | undefined | null): number | null {
  if (!s) return null
  const n = parseFloat(s.replace(/,/g, ".").replace(/[^\d.]/g, ""))
  return isNaN(n) ? null : n
}

export interface PickerAnswer {
  questionId: string
  selected: string[]
  custom: string
}

// Normalized, EN-mapped filter set derived once from the questionnaire answers.
// Every picker request (suggest / approve / direct-stream / search-all) builds
// its specific payload shape from this object instead of re-deriving maps.
export interface DerivedFilters {
  fuel: string | null
  body_type: string | null
  transmission: string | null
  drive: string | null
  color: string | null
  interior_material: string | null
  year_from: number | null
  year_to: number | null
  budget_min: number | null
  budget_max: number | null
  mileage_min: number | null
  mileage_max: number | null
  displacement_min: number | null
  displacement_max: number | null
  hp_min: number | null
  doors: number | null
  seats_min: number | null
}

export function deriveFilters(answers: PickerAnswer[]): DerivedFilters {
  const byId: Record<string, PickerAnswer> = Object.fromEntries(
    answers.map(a => [a.questionId, a]),
  )
  const sel = (id: string, i = 0) => byId[id]?.selected[i] ?? ""

  const seatsRaw = sel("seats")
  const seats_min = seatsRaw === "7+" ? 7 : seatsRaw ? parseInt(seatsRaw, 10) : null
  const doorsRaw = sel("doors")
  const doors = doorsRaw ? parseInt(doorsRaw, 10) : null

  return {
    fuel: FUEL_MAP[sel("fuel")] ?? null,
    body_type: BODY_MAP[sel("body")] ?? null,
    transmission: TRANSMISSION_MAP[sel("transmission")] ?? null,
    drive: DRIVE_MAP[sel("drive")] ?? null,
    color: COLOR_MAP[sel("color")] ?? null,
    interior_material: INTERIOR_MAP[sel("interior")] ?? null,
    year_from: cleanInt(sel("year", 0)),
    year_to: cleanInt(sel("year", 1)),
    budget_min: cleanInt(sel("budget", 0)),
    budget_max: cleanInt(sel("budget", 1)),
    mileage_min: cleanInt(sel("mileage", 0)),
    mileage_max: cleanInt(sel("mileage", 1)),
    displacement_min: cleanFloat(sel("engine", 0)),
    displacement_max: cleanFloat(sel("engine", 1)),
    hp_min: cleanInt(sel("hp", 0)),
    doors: doors != null && !isNaN(doors) ? doors : null,
    seats_min: seats_min != null && !isNaN(seats_min) ? seats_min : null,
  }
}
