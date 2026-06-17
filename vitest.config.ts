import { defineConfig } from "vitest/config"
import path from "node:path"

// Unit tests for pure picker/business logic only (no Next runtime, no network).
// Keep these fast and deterministic — they are the regression net for the
// turnkey↔EU price math and brand normalization.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
})
