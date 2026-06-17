import { describe, it, expect } from "vitest"
import { calcTotalCost, euPriceFromTurnkey, PRICING } from "../constants"

describe("calcTotalCost (raw EU → turnkey UA price)", () => {
  it("computes a known breakdown for €20 000", () => {
    const c = calcTotalCost(20000)
    expect(c.duty).toBe(2000) // 10%
    expect(c.excise).toBe(1000) // 5%
    expect(c.vat).toBe(4600) // 20% of (20000+2000+1000)
    expect(c.delivery).toBe(PRICING.DELIVERY_FEE)
    // 20000 + 2000 + 1000 + 4600 + 2500 + 1200 + 800
    expect(c.total).toBe(32100)
  })
  it("is monotonic — pricier car ⇒ pricier turnkey", () => {
    expect(calcTotalCost(30000).total).toBeGreaterThan(calcTotalCost(20000).total)
  })
})

describe("euPriceFromTurnkey (reverse — used to filter the parser)", () => {
  it("inverts calcTotalCost within rounding tolerance", () => {
    for (const eu of [20000, 25000, 33333, 50000, 80000]) {
      const turnkey = calcTotalCost(eu).total
      const back = euPriceFromTurnkey(turnkey)
      expect(Math.abs(back - eu)).toBeLessThanOrEqual(2)
    }
  })
  it("never returns a negative EU price for tiny turnkey budgets", () => {
    expect(euPriceFromTurnkey(1000)).toBeGreaterThanOrEqual(0)
    expect(euPriceFromTurnkey(0)).toBe(0)
  })
  it("a turnkey budget always maps to a STRICTLY lower raw EU price", () => {
    // Guards the core invariant: the user thinks turnkey, the parser filters EU,
    // and EU must be below turnkey or we'd surface cars over the client's budget.
    for (const turnkey of [25000, 40000, 60000]) {
      expect(euPriceFromTurnkey(turnkey)).toBeLessThan(turnkey)
    }
  })
})
