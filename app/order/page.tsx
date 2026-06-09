import type { Metadata } from "next"
import { getFeaturedOrderCars } from "@/lib/cars"
import OrderCatalogClient from "@/components/order-catalog-client"

// 4-hour ISR cache — fresh parser batches drop every 4-6h, so this gives
// users a stable selection within each refresh window while still rotating
// to newer stock at each batch. Less DB churn than the previous 60s
// revalidate, no perceptible loss of freshness.
export const revalidate = 14400

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
  // Initial server-side fetch — 50 most relevant cars by value score
  const { cars, total } = await getFeaturedOrderCars(0, 50)
  return (
    <div className="pt-20">
      <OrderCatalogClient initialCars={cars} initialTotal={total} />
    </div>
  )
}
