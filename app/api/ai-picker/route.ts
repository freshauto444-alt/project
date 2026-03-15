import { NextResponse } from "next/server"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface Answer {
  questionId: string
  selected: string[]
  custom: string
}

const PARSER_URL = process.env.PARSER_API_URL ?? ""
const PARSER_KEY = process.env.PARSER_API_KEY ?? ""

function extractSearchParams(answers: Answer[]) {
  const byId = Object.fromEntries(answers.map(a => [a.questionId, a]))
  const budgetStr = byId.budget?.selected[0] ?? byId.budget?.custom ?? ""
  // Parse "X – Y EUR" format → extract both min and max
  const rangeMatch = budgetStr.match(/([\d\s]+)\s*[–-]\s*([\d\s]+)/)
  let budgetMin: number | null = null
  let budgetMax: number | null = null
  if (rangeMatch) {
    budgetMin = parseInt(rangeMatch[1].replace(/\s/g, ""))
    budgetMax = parseInt(rangeMatch[2].replace(/\s/g, ""))
  } else if (budgetStr.includes("понад")) {
    const m = budgetStr.match(/([\d\s]+)/)
    budgetMin = m ? parseInt(m[1].replace(/\s/g, "")) : null
    budgetMax = null
  } else {
    // Plain custom number (e.g. "15000")
    const plain = parseInt(budgetStr.replace(/\D/g, ""))
    if (!isNaN(plain) && plain > 0) budgetMax = plain
  }
  const yearStr = byId.year?.selected[0] ?? byId.year?.custom ?? ""
  const yearFrom = yearStr ? parseInt(yearStr) : null
  const fuelMap: Record<string, string> = {
    "Бензин": "Petrol", "Дизель": "Diesel",
    "Електро": "Electric", "Гібрид": "Hybrid", "Plug-in гібрид": "Hybrid",
  }
  const transmissionMap: Record<string, string> = {
    "Автомат": "Automatic", "Механіка": "Manual",
    "Робот": "Automatic", "Варіатор": "Automatic",
  }
  const bodyMap: Record<string, string> = {
    "Седан": "sedan", "Хетчбек": "hatchback", "Універсал": "estate",
    "SUV": "suv", "Кросовер": "suv", "Мінівен": "minivan",
    "Купе": "coupe", "Кабріолет": "convertible",
  }
  return {
    year_from: yearFrom && !isNaN(yearFrom) ? yearFrom : null,
    budget_min: budgetMin,
    budget_max: budgetMax,
    fuel: fuelMap[byId.fuel?.selected[0] ?? ""] ?? null,
    transmission: transmissionMap[byId.transmission?.selected[0] ?? ""] ?? null,
    body_type: bodyMap[byId.body?.selected[0] ?? ""] ?? null,
  }
}

async function callClaude(systemPrompt: string, messages: ChatMessage[], maxTokens: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  })
  const data = await res.json()
  return data.content?.[0]?.text?.trim() ?? ""
}

interface CarPair { make: string | null; model: string | null }

async function extractFromChat(messages: ChatMessage[]): Promise<{
  pairs: CarPair[]; fuel: string | null; body_type: string | null; budget: number | null
}> {
  const empty = { pairs: [], fuel: null, body_type: null, budget: null }
  try {
    const userText = messages
      .filter(m => m.role === "user")
      .slice(-5)
      .map(m => m.content)
      .join(" ")
      .trim()

    if (!userText) return empty

    const text = await callClaude(
      `Extract car search preferences from user text (Ukrainian/Russian/English).
Return JSON with these keys:
- "pairs": array of {make, model} objects — one per distinct car/brand mentioned
- "budget": numeric EUR amount if mentioned, else null
- "fuel": "Petrol","Diesel","Electric","Hybrid" or null
- "body_type": "sedan","estate","suv","hatchback","coupe","convertible","minivan" or null

Examples:
"ауді бмв дизель бюджет 50000"→{"pairs":[{"make":"Audi","model":null},{"make":"BMW","model":null}],"fuel":"Diesel","body_type":null,"budget":50000}
"пасат або а4 50000"→{"pairs":[{"make":"Volkswagen","model":"Passat"},{"make":"Audi","model":"A4"}],"fuel":null,"body_type":null,"budget":50000}
"пасат дизель універсал"→{"pairs":[{"make":"Volkswagen","model":"Passat"}],"fuel":"Diesel","body_type":"estate","budget":null}
"бмв бензин 40000"→{"pairs":[{"make":"BMW","model":null}],"fuel":"Petrol","body_type":null,"budget":40000}
"седан дизель"→{"pairs":[],"fuel":"Diesel","body_type":"sedan","budget":null}

Return ONLY valid JSON.`,
      [{ role: "user", content: userText }],
      150,
    )
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return empty
    const parsed = JSON.parse(match[0])
    const pairs: CarPair[] = Array.isArray(parsed.pairs)
      ? parsed.pairs.filter((p: CarPair) => p.make || p.model)
      : []
    return {
      pairs,
      fuel: parsed.fuel ?? null,
      body_type: parsed.body_type ?? null,
      budget: typeof parsed.budget === "number" ? parsed.budget : null,
    }
  } catch {
    return empty
  }
}

async function callParser(payload: Record<string, unknown>): Promise<{ count: number; cars: unknown[] } | null> {
  try {
    const res = await fetch(`${PARSER_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(PARSER_KEY ? { "x-api-key": PARSER_KEY } : {}),
      },
      body: JSON.stringify(payload),
    })
    return await res.json()
  } catch (e) {
    console.error("[ai-picker] parser error:", e)
    return null
  }
}

async function triggerParser(
  answers: Answer[],
  clientOrderId: string,
  chat: { pairs: CarPair[]; fuel: string | null; body_type: string | null; budget: number | null },
) {
  if (!PARSER_URL) return null
  const base = extractSearchParams(answers)

  let budgetMin = base.budget_min
  let budgetMax = base.budget_max
  if (chat.budget != null) {
    budgetMin = Math.max(0, chat.budget - 2000)
    budgetMax = chat.budget + 2000
  }

  if (budgetMin != null) budgetMin = Math.max(budgetMin, 20000)

  const commonPayload = {
    year_from: base.year_from,
    budget_min: budgetMin,
    budget_max: budgetMax,
    fuel: chat.fuel ?? base.fuel,
    transmission: base.transmission,
    body_type: chat.body_type ?? base.body_type,
    client_order_id: clientOrderId,
  }

  const pairs: CarPair[] = chat.pairs.length > 0 ? chat.pairs : [{ make: null, model: null }]

  const results = await Promise.all(
    pairs.map(p => callParser({ ...commonPayload, make: p.make, model: p.model }))
  )

  const seenUrls = new Set<string>()
  const allCars: unknown[] = []
  for (const r of results) {
    if (!r) continue
    for (const car of r.cars ?? []) {
      const c = car as Record<string, unknown>
      const key = (c.url ?? c.source_url ?? c.id) as string
      if (key && seenUrls.has(key)) continue
      if (key) seenUrls.add(key)
      allCars.push(car)
    }
  }

  return { count: allCars.length, cars: allCars }
}

const MIN_BUDGET = 20000

export async function POST(req: Request) {
  const { messages, answers, cars, triggerSearch, clientOrderId } = await req.json()

  const tags: string[] = []
  answers?.forEach((a: Answer) => {
    a.selected?.forEach((s: string) => tags.push(s))
    if (a.custom?.trim()) tags.push(a.custom.trim())
  })

  // ── Запуск парсера ────────────────────────────────────────────────────────
  if (triggerSearch) {
    const orderId = clientOrderId ?? crypto.randomUUID()
    const chat = await extractFromChat(messages ?? [])
    console.log("[ai-picker] extracted:", chat)

    // Block search if budget is below minimum
    const effectiveBudget = chat.budget ?? extractSearchParams(answers).budget_max
    if (effectiveBudget != null && effectiveBudget < MIN_BUDGET) {
      return NextResponse.json({
        message: `Fresh Auto спеціалізується на авто від ${MIN_BUDGET.toLocaleString()} EUR. На жаль, у цьому діапазоні ми не зможемо запропонувати гідні варіанти. Якщо розглядаєте вищий бюджет — будемо раді допомогти. Телефон: 098 708 19 19.`,
        searching: false,
        cars: [],
      })
    }

    const result = await triggerParser(answers, orderId, chat)
    console.log("[ai-picker] parser result:", JSON.stringify(result)?.slice(0, 300))
    const count = result?.count ?? 0
    const base = extractSearchParams(answers)
    const budgetLabel = chat.budget
      ? `${chat.budget - 2000}–${chat.budget + 2000}€`
      : (base.budget_min && base.budget_max) ? `${base.budget_min}–${base.budget_max}€`
      : base.budget_max ? `до ${base.budget_max}€` : "—"
    const makesLabel = chat.pairs.map(p => [p.make, p.model].filter(Boolean).join(" ")).join(", ") || "—"
    return NextResponse.json({
      message: count > 0
        ? `Знайдено ${count} авто під ваші критерії! Перегляньте результати нижче.`
        : `На жаль, за критеріями (${makesLabel}, бюджет ${budgetLabel}) нічого не знайдено. Спробуйте розширити критерії або зверніться до менеджера: 098 708 19 19.`,
      searching: false,
      cars: result?.cars ?? [],
    })
  }

  const hasNoCars = !cars || cars.length === 0
  const carsContext = cars?.slice(0, 6)
    .map((c: any, i: number) =>
      `${i + 1}. ${c.year} ${c.make} ${c.model} — €${c.price?.toLocaleString()}, ${c.mileage ? Math.round(c.mileage / 1000) + "k km" : "—"}, ${c.fuel_ua || c.fuel || "—"}, ${c.transmission || "—"}`)
    .join("\n") ?? ""

  const systemPrompt = `Ти AI-консультант Fresh Auto — компанія з продажу авто з Європи до України. Спілкуєшся українською, коротко і по справі. БЕЗ емодзі, БЕЗ зірочок, БЕЗ markdown.

Критерії клієнта з анкети: ${tags.join(", ") || "не вказані"}

${hasNoCars
  ? "ВАЖЛИВО: У каталозі зараз немає авто за цими критеріями."
  : `Авто в каталозі:\n${carsContext}`}

═══ СТИЛЬ РОБОТИ ═══
Ти досвідчений консультант. Мета — підібрати авто яке дійсно підійде клієнту.

ЯКЩО клієнт написав мало або один параметр — уточни 3-4 найважливіших яких не вистачає:
- "Яку марку розглядаєте?"
- "Який бюджет плануєте (EUR)?"
- "Дизель, бензин чи гібрид?"
- "Важливий рік або пробіг?"

Максимум 3 питання за раз. Не питай про те що вже відомо з анкети вище.

ЯКЩО клієнт дав достатньо (марка або модель + ще 3-4 критерії) — відповідай ТІЛЬКИ словом: TRIGGER_SEARCH
ЯКЩО клієнт явно хоче загальний пошук ("покажи що є", "давай дивитись", "шукай все") — відповідай ТІЛЬКИ словом: TRIGGER_SEARCH
ЯКЩО після уточнень клієнт знову просить пошук — відповідай ТІЛЬКИ словом: TRIGGER_SEARCH

═══ БЮДЖЕТ < 20 000 EUR ═══
Якщо клієнт називає бюджет менше 20 000 EUR:
"Fresh Auto спеціалізується на авто від 20 000 EUR. На жаль, у цьому діапазоні ми не зможемо запропонувати гідні варіанти. Якщо розглядаєте вищий бюджет — будемо раді допомогти."
НЕ запускай пошук якщо бюджет < 20 000 EUR.

═══ ЗАГАЛЬНЕ ═══
Телефон менеджера: 098 708 19 19.`

  // ── Перший запит — детекція тригера (дуже короткий) ──────────────────────
  const triggerCheck = await callClaude(systemPrompt, messages as ChatMessage[], 20)

  if (triggerCheck.includes("TRIGGER_SEARCH")) {
    const orderId = crypto.randomUUID()
    return NextResponse.json({
      message: "Запускаю пошук на AutoScout24, Bytbil, Blocket та Mobile.de за вашими критеріями. Зазвичай займає 1-2 хвилини.",
      searching: true,
      clientOrderId: orderId,
    })
  }

  // ── Другий запит — нормальна відповідь (TRIGGER_SEARCH заборонений) ───────
  const safeSystemPrompt = systemPrompt.replace(
    /ПРАВИЛО:.*TRIGGER_SEARCH[\s\S]*?НЕ питай уточнень\. НЕ пропонуй зателефонувати замість пошуку\./,
    "Дай корисну відповідь про авто в каталозі або поради щодо вибору. Не кажи TRIGGER_SEARCH."
  )

  const reply = await callClaude(safeSystemPrompt, messages as ChatMessage[], 400)
  return NextResponse.json({ message: reply || "Вибачте, спробуйте ще раз." })
}
