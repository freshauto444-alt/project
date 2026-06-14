/**
 * T11 prototype — compare the current "forward" picker (AI suggests models from
 * market knowledge, real menu is only a hint) against the proposed "inverted"
 * picker (AI ranks the best models FROM the real parse-history pool only).
 *
 * It does NOT touch the app. It pulls the real pool from `cars`, runs both
 * prompts on a few client scenarios, and prints — per scenario — what each
 * approach picks, plus the key quality metric: grounded-rate (how many of the 3
 * picks actually exist in our real inventory) and price-vs-pool-median accuracy.
 *
 * Run (on a machine with network + creds):
 *   cd cars_site/project-main
 *   node scripts/t11-prototype.mjs                # both modes, all scenarios
 *   node scripts/t11-prototype.mjs inverted       # one mode
 *
 * Needs in env (.env.local / .env / ../../parser-main/.env are auto-loaded):
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY
 */
import { createClient } from "@supabase/supabase-js"
import fs from "node:fs"

// ── env ───────────────────────────────────────────────────────────────────────
for (const f of [".env.local", ".env", "../../parser-main/.env"]) {
  try {
    for (const line of fs.readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch {}
}
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_KEY
const AI_KEY = process.env.ANTHROPIC_API_KEY
if (!SB_URL || !SB_KEY || !AI_KEY) {
  console.error("Missing env: need SUPABASE url+service key + ANTHROPIC_API_KEY"); process.exit(1)
}

// ── baseModelName (mirror of app/api/ai-picker/suggest/route.ts) ───────────────
function baseModelName(make, model) {
  const m = (model || "").trim(); if (!m) return model
  const mk = make.toLowerCase()
  if (mk.includes("mercedes")) {
    const cls = m.match(/^(glc|gle|gls|gla|glb|glk|eqa|eqb|eqc|eqe|eqs|cla|cls|amg ?gt|maybach)/i)
    if (cls) return cls[1].replace(/\s+/g, " ").toUpperCase()
    const single = m.match(/^([abcegsv])[\s-]?\d{2,3}/i); if (single) return single[1].toUpperCase() + "-Class"
  }
  if (mk.includes("bmw")) {
    const special = m.match(/^(x\d|z\d|i\d|ix|m\d(?!\d))/i); if (special) return special[1].toUpperCase()
    const series = m.match(/^(\d)\s*series\b/i) || m.match(/^(\d)\d{2}(?!\d)/); if (series) return series[1] + " Series"
  }
  const trim = m.match(/^(cayenne|macan|panamera|cayman|boxster|taycan|tiguan|touareg|passat|golf|octavia|superb|kodiaq|xc60|xc90|s60|s90|v60|v90)\b/i)
  if (trim) return trim[1][0].toUpperCase() + trim[1].slice(1).toLowerCase()
  const code = m.match(/^(rs ?q?\d|sq\d|s\d|rs\d|q\d|x\d|[a-z]{1,2}\d{1,3})/i)
  if (code) return code[1].replace(/\s+/g, " ").toUpperCase()
  const SPEC = /^(t-?gdi|tdi|tfsi|tsi|hdi|dci|cdi|gdi|crdi|bluetec|bluehdi|ecoboost|awd|fwd|rwd|4wd|4matic|xdrive|quattro|hybrid|phev|mhev)$/i
  const toks = m.replace(/\b\d\.\d[a-z]?\b/gi, " ").replace(/\b\d{2,4}\b/g, " ").trim().split(/\s+/).filter(Boolean)
  const out = []; for (const w of toks) { if (SPEC.test(w)) break; out.push(w); if (out.length === 2) break }
  const base = (out.join(" ") || toks[0] || "").trim()
  return base ? base.replace(/\b\w/g, c => c.toUpperCase()) : m
}
function normMake(make) {
  const m = (make || "").toLowerCase().trim()
  const a = { "mercedes": "mercedes-benz", "mercedes benz": "mercedes-benz", "merc": "mercedes-benz", "vw": "volkswagen", "landrover": "land rover", "range rover": "land rover", "alfa": "alfa romeo", "chevy": "chevrolet" }
  return a[m] ?? m
}
function gkey(make, model) { // mirrors Fix A: strip a duplicated leading make
  let m = (model || "").trim()
  const mkWords = (make || "").toLowerCase().split(/[\s-]+/).filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  if (mkWords.length) { const re = new RegExp(`^(?:(?:${mkWords.join("|")})[\\s-]+)+`, "i"); m = m.replace(re, "").trim() || m }
  return `${normMake(make)}|${baseModelName(make, m).toLowerCase().trim()}`
}
const median = arr => { const s = [...arr].sort((a, b) => a - b); const mid = Math.floor(s.length / 2); const v = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2; return Math.round(v / 500) * 500 }

// ── pool builder (mirror of fetchInventoryContext) ────────────────────────────
const sb = createClient(SB_URL, SB_KEY)
async function buildPool(p) {
  let q = sb.from("cars").select("make, model, year, price, body_type, fuel").neq("status", "Sold").order("parsed_at", { ascending: false }).limit(1200)
  if (p.budget_min) q = q.gte("price", Math.round(p.budget_min / 1.38 - 4500))
  if (p.budget_max) q = q.lte("price", Math.round(p.budget_max / 1.38 - 3000))
  if (p.year_from) q = q.gte("year", p.year_from)
  if (p.fuel) q = q.ilike("fuel", `%${p.fuel}%`)
  const bodies = p.body_type ? [p.body_type] : (p.purpose_body_types ?? [])
  if (bodies.length > 0) { // mirrors Fix B: include Unknown/NULL body
    const ors = bodies.map(b => `body_type.ilike.%${b}%`); ors.push("body_type.is.null", "body_type.eq.Unknown")
    q = q.or(ors.join(","))
  }
  const { data } = await q
  if (!data?.length) return { text: "", keys: new Set(), lines: [] }
  const g = new Map()
  for (const c of data) {
    const k = `${c.make} ${baseModelName(c.make, c.model)}`
    const e = g.get(k) ?? { make: c.make, years: [], prices: [], body: c.body_type ?? "", n: 0, gk: gkey(c.make, c.model) }
    e.n++; if (c.year) e.years.push(+c.year); if (c.price) e.prices.push(+c.price); g.set(k, e)
  }
  const ranked = [...g.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 25)
  const lines = ranked.map(([name, e]) => {
    const yr = e.years.length ? `${Math.min(...e.years)}-${Math.max(...e.years)}` : "?"
    const tk = e.prices.map(x => Math.round(x * 1.38 + 4500))
    const pr = tk.length ? `медіана €${median(tk).toLocaleString()} (€${Math.min(...tk).toLocaleString()}-€${Math.max(...tk).toLocaleString()})` : "?"
    return `• ${name} — ${e.n} шт, ${yr}, ${pr}${e.body ? ", " + e.body : ""}`
  })
  return { text: lines.join("\n"), keys: new Set([...g.values()].map(v => v.gk)), lines }
}

// ── Claude ────────────────────────────────────────────────────────────────────
async function callClaude(system, user) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": AI_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, temperature: 1, system, messages: [{ role: "user", content: user }] }),
  })
  const d = await r.json()
  const text = d?.content?.[0]?.text ?? ""
  try { const m = text.replace(/```json|```/gi, "").match(/\[[\s\S]*\]/); return m ? JSON.parse(m[0]) : [] } catch { return [] }
}

const OUT = `Поверни ТІЛЬКИ JSON-масив із 3 обʼєктів: {"make","model_display","yearRange","priceRange","whyRecommended"}. priceRange — turnkey EUR "min-max".`
const FORWARD_SYS = `Ти автоексперт Fresh Auto (імпорт з ЄС). Запропонуй клієнту 3 моделі під його запит, спираючись на свої знання ринку Німеччини/Швеції. Реальне меню наявних авто — лише ОРІЄНТИР. ${OUT}`
const INVERTED_SYS = `Ти автоексперт Fresh Auto. Тобі дано РЕАЛЬНИЙ ПУЛ фактично наявних зараз авто (спарсені з ринку ЄС). Обери й відранжуй НАЙКРАЩІ 3 моделі ВИКЛЮЧНО З ЦЬОГО ПУЛУ під клієнта (враховуй ціль, бюджет, надійність, ліквідність, співвідношення ціна/якість). Бери ціни/роки з пулу. Виходь за межі пулу ЛИШЕ якщо він порожній. ${OUT}`

const SCENARIOS = [
  { label: "SUV до 50k", prefs: { body_type: "SUV", budget_max: 50000 }, desc: "Кузов: SUV. Бюджет під ключ: до 50000 EUR." },
  { label: "Спортивне до 60k", prefs: { budget_max: 60000 }, desc: "Вільний опис: 'хочу спортивне драйверське авто'. Бюджет під ключ: до 60000 EUR." },
  { label: "Сімейне дизель до 40k", prefs: { fuel: "Diesel", purpose_body_types: ["SUV", "Van", "Estate"], budget_max: 40000 }, desc: "Ціль: сімейне. Паливо: дизель. Бюджет під ключ: до 40000 EUR." },
  { label: "Бізнес-седан до 55k", prefs: { body_type: "Sedan", budget_max: 55000 }, desc: "Кузов: седан, бізнес-клас. Бюджет під ключ: до 55000 EUR." },
]

function poolMedian(lines, make, model) {
  const want = `${normMake(make)}|${baseModelName(make, model).toLowerCase().trim()}`
  for (const l of lines) {
    const m = l.match(/^• (.+?) — .*медіана €([\d, ]+)/)
    if (!m) continue
    const [mk, ...rest] = m[1].split(" ")
    if (gkey(mk, rest.join(" ")) === want) return parseInt(m[2].replace(/[^\d]/g, ""))
  }
  return null
}

async function runScenario(s, modes) {
  const pool = await buildPool(s.prefs)
  console.log(`\n${"═".repeat(72)}\n▶ ${s.label}  — пул: ${pool.keys.size} моделей`)
  console.log("  топ пулу: " + pool.lines.slice(0, 6).map(l => l.replace(/^• /, "").split(" — ")[0]).join(" · "))
  for (const mode of modes) {
    const sys = mode === "inverted" ? INVERTED_SYS : FORWARD_SYS
    const user = `Параметри клієнта: ${s.desc}\n\nРЕАЛЬНИЙ ПУЛ (наявно зараз):\n${pool.text || "(порожньо)"}`
    const picks = await callClaude(sys, user)
    let grounded = 0
    const rows = picks.slice(0, 3).map(p => {
      const inPool = pool.keys.has(gkey(p.make ?? "", p.model_display ?? p.model ?? ""))
      if (inPool) grounded++
      const pm = poolMedian(pool.lines, p.make ?? "", p.model_display ?? p.model ?? "")
      const askMax = parseInt(String(p.priceRange ?? "").split("-")[1]?.replace(/[^\d]/g, "") || "0")
      const priceNote = pm ? `пул-медіана €${pm.toLocaleString()}${askMax ? `, AI каже до €${askMax.toLocaleString()}` : ""}` : "немає в пулі"
      return `      ${inPool ? "✅" : "❌"} ${p.make} ${p.model_display ?? p.model} (${p.yearRange ?? "?"}) — ${priceNote}`
    })
    console.log(`  ${mode === "inverted" ? "INVERTED" : "FORWARD "}: grounded ${grounded}/${picks.slice(0, 3).length}`)
    rows.forEach(r => console.log(r))
  }
}

const arg = process.argv[2]
const modes = arg === "inverted" ? ["inverted"] : arg === "forward" ? ["forward"] : ["forward", "inverted"]
console.log(`T11 prototype — modes: ${modes.join(", ")}\n(grounded ✅ = модель реально є в нашому пулі наявних авто)`)
for (const s of SCENARIOS) { try { await runScenario(s, modes) } catch (e) { console.error(`  ${s.label}: ${e.message}`) } }
console.log(`\n${"═".repeat(72)}\nГотово. Дивись grounded-rate: inverted має бути ~3/3, forward — нижче (вигадані/відсутні моделі).`)
