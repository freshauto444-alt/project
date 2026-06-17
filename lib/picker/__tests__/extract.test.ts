import { vi, describe, it, expect, beforeEach } from "vitest"
import type { ChatPreferences } from "../types"

// Stub the Claude call so we test the DETERMINISTIC merge/reorder/group logic,
// not the model. extractFromChat parses Claude's JSON, then merges it with the
// previous preferences — that merge is the recurring source of "lost a filter"
// bugs, and it is pure once the JSON is fixed.
vi.mock("@/lib/picker/claude", () => ({ callClaude: vi.fn() }))

import { callClaude } from "@/lib/picker/claude"
import { extractFromChat } from "../extract"

const mockClaude = vi.mocked(callClaude)

/** Make Claude "return" a given preference JSON object as its raw text reply. */
function claudeReturns(obj: Record<string, unknown>) {
  mockClaude.mockResolvedValue(JSON.stringify(obj))
}

function userMsg(content: string) {
  return [{ role: "user" as const, content }]
}

const EMPTY: ChatPreferences = {
  pairs: [], fuel: null, body_type: null, budget: null,
  budget_min: null, budget_max: null, color: null,
  mileage_max: null, mileage_min: null, required_options: [],
  year_from: null, year_to: null, transmission: null, drive: null,
  displacement_min: null, displacement_max: null, hp_min: null,
  seats_min: null, doors: null, interior_material: null, purpose_body_types: [],
}

beforeEach(() => mockClaude.mockReset())

describe("extractFromChat — cumulative merge", () => {
  it("rule 1: adding a param keeps previously-set ones", async () => {
    const prev: ChatPreferences = { ...EMPTY, fuel: "Diesel", pairs: [{ make: "BMW", model: null }] }
    claudeReturns({ budget: 25000 }) // AI mentions only budget
    const out = await extractFromChat(userMsg("бюджет 25 тисяч"), prev)
    expect(out.fuel).toBe("Diesel") // not mentioned → preserved
    expect(out.budget).toBe(25000) // new value applied
    expect(out.pairs).toEqual([{ make: "BMW", model: null }]) // preserved
  })

  it("rule 3: explicit null cancels a previously-set param", async () => {
    const prev: ChatPreferences = { ...EMPTY, mileage_max: 100000 }
    claudeReturns({ mileage_max: null }) // "будь-який пробіг"
    const out = await extractFromChat(userMsg("будь-який пробіг"), prev)
    expect(out.mileage_max).toBeNull()
  })

  it("a missing key is NOT treated as a reset (keeps previous)", async () => {
    const prev: ChatPreferences = { ...EMPTY, year_from: 2018 }
    claudeReturns({ budget: 30000 }) // no year_from key at all
    const out = await extractFromChat(userMsg("до 30к"), prev)
    expect(out.year_from).toBe(2018)
  })

  it("orders a newly-added pick LAST (so it surfaces at top of results)", async () => {
    const prev: ChatPreferences = { ...EMPTY, pairs: [{ make: "BMW", model: null }] }
    claudeReturns({ pairs: [{ make: "BMW", model: null }, { make: "Audi", model: null }] })
    const out = await extractFromChat(userMsg("додай ауді"), prev)
    expect(out.pairs[out.pairs.length - 1]).toEqual({ make: "Audi", model: null })
  })

  it("rejects a hallucinated brand, keeping the valid previous pair", async () => {
    const prev: ChatPreferences = { ...EMPTY, pairs: [{ make: "BMW", model: null }] }
    claudeReturns({ pairs: [{ make: "Lada", model: "Niva" }] }) // not in KNOWN_BRAND_SET
    const out = await extractFromChat(userMsg("щось екзотичне"), prev)
    expect(out.pairs.some(p => p.make === "Lada")).toBe(false)
  })

  it("a concern term (ВАГ) expands to the whole group regardless of Claude's pairs", async () => {
    claudeReturns({ pairs: [{ make: "Volkswagen", model: null }] })
    const out = await extractFromChat(userMsg("хочу щось ваг до 30к"), EMPTY)
    const makes = out.pairs.map(p => p.make)
    expect(makes).toEqual(expect.arrayContaining(["Volkswagen", "Audi", "Porsche"]))
  })

  it("falls back to previous when there is no user text", async () => {
    const prev: ChatPreferences = { ...EMPTY, fuel: "Petrol" }
    const out = await extractFromChat([], prev)
    expect(out).toEqual(prev)
    expect(mockClaude).not.toHaveBeenCalled()
  })
})

// ── Rule 8: alternatives clear pairs, preserving class/budget ────────────────
describe("extractFromChat — rule 8: alternatives clear pairs", () => {
  it("an explicit empty pairs + alternatives intent CLEARS pairs but keeps the class", async () => {
    const prev: ChatPreferences = { ...EMPTY, pairs: [{ make: "BMW", model: null }], body_type: "SUV" }
    claudeReturns({ pairs: [] })
    const out = await extractFromChat(userMsg("які ще альтернативи"), prev)
    expect(out.pairs).toHaveLength(0) // class-wide search, not pinned to BMW
    expect(out.body_type).toBe("SUV") // class preserved
  })

  it("an empty pairs WITHOUT an alternatives intent keeps previous (forgetful-echo safety net)", async () => {
    const prev: ChatPreferences = { ...EMPTY, pairs: [{ make: "BMW", model: null }] }
    claudeReturns({ pairs: [], budget: 30000 }) // user only changed budget; AI dropped the echo
    const out = await extractFromChat(userMsg("підніми бюджет до 30к"), prev)
    expect(out.pairs).toEqual([{ make: "BMW", model: null }])
  })
})
