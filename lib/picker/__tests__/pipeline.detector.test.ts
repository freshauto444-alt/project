// ═══════════════════════════════════════════════════════════════════════════════
//  HONEST end-to-end pipeline detector.
//
//  WHY THIS EXISTS: a background check that only counted the parser's per-source
//  contribution lied — it reported "AS24 contributes 16 cars" for M240i while the
//  user saw 0 AutoScout. The cars WERE returned, but AS24 labels an M240i as
//  model="240" / "BMW 240" (trim stripped), so the real site model-gate
//  (filterCarsClientSide) threw all of them away. Counting source contribution is
//  not counting what survives to the user.
//
//  This detector runs the SAME code path the customer hits: live parser →
//  the REAL filterCarsClientSide. For each target it reports, per source,
//  parser_count vs survived_count, and flags two failure classes:
//    • LOST   — parser returned cars for a source but 0 survived the filter
//               (the M240i label/normalization bug — a whole-class smell).
//    • SOURCE_0 — a source returned 0 while another returned cars
//               (taxonomy gap or Akamai/IP block).
//
//  Default-skipped so `vitest run` stays green and offline. Run live with:
//    RUN_DETECTOR=1 PARSER_API_URL=https://parser-production-3e70.up.railway.app \
//      PARSER_API_KEY=freshauto_secret_2024 \
//      npx vitest run lib/picker/__tests__/pipeline.detector.test.ts
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest"
import { filterCarsClientSide } from "../filters"
import type { ChatPreferences } from "../types"

const RUN = process.env.RUN_DETECTOR === "1"
const PARSER_URL = process.env.PARSER_API_URL ?? "https://parser-production-3e70.up.railway.app"
const PARSER_KEY = process.env.PARSER_API_KEY ?? "freshauto_secret_2024"

const EMPTY: ChatPreferences = {
  pairs: [], fuel: null, body_type: null, budget: null,
  budget_min: null, budget_max: null, color: null,
  mileage_max: null, mileage_min: null, required_options: [],
  year_from: null, year_to: null, transmission: null, drive: null,
  displacement_min: null, displacement_max: null, hp_min: null,
  seats_min: null, doors: null, interior_material: null, purpose_body_types: [],
}

interface Target {
  make: string
  model: string
  year_from?: number
  year_to?: number
  /** rough power floor of the REAL variant — used only to annotate the report */
  realHpHint?: number
}

// A basket spanning the known failure classes + plain controls. The point is to
// catch the CLASS, not one car: trim variants (perf hatch, BMW M-perf), Mercedes
// class slugs, and ordinary mass models that must always be healthy.
const TARGETS: Target[] = [
  { make: "BMW", model: "M240i", year_from: 2022, year_to: 2024, realHpHint: 374 },
  { make: "BMW", model: "M340i", year_from: 2020, realHpHint: 374 },
  { make: "Hyundai", model: "i30 N", year_from: 2019, realHpHint: 250 },
  { make: "Hyundai", model: "i20 N", year_from: 2021, realHpHint: 204 },
  { make: "Volkswagen", model: "Golf GTI", year_from: 2020, realHpHint: 245 },
  { make: "Volkswagen", model: "Golf R", year_from: 2020, realHpHint: 300 },
  { make: "Audi", model: "RS6", year_from: 2020, realHpHint: 600 },
  { make: "Mercedes-Benz", model: "C-Class", year_from: 2019 },
  // plain controls — must stay healthy across all three sources
  { make: "BMW", model: "3 Series", year_from: 2019 },
  { make: "Audi", model: "A4", year_from: 2019 },
  { make: "Mazda", model: "6", year_from: 2019 },
]

const SOURCES = ["autoscout24.com", "bytbil.com", "blocket.se"]

function countBySource(cars: any[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of cars) {
    const s = c.source_site ?? c.source ?? "?"
    out[s] = (out[s] ?? 0) + 1
  }
  return out
}

async function fetchParser(t: Target): Promise<any[]> {
  const p = new URLSearchParams({ make: t.make, model: t.model, limit: "200" })
  if (t.year_from) p.set("year_from", String(t.year_from))
  if (t.year_to) p.set("year_to", String(t.year_to))
  const res = await fetch(`${PARSER_URL}/search/instant?${p}`, {
    headers: { "x-api-key": PARSER_KEY },
  })
  if (!res.ok) throw new Error(`parser ${res.status} for ${t.make} ${t.model}`)
  const body = await res.json()
  return body.cars ?? body.results ?? []
}

interface Row {
  target: string
  parser: Record<string, number>
  survived: Record<string, number>
  flags: string[]
}

describe.skipIf(!RUN)("pipeline detector — parser vs what survives the site filter", () => {
  it(
    "reports per-source survival and flags LOST / SOURCE_0 classes",
    async () => {
      const rows: Row[] = []
      for (const t of TARGETS) {
        let cars: any[]
        try {
          cars = await fetchParser(t)
        } catch (e: any) {
          rows.push({ target: `${t.make} ${t.model}`, parser: {}, survived: {}, flags: [`FETCH_ERR ${e.message}`] })
          continue
        }
        const prefs: ChatPreferences = {
          ...EMPTY,
          pairs: [{ make: t.make, model: t.model }],
          year_from: t.year_from ?? null,
          year_to: t.year_to ?? null,
        }
        const survivors = filterCarsClientSide(cars, prefs)
        const parser = countBySource(cars)
        const survived = countBySource(survivors)

        const flags: string[] = []
        const parserTotal = Object.values(parser).reduce((a, b) => a + b, 0)
        for (const s of SOURCES) {
          const pc = parser[s] ?? 0
          const sc = survived[s] ?? 0
          if (pc > 0 && sc === 0) flags.push(`LOST:${s}(${pc}→0)`)
        }
        const survTotal = Object.values(survived).reduce((a, b) => a + b, 0)
        // a source at 0 while the merged parser had cars = block / taxonomy gap
        for (const s of SOURCES) {
          if ((parser[s] ?? 0) === 0 && parserTotal > 0) flags.push(`SOURCE_0:${s}`)
        }
        if (survTotal < 50 && parserTotal >= 50) flags.push(`STARVED(${parserTotal}→${survTotal})`)
        rows.push({ target: `${t.make} ${t.model}`, parser, survived, flags })
      }

      // ── render a readable report ────────────────────────────────────────────
      const line = (n: number) => String(n).padStart(3)
      const fmt = (r: Record<string, number>) =>
        SOURCES.map(s => `${s.split(".")[0].slice(0, 4)}=${line(r[s] ?? 0)}`).join(" ")
      console.log("\n" + "═".repeat(78))
      console.log("HONEST PIPELINE DETECTOR — parser → site filter")
      console.log("═".repeat(78))
      for (const r of rows) {
        console.log(`\n▸ ${r.target}`)
        console.log(`    parser:   ${fmt(r.parser)}`)
        console.log(`    survived: ${fmt(r.survived)}`)
        if (r.flags.length) console.log(`    ⚠  ${r.flags.join("  ")}`)
        else console.log(`    ✓ healthy`)
      }
      console.log("\n" + "═".repeat(78))
      const lost = rows.filter(r => r.flags.some(f => f.startsWith("LOST")))
      const src0 = rows.filter(r => r.flags.some(f => f.startsWith("SOURCE_0")))
      console.log(`LOST (parser>0 but filter zeroed): ${lost.map(r => r.target).join(", ") || "none"}`)
      console.log(`SOURCE_0 (a source empty):         ${src0.map(r => r.target).join(", ") || "none"}`)
      console.log("═".repeat(78) + "\n")

      // The detector is diagnostic, not a gate — it must always finish and print.
      // We assert only that it actually probed every target (caught the run).
      expect(rows).toHaveLength(TARGETS.length)
    },
    180_000,
  )
})
