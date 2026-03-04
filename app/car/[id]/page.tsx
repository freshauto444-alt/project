import { getCar } from "@/lib/cars"
import CarDetailsClient from "@/components/car-details-client"
import { notFound } from "next/navigation"

export async function generateMetadata({ params }: { params: { id: string } }) {
  const car = await getCar(params.id)
  if (!car) return { title: "Авто не знайдено" }
  return {
    title: `${car.make} ${car.model} ${car.year} | Fresh Auto`,
    description: `${car.make} ${car.model} ${car.year}, ${car.engine}, ${car.horsepower} к.с. Ціна: ${car.price} EUR. ${car.conditionUa}.`,
    openGraph: {
      images: [car.image],
      title: `${car.make} ${car.model} ${car.year}`,
    },
  }
}


export default async function CarPage({ params }: { params: { id: string } }) {
  const car = await getCar(params.id)
  if (!car) notFound()
  return <CarDetailsClient car={car} />
}