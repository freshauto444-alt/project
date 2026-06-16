// ═══════════════════════════════════════════════════════════════════════════════
//  ai-picker config — shared by the route handler and the parser orchestration.
// ═══════════════════════════════════════════════════════════════════════════════

// Parser URL/key from env so deployment isn't locked to localhost.
// Evaluated at module load — Next.js hot-reloads modules on env change.
export const PARSER_URL = process.env.PARSER_API_URL || "http://localhost:8000"
export const PARSER_KEY = process.env.PARSER_API_KEY || "freshauto_secret_2024"

// Minimum turnkey budget (EUR). Searches below this are rejected, and no-budget
// searches still enforce it as a floor (Fresh Auto deals only in cars ≥ this).
export const MIN_BUDGET = 20000
