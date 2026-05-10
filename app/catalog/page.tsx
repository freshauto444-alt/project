import type { Metadata } from "next"
import { getStockCars } from "@/lib/cars"
import CatalogClient from "@/components/catalog-client"

// Short revalidate (1 min) so admin-added stock cars appear quickly.
export const revalidate = 60

export const metadata: Metadata = {
  title: "Каталог авто з Європи в наявності — ціни, фото, характеристики",
  description: "Каталог перевірених автомобілів з Європи від Fresh Auto. BMW, Audi, Mercedes, Volvo, Porsche, Toyota в наявності. Фото, характеристики, ціни в EUR. Доставка по Україні — Київ, Рівне, Львів.",
  keywords: "каталог авто з європи, авто в наявності, купити бмв з німеччини, ауді з європи ціна, мерседес з європи, авто під ключ україна",
  alternates: { canonical: "/catalog" },
  openGraph: {
    title: "Каталог авто з Європи | Fresh Auto",
    description: "Перевірені автомобілі з Європи. Повна діагностика, гарантія, доставка.",
    url: "https://freshauto.ua/catalog",
  },
}

export default async function CatalogPage() {
  const cars = await getStockCars()
  return (
    <div className="pt-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Головна", item: "https://freshauto.ua" },
              { "@type": "ListItem", position: 2, name: "Каталог", item: "https://freshauto.ua/catalog" },
            ],
          }),
        }}
      />
      <CatalogClient cars={cars} />
    </div>
  )
}