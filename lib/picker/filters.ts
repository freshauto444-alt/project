// ═══════════════════════════════════════════════════════════════════════════════
//  Client-side filtering — mileage, color, options, body, drive…
//  Params the parser doesn't support server-side. Extracted from route.ts.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ChatPreferences } from "./types"

// EN option key → substrings to look for across UA features + SE/DE descriptions
// (sources are Swedish/German). Keeps the leaky required_options filter actually
// functional. Substrings are stems so "panoram" hits panorama/panoramatak/панорам.
const OPTION_SYNONYMS: Record<string, string[]> = {
  "leather":      ["leather", "шкір", "läder", "leder", "skinn"],
  "panorama":     ["panorama", "панорам", "panoramatak", "glastak", "glasdach", "glasdak"],
  "carplay":      ["carplay", "car play", "apple car", "android auto", "smartphone integration"],
  "navigation":   ["navigation", "navi", "навігац", "gps", "satnav", "mmi navi"],
  "camera":       ["camera", "kamera", "камер", "backkamera", "rückfahrkamera", "360"],
  "heated seats": ["heated seat", "stolvärme", "värmestol", "sitzheizung", "підігрів сид", "sätesvärme"],
  "navigation system": ["navigation", "navi", "навігац", "gps", "satnav"],
  "heated seat":  ["heated seat", "stolvärme", "värmestol", "sitzheizung", "підігрів сид"],
}

export function filterCarsClientSide(cars: any[], prefs: ChatPreferences): any[] {
  let filtered = [...cars]

  // Model filter — SOFT: parser already filtered by make/model in URL.
  // Make + Model filter — smart series matching
  // BMW "4er" → accepts "420", "430", "M4" but NOT "318", "X5"
  // Audi "a6" → accepts "A6", "A6 Avant" but NOT "A4", "Q5"
  if (prefs.pairs.length > 0) {
    const pairsLower = prefs.pairs
      .filter(p => p.make)
      .map(p => ({ make: p.make!.toLowerCase(), model: (p.model ?? "").toLowerCase() }))

    if (pairsLower.length > 0) {
      filtered = filtered.filter(c => {
        const carMake = (c.make ?? "").toLowerCase()
        const carModel = (c.model ?? "").toLowerCase()
        if (!carMake) return true

        return pairsLower.some(({ make: reqMake, model: reqModel }) => {
          // Make must match
          if (!carMake.includes(reqMake) && !reqMake.includes(carMake)) return false
          // If no specific model requested, accept all from this make
          if (!reqModel) return true

          // Extract series number: "3er" → "3", "4 series" → "4", "a6" → "a6"
          const seriesMatch = reqModel.match(/^(\d+)/)
          if (seriesMatch) {
            const series = seriesMatch[1]
            // BMW series: "4" matches "420", "430", "440", "M4", "Serie 4", "4er Reihe"
            // but NOT "X4", "318", "520". Guard against X-class (suv) with negative lookbehind.
            if (carModel.startsWith(series)) return true
            // M3 must match "M3 Competition" but NOT "M340i" / "M3 GTS"
            // Negative lookahead forbids trailing digit after the M-letter form.
            if (new RegExp(`m${series}(?![0-9])`, "i").test(carModel)) return true
            // Match "series N" / "serie N" / "Nreihe" / "Ner" anywhere
            const seriesRe = new RegExp(`(?:^|\\s|^serie\\s*|^series\\s*)${series}(?:er|e|\\s|$)`, "i")
            if (seriesRe.test(carModel)) return true
            return false
          }

          // Mercedes class slug ("c-klasse", "e-klasse", "gla-klasse", "cla-class"…).
          // Parser hits AS24/Bytbil with the class slug but returned cars come back
          // with the concrete designation ("C 300 T", "GLA 200", "CLA 180"), which
          // does NOT contain the literal "klasse"/"class" substring — so the generic
          // includes() check below would drop every Mercedes result. Match on the
          // class prefix followed by a space/dash/digit boundary so "c-klasse"
          // accepts "C 300 T" but not "CLA 200", and "cla-klasse" accepts "CLA 200"
          // but not "C 300 T".
          const mbClass = reqModel.match(/^([a-z]{1,3})[\s-]?(?:klasse|class)$/i)
          if (mbClass) {
            const cls = mbClass[1].toLowerCase()
            const carTrimmed = carModel.trim().toLowerCase()
            // Commercial / non-class models that start with the same letter
            // get pulled in by Bytbil free-text search. E-Klasse query brings
            // back "E Vito Tourer" (bytbil reuses the E letter for an
            // E-anything tag). Drop these explicitly.
            const COMMERCIAL_LOOKALIKES = [
              "vito", "v-class", "v klasse", "viano", "metris", "citan",
              "sprinter", "vario", "marco polo", "eqv",
            ]
            if (COMMERCIAL_LOOKALIKES.some(k => carTrimmed.includes(k))) return false
            if (new RegExp(`^${cls}(?:[\\s-]|\\d)`, "i").test(carTrimmed)) return true
            return false
          }

          // Non-numeric models: "a6" matches "A6", "A6 Avant", "A6 Allroad".
          // Word-token boundary via digit-guards: "m5" must not match "M50i",
          // "a6" must not match "a60" (rare but possible AS24 ID strings).
          // Preceding char: start-of-string OR non-digit. Trailing char: not a digit.
          const reqNorm = reqModel.replace(/[^a-z0-9]/g, "")
          const carNorm = carModel.replace(/[^a-z0-9]/g, "")
          // Purely-alphabetic models (Mercedes GLC/GLE/GLS/GLA/EQE, CLA, AMG "GT"…)
          // have the trim number right after the letters — "GLC" MUST match
          // "GLC 220 d". Only guard against a trailing digit when the model itself
          // ends in a digit (a6 ≠ a60, x5 ≠ x50, m5 ≠ m50i).
          const endsWithDigit = /[0-9]$/.test(reqNorm)
          const tokenRe = endsWithDigit
            ? new RegExp(`(?:^|[^0-9])${reqNorm}(?![0-9])`, "i")
            : new RegExp(`(?:^|[^a-z0-9])${reqNorm}`, "i")
          if (tokenRe.test(carNorm)) return true

          // Multi-token trims ("Golf GTI", "Model 3"). Two traps to handle:
          //  1. interleaved labels ("Golf 5-door GTI" → "golf5doorgti");
          //  2. the trim lives ONLY in the title, not the model — Blocket labels
          //     the same car model="Golf-Serie" with "GTI" in title_line. Checking
          //     just c.model dropped every Blocket trim car (Golf GTI/RS6/AMG),
          //     mirroring the parser-side bug. So: the BASE token must be in the
          //     model (keeps "Polo GTI" out of "Golf GTI"), but the remaining
          //     (trim) tokens may be satisfied by model + title_line.
          const reqTokens = reqModel.split(/[\s-]+/).filter(t => t.length >= 2)
          if (reqTokens.length >= 2) {
            const baseTok = reqTokens[0]                    // "golf", "polo", "model"
            const hay = `${carModel} ${(c.title_line ?? "").toLowerCase()}`
            if (carModel.includes(baseTok) && reqTokens.every(t => hay.includes(t))) return true
          }

          return false
        })
      })
    }
  }

  // Year range — hard filter.
  // When the client asks for 2018+ (modern car), REJECT cars with missing
  // year. Otherwise Blocket's bare-bones listings (no regdate scraped on
  // many ancient Honda Accord/Toyota Avensis ads from 2003-2010) leak in
  // as if they matched a "Honda Accord 2019-2022" query. For older searches
  // (year_from < 2018) we still keep unknowns since that's the bulk of the
  // pre-2015 Swedish stock and dropping them empties the result.
  if (prefs.year_from != null) {
    const strictUnknown = prefs.year_from >= 2018
    filtered = filtered.filter(c => c.year ? c.year >= prefs.year_from! : !strictUnknown)
  }
  if (prefs.year_to != null) {
    filtered = filtered.filter(c => !c.year || c.year <= prefs.year_to!)
  }

  // Fuel — hard filter, never show petrol when diesel requested
  if (prefs.fuel) {
    filtered = filtered.filter(c => {
      const carFuel = (c.fuel ?? c.fuel_ua ?? "").toLowerCase()
      if (!carFuel || carFuel === "unknown") return true
      return carFuel.includes(prefs.fuel!.toLowerCase())
    })
  }

  // Engine displacement — prefer the structured engine_cc (cc→L) when present,
  // else parse the engine display string. Robust to EU comma decimals: the old
  // /[1-9]\.\d+/ required a DOT, so "2,0 TDI" (common on Swedish/German ads) never
  // matched → liters stayed null → the car bypassed the filter (a silent leak).
  if (prefs.displacement_min != null || prefs.displacement_max != null) {
    filtered = filtered.filter(c => {
      let liters: number | null = null
      const cc = Number(c.engine_cc ?? c.engineCc)
      if (Number.isFinite(cc) && cc > 600) {
        liters = Math.round(cc / 100) / 10 // authoritative when present
      } else {
        const eng: string = (c.engine ?? "").toLowerCase()
        const mDec = eng.match(/\b([1-9])[.,](\d)(?!\d)/)    // "2.0", "2,0", "1.5L"
        if (mDec) liters = parseFloat(`${mDec[1]}.${mDec[2]}`)
        if (liters === null) {
          const mCc = eng.match(/(\d{3,4})\s*(?:cc|ccm)\b/i)  // "1998 ccm"
          if (mCc) liters = Math.round(parseInt(mCc[1]) / 100) / 10
        }
        if (liters === null) {
          // bare-integer liters "2L"/"2 л" — lookbehind stops it grabbing a digit
          // that's part of a decimal ("1.5l" is handled by mDec above).
          const mL = eng.match(/(?<![.,\d])([1-9])\s*(?:l|л|liter|litre)\b/i)
          if (mL) liters = parseInt(mL[1])
        }
      }
      if (liters === null) return true // unknown → keep (soft, like every filter)
      if (prefs.displacement_min != null && liters < prefs.displacement_min) return false
      if (prefs.displacement_max != null && liters > prefs.displacement_max) return false
      return true
    })
  }

  // Mileage max
  if (prefs.mileage_max) {
    filtered = filtered.filter(c => {
      const km = c.mileage ?? c.mileage_km
      return !km || km <= prefs.mileage_max!
    })
  }

  // Mileage min
  if (prefs.mileage_min) {
    filtered = filtered.filter(c => {
      const km = c.mileage ?? c.mileage_km
      return !km || km >= prefs.mileage_min!
    })
  }

  // Color
  if (prefs.color) {
    filtered = filtered.filter(c => {
      if (!c.color || c.color === "Unknown") return true // keep if unknown
      return c.color.toLowerCase() === prefs.color!.toLowerCase()
    })
  }

  // Drive (AWD/FWD/RWD) — keep unknowns only if most results lack drive data
  if (prefs.drive) {
    const carsWithDrive = filtered.filter(c => c.drive && c.drive !== "Unknown").length
    const keepUnknown = carsWithDrive < filtered.length * 0.3 // if <30% have drive data, keep unknowns
    filtered = filtered.filter(c => {
      const carDrive = (c.drive ?? "").toUpperCase()
      if (!carDrive || carDrive === "UNKNOWN") return keepUnknown
      const wanted = prefs.drive!.toUpperCase()
      if (wanted === "AWD") return ["AWD", "4WD", "4X4", "ALL"].some(k => carDrive.includes(k))
      return carDrive.includes(wanted)
    })
  }

  // Horsepower minimum (from purpose presets or chat)
  if (prefs.hp_min != null) {
    filtered = filtered.filter(c => {
      const hp = c.horsepower ?? c.hp
      if (!hp) return true // keep if unknown
      return hp >= prefs.hp_min!
    })
  }

  // Seats minimum (from purpose: "Для сім'ї з дітьми" → 5+)
  if (prefs.seats_min != null) {
    filtered = filtered.filter(c => {
      if (!c.seats) return true // keep if unknown
      return c.seats >= prefs.seats_min!
    })
  }

  // Explicit body type — HARD filter (keep unknowns, like every other filter).
  // Blocket doesn't body-filter server-side and the parser body filter covers
  // only some sources, so vans/campers (VW California=Bus, Fiat Doblo=Van) leaked
  // into a "Sedan"/"SUV" search. Drop cars whose KNOWN body doesn't match.
  if (prefs.body_type) {
    const want = prefs.body_type.toLowerCase()
    filtered = filtered.filter(c => {
      const cb = (c.body_type ?? c.bodyType ?? "").toLowerCase()
      if (!cb || cb === "unknown" || cb === "other") return true
      return cb.includes(want) || want.includes(cb)
    })
  }

  // Purpose body types (soft filter: if car has known body type, it must match one)
  if (prefs.purpose_body_types.length > 0 && !prefs.body_type) {
    const allowed = prefs.purpose_body_types.map(b => b.toLowerCase())
    filtered = filtered.filter(c => {
      const carBody = (c.body_type ?? c.bodyType ?? "").toLowerCase()
      if (!carBody || carBody === "unknown" || carBody === "other") return true
      return allowed.some(a => carBody.includes(a))
    })
  }

  // Doors
  if (prefs.doors != null) {
    filtered = filtered.filter(c => {
      if (!c.doors) return true // keep if unknown
      return c.doors === prefs.doors
    })
  }

  // Interior material
  if (prefs.interior_material) {
    const wanted = prefs.interior_material.toLowerCase()
    filtered = filtered.filter(c => {
      const mat = (c.seatMaterial ?? c.seat_material ?? c.interior_material ?? "").toLowerCase()
      if (!mat) return true
      return mat.includes(wanted)
    })
  }

  // Required options — match across feature lists AND the description, with
  // EN→UA/SE/DE synonyms. The option keys are English ("leather", "panorama"…)
  // but features_ua/descriptions come back in Ukrainian/Swedish/German, so a raw
  // includes() matched almost nothing → cars with features were hard-dropped
  // (over-filter leak). Cars with NO verifiable data at all are kept (soft, like
  // every other filter), instead of being silently dropped.
  if (prefs.required_options.length > 0) {
    filtered = filtered.filter(c => {
      const allFeatures = [
        ...(c.safety_features ?? []),
        ...(c.comfort_features ?? []),
        ...(c.infotainment ?? []),
        ...(c.features_ua ?? []),
      ].map((f: string) => f.toLowerCase())
      const desc = `${c.description ?? ""} ${c.title_line ?? ""}`.toLowerCase()
      // Nothing to verify against → keep (can't confirm, don't drop).
      if (allFeatures.length === 0 && !desc.trim()) return true

      const hay = allFeatures.join(" · ") + " · " + desc
      return prefs.required_options.every(opt => {
        const syns = OPTION_SYNONYMS[opt.toLowerCase()] ?? [opt.toLowerCase()]
        return syns.some(s => hay.includes(s))
      })
    })
  }

  return filtered
}
