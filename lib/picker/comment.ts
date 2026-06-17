import { callClaude } from "@/lib/picker/claude"
import type { ChatMessage, ChatPreferences } from "@/lib/picker/types"

// ═══════════════════════════════════════════════════════════════════════════════
//  Generate expert comment after search results
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateSearchComment(
  foundCars: any[],
  totalCount: number,
  prefs: ChatPreferences | null,
  tags: string[],
  opts?: { messages?: ChatMessage[]; prevCount?: number | null; wantsMore?: boolean },
): Promise<string> {
  if (totalCount === 0) {
    // Identify tightest constraint — suggest loosening ONE specific thing instead of vague advice
    const constraints: string[] = []
    if (prefs?.budget_max && prefs.budget_max < 30000) constraints.push(`бюджет під ключ до €${prefs.budget_max} (рідкісний діапазон)`)
    if (prefs?.year_from && prefs.year_from >= 2022) constraints.push(`рік від ${prefs.year_from} (новіші дорожчі)`)
    if (prefs?.mileage_max && prefs.mileage_max < 80000) constraints.push(`пробіг до ${Math.round(prefs.mileage_max / 1000)}k`)
    if (prefs?.color) constraints.push(`колір ${prefs.color}`)
    if (prefs?.drive === "AWD") constraints.push(`повний привід`)

    const prompt = `Ти — старший менеджер Fresh Auto (8+ років на ринку імпорту авто з Європи). Клієнт щойно натиснув пошук, результат: 0 авто.

Параметри клієнта: ${JSON.stringify(prefs)}
Анкета: ${tags.join(", ") || "не заповнена"}
${constraints.length ? `Найжорсткіші обмеження (кандидати на послаблення): ${constraints.join(", ")}` : ""}

Напиши 3-4 речення українською як живий менеджер:

1. ПОЯСНИ ЧОМУ саме ця комбінація рідкісна — ринковий факт. Приклади:
   • "Дизель + AWD + до €25k — це 2 з 100 авто на ринку, бо AWD сам по собі піднімає ціну на 15%."
   • "Чорний колір + кабріолет — рідкість: лише ~5% преміум-кабріо чорні, більшість світлі."
   • "Рік від 2023 + пробіг до 30k + під €25k — такі авто на аукціонах коштують €28-32k без розмитнення."
   • "Дизель 2.5л+ — в Європі таких майже не роблять з 2019, ринок обмежений."

2. Назви ОДИН конкретний параметр який варто послабити (з найжорсткіших вище) + ЦИФРОЮ наскільки: "+€3k до бюджету", "рік 2020 замість 2022", "пробіг до 120k", "будь-який темний колір".

3. Скажи що це РЕАЛІСТИЧНО дасть (скільки варіантів зʼявиться орієнтовно).

4. Заверши впевнено — як менеджер, не як бот. Наприклад: "Скажіть, адаптуємо і запускаю пошук знову."

БЕЗ емодзі, markdown, зірочок, нумерації в відповіді. Одним природнім абзацом. Говори як жива людина, що знає ринок — з фактами і цифрами, не ваніль.`
    // 350 tokens — 3-4 Ukrainian sentences fit comfortably and respond fast.
    const msg = await callClaude(prompt, [{ role: "user", content: "Шукаю авто" }], 350)
    return msg || "За цими точними критеріями зараз немає. Спробуйте збільшити бюджет на €2-3k або послабити пробіг — зазвичай це одразу відкриває 5-10 варіантів."
  }

  // Compute turnkey price for each car so Claude quotes final Ukrainian price, not raw EU.
  const { calcTotalCost } = await import("@/lib/constants")
  const carsDesc = foundCars.slice(0, 6).map((c: any, i: number) => {
    const turnkey = typeof c.price === "number" ? calcTotalCost(c.price).total : null
    const parts = [
      `${i + 1}. ${c.year ?? "?"} ${c.make} ${c.model}`,
      turnkey ? `€${turnkey.toLocaleString()} під ключ` : `€${c.price?.toLocaleString() ?? "?"}`,
      c.mileage ? `${Math.round(c.mileage / 1000)}k км` : null,
      c.engine || null,
      c.horsepower ? `${c.horsepower} к.с.` : null,
      c.fuel_ua || c.fuel || null,
      c.body_type_ua || c.body_type || null,
      c.color_ua || c.color || null,
      c.country_ua || c.country || null,
    ]
    return parts.filter(Boolean).join(", ")
  }).join("\n")

  // Continuity context — avoid repeating the same pitch, be honest when a
  // re-search returned the same/no-more cars, and steer toward widening the
  // YEAR (usually the real limiter) + offer monitoring / search-to-order.
  const recentAssistant = (opts?.messages ?? [])
    .filter(m => m.role === "assistant")
    .slice(-3)
    .map(m => m.content)
    .join(" | ")
  const prevCount = opts?.prevCount ?? null
  const sameAsBefore = prevCount != null && prevCount > 0 && prevCount === totalCount
  const fewResults = totalCount <= 6
  const yf = prefs?.year_from ?? null
  const yt = prefs?.year_to ?? null
  const continuityNote = [
    recentAssistant
      ? `Твої попередні репліки в цьому діалозі — НЕ повторюй їх дослівно і НЕ пере-пітч те саме авто тими ж словами, зміни фокус чи виділи інший варіант: "${recentAssistant.slice(0, 600)}"`
      : "",
    opts?.wantsMore ? "Клієнт просить БІЛЬШЕ варіантів." : "",
    sameAsBefore
      ? `Результат той самий, що й минулого разу (${totalCount} авто) — чесно це визнай, не вдавай ніби зʼявилось щось нове.`
      : "",
    fewResults
      ? `Варіантів мало (${totalCount}). Якщо обмежує РІК (зараз ${yf ?? "?"}–${yt ?? "будь-який"}) — запропонуй розширити саме рік (напр. ${yf ? yf - 2 : 2017}–${yt ?? 2024}), бо це дає більше, ніж зміна бюджету. Доречно також запропонувати поставити на моніторинг (сповістимо щойно зʼявиться) або пошук під замовлення з Німеччини, де вибір ширший.`
      : "",
  ].filter(Boolean).join("\n")

  const prompt = `Ти — старший менеджер Fresh Auto, 8+ років у підборі авто з ЄС. Клієнт щойно запустив пошук, знайдено ${totalCount} варіантів.
${continuityNote ? `\n═══ КОНТЕКСТ ДІАЛОГУ (врахуй обовʼязково) ═══\n${continuityNote}\n` : ""}

Параметри клієнта: ${JSON.stringify(prefs)}
Анкета: ${tags.join(", ") || "не заповнена"}

Топ-6 знайдених авто (ціни ВЖЕ ПІД КЛЮЧ — фінальна ціна в Україні з митом, доставкою, реєстрацією):
${carsDesc}

КРИТИЧНО — ЦІНИ:
• Усі ціни вище — під ключ (фінальна в Україні).
• Коли згадуєш конкретне авто — ПИШИ "€X під ключ" (наприклад: "Марка Модель за €31k під ключ").
• НЕ переводь назад в EU-ціну, не додавай фрази "з ЄС вийде €X".
• Клієнт оперує тільки turnkey — це те що він фактично заплатить.

Напиши відповідь (3-5 речень) українською — як менеджер старій клієнтці, не як бот:

1. Коротко — скільки знайдено (одним реченням, без переліку критеріїв — клієнт знає що шукав).
2. Виділи 1-2 КОНКРЕТНІ авто з переліку вище (за номером/маркою/ціною під ключ). Поясни ЧОМУ — через конкретну характеристику + що це дає клієнту. Приклади:
   • "Марка Модель 2021 за €31k під ключ — пробіг 65k у такого класу рідкість, Коробка(назва) вже без проблем 2014-2018 серії."
   • "Марка Модель за €29k під ключ зверніть увагу — Euro NCAP 5/5, мертва точка + автопарковка, для поїздок з дітьми плюс."
3. Попередь про нюанс ЯКЩО він є в конкретному авто зі списку: дорожчий ТО цієї марки, пробіг на межі, рідкісні запчастини. М'яко, без лякання.
4. Заверши конкретною дією: "Скажіть якщо хочете глибше перевірити цей варіант", "Можна звузити до дизелів якщо важлива економія", "Розглянете темно-сірий — вибірка зросте вдвічі".

ЗАБОРОНЕНО:
- Повторювати список критеріїв пошуку (клієнт їх знає)
- Повторювати ту саму рекомендацію тими ж словами, що в попередній репліці (дивись КОНТЕКСТ ДІАЛОГУ — виділи інший варіант або зміни кут)
- Казати "перегляньте нижче" (авто вже під чатом)
- Емодзі, markdown, зірочки, нумерація в відповіді
- Ваніль ("гарні варіанти", "непогані авто")
- Шаблонні закінчення типу "успіху у виборі"
- Ціни в EU ("€22k з ЄС") — тільки turnkey
- Конкретні суми ремонтів (€2-3k) і коди моторів (N47, OM651) — лякає

Говори ОДНИМ природнім абзацом. Як жива людина, що знає ринок і конкретні моделі.`

  try {
    // 400 tokens — fits a 3-5 sentence answer that mentions 1-2 specific cars.
    // Lower cap = faster response (user wants ≤ 10s total including parser).
    const comment = await callClaude(prompt, [{ role: "user", content: "Що знайшлось?" }], 400)
    return comment || `Знайшов ${totalCount} варіантів. Подивіться що підходить, і скажіть якщо потрібно уточнити.`
  } catch {
    return `Знайшов ${totalCount} варіантів. Подивіться що підходить, і скажіть якщо потрібно уточнити.`
  }
}
