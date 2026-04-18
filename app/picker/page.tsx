import type { Metadata } from "next"
import PickerClient from "@/components/picker-client"

export const metadata: Metadata = {
  title: "AI Підбір авто з Європи | Знайти авто за 30 секунд — Fresh Auto",
  description: "Безкоштовний AI підбір автомобіля з Європи. Вкажіть бюджет, тип кузова та побажання — штучний інтелект миттєво знайде найкращі пропозиції з AutoScout24, Mobile.de та шведських майданчиків. BMW, Audi, Mercedes, Volvo, Toyota від 20 000 EUR.",
  keywords: "підбір авто, авто з європи, купити авто німеччина, AI підбір автомобіля, автомобілі з європи ціни, fresh auto, bmw з німеччини, audi з європи, mercedes з європи",
  alternates: { canonical: "/picker" },
  openGraph: {
    title: "AI Підбір авто з Європи — Fresh Auto",
    description: "Знайдіть ідеальне авто за 30 секунд. AI аналізує побажання та шукає по 4 європейських майданчиках.",
    url: "https://freshauto.ua/picker",
    type: "website",
  },
}

export default function PickerPage() {
  return (
    <main className="pt-20">
      {/* SEO: structured data for Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Fresh Auto AI Підбір",
            description: "Інтелектуальний підбір автомобіля з Європи",
            url: "https://freshauto.ua/picker",
            applicationCategory: "Automotive",
            operatingSystem: "Web",
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "EUR",
              lowPrice: 15000,
              highPrice: 200000,
              offerCount: "5000+",
            },
          }),
        }}
      />
      <PickerClient />
    </main>
  )
}
