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
  if (budgetStr.includes("до"))            budgetMax = 15000
  else if (budgetStr.includes("15 000"))   budgetMax = 30000
  else if (budgetStr.includes("30 000"))   budgetMax = 60000
  else if (budgetStr.includes("60 000"))   budgetMax = 100000
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
  return {
    year_from: yearFrom && !isNaN(yearFrom) ? yearFrom : null,
    budget_max: budgetMax,
    fuel: fuelMap[byId.fuel?.selected[0] ?? ""] ?? null,
    transmission: transmissionMap[byId.transmission?.selected[0] ?? ""] ?? null,
  }
}

async function extractMakeModel(messages: ChatMessage[]): Promise<{ make: string | null; model: string | null }> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 40,
        system: 'You are a car name extractor. The user may write in Ukrainian or Russian (e.g. "пасат"=Passat, "бмв"=BMW, "мерс"=Mercedes, "тойота"=Toyota). Extract car make and model, normalize to English brand names. Return ONLY valid JSON: {"make":"Volkswagen","model":"Passat"} or {"make":null,"model":null}. No extra text.',
        messages: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
      }),
    })
    const data = await res.json()
    return JSON.parse(data.content?.[0]?.text?.trim() ?? "{}")
  } catch {
    return { make: null, model: null }
  }
}

async function triggerParser(answers: Answer[], clientOrderId: string, make: string | null, model: string | null) {
  if (!PARSER_URL) return null
  try {
    const res = await fetch(`${PARSER_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(PARSER_KEY ? { "x-api-key": PARSER_KEY } : {}),
      },
      body: JSON.stringify({ ...extractSearchParams(answers), make, model, client_order_id: clientOrderId }),
      signal: AbortSignal.timeout(120_000),
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

  const carsContext = cars?.slice(0, 6)
    .map((c: any, i: number) =>
      `${i + 1}. ${c.year} ${c.make} ${c.model} — €${c.price?.toLocaleString()}, ${c.mileage ? Math.round(c.mileage / 1000) + "k km" : "—"}, ${c.fuelUa || c.fuel || "—"}, ${c.transmission || "—"}`)
    .join("\n") ?? ""

  const hasNoCars = !cars || cars.length === 0

  if (triggerSearch) {
    const orderId = clientOrderId ?? crypto.randomUUID()
    const { make, model } = await extractMakeModel(messages ?? [])
    console.log("[ai-picker] extracted:", { make, model })
    const result = await triggerParser(answers, orderId, make, model)
    console.log("[ai-picker] parser result:", JSON.stringify(result)?.slice(0, 300))
    const count = result?.count ?? 0
    return NextResponse.json({
      message: count > 0
        ? `Знайдено ${count} авто під ваші критерії! Перегляньте результати нижче.`
        : `Пошук завершено. Точних збігів не знайдено (make=${make}, model=${model}, result=${JSON.stringify(result)?.slice(0,100)})`,
      searching: false,
      cars: result?.cars ?? [],
    })
  }

  const systemPrompt = `Ти AI-асистент Fresh Auto — продаж авто з Європи до України.
Відповідай КОРОТКО (1-3 речення), українською. БЕЗ емодзі, БЕЗ зірочок, БЕЗ markdown.

Критерії клієнта: ${tags.join(", ") || "не вказані"}

${hasNoCars
  ? `ВАЖЛИВО: У каталозі зараз немає авто. Твоє єдине завдання — запустити пошук.`
  : `Авто в каталозі:\n${carsContext}`}

ПРАВИЛО ПОШУКУ: Якщо клієнт хоч якось висловив бажання знайти авто, побачити більше варіантів, або погоджується на пошук — відповідай ТІЛЬКИ одним словом без будь-якого іншого тексту: TRIGGER_SEARCH
НЕ питай уточнень. НЕ пропонуй зателефонувати. НЕ додавай нічого до TRIGGER_SEARCH.

Ціна під ключ = авто + мито 10% + акциз 5% + ПДВ 20% + доставка ~2500 EUR.
Телефон менеджера: 098 708 19 19.`

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16,
      system: systemPrompt,
      messages: (messages as ChatMessage[]).map(m => ({ role: m.role, content: m.content })),
    }),
  })

  const data = await response.json()
  const raw: string = data.content?.[0]?.text?.trim() ?? "Вибачте, спробуйте ще раз."

  if (raw.includes("TRIGGER_SEARCH")) {
    const orderId = crypto.randomUUID()
    return NextResponse.json({
      message: "Запускаю пошук по європейським майданчикам за вашими критеріями. Це займе 2-5 хвилин.",
      searching: true,
      clientOrderId: orderId,
    })
  }

  // Якщо є авто — дати нормальну відповідь з більшим ліміттом
  const response2 = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: systemPrompt,
      messages: (messages as ChatMessage[]).map(m => ({ role: m.role, content: m.content })),
    }),
  })
  const data2 = await response2.json()
  return NextResponse.json({ message: data2.content?.[0]?.text ?? "Вибачте, спробуйте ще раз." })
}