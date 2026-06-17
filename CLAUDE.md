# Fresh Auto — Site (Next.js)

Customer-facing car-import storefront + AI car picker. Talks to the separate
**parser** service (see `../../parser-main/CLAUDE.md`) for live listings.

## Stack

- **Next.js 16** App Router + Turbopack, **React 19** (react-compiler on)
- **Supabase** — auth (`@supabase/ssr`) + Postgres (profiles, orders, saved_cars, leads)
- **Tailwind v4** + Radix UI primitives (`components/ui/`)
- **Anthropic Claude API** — direct `fetch` (no SDK). Models differ per route:
  - chat/extract/comment (`lib/picker/claude.ts`): `claude-sonnet-4-6`
  - suggestions (`api/ai-picker/suggest/route.ts`): `claude-sonnet-4-6`
  - fast classifier (`api/ai-picker/search/route.ts`): `claude-haiku-4-5-20251001`

## The AI picker — the heart of the app

`app/api/ai-picker/route.ts` (~2k lines). One `POST` with two modes:

| Mode | Trigger | Does |
|------|---------|------|
| **Search** | `triggerSearch: true` | merge survey + chat prefs → `triggerParser()` → parser `/search/instant` → expert comment |
| **Chat** | otherwise | `extractFromChat()` conversational turn, cumulative preference extraction |

- Model call: `callClaude()` — `claude-sonnet-4-6`, system prompt wrapped in a
  `cache_control: ephemeral` block (~90% input savings on repeat calls within 5min),
  hard **15s `AbortController` timeout**, history trimmed to last 12 messages.
- Errors never throw to the client — they log via `lib/logger` and return `""`.

## Pricing: turnkey vs raw EU (critical, easy to get wrong)

- The **user always thinks in "під ключ" (turnkey)** = final UA price incl.
  duty + excise + VAT + delivery. The whole UI quotes turnkey.
- The **parser filters by raw EU source price.** So before calling the parser,
  budgets are reverse-converted: `euPriceFromTurnkey()` in `lib/constants.ts`
  (`eu ≈ (turnkey - fixed_fees) / 1.38`). Forward conversion: `calcTotalCost()`.
- `MIN_BUDGET = 20000` EUR turnkey — searches below are rejected.
- When generating comments, prices passed to Claude are **already turnkey** — the
  prompt forbids converting back to EU.

## Brand/model normalization (mirror of parser-side bugs)

- `normalizeBrand()` + `BRAND_ALIASES` — Cyrillic → canonical ("мерс" → "Mercedes-Benz").
- `stripGenerationSuffix()` — drops gen codes ("passat b9" → "passat", "x5 g05" → "x5")
  AND body suffixes ("Cooper 3 Door" → "Cooper"); **preserves** AMG/M/RS trims
  (e63, m5). AS24 slug map only has base models — gen suffixes return 0 results.
  Related: parser's `mercedes-model-matching` recurring bug.
- `_KNOWN` brand set in `extractFromChat` rejects hallucinated brands — **keep in
  sync** with `regexFallbackExtract`'s `KNOWN_BRANDS`, or exotic brands get dropped.

## Parser integration

- `triggerParser()` → `callParserInstant()` hits `PARSER_API_URL` `/search/instant`
  with `x-api-key: PARSER_API_KEY`. Up to **8 brand/model pairs in parallel**.
- **3-step fallback per pair** (never widens budget_max or returns out-of-budget cars):
  1. criteria as-is → 2. drop `budget_min` only → 3. drop year window (niche models only).

## Database (Supabase, `supabase/migration.sql`)

Tables: `profiles` (role-based), `orders`, `order_notes`, `saved_cars`, `leads`.
RLS everywhere; admin/manager access via `public.is_admin_or_manager()`.
Server routes use `SUPABASE_SERVICE_KEY` (bypasses RLS) — never expose client-side.

## API routes

`ai-picker`, `cars/order`, `orders`, `saved-cars`, `auth/callback`,
`log/client-error`, `admin/{logs,stats,orders/[id]/{assign,status}}`.

## Env vars

`ANTHROPIC_API_KEY`, `PARSER_API_URL`, `PARSER_API_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`.

## Conventions

- Rate limit: `lib/rate-limit.ts`, 30 req/min/IP on ai-picker (Anthropic caps 50/min).
- Logging: `lib/logger` — `logError()` / `logSearchEvent()` append JSON-lines to
  `../.logs/{site-errors,search-events}.jsonl` (NOT Supabase). `api/admin/logs`
  tails that file. ⚠️ Disk is ephemeral on Vercel — these logs do not persist in
  prod across invocations; the durable analytics path is the `picker_events`
  Supabase table (written by `api/ai-picker/event`, read by `api/admin/picker-metrics`).
  Never `console.log`.
- Verify changes: `timeout 60 npx tsc --noEmit` before considering a TS change done.
- Heavy `lib` modules are dynamically `import()`ed inside handlers to keep cold start lean.
