import type { Metadata } from "next"
import { getFeaturedOrderCars } from "@/lib/cars"
import CatalogClient from "@/components/catalog-client"

export const revalidate = 21600

export const metadata: Metadata = {
  title: "Авто під замовлення — Fresh Auto",
  description: "Замовте будь-яке авто з Європи під ваші параметри. Персональний менеджер від пошуку до реєстрації. Доставка 7-21 день по всій Україні.",
  alternates: { canonical: "/order" },
  openGraph: {
    title: "Авто під замовлення | Fresh Auto",
    description: "Знайдемо будь-яке авто з Європи за 7-21 день. Повний супровід від замовлення до реєстрації.",
    url: "https://freshauto.ua/order",
  },
}

export default async function OrderPage() {
  const cars = await getFeaturedOrderCars()
  return (
    <div className="pt-20">
      <CatalogClient cars={cars} />
    </div>
  )
}
