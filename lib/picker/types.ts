// ═══════════════════════════════════════════════════════════════════════════════
//  Shared ai-picker types. Extracted from route.ts so the route handlers and the
//  helper modules (normalize / filters / params) reference one definition.
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface Answer {
  questionId: string
  selected: string[]
  custom: string
}

export interface CarPair {
  make: string | null
  model: string | null
}

export interface ChatPreferences {
  pairs: CarPair[]
  fuel: string | null
  body_type: string | null
  budget: number | null
  budget_min: number | null
  budget_max: number | null
  color: string | null
  mileage_max: number | null
  mileage_min: number | null
  required_options: string[]
  year_from: number | null
  year_to: number | null
  transmission: string | null
  drive: string | null
  displacement_min: number | null
  displacement_max: number | null
  hp_min: number | null
  seats_min: number | null
  doors: number | null
  interior_material: string | null
  purpose_body_types: string[]
  offset?: number
}
