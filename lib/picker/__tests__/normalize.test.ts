import { describe, it, expect } from "vitest"
import {
  normalizeBrand,
  normalizeColor,
  stripGenerationSuffix,
  detectBrandGroups,
  BRAND_ALIASES,
  KNOWN_BRAND_SET,
  KNOWN_BRANDS_LOWER,
} from "../normalize"

describe("normalizeBrand", () => {
  it("maps Cyrillic aliases to canonical brands", () => {
    expect(normalizeBrand("мерс")).toBe("Mercedes-Benz")
    expect(normalizeBrand("бмв")).toBe("BMW")
    expect(normalizeBrand("ауді")).toBe("Audi")
    expect(normalizeBrand("vw")).toBe("Volkswagen")
  })
  it("is case/whitespace insensitive", () => {
    expect(normalizeBrand("  МеРс  ")).toBe("Mercedes-Benz")
  })
  it("passes unknown input through untouched (trimmed)", () => {
    expect(normalizeBrand("  Cupra ")).toBe("Cupra")
  })
})

describe("stripGenerationSuffix", () => {
  it("drops generation codes that break AS24 slugs", () => {
    expect(stripGenerationSuffix("passat b9")).toBe("passat")
    expect(stripGenerationSuffix("x5 g05")).toBe("x5")
    expect(stripGenerationSuffix("a4 b9")).toBe("a4")
  })
  it("drops body-variant suffixes", () => {
    expect(stripGenerationSuffix("Cooper 3 Door")).toBe("Cooper")
  })
  it("PRESERVES AMG/M/RS performance trims (not generation codes)", () => {
    // The recurring footgun: collapsing E63 → E-Class loses the AMG variant.
    expect(stripGenerationSuffix("amg e63")).toBe("amg e63")
    expect(stripGenerationSuffix("m5")).toBe("m5")
  })
  it("leaves single-word models unchanged", () => {
    expect(stripGenerationSuffix("Octavia")).toBe("Octavia")
  })
  it("handles null/undefined", () => {
    expect(stripGenerationSuffix(null)).toBeNull()
    expect(stripGenerationSuffix(undefined)).toBeNull()
  })
})

describe("normalizeColor", () => {
  it("maps multilingual colour words", () => {
    expect(normalizeColor("хочу чорний седан")).toBe("Black")
    expect(normalizeColor("a white one")).toBe("White")
    expect(normalizeColor("серый")).toBe("Grey")
  })
  it("returns null when no colour mentioned", () => {
    expect(normalizeColor("бмв до 30к")).toBeNull()
  })
})

describe("detectBrandGroups", () => {
  it("expands VAG concern term to the whole group", () => {
    const g = detectBrandGroups("хочу щось ваг до 30к")
    expect(g).toContain("Volkswagen")
    expect(g).toContain("Audi")
    expect(g).toContain("Porsche")
  })
  it("does NOT match concern term inside another word", () => {
    expect(detectBrandGroups("важіль перемикання")).toEqual([])
    expect(detectBrandGroups("вагон")).toEqual([])
  })
  it("returns [] when no concern term present", () => {
    expect(detectBrandGroups("audi a4")).toEqual([])
  })
})

// ── Drift guard ──────────────────────────────────────────────────────────────
// This is the test that would have caught the "Aston Martin parsed by Claude but
// silently dropped by the validator" bug. Every brand any alias maps to MUST be
// a known brand, or the picker discards a correctly-parsed make.
describe("brand list integrity (single source of truth)", () => {
  it("every BRAND_ALIASES target is in KNOWN_BRAND_SET", () => {
    const orphans = [...new Set(Object.values(BRAND_ALIASES))].filter(
      (b) => !KNOWN_BRAND_SET.has(b),
    )
    expect(orphans).toEqual([])
  })
  it("KNOWN_BRANDS_LOWER is sorted longest-first (so mercedes-benz beats mercedes)", () => {
    for (let i = 1; i < KNOWN_BRANDS_LOWER.length; i++) {
      expect(KNOWN_BRANDS_LOWER[i - 1].length).toBeGreaterThanOrEqual(
        KNOWN_BRANDS_LOWER[i].length,
      )
    }
  })
})
