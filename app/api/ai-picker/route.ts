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
const MIN_BUDGET = 20000

// ── Словник кольорів ─────────────────────────────────────────────────────────
const COLOR_ALIASES: Record<string, string> = {
  "чорний": "Black", "чорна": "Black", "черный": "Black", "black": "Black",
  "білий": "White", "біла": "White", "белый": "White", "white": "White",
  "сірий": "Grey", "сіра": "Grey", "серый": "Grey", "grey": "Grey", "gray": "Grey",
  "синій": "Blue", "синя": "Blue", "синий": "Blue", "blue": "Blue",
  "червоний": "Red", "червона": "Red", "красный": "Red", "red": "Red",
  "зелений": "Green", "зелена": "Green", "зеленый": "Green", "green": "Green",
  "коричневий": "Brown", "коричнева": "Brown", "brown": "Brown",
  "бежевий": "Beige", "бежева": "Beige", "beige": "Beige",
  "сріблястий": "Silver", "срібний": "Silver", "silver": "Silver",
  "помаранчевий": "Orange", "оранжевый": "Orange", "orange": "Orange",
  "жовтий": "Yellow", "жовта": "Yellow", "yellow": "Yellow",
}

// Псевдоніми брендів для extractFromChat
const BRAND_ALIASES: Record<string, string> = {
  "ваг": "Volkswagen", "ваг група": "Volkswagen", "вольксваген": "Volkswagen",
  "фольксваген": "Volkswagen", "фольк": "Volkswagen", "vw": "Volkswagen",
  "бмв": "BMW", "бмв'шка": "BMW",
  "мерс": "Mercedes-Benz", "мерседес": "Mercedes-Benz", "мерсик": "Mercedes-Benz",
  "ауді": "Audi",
  "тойота": "Toyota",
  "шкода": "Skoda",
  "вольво": "Volvo",
  "кіа": "Kia",
  "хюндай": "Hyundai", "хундай": "Hyundai",
  "форд": "Ford",
  "пежо": "Peugeot",
  "рено": "Renault",
  "опель": "Opel",
  "порше": "Porsche",
  "тесла": "Tesla",
  "лексус": "Lexus",
  "субару": "Subaru",
  "мазда": "Mazda",
  "нісан": "Nissan",
  "альфа": "Alfa Romeo",
  "ситроен": "Citroen",
}

function normalizeBrand(raw: string): string {
  const key = raw.trim().toLowerCase()
  return BRAND_ALIASES[key] ?? raw.trim()
}

function normalizeColor(text: string): string | null {
  const words = text.toLowerCase().split(/\s+/)
  for (const word of words) {
    if (COLOR_ALIASES[word]) return COLOR_ALIASES[word]
  }
  // Перевіряємо фрази (2 слова)
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i+1]}`
    if (COLOR_ALIASES[phrase]) return COLOR_ALIASES[phrase]
  }
  return null
}

function extractSearchParams(answers: Answer[]) {
  const byId = Object.fromEntries(answers.map(a => [a.questionId, a]))
  const budgetStr = byId.budget?.selected[0] ?? byId.budget?.custom ?? ""
  const rangeMatch = budgetStr.match(/([\d\s]+)\s*[–-]\s*([\d\s]+)/)
  let budgetMin: number | null = null
  let budgetMax: number | null = null
  if (rangeMatch) {
    budgetMin = parseInt(rangeMatch[1].replace(/\s/g, ""))
    budgetMax = parseInt(rangeMatch[2].replace(/\s/g, ""))
  } else if (budgetStr.includes("понад")) {
    const m = budgetStr.match(/([\d\s]+)/)
    budgetMin = m ? parseInt(m[1].replace(/\s/g, "")) : null
  } else {
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
    "Седан": "Sedan", "Хетчбек": "Hatchback", "Універсал": "Estate",
    "Позашляховик": "SUV", "Кросовер": "SUV", "Мінівен": "Van",
    "Купе": "Coupe", "Кабріолет": "Convertible",
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

interface ChatPreferences {
  pairs: CarPair[]
  fuel: string | null
  body_type: string | null
  budget: number | null
  color: string | null
  mileage_max: number | null
  required_options: string[]
  year_from: number | null
}

async function extractFromChat(messages: ChatMessage[]): Promise<ChatPreferences> {
  const empty: ChatPreferences = {
    pairs: [], fuel: null, body_type: null, budget: null,
    color: null, mileage_max: null, required_options: [], year_from: null,
  }
  try {
    // Беремо більше контексту — всі повідомлення користувача (до 8 останніх)
    const userText = messages
      .filter(m => m.role === "user")
      .slice(-8)
      .map(m => m.content)
      .join(" | ")
      .trim()

    if (!userText) return empty

    const text = await callClaude(
      `Extract car search preferences from Ukrainian/Russian/English text.
Return JSON with keys:
- "pairs": [{make, model}] — all mentioned brands/models. Examples: "ваг група"→"Volkswagen", "бмв"→"BMW", "мерс"→"Mercedes-Benz", "ауді"→"Audi"
- "budget": number in EUR or null
- "fuel": "Petrol"|"Diesel"|"Electric"|"Hybrid" or null
- "body_type": "Sedan"|"Estate"|"SUV"|"Hatchback"|"Coupe"|"Convertible"|"Van" or null
- "color": color in English (Black/White/Grey/Blue/Red/Green/Brown/Beige/Silver/Orange/Yellow) or null
- "mileage_max": max mileage in km or null (e.g. "до 150" → 150000, "до 100к" → 100000)
- "required_options": array of required options like ["leather", "panorama", "carplay", "navigation", "camera", "heated seats"] or []
- "year_from": minimum year or null

Examples:
"ваг група дизель 30000"→{"pairs":[{"make":"Volkswagen","model":null}],"fuel":"Diesel","body_type":null,"budget":30000,"color":null,"mileage_max":null,"required_options":[],"year_from":null}
"чорна бмв або ауді седан пробіг до 100к"→{"pairs":[{"make":"BMW","model":null},{"make":"Audi","model":null}],"fuel":null,"body_type":"Sedan","budget":null,"color":"Black","mileage_max":100000,"required_options":[],"year_from":null}
"пасат дизель зі шкірою та панорамою"→{"pairs":[{"make":"Volkswagen","model":"Passat"}],"fuel":"Diesel","body_type":null,"budget":null,"color":null,"mileage_max":null,"required_options":["leather","panorama"],"year_from":null}

Return ONLY valid JSON.`,
      [{ role: "user", content: userText }],
      200,
    )
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return empty
    const parsed = JSON.parse(match[0])
    const pairs: CarPair[] = Array.isArray(parsed.pairs)
      ? parsed.pairs
          .filter((p: CarPair) => p.make || p.model)
          .map((p: CarPair) => ({
            make: p.make ? normalizeBrand(p.make) : null,
            model: p.model,
          }))
      : []

    // Нормалізуємо колір якщо не розпізнано
    let color = parsed.color ?? null
    if (!color) {
      const fullText = messages.filter(m => m.role === "user").slice(-8).map(m => m.content).join(" ")
      color = normalizeColor(fullText)
    }

    return {
      pairs,
      fuel: parsed.fuel ?? null,
      body_type: parsed.body_type ?? null,
      budget: typeof parsed.budget === "number" ? parsed.budget : null,
      color,
      mileage_max: typeof parsed.mileage_max === "number" ? parsed.mileage_max : null,
      required_options: Array.isArray(parsed.required_options) ? parsed.required_options : [],
      year_from: typeof parsed.year_from === "number" ? parsed.year_from : null,
    }
  } catch {
    return empty
  }
}

async function callParser(payload: Record<string, unknown>): Promise<{ count: number; cars: unknown[] } | null> {
  if (!PARSER_URL) return null
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
  chat: ChatPreferences,
  offset: number = 0,
) {
  if (!PARSER_URL) return null
  const base = extractSearchParams(answers)

  let budgetMin = base.budget_min
  let budgetMax = base.budget_max
  if (chat.budget != null) {
    budgetMin = Math.max(0, chat.budget - 2000)
    budgetMax = chat.budget + 2000
  }
  if (budgetMin != null) budgetMin = Math.max(budgetMin, MIN_BUDGET)

  const commonPayload: Record<string, unknown> = {
    year_from: chat.year_from ?? base.year_from,
    budget_min: budgetMin,
    budget_max: budgetMax,
    fuel: chat.fuel ?? base.fuel,
    transmission: base.transmission,
    body_type: chat.body_type ?? base.body_type,
    color: chat.color,
    mileage_max: chat.mileage_max,
    required_options: chat.required_options,
    client_order_id: clientOrderId,
    offset,
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

export async function POST(req: Request) {
  const { messages, answers, cars, triggerSearch, clientOrderId, loadMore, chatPreferences } = await req.json()

  const tags: string[] = []
  answers?.forEach((a: Answer) => {
    a.selected?.forEach((s: string) => tags.push(s))
    if (a.custom?.trim()) tags.push(a.custom.trim())
  })

  // ── Завантажити ще (пагінація) ────────────────────────────────────────────
  if (loadMore && chatPreferences) {
    const offset = chatPreferences.offset ?? 20
    const orderId = clientOrderId ?? crypto.randomUUID()
    const result = await triggerParser(answers, orderId, chatPreferences, offset)
    const count = result?.count ?? 0
    return NextResponse.json({
      message: count > 0
        ? `Знайдено ще ${count} авто!`
        : `Більше авто за цими критеріями не знайдено.`,
      searching: false,
      cars: result?.cars ?? [],
      chatPreferences: { ...chatPreferences, offset: offset + 20 },
    })
  }

  // ── Запуск парсера ────────────────────────────────────────────────────────
  if (triggerSearch) {
    const orderId = clientOrderId ?? crypto.randomUUID()
    const chat = await extractFromChat(messages ?? [])
    console.log("[ai-picker] extracted:", JSON.stringify(chat))

    const effectiveBudget = chat.budget ?? extractSearchParams(answers).budget_max
    if (effectiveBudget != null && effectiveBudget < MIN_BUDGET) {
      return NextResponse.json({
        message: `Fresh Auto спеціалізується на авто від ${MIN_BUDGET.toLocaleString()} EUR. На жаль, у цьому діапазоні ми не зможемо запропонувати гідні варіанти. Якщо розглядаєте вищий бюджет — будемо раді допомогти. Телефон: 098 708 19 19.`,
        searching: false,
        cars: [],
      })
    }

    const result = await triggerParser(answers, orderId, chat)
    console.log("[ai-picker] result count:", result?.count)
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
      chatPreferences: { ...chat, offset: 20 },
    })
  }

  // ── Звичайна розмова ──────────────────────────────────────────────────────
  const hasNoCars = !cars || cars.length === 0
  const carsContext = cars?.slice(0, 6)
    .map((c: any, i: number) =>
      `${i + 1}. ${c.year ?? "—"} ${c.make} ${c.model} — €${c.price?.toLocaleString()}, ${c.mileage ? Math.round(c.mileage / 1000) + "k km" : "—"}, ${c.fuel_ua || c.fuel || "—"}, ${c.body_type_ua || c.body_type || "—"}, ${c.color_ua || c.color || "—"}`)
    .join("\n") ?? ""

  const systemPrompt = `Ти AI-консультант Fresh Auto — продаж авто з Європи до України. Відповідаєш українською, коротко. БЕЗ емодзі, БЕЗ зірочок, БЕЗ markdown.

Критерії з анкети: ${tags.join(", ") || "не вказані"}

${hasNoCars
  ? "У каталозі Fresh Auto зараз немає авто за цими критеріями."
  : `Авто в каталозі Fresh Auto:\n${carsContext}`}

═══ ЛОГІКА ═══
1. Спочатку коментуєш що є в каталозі.
2. Якщо клієнту не підходить або хоче більше — пропонуєш і запускаєш пошук на зовнішніх майданчиках.
3. Клієнт може вказати будь-які параметри: марку, модель, рік, бюджет, паливо, кузов, колір, пробіг, комплектацію (шкіра, панорама, CarPlay тощо).

ЯКЩО клієнт написав мало — уточни 1-2 параметри. Максимум 2 питання за раз.

TRIGGER_SEARCH якщо:
- Клієнт просить пошук ("знайди", "пошукай", "є ще?", "шукай")
- Клієнт незадоволений каталогом і хоче альтернативи
- Клієнт дав нові параметри після показу каталогу
- Клієнт хоче пошук на інших майданчиках

НЕ запускай пошук якщо бюджет < 20 000 EUR.

═══ БЮДЖЕТ < 20k ═══
"Fresh Auto спеціалізується на авто від 20 000 EUR. У цьому діапазоні не зможемо запропонувати гідні варіанти. Якщо розглядаєте вищий бюджет — будемо раді допомогти."

═══ ЗАГАЛЬНЕ ═══
Ціна під ключ = авто + мито 10% + акциз 5% + ПДВ 20% + доставка ~2500 EUR.
Менеджер: 098 708 19 19.`

  const triggerCheck = await callClaude(systemPrompt, messages as ChatMessage[], 20)

  if (triggerCheck.includes("TRIGGER_SEARCH")) {
    const orderId = crypto.randomUUID()
    return NextResponse.json({
      message: "Запускаю пошук на AutoScout24 та Mobile.de за вашими критеріями. Зазвичай займає 30-60 секунд.",
      searching: true,
      clientOrderId: orderId,
    })
  }

  const safePrompt = systemPrompt + "\n\nВАЖЛИВО: НЕ використовуй TRIGGER_SEARCH у відповіді. Дай корисну відповідь."
  const reply = await callClaude(safePrompt, messages as ChatMessage[], 400)
  return NextResponse.json({ message: reply || "Вибачте, спробуйте ще раз." })
}