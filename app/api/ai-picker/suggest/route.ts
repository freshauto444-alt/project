import { createClient } from "@supabase/supabase-js"

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

  return {
    make,
    model: modelDisplay,
    yearRange: raw.yearRange ?? "",
    priceRange: raw.priceRange ?? "",
    whyRecommended: raw.whyRecommended ?? "",
    concerns: raw.concerns ?? "",
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
  if (prefs.body_type)    prefsDesc.push(`Кузов: ${prefs.body_type}`)
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

  const systemPrompt = `Ти — старший менеджер Fresh Auto, 15+ років на ринку імпорту авто з Німеччини/Швеції/Нідерландів. Знаєш моделі 2015-2026: типові двигуни, ТО, надійність.

ПРАВИЛА:
1. Ціни ТІЛЬКИ в EUR і ТІЛЬКИ "під ключ" (фінал в Україні). Формула: turnkey = EU × 1.38 + 4500.
2. ВСІ пропозиції в бюджеті клієнта. Не пропонуй модель якщо її реальна turnkey-ціна перевищує бюджет.
3. РІВНО 3 моделі, мінімум 2 різні марки.
4. model_display БЕЗ префіксу марки. Правильно: "3 Series Touring", не "BMW 3 Series Touring".
5. У whyRecommended ціни завжди як "€X під ключ".
6. Якщо є дані про наявність у стоці — пріоритизуй моделі, які там є.

whyRecommended (РІВНО 2 короткі речення, ~25 слів кожне): одне про конкретну характеристику+перевагу, друге про репутацію (ADAC/Euro NCAP/J.D. Power) АБО ринок України.

concerns (1 коротке речення, мʼяко): загальний нюанс класу. Без сум ремонтів, без кодів моторів, без слів "проблема/ремонт/ризик".

model_search = назва моделі lowercase, БЕЗ префіксу марки. Приклади: "Audi A7" → "a7"; "BMW 3 Series Touring" → "3er"; "Mercedes C-Class" → "c-klasse"; "VW Golf" → "golf"; "Skoda Octavia" → "octavia"; "Volvo V60" → "v60"; "Porsche Panamera" → "panamera". Підбирай ВИКЛЮЧНО код для конкретно тієї моделі, яку пропонуєш.

Поверни ТІЛЬКИ JSON-масив з РІВНО 3 об'єктами (без markdown, без тексту до/після):
[{"make":"BMW","model_display":"3 Series Touring","model_search":"3er","yearRange":"2020-2023","priceRange":"39000-48500","whyRecommended":"...","concerns":"...","confidence":"high"}]`

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
  ? "• Не пропонуй модель, якщо її реальна turnkey-ціна перевищує бюджет клієнта."
  : "• Бюджет не вказаний — будь чесним: пропонуй РЕАЛЬНІ turnkey-ціни моделей, не штучно занижуй під якийсь діапазон. Якщо модель реально коштує €60k turnkey — пиши €60k, не €23k."}

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
                      if (rawSugg?.make && sentCount < 3) {
                        controller.enqueue(sseEvent(encoder, {
                          type: "suggestion",
                          suggestion: mapRawSuggestion(rawSugg, prefs),
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
