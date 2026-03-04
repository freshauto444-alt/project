import type { Metadata } from "next"
import InfoPage from "@/components/info-page"

export const metadata: Metadata = {
  title: "Політика Cookies — Fresh Auto",
  description: "Політика використання файлів cookies на сайті Fresh Auto. Типи cookies, їх призначення та способи керування.",
  alternates: { canonical: "/cookies" },
  robots: { index: false, follow: false },
}

const cookieTypes = [
  {
    type: "Необхідні (Strictly Necessary)",
    desc: "Забезпечують базову функціональність Сайту: авторизація, збереження кошика, налаштування мови. Не потребують вашої згоди.",
    duration: "Сесія / до 1 року",
  },
  {
    type: "Аналітичні (Analytics)",
    desc: "Допомагають зрозуміти, як відвідувачі взаємодіють з Сайтом. Ми використовуємо Vercel Analytics та Google Analytics для збору анонімної статистики.",
    duration: "До 2 років",
  },
  {
    type: "Функціональні (Functional)",
    desc: "Запам'ятовують ваші налаштування: обрані фільтри в каталозі, збережені автомобілі, режим відображення (темна/світла тема).",
    duration: "До 1 року",
  },
  {
    type: "Маркетингові (Marketing)",
    desc: "Використовуються для показу релевантної реклами на інших платформах (Meta Pixel, Google Ads). Збирають інформацію про ваші інтереси для персоналізації.",
    duration: "До 2 років",
  },
]

export default function CookiesPage() {
  return (
    <div className="pt-20">
      <InfoPage title="Політика Cookies">
        <p className="text-xs text-muted-foreground/60">
          {"Дата набуття чинності: 01 січня 2026 р. | Останнє оновлення: 01 січня 2026 р."}
        </p>

        <h2 className="text-foreground font-semibold text-base mt-4">{"1. Що таке Cookies?"}</h2>
        <p>
          {"Cookies — це невеликі текстові файли, які зберігаються на вашому пристрої під час відвідування веб-сайту. Вони допомагають забезпечити коректну роботу Сайту, запам'ятати ваші налаштування та покращити загальний досвід використання."}
        </p>

        <h2 className="text-foreground font-semibold text-base mt-4">{"2. Які Cookies ми використовуємо"}</h2>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-1 divide-y divide-border">
            {cookieTypes.map((c) => (
              <div key={c.type} className="p-4 sm:p-5">
                <div className="text-sm font-semibold text-foreground mb-1">{c.type}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
                <div className="text-[10px] text-muted-foreground/50 mt-1.5">{"Термін зберігання: "}{c.duration}</div>
              </div>
            ))}
          </div>
        </div>

        <h2 className="text-foreground font-semibold text-base mt-4">{"3. Cookies третіх сторін"}</h2>
        <p>
          {"Деякі cookies встановлюються сторонніми сервісами: Vercel Analytics, Google Analytics, Meta Pixel, Google Maps. Ці сервіси мають власні Політики конфіденційності."}
        </p>

        <h2 className="text-foreground font-semibold text-base mt-4">{"4. Управління Cookies"}</h2>
        <p>
          {"Ви можете контролювати та видаляти cookies через налаштування браузера. Інструкції для браузерів: Chrome — Налаштування › Конфіденційність і безпека › Файли cookie; Firefox — Налаштування › Приватність і захист; Safari — Налаштування › Конфіденційність; Edge — Налаштування › Файли cookie та дозволи."}
        </p>

        <h2 className="text-foreground font-semibold text-base mt-4">{"5. Контакти"}</h2>
        <p>
          {"Email: privacy@freshauto.ua | Телефон: "}
          <a href="tel:+380987081919" className="text-primary hover:underline">+380 98 708 19 19</a>
        </p>
      </InfoPage>
    </div>
  )
}
