// Pure, framework-free car filtering shared by the server route
// (app/api/ai-picker/route.ts) and the client direct-stream path
// (components/unified-picker.tsx). Previously this logic lived only in the
// route, so the AI-down stream path returned UNFILTERED cars — the user's
// engine/mileage/hp/doors/seats/color/interior choices were silently ignored.
//
// Reads both snake_case (parser payload) and camelCase (mapApiCar output)
// field names so it works on either shape.

export interface CarPair {
  make: string | null
  model: string | null
}

export interface FilterPrefs {
  pairs: CarPair[]
  fuel: string | null
  body_type: string | null
  color: string | null
  drive: string | null
  year_from: number | null
  year_to: number | null
  mileage_min: number | null
  mileage_max: number | null
  displacement_min: number | null
  displacement_max: number | null
  hp_min: number | null
  seats_min: number | null
  doors: number | null
  interior_material: string | null
  required_options: string[]
  purpose_body_types: string[]
}

// Single source of truth for the dedup identity of a listing. Used across the
// server merge and both client merge paths so the same car can't slip through
// as a duplicate just because one path keyed on `id` and another on `url`.
export function carKey(car: any): string {
  return String(
    car?.sourceUrl ?? car?.source_url ?? car?.url ?? car?.id ?? "",
  )
}

export function filterCars(cars: any[], prefs: FilterPrefs): any[] {
  let filtered = [...cars]

  // Make + Model filter — smart series matching.
  // BMW "4er" → accepts "420", "430", "M4" but NOT "318", "X5".
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
          if (!carMake.includes(reqMake) && !reqMake.includes(carMake)) return false
          if (!reqModel) return true

          const seriesMatch = reqModel.match(/^(\d+)/)
          if (seriesMatch) {
            const series = seriesMatch[1]
            if (carModel.startsWith(series)) return true
            if (new RegExp(`m${series}(?![0-9])`, "i").test(carModel)) return true
            const seriesRe = new RegExp(`(?:^|\\s|^serie\\s*|^series\\s*)${series}(?:er|e|\\s|$)`, "i")
            if (seriesRe.test(carModel)) return true
            return false
          }

          const mbClass = reqModel.match(/^([a-z]{1,3})[\s-]?(?:klasse|class)$/i)
          if (mbClass) {
            const cls = mbClass[1].toLowerCase()
            const carTrimmed = carModel.trim().toLowerCase()
            const COMMERCIAL_LOOKALIKES = [
              "vito", "v-class", "v klasse", "viano", "metris", "citan",
              "sprinter", "vario", "marco polo", "eqv",
            ]
            if (COMMERCIAL_LOOKALIKES.some(k => carTrimmed.includes(k))) return false
            if (new RegExp(`^${cls}(?:[\\s-]|\\d)`, "i").test(carTrimmed)) return true
            return false
          }

          const reqNorm = reqModel.replace(/[^a-z0-9]/g, "")
          const carNorm = carModel.replace(/[^a-z0-9]/g, "")
          // If the requested model is purely alphabetic (Mercedes GLE/GLS/GLC/GLA/
          // EQE/CLA/CLS, AMG "GT"…), a trailing digit is the TRIM — "GLE" MUST match
          // "GLE 300 d". Only guard against a trailing digit when the model itself
          // ends in a digit (a6 must not match a60, x5 not x50, 320 not 3200).
          const endsWithDigit = /[0-9]$/.test(reqNorm)
          const tokenRe = endsWithDigit
            ? new RegExp(`(?:^|[^0-9])${reqNorm}(?![0-9])`, "i")
            : new RegExp(`(?:^|[^a-z0-9])${reqNorm}`, "i")
          if (tokenRe.test(carNorm)) return true

          return false
        })
      })
    }
  }

  // Year range — hard filter. Reject missing-year cars only for modern (2018+)
  // searches, where a yearless listing is almost always old Swedish stock.
  if (prefs.year_from != null) {
    const strictUnknown = prefs.year_from >= 2018
    filtered = filtered.filter(c => c.year ? c.year >= prefs.year_from! : !strictUnknown)
  }
  if (prefs.year_to != null) {
    filtered = filtered.filter(c => !c.year || c.year <= prefs.year_to!)
  }

  // Fuel — hard filter, never show petrol when diesel requested.
  if (prefs.fuel) {
    filtered = filtered.filter(c => {
      const carFuel = (c.fuel ?? c.fuel_ua ?? "").toLowerCase()
      if (!carFuel || carFuel === "unknown") return true
      return carFuel.includes(prefs.fuel!.toLowerCase())
    })
  }

  // Engine displacement (parsed from the engine string; keep unknowns).
  if (prefs.displacement_min != null || prefs.displacement_max != null) {
    filtered = filtered.filter(c => {
      const eng: string = (c.engine ?? "").toLowerCase()
      let liters: number | null = null
      // Prefer the exact numeric engine_cc when present (more reliable than the
      // rounded liter string).
      const ccNum = c.engine_cc ?? c.engineCc
      if (typeof ccNum === "number" && ccNum > 100) {
        liters = Math.round(ccNum / 100) / 10
      }
      if (liters === null) {
        const mDot = eng.match(/\b([1-9]\.\d+)\b/)
        if (mDot) liters = parseFloat(mDot[1])
      }
      if (liters === null) {
        const mCc = eng.match(/(\d{3,4})\s*(?:cc|ccm)/i)
        if (mCc) liters = Math.round(parseInt(mCc[1]) / 100) / 10
      }
      if (liters === null) return true // keep if unknown
      if (prefs.displacement_min != null && liters < prefs.displacement_min) return false
      if (prefs.displacement_max != null && liters > prefs.displacement_max) return false
      return true
    })
  }

  // Mileage max / min (keep unknowns).
  if (prefs.mileage_max) {
    filtered = filtered.filter(c => {
      const km = c.mileage ?? c.mileage_km
      return !km || km <= prefs.mileage_max!
    })
  }
  if (prefs.mileage_min) {
    filtered = filtered.filter(c => {
      const km = c.mileage ?? c.mileage_km
      return !km || km >= prefs.mileage_min!
    })
  }

  // Color (keep unknowns).
  if (prefs.color) {
    filtered = filtered.filter(c => {
      if (!c.color || c.color === "Unknown") return true
      return c.color.toLowerCase() === prefs.color!.toLowerCase()
    })
  }

  // Drive — keep unknowns only when most results lack drive data.
  if (prefs.drive) {
    const carsWithDrive = filtered.filter(c => c.drive && c.drive !== "Unknown").length
    const keepUnknown = carsWithDrive < filtered.length * 0.3
    filtered = filtered.filter(c => {
      const carDrive = (c.drive ?? "").toUpperCase()
      if (!carDrive || carDrive === "UNKNOWN") return keepUnknown
      const wanted = prefs.drive!.toUpperCase()
      if (wanted === "AWD") return ["AWD", "4WD", "4X4", "ALL"].some(k => carDrive.includes(k))
      return carDrive.includes(wanted)
    })
  }

  // Horsepower minimum (keep unknowns).
  if (prefs.hp_min != null) {
    filtered = filtered.filter(c => {
      const hp = c.horsepower ?? c.hp
      if (!hp) return true
      return hp >= prefs.hp_min!
    })
  }

  // Seats minimum (keep unknowns).
  if (prefs.seats_min != null) {
    filtered = filtered.filter(c => {
      if (!c.seats) return true
      return c.seats >= prefs.seats_min!
    })
  }

  // Purpose body types (soft: if car has known body type, it must match one).
  if (prefs.purpose_body_types.length > 0 && !prefs.body_type) {
    const allowed = prefs.purpose_body_types.map(b => b.toLowerCase())
    filtered = filtered.filter(c => {
      const carBody = (c.body_type ?? c.bodyType ?? "").toLowerCase()
      if (!carBody || carBody === "unknown" || carBody === "other") return true
      return allowed.some(a => carBody.includes(a))
    })
  }

  // Doors (keep unknowns).
  if (prefs.doors != null) {
    filtered = filtered.filter(c => {
      if (!c.doors) return true
      return c.doors === prefs.doors
    })
  }

  // Interior material (keep unknowns).
  if (prefs.interior_material) {
    const wanted = prefs.interior_material.toLowerCase()
    filtered = filtered.filter(c => {
      const mat = (c.seatMaterial ?? c.seat_material ?? c.interior_material ?? "").toLowerCase()
      if (!mat) return true
      return mat.includes(wanted)
    })
  }

  // Required options — every requested option must be present in some feature list.
  if (prefs.required_options.length > 0) {
    filtered = filtered.filter(c => {
      const allFeatures = [
        ...(c.safety_features ?? c.safetyFeatures ?? []),
        ...(c.comfort_features ?? c.comfortFeatures ?? []),
        ...(c.infotainment ?? []),
        ...(c.features_ua ?? c.featuresUa ?? []),
      ].map((f: string) => f.toLowerCase())

      return prefs.required_options.every(opt => {
        const optLower = opt.toLowerCase()
        return allFeatures.some(f => f.includes(optLower))
      })
    })
  }

  return filtered
}
