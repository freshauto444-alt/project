import { describe, it, expect } from "vitest"
import { mergeSurveyIntoChat } from "../merge-survey"
import { extractSearchParams } from "../survey-params"
import type { ChatPreferences } from "../types"

// An all-null survey base; tests override only the fields they exercise.
const baseWith = (over: Partial<ReturnType<typeof extractSearchParams>>) => ({
  ...extractSearchParams([]),
  ...over,
})

const EMPTY: ChatPreferences = {
  pairs: [], fuel: null, body_type: null, budget: null,
  budget_min: null, budget_max: null, color: null,
  mileage_max: null, mileage_min: null, required_options: [],
  year_from: null, year_to: null, transmission: null, drive: null,
  displacement_min: null, displacement_max: null, hp_min: null,
  seats_min: null, doors: null, interior_material: null, purpose_body_types: [],
}

describe("mergeSurveyIntoChat", () => {
  it("fills a field the chat left unset", () => {
    const chat = { ...EMPTY }
    mergeSurveyIntoChat(chat, baseWith({ fuel: "Diesel", body_type: "SUV" }))
    expect(chat.fuel).toBe("Diesel")
    expect(chat.body_type).toBe("SUV")
  })

  it("does NOT override an explicit chat value", () => {
    const chat: ChatPreferences = { ...EMPTY, fuel: "Petrol" }
    mergeSurveyIntoChat(chat, baseWith({ fuel: "Diesel" }))
    expect(chat.fuel).toBe("Petrol") // chat wins
  })

  it("min-only chat budget is NOT capped by the survey's budget_max", () => {
    // "від 30к" = client wants 30k+; survey must not silently add an upper cap.
    const chat: ChatPreferences = { ...EMPTY, budget_min: 30000 }
    mergeSurveyIntoChat(chat, baseWith({ budget_max: 45000 }))
    expect(chat.budget_max).toBeNull()
    expect(chat.budget_min).toBe(30000)
  })

  it("applies survey budget_max when chat has no budget at all", () => {
    const chat = { ...EMPTY }
    mergeSurveyIntoChat(chat, baseWith({ budget_max: 45000 }))
    expect(chat.budget_max).toBe(45000)
  })
})
