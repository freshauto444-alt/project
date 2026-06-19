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

  it("keeps real i30 N (275hp), drops N-Line (150hp) and base — by text AND power", () => {
    // Mirrors real AS24 data: model is always "I30"; the real N says "N
    // Performance" / 275PS, N-Line is a 150PS cosmetic package, and AS24 also
    // lists the real N with NO "N" in the title at all (just hp=275).
    const nPrefs: ChatPreferences = { ...EMPTY, pairs: [{ make: "Hyundai", model: "i30 N" }] }
    const cars = [
      { make: "Hyundai", model: "I30", title_line: "N Performance 1.Hand 275PS Top", horsepower: 275, year: 2019 },
      { make: "Hyundai", model: "I30", title_line: "N Performance", horsepower: 275, year: 2020 },
      { make: "Hyundai", model: "I30", title_line: "Hyundai I30", horsepower: 280, year: 2021 }, // no "N" text, real N by hp
      { make: "Hyundai", model: "I30", title_line: "FL 1,6 T-GDI N-LINE Klima", horsepower: 150, year: 2021 }, // N-Line package → drop
      { make: "Hyundai", model: "I30", title_line: "1.4 T-GDi Comfort", horsepower: 140, year: 2020 }, // base → drop
    ]
    const out = filterCarsClientSide(cars, nPrefs)
    expect(out.map(c => c.horsepower)).toEqual([275, 275, 280])
  })

  it("keeps Golf R (single-letter R in title), drops base Golf and R-Line", () => {
    const rPrefs: ChatPreferences = { ...EMPTY, pairs: [{ make: "Volkswagen", model: "Golf R" }] }
    const cars = [
      { make: "Volkswagen", model: "Golf-Serie", title_line: "Golf R 4Motion DSG 320hk", year: 2021 },
      { make: "Volkswagen", model: "Golf", title_line: "1.5 TSI R-Line", year: 2021 },  // package → drop
      { make: "Volkswagen", model: "Golf", title_line: "1.0 TSI Comfort", year: 2020 }, // base → drop
    ]
    const out = filterCarsClientSide(cars, rPrefs)
    expect(out.map(c => c.title_line)).toEqual(["Golf R 4Motion DSG 320hk"])
  })

  it("keeps AS24 BMW M240i labelled as bare '240', drops base 218/220 (motor-code bridge)", () => {
    // Real AS24 data: M240i comes back model='240' title='BMW 240' (trim stripped),
    // base trims as '218'/'220'. Bytbil keeps the full 'M240I xDrive' label.
    const prefs: ChatPreferences = { ...EMPTY, pairs: [{ make: "BMW", model: "M240i" }] }
    const cars = [
      { make: "BMW", model: "240", title_line: "BMW 240", horsepower: 374, year: 2023 }, // AS24 real M240i
      { make: "BMW", model: "240", title_line: "BMW 240", horsepower: 387, year: 2022 }, // AS24 real M240i
      { make: "BMW", model: "M240I xDrive M-Sport", title_line: "BMW M240I xDrive", horsepower: 340, year: 2023 }, // bytbil
      { make: "BMW", model: "218", title_line: "BMW 218", horsepower: 136, year: 2022 }, // base → drop
      { make: "BMW", model: "220", title_line: "BMW 220", horsepower: 178, year: 2022 }, // base → drop
    ]
    const out = filterCarsClientSide(cars, prefs)
    expect(out.map(c => c.model)).toEqual(["240", "240", "M240I xDrive M-Sport"])
  })

  it("keeps AS24 BMW M340i labelled as bare '340', not a 320i", () => {
    const prefs: ChatPreferences = { ...EMPTY, pairs: [{ make: "BMW", model: "M340i" }] }
    const cars = [
      { make: "BMW", model: "340", title_line: "BMW 340", horsepower: 374, year: 2021 }, // AS24 real M340i
      { make: "BMW", model: "320", title_line: "BMW 320", horsepower: 184, year: 2021 }, // 320i → drop
      { make: "BMW", model: "330", title_line: "BMW 330", horsepower: 258, year: 2021 }, // 330i → drop
    ]
    const out = filterCarsClientSide(cars, prefs)
    expect(out.map(c => c.model)).toEqual(["340"])
  })

  it("motor-code bridge is BMW-scoped — does not leak across makes", () => {
    // An Audi search must NOT match a stray 3-digit code via the BMW bridge.
    const prefs: ChatPreferences = { ...EMPTY, pairs: [{ make: "Audi", model: "A4" }] }
    const cars = [{ make: "Audi", model: "240", title_line: "weird 240", year: 2021 }]
    const out = filterCarsClientSide(cars, prefs)
    expect(out).toHaveLength(0)
  })

  it("does NOT cap a large in-band result set — returns all matches, not a truncated page", () => {
    // Guards the 'more results, not fewer' goal: now that the parser returns
    // ~100+ cars per source, the client-side filter must never silently slice.
    const cars = Array.from({ length: 150 }, (_, i) => car("Volkswagen", `Golf GTI ${i}`))
    const out = filterCarsClientSide(cars, gtiPrefs)
    expect(out).toHaveLength(150)
  })
})

describe("filterCarsClientSide — year strict-unknown rule does not over-drop", () => {
  it("keeps unknown-year cars for a pre-2018 search (bulk of old SE stock)", () => {
    const prefs: ChatPreferences = { ...EMPTY, year_from: 2010 }
    const cars = [{ year: 2012 }, { year: undefined }, { year: 2009 }]
    const out = filterCarsClientSide(cars, prefs)
    // 2012 in-band + unknown kept (not strict); 2009 below floor dropped.
    expect(out).toHaveLength(2)
  })

  it("drops unknown-year cars ONLY for a strict 2018+ search", () => {
    const prefs: ChatPreferences = { ...EMPTY, year_from: 2018 }
    const cars = [{ year: 2020 }, { year: undefined }, { year: 2015 }]
    const out = filterCarsClientSide(cars, prefs)
    expect(out).toEqual([{ year: 2020 }])
  })
})
