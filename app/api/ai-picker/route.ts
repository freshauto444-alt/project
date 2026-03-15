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
  let budgetMax: number | null = null
  if (budgetStr.includes("до"))          budgetMax = 15000
  else if (budgetStr.includes("15 000")) budgetMax = 30000
  else if (budgetStr.includes("30 000")) budgetMax = 60000
  else if (budgetStr.includes("60 000")) budgetMax = 100000
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

async function extractFromChat(messages: ChatMessage[]): Promise<{
  make: string | null; model: string | null
  fuel: string | null; body_type: string | null
}> {
  const empty = { make: null, model: null, fuel: null, body_type: null }
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
Examples:
"пасат дизель універсал"→{"make":"Volkswagen","model":"Passat","fuel":"Diesel","body_type":"estate"}
"бмв бензин"→{"make":"BMW","model":null,"fuel":"Petrol","body_type":null}
"хочу audi a4 автомат"→{"make":"Audi","model":"A4","fuel":null,"body_type":null}
"седан дизель"→{"make":null,"model":null,"fuel":"Diesel","body_type":"sedan"}
fuel values: "Petrol","Diesel","Electric","Hybrid" or null
body_type values: "sedan","estate","suv","hatchback","coupe","convertible","minivan" or null
Return ONLY valid JSON: {"make":"...","model":"...","fuel":"...","body_type":"..."}`,
      [{ role: "user", content: userText }],
      80,
    )
    const match = text.match(/\{[\s\S]*?\}/)
    return match ? JSON.parse(match[0]) : empty
  } catch {
    return empty
  }
}
async function triggerParser(
  answers: Answer[],
  clientOrderId: string,
  chat: { make: string | null; model: string | null; fuel: string | null; body_type: string | null },
) {
  if (!PARSER_URL) return null
  const base = extractSearchParams(answers)
  try {
    const res = await fetch(`${PARSER_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(PARSER_KEY ? { "x-api-key": PARSER_KEY } : {}),
      },
      body: JSON.stringify({
        ...base,
        make: chat.make,
        model: chat.model,
        fuel: chat.fuel ?? base.fuel,
        body_type: chat.body_type ?? base.body_type,
        client_order_id: clientOrderId,
      }),
    })
    return await res.json()
  } catch (e) {
    console.error("[ai-picker] parser error:", e)
    return null
  }
}

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
    const result = await triggerParser(answers, orderId, chat)
    console.log("[ai-picker] parser result:", JSON.stringify(result)?.slice(0, 300))
    const count = result?.count ?? 0
    return NextResponse.json({
      message: count > 0
        ? `Знайдено ${count} авто під ваші критерії! Перегляньте результати нижче.`
        : `На жаль, за критеріями (${chat.make ?? "—"} ${chat.model ?? ""}, бюджет ${extractSearchParams(answers).budget_max ? `до ${extractSearchParams(answers).budget_max}€` : "—"}) нічого не знайдено. Спробуйте розширити критерії або зверніться до менеджера: 098 708 19 19.`,
      searching: false,
      cars: result?.cars ?? [],
    })
  }

  const hasNoCars = !cars || cars.length === 0
  const carsContext = cars?.slice(0, 6)
    .map((c: any, i: number) =>
      `${i + 1}. ${c.year} ${c.make} ${c.model} — €${c.price?.toLocaleString()}, ${c.mileage ? Math.round(c.mileage / 1000) + "k km" : "—"}, ${c.fuel_ua || c.fuel || "—"}, ${c.transmission || "—"}`)
    .join("\n") ?? ""

  const systemPrompt = `Ти AI-асистент Fresh Auto — компанія з продажу авто з Європи до України. Спілкуєшся українською, коротко і по справі. БЕЗ емодзі, БЕЗ зірочок, БЕЗ markdown.

Критерії клієнта з анкети: ${tags.join(", ") || "не вказані"}

${hasNoCars
  ? "ВАЖЛИВО: У каталозі зараз немає авто за цими критеріями."
  : `Авто в каталозі:\n${carsContext}`}

═══ ЛОГІКА РОЗМОВИ ═══

КРОК 1 — УТОЧНЕННЯ:
Якщо з анкети або чату НЕ відомо хоча б одне з: марка/тип авто, бюджет — постав 1-2 коротких питання.
Питай тільки про те що реально невідомо. Не повторюй питань.
Приклади: "Яку марку або модель розглядаєте?" / "Який бюджет плануєте (EUR)?" / "Кузов важливий — седан, SUV, універсал?"
Максимум 2 питання за раз.

КРОК 2 — БЮДЖЕТ < 20 000 EUR:
Якщо клієнт називає бюджет менше 20 000 EUR — відповідай:
"Fresh Auto спеціалізується на авто середнього та преміум сегменту від 20 000 EUR. На жаль, у цьому діапазоні ми не зможемо запропонувати гідні варіанти. Якщо розглядаєте вищий бюджет — будемо раді допомогти з підбором."
НЕ запускай пошук якщо бюджет < 20 000 EUR.

КРОК 3 — ЗАПУСК ПОШУКУ:
Якщо відомі основні параметри (марка або тип авто) І бюджет ≥ 20 000 або бюджет не вказаний — відповідай ТІЛЬКИ словом: TRIGGER_SEARCH
Також TRIGGER_SEARCH якщо клієнт каже: "знайди", "пошукай", "є щось інше?", "покажи більше", "хочу подивитись", або називає конкретну марку/модель.

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