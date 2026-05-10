import type { Metadata } from "next"
import InfoPage from "@/components/info-page"
import ServiceCard from "@/components/service-card"
import { serviceModules } from "@/lib/services-data"

export const metadata: Metadata = {
  title: "Послуги — Fresh Auto",
  description: "Повний спектр послуг Fresh Auto: каталог авто з Європи, AI підбір, підбір та доставка за 7-21 день, викуп та Trade-In, реалізація авто, сервіс та гарантія.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Послуги | Fresh Auto",
    description: "Каталог, AI підбір, доставка, Trade-In, реалізація та сервіс авто з Європи.",
    url: "https://freshauto.ua/services",
  },
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Скільки коштує доставка авто з Європи?",
      acceptedAnswer: { "@type": "Answer", text: "Вартість залежить від країни та типу авто. Зазвичай від €800 до €2500 включаючи розмитнення та оформлення." },
    },
    {
      "@type": "Question",
      name: "Як довго займає доставка авто з Європи?",
      acceptedAnswer: { "@type": "Answer", text: "Від 7 до 21 днів залежно від країни походження та наявності авто. Доставка по Україні — 3-7 днів." },
    },
    {
      "@type": "Question",
      name: "Чи є гарантія на авто?",
      acceptedAnswer: { "@type": "Answer", text: "Так, всі автомобілі проходять діагностику на 150+ пунктів. Ми надаємо гарантію та повний пакет документів." },
    },
    {
      "@type": "Question",
      name: "Чи можна обміняти старе авто на нове (Trade-In)?",
      acceptedAnswer: { "@type": "Answer", text: "Так, ми пропонуємо послугу Trade-In. Безкоштовна оцінка вашого авто за 1 годину, виплата протягом доби." },
    },
  ],
}

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Головна", item: "https://freshauto.ua" },
    { "@type": "ListItem", position: 2, name: "Послуги" },
  ],
}

export default function ServicesPage() {
  return (
    <div className="pt-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <InfoPage title="Послуги">
        <p>
          {"Втілюй мрії разом з Fresh Auto. Швидка покупка авто на вигідних умовах, з гарантією та оформленням. Повний спектр послуг — від підбору та доставки автомобіля з Європи до обслуговування, викупу та реалізації."}
        </p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { num: "500+", label: "Проданих авто" },
            { num: "7-21", label: "Днів доставка" },
            { num: "150+", label: "Пунктів діагностики" },
            { num: "24/7", label: "Підтримка менеджера" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-5 text-center">
              <div className="text-2xl font-extrabold text-primary">{s.num}</div>
              <div className="text-xs font-medium text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {serviceModules.map((svc) => (
            <ServiceCard key={svc.id} svc={svc} />
          ))}
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-8">
          <h3 className="text-base font-semibold text-foreground mb-2">{"Потрібна консультація?"}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            {"Наші менеджери готові відповісти на всі ваші питання. Зверніться — і ми допоможемо реалізувати вашу автівкову мрію."}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="tel:+380987081919"
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all"
            >
              {"098 708 19 19 — Ігор"}
            </a>
            <a
              href="tel:+380678160505"
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all"
            >
              {"067 816 05 05 — Руслан"}
            </a>
            <a
              href="https://www.instagram.com/freshauto_ua/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-all"
            >
              {"Instagram"}
            </a>
          </div>
        </div>
      </InfoPage>
    </div>
  )
}
