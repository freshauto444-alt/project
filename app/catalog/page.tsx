import type { Metadata } from "next"
import { getStockCars } from "@/lib/cars"
import CatalogClient from "@/components/catalog-client"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Каталог авто з Європи — Fresh Auto",
  description: "Перевірені автомобілі преміум та бізнес-класу з Європи в наявності. Porsche, BMW, Mercedes, Audi, Lamborghini. Ціни в EUR. Київ, Рівне, Львів.",
  alternates: { canonical: "/catalog" },
  openGraph: {
    title: "Каталог авто з Європи | Fresh Auto",
    description: "Перевірені автомобілі з Євопри. Повна діагностика, CarVertical, гарантія.",
    url: "https://freshauto.ua/catalog",
  },
}

export default async function CatalogPage() {
  const cars = await getStockCars()
  return (
    <div className="pt-20">
      <CatalogClient cars={cars} />
    </div>
  )
}