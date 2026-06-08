// Shared client-side car filter — used by both the blocking /api/ai-picker
// handler and the streaming /api/ai-picker/stream proxy so that progressive
// SSE results get the same Vito/M50i/etc safety net as the synchronous path.

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

export function filterCarsClientSide(cars: any[], prefs: ChatPreferences): any[] {
  let filtered = [...cars]

  // Model filter — SOFT: parser already filtered by make/model in URL.
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
            // M3 must match "M3 Competition" but NOT "M340i" — forbid trailing digit.
            if (new RegExp(`m${series}(?![0-9])`, "i").test(carModel)) return true
            const seriesRe = new RegExp(`(?:^|\\s|^serie\\s*|^series\\s*)${series}(?:er|e|\\s|$)`, "i")
            if (seriesRe.test(carModel)) return true
            return false
          }

          // Mercedes class slug: accept "C 300 T" for "c-klasse", reject "E Vito Tourer".
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

          // Non-numeric: "a6" matches "A6/A6 Avant" but "m5" must NOT match "M50i".
          const reqNorm = reqModel.replace(/[^a-z0-9]/g, "")
          const carNorm = carModel.replace(/[^a-z0-9]/g, "")
          const tokenRe = new RegExp(`(?:^|[^0-9])${reqNorm}(?![0-9])`, "i")
          if (tokenRe.test(carNorm)) return true

          return false
        })
      })
    }
  }

  if (prefs.year_from != null) {
    filtered = filtered.filter(c => !c.year || c.year >= prefs.year_from!)
  }
  if (prefs.year_to != null) {
    filtered = filtered.filter(c => !c.year || c.year <= prefs.year_to!)
  }

  if (prefs.fuel) {
    filtered = filtered.filter(c => {
      const carFuel = (c.fuel ?? c.fuel_ua ?? "").toLowerCase()
      if (!carFuel || carFuel === "unknown") return true
      return carFuel.includes(prefs.fuel!.toLowerCase())
    })
  }

  if (prefs.displacement_min != null || prefs.displacement_max != null) {
    filtered = filtered.filter(c => {
      const eng: string = (c.engine ?? "").toLowerCase()
      let liters: number | null = null
      const mDot = eng.match(/\b([1-9]\.\d+)\b/)
      if (mDot) liters = parseFloat(mDot[1])
      if (liters === null) {
        const mCc = eng.match(/(\d{3,4})\s*(?:cc|ccm)/i)
        if (mCc) liters = Math.round(parseInt(mCc[1]) / 100) / 10
      }
      if (liters === null) return true
      if (prefs.displacement_min != null && liters < prefs.displacement_min) return false
      if (prefs.displacement_max != null && liters > prefs.displacement_max) return false
      return true
    })
  }

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

  if (prefs.color) {
    filtered = filtered.filter(c => {
      if (!c.color || c.color === "Unknown") return true
      return c.color.toLowerCase() === prefs.color!.toLowerCase()
    })
  }

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

  if (prefs.hp_min != null) {
    filtered = filtered.filter(c => {
      const hp = c.horsepower ?? c.hp
      return !hp || hp >= prefs.hp_min!
    })
  }

  if (prefs.seats_min != null) {
    filtered = filtered.filter(c => !c.seats || c.seats >= prefs.seats_min!)
  }

  if (prefs.purpose_body_types.length > 0 && !prefs.body_type) {
    const allowed = prefs.purpose_body_types.map(b => b.toLowerCase())
    filtered = filtered.filter(c => {
      const carBody = (c.body_type ?? c.bodyType ?? "").toLowerCase()
      if (!carBody || carBody === "unknown" || carBody === "other") return true
      return allowed.some(a => carBody.includes(a))
    })
  }

  if (prefs.doors != null) {
    filtered = filtered.filter(c => !c.doors || c.doors === prefs.doors)
  }

  if (prefs.interior_material) {
    const wanted = prefs.interior_material.toLowerCase()
    filtered = filtered.filter(c => {
      const mat = (c.seatMaterial ?? c.seat_material ?? c.interior_material ?? "").toLowerCase()
      if (!mat) return true
      return mat.includes(wanted)
    })
  }

  if (prefs.required_options.length > 0) {
    filtered = filtered.filter(c => {
      const allFeatures = [
        ...(c.safety_features ?? []),
        ...(c.comfort_features ?? []),
        ...(c.infotainment ?? []),
        ...(c.features_ua ?? []),
      ].map((f: string) => f.toLowerCase())

      return prefs.required_options.every(opt => {
        const optLower = opt.toLowerCase()
        return allFeatures.some(f => f.includes(optLower))
      })
    })
  }

  return filtered
}
