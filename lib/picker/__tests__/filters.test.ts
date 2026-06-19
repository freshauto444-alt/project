import { describe, it, expect } from "vitest"
import { filterCarsClientSide } from "../filters"
import type { ChatPreferences } from "../types"

const EMPTY: ChatPreferences = {
  pairs: [], fuel: null, body_type: null, budget: null,
  budget_min: null, budget_max: null, color: null,
  mileage_max: null, mileage_min: null, required_options: [],
  year_from: null, year_to: null, transmission: null, drive: null,
  displacement_min: null, displacement_max: null, hp_min: null,
  seats_min: null, doors: null, interior_material: null, purpose_body_types: [],
}

const car = (make: string, model: string) => ({ make, model })

describe("filterCarsClientSide — multi-token trim model matching", () => {
  const gtiPrefs: ChatPreferences = { ...EMPTY, pairs: [{ make: "Volkswagen", model: "Golf GTI" }] }

  it("keeps every Golf GTI label, incl. interleaved 'Golf 5-door GTI'", () => {
    const cars = [
      car("Volkswagen", "Golf GTI"),
      car("Volkswagen", "Golf GTI Clubsport"),
      car("Volkswagen", "Golf GTI Edition"),
      car("Volkswagen", "Golf GTI 2.0"),
      car("Volkswagen", "Golf 5-door GTI"),   // interleaved — was dropped before
    ]
    const out = filterCarsClientSide(cars, gtiPrefs)
    expect(out).toHaveLength(5)
  })

  it("keeps Blocket GTI cars where the trim is only in title_line (model='Golf-Serie')", () => {
    const cars = [
      { make: "Volkswagen", model: "Golf-Serie", title_line: "GTI Performance 2.0 TSI DSG 230hk" },
      { make: "Volkswagen", model: "Golf VIII", title_line: "Golf GTI Clubsport" },
      { make: "Volkswagen", model: "Golf-Serie", title_line: "1.5 TSI Comfort" }, // base → drop
    ]
    const out = filterCarsClientSide(cars, gtiPrefs)
    expect(out.map(c => c.title_line)).toEqual([
      "GTI Performance 2.0 TSI DSG 230hk",
      "Golf GTI Clubsport",
    ])
  })

  it("still rejects base Golf and Golf GTD for a GTI search", () => {
    const cars = [
      car("Volkswagen", "Golf"),
      car("Volkswagen", "Golf GTD"),
      car("Volkswagen", "Golf GTI"),
    ]
    const out = filterCarsClientSide(cars, gtiPrefs)
    expect(out.map(c => c.model)).toEqual(["Golf GTI"])
  })

  it("keeps a car with unknown make (soft — parser already constrained make)", () => {
    const out = filterCarsClientSide([{ make: "", model: "" }], gtiPrefs)
    expect(out).toHaveLength(1)
  })
})
