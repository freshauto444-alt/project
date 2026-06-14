import { createClient } from "@supabase/supabase-js"

// Multi-suggestion Claude generation can take 15-25s; lift past Vercel default.
export const maxDuration = 60

// ═══════════════════════════════════════════════════════════════════════════════
//  AI Car Suggestion Endpoint — Streaming SSE
//
//  Returns a text/event-stream with events:
//    { type: "suggestion", suggestion: CarSuggestion }  — one per suggestion
//    { type: "done" }                                    — stream complete
//    { type: "fallback", fallback: "ai_unavailable", message: string }
//    { type: "error", message: string }
// ═══════════════════════════════════════════════════════════════════════════════

interface SuggestRequest {
  preferences: {
    fuel?: string | null
    body_type?: string | null
    budget_min?: number | null
    budget_max?: number | null
    year_from?: number | null
    year_to?: number | null
    transmission?: string | null
    drive?: string | null
    hp_min?: number | null
    seats_min?: number | null
    displacement_min?: number | null
    displacement_max?: number | null
    mileage_min?: number | null
    mileage_max?: number | null
    doors?: number | null
    color?: string | null
    interior_material?: string | null
    purpose_body_types?: string[]
    pairs?: { make: string | null; model: string | null }[]
  }
  answers?: { questionId: string; selected: string[]; custom: string }[]
  conversationHistory?: { role: string; content: string }[]
  freeText?: string
}

// ── Inventory context: query Supabase before Claude call ──────────────────────
// Gives Claude real data about what's available in stock so suggestions are
// grounded in actual inventory rather than Claude's general knowledge.

async function fetchInventoryContext(prefs: SuggestRequest["preferences"]): Promise<string> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    )

    let query = supabase
      .from("cars")
      .select("make, model, year, price, body_type, fuel, transmission")
      .eq("status", "In Stock")
      .limit(40)

    if (prefs.budget_min) query = query.gte("price", Math.round(prefs.budget_min / 1.38 - 4500))
    if (prefs.budget_max) query = query.lte("price", Math.round(prefs.budget_max / 1.38 - 3000))
    if (prefs.year_from)  query = query.gte("year", prefs.year_from)
    if (prefs.year_to)    query = query.lte("year", prefs.year_to)
    if (prefs.fuel)       query = query.ilike("fuel", `%${prefs.fuel}%`)

    const { data } = await query
    if (!data || data.length === 0) return ""

    // Summarise: group by make+model, show year range and price range
    const grouped = new Map<string, { years: number[]; prices: number[]; body: string }>()
    for (const c of data) {
      const key = `${c.make} ${c.model}`
      const entry = grouped.get(key) ?? { years: [] as number[], prices: [] as number[], body: c.body_type ?? "" }
      if (c.year)  entry.years.push(Number(c.year))
      if (c.price) entry.prices.push(Number(c.price))
      grouped.set(key, entry)
    }

    const lines: string[] = []
    for (const [name, { years, prices, body }] of grouped) {
      const yearStr = years.length
        ? `${Math.min(...years)}-${Math.max(...years)}`
        : "?"
      const priceStr = prices.length
        ? `€${Math.min(...prices).toLocaleString()}-€${Math.max(...prices).toLocaleString()} EU`
        : "?"
      lines.push(`• ${name} (${yearStr}, ${priceStr}${body ? ", " + body : ""})`)
    }

    return `НАЯВНІСТЬ У СТОЦІ (реальні авто, що зараз є):\n${lines.join("\n")}`
  } catch {
    return ""
  }
}

// ── Streaming JSON suggestion parser ─────────────────────────────────────────
// Parses complete JSON objects from a streaming buffer like "[{...},{...},..."
// Returns completed objects and the remaining unparsed buffer.

function extractCompleteSuggestions(
  text: string,
): { complete: any[]; remaining: string } {
  const complete: any[] = []
  let t = text.trim()
  if (t.startsWith("[")) t = t.slice(1)

  while (true) {
    t = t.trim()
    if (!t || t.startsWith("]")) break
    if (t.startsWith(",")) { t = t.slice(1).trim(); continue }
    if (!t.startsWith("{")) break

    // Find end of this JSON object (respecting nested structures and strings)
    let depth = 0
    let end = -1
    let inString = false
    let escape = false

    for (let i = 0; i < t.length; i++) {
      const c = t[i]
      if (escape) { escape = false; continue }
      if (c === "\\") { escape = true; continue }
      if (c === '"') { inString = !inString; continue }
      if (inString) continue
      if (c === "{") depth++
      else if (c === "}") {
        depth--
        if (depth === 0) { end = i; break }
      }
    }

    if (end === -1) break // object not yet complete

    try {
      complete.push(JSON.parse(t.slice(0, end + 1)))
      t = t.slice(end + 1)
    } catch {
      break
    }
  }

  return { complete, remaining: t }
}

// ── Map raw Claude suggestion → normalized CarSuggestion ─────────────────────

// Year a brand actually started selling in the EUROPEAN market. We import from
// the EU, so a brand/model that didn't exist there yields 0 parser results no
// matter what the AI claims.
const EU_LAUNCH_YEAR: Record<string, number> = {
  genesis: 2021,
  polestar: 2020,
  byd: 2023,
  nio: 2022,
}

// Deterministic safety net (prompt isn't 100% reliable): drop a mapped
// suggestion that can never parse — an inverted/empty year range, or a brand
// whose EU availability doesn't reach the requested upper year.
function isUsableSuggestion(s: any): boolean {
  const sp = s?.searchParams ?? {}
  const yf = typeof sp.year_from === "number" ? sp.year_from : null
  const yt = typeof sp.year_to === "number" ? sp.year_to : null
  if (yf != null && yt != null && yf > yt) return false // inverted/empty range
  const launch = EU_LAUNCH_YEAR[String(sp.make ?? s?.make ?? "").toLowerCase()]
  if (launch != null && yt != null && yt < launch) return false // brand not in EU for those years
  return true
}

function mapRawSuggestion(
  raw: any,
  prefs: SuggestRequest["preferences"],
): object {
  let modelDisplay: string = raw.model_display ?? raw.model ?? ""
  const make: string = raw.make ?? ""
  if (modelDisplay.toLowerCase().startsWith(make.toLowerCase())) {
    modelDisplay = modelDisplay.slice(make.length).trim()
  }

  const parseYearRange = (s: string) => {
    const parts = String(s ?? "").split("-")
    return {
      from: (() => { const v = parseInt(parts[0]?.replace(/\D/g, "")); return !isNaN(v) && v > 1990 ? v : null })(),
      to:   (() => { const v = parseInt(parts[1]?.replace(/\D/g, "") ?? ""); return !isNaN(v) && v > 1990 ? v : null })(),
    }
  }
  const parsePriceRange = (s: string) => {
    const parts = String(s ?? "").split("-")
    return {
      min: (() => { const v = parseInt(parts[0]?.replace(/\D/g, "")); return !isNaN(v) && v > 0 ? v : null })(),
      max: (() => { const v = parseInt(parts[1]?.replace(/\D/g, "") ?? ""); return !isNaN(v) && v > 0 ? v : null })(),
    }
  }

  const yr = parseYearRange(raw.yearRange ?? "")
  const pr = parsePriceRange(raw.priceRange ?? "")

  // Normalize new honesty fields (from updated system prompt).
  // budgetFit: "fits" | "tight" | "over" — visual badge on the suggestion card.
  // overBy: EUR amount over user's budget (only meaningful when budgetFit="over").
  // feasibilityWarning: explanation when user's constraints are unsatisfiable.
  const budgetFit: "fits" | "tight" | "over" =
    raw.budgetFit === "over" ? "over"
    : raw.budgetFit === "tight" ? "tight"
    : "fits"
  const overBy = typeof raw.overBy === "number" && raw.overBy > 0 ? Math.round(raw.overBy) : 0
  const feasibilityWarning = typeof raw.feasibilityWarning === "string" && raw.feasibilityWarning.trim()
    ? raw.feasibilityWarning.trim()
    : null

  return {
    make,
    model: modelDisplay,
    yearRange: raw.yearRange ?? "",
    priceRange: raw.priceRange ?? "",
    whyRecommended: raw.whyRecommended ?? "",
    concerns: raw.concerns ?? "",
    budgetFit,
    overBy,
    feasibilityWarning,
    searchParams: {
      make,
      model: raw.model_search ?? raw.model ?? "",
      year_from:  yr.from ?? prefs.year_from ?? 2018,
      year_to:    yr.to   ?? prefs.year_to   ?? undefined,
      budget_min: pr.min  ?? prefs.budget_min ?? 20000,
      budget_max: pr.max  ?? prefs.budget_max ?? undefined,
      fuel:         prefs.fuel         || undefined,
      transmission: prefs.transmission || undefined,
      body_type:    prefs.body_type    || undefined,
      drive:        prefs.drive        || undefined,
    },
  }
}

// ── SSE helpers ───────────────────────────────────────────────────────────────

function sseEvent(encoder: TextEncoder, payload: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
}

// ── Main POST handler ─────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const { tryAcquire, clientKey } = await import("@/lib/rate-limit")
  const rl = tryAcquire(`ai-suggest:${clientKey(req)}`, 15)
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ type: "error", message: "Забагато запитів. Спробуйте через кілька секунд." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(rl.resetIn) } },
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(sseEvent(encoder, { type: "fallback", fallback: "ai_unavailable", message: "AI недоступний." }))
        c.close()
      },
    })
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } })
  }

  let body: SuggestRequest
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ type: "error", message: "Невалідний запит." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }

  const prefs = body.preferences ?? {}

  // ── Build user-facing preferences description ─────────────────────────────
  const prefsDesc: string[] = []
  if (prefs.budget_min || prefs.budget_max) {
    prefsDesc.push(
      `Бюджет клієнта ПІД КЛЮЧ: ${prefs.budget_min ?? "?"} - ${prefs.budget_max ?? "?"} EUR ` +
      `(фінальна ціна в Україні з митом, доставкою, реєстрацією). ` +
      `ВСІ пропозиції МУСЯТЬ вміщуватись у цей бюджет — priceRange в turnkey.`,
    )
  }
  if (prefs.fuel)         prefsDesc.push(`Паливо: ${prefs.fuel}`)
  if (prefs.body_type) {
    // Body types form has TWO distinct pickup-ish options that map to different
    // markets: "Пікап" → Pickup (personal pickups: Ranger, F-150, Hilux, Amarok)
    // and "Вантажівка" → Truck (commercial freight: Sprinter, Iveco Daily,
    // MAN TGE, Renault Master). The AI must respect this distinction or it
    // suggests a Ranger to someone who picked Truck and the strict parser
    // filter (pickup ≠ truck) drops every car. Spell out the rule explicitly.
    let bodyHint = `Кузов: ${prefs.body_type}`
    if (prefs.body_type === "Truck") {
      bodyHint += ` — це КОМЕРЦІЙНІ вантажівки/фургони (Sprinter, Iveco Daily, MAN TGE, Renault Master, VW Crafter, Ford Transit). НЕ пропонуй пікапи (Ranger, F-150, Hilux, Amarok) — у клієнта окремо є опція "Пікап".`
    } else if (prefs.body_type === "Pickup") {
      bodyHint += ` — це особисті пікапи (Ranger, F-150, Hilux, Amarok, Navara, L200). НЕ пропонуй комерційні фургони (Sprinter, Transit, Iveco) — у клієнта окремо є опція "Вантажівка".`
    }
    prefsDesc.push(bodyHint)
  }
  if (prefs.year_from)    prefsDesc.push(`Рік від: ${prefs.year_from}`)
  if (prefs.year_to)      prefsDesc.push(`Рік до: ${prefs.year_to}`)
  if (prefs.transmission) prefsDesc.push(`КПП: ${prefs.transmission}`)
  if (prefs.drive)        prefsDesc.push(`Привід: ${prefs.drive}`)
  if (prefs.hp_min)       prefsDesc.push(`Мін. к.с.: ${prefs.hp_min}`)
  if (prefs.seats_min)    prefsDesc.push(`Мін. місць: ${prefs.seats_min}`)
  if (prefs.displacement_min) prefsDesc.push(`Об'єм від: ${prefs.displacement_min}л`)
  if (prefs.purpose_body_types?.length) prefsDesc.push(`Ціль (кузови): ${prefs.purpose_body_types.join(", ")}`)
  if (prefs.pairs?.length) {
    const validPairs = prefs.pairs.filter(p => p.make)
    const pairsDesc = validPairs.map(p => `${p.make}${p.model ? " " + p.model : ""}`).join(", ")
    if (pairsDesc) {
      prefsDesc.push(
        `КЛІЄНТ ЯВНО ОБРАВ ЦІ МОДЕЛІ — ВОНИ МУСЯТЬ БУТИ В ПРОПОЗИЦІЯХ: ${pairsDesc}. ` +
        (validPairs.length === 1
          ? `Перша пропозиція = саме ${pairsDesc}. Дві інші — найближчі альтернативи того ж класу/сегменту.`
          : `Усі пропозиції — з цього списку.`),
      )
    }
  }

  const purposes = body.answers?.find(a => a.questionId === "purpose")?.selected ?? []
  if (purposes.length) prefsDesc.push(`Ціль: ${purposes.join(", ")}`)

  const systemPrompt = `Ти — старший менеджер Fresh Auto, 15+ років на ринку імпорту авто з Німеччини/Швеції/Нідерландів. Знаєш моделі 2015-2026: реальні комплектації двигунів, які об'єми/палива доступні на якому поколінні, типові ринкові ціни, надійність.

═══ АБСОЛЮТНІ ПРАВИЛА ЧЕСНОСТІ (НІКОЛИ не порушуй) ═══

1. **ВИКОРИСТОВУЙ СВОЇ ЗНАННЯ ПРО РЕАЛЬНИЙ РИНОК:**
   Ти знаєш типові ціни на autoscout24/mobile.de для кожної моделі та року з власних тренувальних даних. Користуйся ними напряму.

   priceRange = реальний turnkey-діапазон для типового стану (медіана ринку): нижня межа = типовий floor авто з нормальним пробігом, верхня межа = типовий well-equipped варіант. Формула: turnkey = EU × 1.38 + €4500.

   НЕ занижуй ціни щоб вписатись у бюджет клієнта. Краще чесно показати реальний діапазон і дати клієнту вирішити.

2. **budgetFit ВИКОРИСТОВУЙ ТІЛЬКИ КОЛИ КЛІЄНТ ВКАЗАВ БЮДЖЕТ:**
   • Бюджет не вказаний клієнтом → завжди budgetFit:"fits", overBy:0, feasibilityWarning:null. Ніяких "над бюджетом" — нема з чим порівнювати.
   • Бюджет вказаний і реальний priceRange.min > user.budget_max → budgetFit:"over", overBy=(priceRange.min - user.budget_max), feasibilityWarning пояснює різницю та пропонує альтернативи.
   • Бюджет вказаний і priceRange.max в межах user.budget_max ±10% → "tight".
   • Інакше → "fits".

2. **НЕ ВИГАДУВАТИ КОМПЛЕКТАЦІЇ — ДВИГУН ЦЕ HARD CONSTRAINT.** Якщо клієнт указав displacement_min, ПЕРЕД генерацією кожної пропозиції перевір чи реально існує мотор цього об'єму у цій моделі у вказаних роках. Якщо НЕ існує — НЕ ПРОПОНУЙ.

   **Якщо клієнт хоче ≥3.0 літра:**
   • Volvo — ВСЯ модельна лінійка з 2014 максимум 2.0 (Drive-E platform). НЕ пропонуй жодну Volvo для 3.0L+ запиту.
   • Mazda — після 2018 тільки 2.0/2.5 SkyActiv. CX-60 має 3.3 PHEV (один варіант).
   • Mercedes — є 3.0 (E 400d, S 400d, GLE 400d, AMG GT, S 580). C-Klasse після 2021 тільки 2.0.
   • BMW — є 3.0 (30d, 40d, 40i, M340i, M40i, X5/X6/X7 40i, M3, M5 — V8 у поточному, S58 турбо у М3/M4).
   • Audi — є 3.0 TDI/TFSI (Q5/Q7/Q8/A6/A7/A8 40/50/55 TDI, SQ7/SQ8). RS варіанти 4.0 V8 biturbo.
   • Porsche — 3.0+ скрізь (Macan S/GTS, Cayenne S/GTS, Panamera 4S, 911).
   • Toyota — Land Cruiser 3.5 V6, Hilux 2.8 (макс — не 3.0).
   • Lexus — RX/LX/LS 3.5 V6 / 5.0 V8.
   • Land Rover/Range Rover — 3.0 D300/I6, 4.4 V8.

   **Якщо клієнт хоче 2.0-3.0:** більшість виробників мають варіанти.

   Краще чесно вкажи у feasibilityWarning що такого варіанта не існує і запропонуй або іншу марку, або послабити фільтр об'єму.

3. **НЕ ПІДБИРАТИ ПІД ПАРАМЕТРИ ЯКЩО НЕРЕАЛЬНО.** Якщо параметри клієнта неможливо задовольнити (наприклад, "Porsche 718 Cayman до €23k turnkey" — реально €55k+), не вигадуй модель щоб обманом вкластись. Поверни feasibilityWarning у першій пропозиції.

═══ ФОРМАТ ВИВОДУ ═══

Поля кожної пропозиції:
- make, model_display, model_search, yearRange, priceRange (ТУRNKEY EUR), whyRecommended, concerns, confidence
- **budgetFit**: "fits" | "tight" | "over"
  • "fits" — реальна turnkey-ціна на ≥10% нижче верхньої межі бюджету
  • "tight" — на межі (в межах ±10% бюджету)
  • "over" — реальна ціна перевищує бюджет
- **overBy** (EUR, 0 якщо не "over"): на скільки реальна turnkey-ціна перевищує бюджет клієнта
- **feasibilityWarning** (string | null): попередження якщо параметри клієнта не реалістичні. Якщо все OK → null. Якщо проблема (об'єм/паливо/комплектація не існує, бюджет надто низький) → коротке пояснення (1-2 речення).

═══ ОБОВ'ЯЗКОВІ ПРАВИЛА ═══

A. Ціни ТІЛЬКИ в EUR і ТІЛЬКИ "під ключ". Формула: turnkey = EU × 1.38 + 4500.
B. РІВНО 3 моделі, мінімум 2 різні марки.
C. model_display БЕЗ префіксу марки. Правильно: "3 Series Touring", не "BMW 3 Series Touring".
D. У whyRecommended ціни завжди як "€X під ключ".
E. Якщо є дані про наявність у стоці — пріоритизуй моделі, які там є.

═══ СТРАТЕГІЯ ВИБОРУ ПРОПОЗИЦІЙ ═══

• Якщо параметри РЕАЛІСТИЧНІ і бюджет вкладається — 3 моделі що ВСІ "fits"/"tight", без "over".
• Якщо клієнт назвав КОНКРЕТНУ марку+модель але бюджет недостатній — перша пропозиція = саме та модель з ЧЕСНОЮ ціною і budgetFit:"over" + overBy. Інші 2 = реальні альтернативи в бюджеті ("fits").
• Якщо параметри НЕРЕАЛІСТИЧНІ (не існує комбінації об'єму/палива/моделі/року) — перша пропозиція = найближча реальна альтернатива з feasibilityWarning що пояснює проблему. Інші 2 = додаткові реальні варіанти.

КЛЮЧОВИЙ ПРИНЦИП: ТРИМАЙСЯ ВИБІРКИ З РЕАЛЬНИМИ ВАРІАНТАМИ.
Не пропонуй "Mercedes E-Class 2018-2020 за €50-55k" якщо знаєш що в Європі ринок цих років в цьому бюджеті — 0-2 авто.

═══ СПОРТИВНИЙ ЗАПИТ — ТІЛЬКИ СПРАВЖНІЙ СПОРТ + ВІДПОВІДНИЙ КЛАС БЮДЖЕТУ ═══

Якщо клієнт хоче СПОРТИВНЕ/драйверське авто (слова "спортивне", "sporty", "драйв", "потужне", ціль "спорт") — пропонуй ТІЛЬКИ реально перформанс-моделі, НЕ базові/комфортні версії:
• Перформанс-лінійки: Audi S/RS (S3/S4/S5/RS3), BMW M/M-Performance (M2/M240i/M340i/M3/M4), Mercedes-AMG (A35/A45/C43/CLA45), VW Golf GTI/R, Hyundai N (i30 N/i20 N), Cupra (Leon/Formentor), Honda Type R, Toyota GR (Supra/GR86/Yaris), Porsche (Cayman/Boxster/718), Ford ST/RS, Renault RS.
• НЕ пропонуй базову некомплектну версію як «спортивну» (звичайний Hyundai i30, базовий Golf, A3 1.0 — це НЕ спорт). Базовий хетч ≠ спорт.

ВІДПОВІДНІСТЬ БЮДЖЕТУ: підбирай авто, що ВИКОРИСТОВУЄ бюджет, а не сильно дешевше. Для спорт-бюджету €45k не пропонуй €30k хот-хетч (i30 N), коли в цей бюджет реально вкладаються сильніші: Audi S4/S5, BMW M240i/M340i, Porsche Cayman (базовий 2.0 718), Toyota Supra, Golf R, AMG A45/CLA45, Audi TTS. Дешевший варіант доречний ЛИШЕ якщо клієнт явно просив зекономити.

═══ yearRange = РОКИ МОДЕЛЬНОГО ПОКОЛІННЯ ═══

yearRange має відповідати РЕАЛЬНИМ рокам конкретного покоління моделі (ти знаєш межі поколінь з тренувальних даних), а не "до якого року вписується бюджет".

Алгоритм:
1. Визнач покоління моделі, яке найкраще підходить запиту.
2. yearRange = перетин меж покоління з обмеженнями клієнта:
   • yearFrom = max(generation.start, user.year_from)
   • yearTo = min(generation.end, user.year_to)
3. НЕ ЗМІШУЙ два покоління в одному yearRange (наприклад "2017-2022" для BMW 3 Series міксує F30 і G20 — невірно). yearRange має лежати в межах ОДНОГО покоління.

Приклади:
• Skoda Octavia A7 (2013-2020): клієнт без year-обмежень → "2013-2020". Клієнт year_from=2015 → "2015-2020".
• BMW 3 Series F30 (2012-2019): клієнт year_to=2017 → "2012-2017". Клієнт year_from=2014 → "2014-2019".
• Audi A6 C8 (2018-2026): клієнт без обмежень → "2018-2026". Клієнт year_from=2020 → "2020-2026".
• Volvo XC90 II (2015-2026): без обмежень → "2015-2026".

ВИБІР ПОКОЛІННЯ коли модель має кілька актуальних:
• Клієнт year_from=2018, а є і Audi A6 C7 (2011-2018), і C8 (2018-2026) → бери C8 (новіше тяжіння при year_from).
• Клієнт year_to=2015 → бери старіше покоління.
• Клієнт без year-обмежень → бери покоління що ВКЛАДАЄТЬСЯ у бюджет (для €30k turnkey преміуму F30 реальніше за G20).

═══ ДОСТУПНІСТЬ НА ЄВРОПЕЙСЬКОМУ РИНКУ (КРИТИЧНО — інакше парсер знайде 0) ═══

Модель і yearRange мають існувати на ЄВРОПЕЙСЬКОМУ вторинному ринку у вказані роки — НЕ глобально (US/Korea/Asia не рахуються, ми возимо з ЄС). Деякі марки вийшли в Європу пізно:
• Genesis — продається в Європі ЛИШЕ з ~2021 (G80/G70/GV70/GV80). G80 2016-2020 існує в Кореї/США, але НЕ в ЄС.
• Інші «молоді в ЄС» бренди (BYD, Nio, відроджений MG, Polestar з 2020) — лише останні роки.

ЖОРСТКЕ ПРАВИЛО (перевизначає інструкцію «показати з feasibilityWarning»):
1. Якщо роки доступності марки в ЄС НЕ перетинаються з year-вікном клієнта — ПОВНІСТЮ ВИКИНЬ цю марку зі списку. НЕ показуй її навіть із попередженням. Заміни її іншою РЕАЛЬНОЮ альтернативою. (Genesis при year_to=2020 → взагалі не пропонуй Genesis, бо в ЄС його там 0.)
2. yearRange ЗАВЖДИ має бути валідним: yearFrom ≤ yearTo. НІКОЛИ не виводь інвертований діапазон типу "2021-2020" — якщо після застосування обмежень yearFrom вийшов більший за yearTo, діапазон ПОРОЖНІЙ → ця модель НЕ підходить → викинь її і візьми іншу.
Краще релевантна марка з реальними авто, ніж «правильна на папері», якої немає на ринку ЄС.

═══ ВАРІАТИВНІСТЬ — НЕ ПОВТОРЮЙ ТИПОВІ ПАРИ ═══

Канонічні «очевидні» пари по сегментах (їх легко вгадати з тренувальних даних):
• Молодіжне спортивне: Golf GTI + Civic Type R + Toyota GR86/Yaris
• Сімейне €30-40k: Skoda Octavia + VW Passat + Toyota Corolla
• Преміум €40-60k: BMW 5er + Mercedes E-Class + Audi A6
• SUV сімейне: Skoda Kodiaq + Hyundai Tucson + Toyota RAV4
• Compact €15-25k: Skoda Fabia + VW Polo + Hyundai i20
• Бізнес-седан: BMW 5er + Mercedes E + Audi A6 (та сама трійка для будь-якого «бізнес»)

ПРАВИЛО (жорстке): **МІНІМУМ 2 з 3 пропозицій мають бути НЕ-канонічними** для цього сегменту. Сінглова канонічна пропозиція — окей як «безпечний дефолт», але інші 2 — обов'язково з-поза очевидних.

Альтернативи замість канонічних (приклади заміни):
• замість Civic Type R → MINI JCW, Hyundai i30 N, Ford Focus ST, Renault Megane RS, Cupra Leon
• замість Skoda Octavia → Mazda 6, Volvo V40/V60, Kia Ceed/ProCeed, Seat Leon, Peugeot 508
• замість BMW 5er / Mercedes E → Volvo S90/V90, Lexus ES/IS, Kia Stinger, Genesis G70/G80 (ТІЛЬКИ для year ≥2021 — раніше в ЄС не продавався)
• замість Skoda Kodiaq → Mazda CX-5, Subaru Forester, Volvo XC60, Lexus NX, Ford Kuga
• замість VW Polo → Renault Clio, Mazda 2, Seat Ibiza, Peugeot 208

ВИБІР НЕ-канонічного варіанту обґрунтовуй конкретно (а не «теж непогана»): рідкісніший на ринку = менше падає в ціні; нижчий пробіг по сегменту; недооцінений за надійністю; нюанс комплектації що зустрічається саме тут.

ПЕРЕВІРКА ПЕРЕД ВИВОДОМ: коли вже згенерував 3 пропозиції — перерахуй, чи всі 3 НЕ з очевидної канонічної трійки. Якщо так — заміни одну на не-канонічну.

whyRecommended (РІВНО 2 короткі речення, ~25 слів кожне): одне про конкретну характеристику+перевагу, друге про репутацію (ADAC/Euro NCAP/J.D. Power) АБО ринок України.
concerns (1 коротке речення, мʼяко): загальний нюанс класу. Без сум ремонтів, без кодів моторів, без слів "проблема/ремонт/ризик".
model_search = назва моделі lowercase, БЕЗ префіксу марки, БЕЗ маркера покоління (B8, B9, F30, G20, W213, E46, C8 тощо — це КОДИ платформ, а не модель). Приклади: "Audi A7" → "a7"; "BMW 3 Series Touring" → "3er"; "Mercedes C-Class" → "c-klasse"; "Volvo V60" → "v60"; "VW Passat B9" → "passat"; "BMW X5 G05" → "x5". Підбирай ВИКЛЮЧНО код базової моделі — покоління визначається через yearRange.

КУЗОВНІ ВАРІАНТИ (3 Door, 5 Door, Estate, Touring, Avant, Sportback, Coupé, Convertible). НЕ пиши їх у model_search — це body_type, не модель:
• "MINI Cooper 3 Door" → model_search="cooper" (body_type обирається окремо як Hatchback)
• "MINI Cooper 5 Door" → model_search="cooper"
• "Audi A4 Avant" → model_search="a4"
• "BMW 3 Series Touring" → model_search="3er" (виняток: AS24 розрізняє Touring окремою категорією, проте slug "3er" повертає й Touring — фільтр body_type=Estate далі звузить)

ВИНЯТОК — ПЕРФОРМАНС-ВАРІАНТИ (AMG / M / RS / S-line / GT). Тут цифра після літери — це trim, не покоління. Зберігай повну назву:
• "Mercedes E63 AMG" → model_search="e 63" (НЕ "e-klasse" — клієнт хоче конкретно AMG-версію)
• "Mercedes C63 AMG" → model_search="c 63"
• "BMW M5" → model_search="m5"
• "BMW M3 Competition" → model_search="m3"
• "Audi RS6" → model_search="rs6"
• "Audi S3" → model_search="s3"
• "VW Golf R" → model_search="golf r"
Якщо клієнт назвав AMG/M/RS — пропонуй ці моделі з повним trim. Базовий клас (E-Klasse, 5er) — для не-перформанс запитів.

Поверни ТІЛЬКИ JSON-масив з РІВНО 3 об'єктами (без markdown, без тексту до/після):
[{"make":"BMW","model_display":"X5","model_search":"x5","yearRange":"2019-2020","priceRange":"44000-50000","whyRecommended":"...","concerns":"...","confidence":"high","budgetFit":"over","overBy":7000,"feasibilityWarning":null}]`

  const freeTextBlock = body.freeText?.trim()
    ? `\n\nВІЛЬНИЙ ОПИС КЛІЄНТА (ГОЛОВНЕ джерело — переважає над структурованими параметрами): "${body.freeText.trim()}"

ОБРОБКА ВІЛЬНОГО ОПИСУ:
• ЯКЩО клієнт назвав конкретну марку+модель (напр. "Audi A7", "BMW X5", "Volvo V60") — це ЖОРСТКА ВИМОГА. ПЕРША пропозиція = саме ця модель (підбери відповідне покоління/рік під бюджет). Інші 2 — найближчі альтернативи того ж класу (НЕ просто інші марки).
• ЯКЩО названа тільки марка (напр. "Audi") без моделі — всі 3 пропозиції = моделі цієї марки.
• Витягни з тексту: рік ("свіжа" = 2022-2025; "не старе" = 2020+), бюджет ("до 30к", "20-25"), кузов, об'єм, паливо, комплектацію.
• Слова на кшталт "свіжа/нова/freshe" = пріоритет на роки 2022-2025 у межах бюджету.`
    : ""

  // Fetch inventory context in parallel with prompt building (non-blocking)
  const inventoryContextPromise = fetchInventoryContext(prefs)

  const inventoryContext = await inventoryContextPromise
  const inventoryBlock = inventoryContext
    ? `\n\n${inventoryContext}\n\nВикористай ці дані як підказку — якщо наявні авто відповідають запиту клієнта, рекомендуй їх першими.`
    : ""

  // When budget is missing, DO NOT force a synthetic 20-40k EUR range — that
  // makes Claude pick unrealistic prices for premium suggestions (e.g. Porsche
  // 718 Cayman at €23k turnkey, which the model itself acknowledges as
  // "практично нереальна комбінація"). Instead, let Claude propose prices
  // anchored to actual market rates for the cars it recommends.
  const hasBudget = !!(prefs.budget_min || prefs.budget_max)
  const prefsBlock = prefsDesc.join("\n") ||
    "Не вказані. Запропонуй 3 моделі різного класу та користуйся СВОЇМИ знаннями про реальний ринок — priceRange має відповідати справжнім turnkey-цінам моделей, які ти пропонуєш (НЕ занижуй під уявний бюджет)."

  const userMessage =
    `Параметри клієнта:\n${prefsBlock}` +
    freeTextBlock +
    inventoryBlock +
    `\n\nВАЖЛИВО ПРО ЦІНИ:
• Бюджет клієнта — у TURNKEY (фінал в Україні).
• Формула: turnkey = EU × 1.38 + 4500 (мито+акциз+ПДВ+комісія+доставка+реєстрація).
• Орієнтуйся на свої знання про ринок Німеччини/Швеції 2015-2026: типові EU-ціни моделі/року + вищенаведена формула = твій priceRange.
${hasBudget
  ? `• Бюджет клієнта вказаний (див. вище). Порівнюй свій priceRange з ним і виставляй budgetFit чесно. Якщо модель реально дорожча — використовуй "over" + feasibilityWarning з рекомендацією альтернатив у бюджеті.`
  : `• Бюджет НЕ вказаний клієнтом. Пиши РЕАЛЬНІ ринкові ціни моделей. budgetFit:"fits" для всіх, overBy:0, feasibilityWarning:null — не пиши "над бюджетом" коли бюджету немає.`}

ФОРМАТ ВІДПОВІДІ: ТІЛЬКИ JSON-масив, що починається з [ і закінчується ]. Без тексту до/після, без markdown ${"```"}, без уточнюючих питань. Якщо параметрів недостатньо — здогадайся розумно і поверни 3 пропозиції. Перший символ відповіді МУСИТЬ бути [.`

  // ── Start streaming response ───────────────────────────────────────────────
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const abort = new AbortController()
      const timeout = setTimeout(() => abort.abort(), 35_000)

      try {
        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "prompt-caching-2024-07-31",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1000,
            // Temperature 1.0 + the variability rule in the prompt pushes the
            // model off canonical "Golf GTI / Civic Type R" combos. Default
            // (~1.0) was already this — making it explicit so any future
            // tuning is intentional, not accidental.
            temperature: 1.0,
            stream: true,
            system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: userMessage }],
          }),
          signal: abort.signal,
        })

        if (!claudeRes.ok) {
          const errBody = await claudeRes.text().catch(() => "")
          const { logError } = await import("@/lib/logger")
          await logError({
            source: "ai", level: "error",
            msg: `Claude suggest HTTP ${claudeRes.status}`,
            details: { body: errBody.slice(0, 400), endpoint: "ai-picker/suggest" },
          })
          controller.enqueue(sseEvent(encoder, {
            type: "fallback",
            fallback: "ai_unavailable",
            message: "AI зараз недоступний — шукаємо за вашими параметрами.",
          }))
          controller.close()
          return
        }

        // ── Stream Claude SSE → parse suggestions → re-emit ─────────────────
        const reader = claudeRes.body!.getReader()
        const dec = new TextDecoder()
        let lineBuf = ""
        let textAccum = ""
        let sentCount = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          lineBuf += dec.decode(value, { stream: true })
          const lines = lineBuf.split("\n")
          lineBuf = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const raw = line.slice(6).trim()
            if (raw === "[DONE]") continue

            try {
              const event = JSON.parse(raw)

              if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                textAccum += event.delta.text
                const { complete, remaining } = extractCompleteSuggestions(textAccum)
                textAccum = remaining
                // `complete` contains ONLY newly-parsed objects on this call
                // (textAccum was just stripped of their bytes). Iterate the
                // whole array — do NOT .slice(sentCount), because sentCount
                // counts globally across calls and would always skip the
                // 2nd+ suggestion. Cap at 3 to match the system-prompt count.
                for (const rawSugg of complete) {
                  if (sentCount >= 3) break
                  if (rawSugg && typeof rawSugg === "object" && rawSugg.make) {
                    const mapped = mapRawSuggestion(rawSugg, prefs)
                    if (!isUsableSuggestion(mapped)) continue // skip un-parseable (bad years / not-in-EU brand)
                    controller.enqueue(sseEvent(encoder, { type: "suggestion", suggestion: mapped }))
                    sentCount++
                  }
                }
              }

              if (event.type === "message_stop") {
                // Flush any remaining partial content
                if (textAccum.trim()) {
                  try {
                    const cleaned = textAccum.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
                    const match = cleaned.match(/\{[\s\S]*\}/)
                    if (match) {
                      const rawSugg = JSON.parse(match[0])
                      const mapped2 = rawSugg?.make ? mapRawSuggestion(rawSugg, prefs) : null
                      if (mapped2 && sentCount < 3 && isUsableSuggestion(mapped2)) {
                        controller.enqueue(sseEvent(encoder, {
                          type: "suggestion",
                          suggestion: mapped2,
                        }))
                        sentCount++
                      }
                    }
                  } catch { /* incomplete JSON, ignore */ }
                }
                controller.enqueue(sseEvent(encoder, { type: "done" }))
              }

              if (event.type === "error") {
                const { logError } = await import("@/lib/logger")
                await logError({
                  source: "ai", level: "error",
                  msg: `Claude stream error: ${event.error?.type}`,
                  details: { message: event.error?.message, endpoint: "ai-picker/suggest" },
                })
                controller.enqueue(sseEvent(encoder, {
                  type: "fallback",
                  fallback: "ai_unavailable",
                  message: "AI зараз недоступний.",
                }))
              }
            } catch { /* malformed SSE event, skip */ }
          }
        }
      } catch (e: any) {
        const isAbort = e?.name === "AbortError"
        const { logError } = await import("@/lib/logger")
        await logError({
          source: "ai", level: "error",
          msg: isAbort ? "Claude suggest stream timeout (35s)" : `Claude suggest stream error: ${e?.message}`,
          stack: e?.stack,
          details: { endpoint: "ai-picker/suggest" },
        })
        controller.enqueue(sseEvent(encoder, {
          type: "fallback",
          fallback: "ai_unavailable",
          message: "AI зараз недоступний — шукаємо за вашими параметрами.",
        }))
      } finally {
        clearTimeout(timeout)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
