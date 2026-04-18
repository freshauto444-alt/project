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

  const fuelMap: Record<string, string> = {
    "Бензин": "https://schema.org/Gasoline",
    "Дизель": "https://schema.org/Diesel",
    "Електро": "https://schema.org/Electric",
    "Гібрид": "https://schema.org/Hybrid",
  }

  const schema = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: `${car.make} ${car.model} ${car.year}`,
    brand: { "@type": "Brand", name: car.make },
    model: car.model,
    vehicleModelDate: String(car.year),
    image: car.image || undefined,
    color: car.colorUa || car.color || undefined,
    mileageFromOdometer: car.mileage ? {
      "@type": "QuantitativeValue",
      value: car.mileage,
      unitCode: "KMT",
    } : undefined,
    vehicleEngine: car.horsepower ? {
      "@type": "EngineSpecification",
      enginePower: { "@type": "QuantitativeValue", value: car.horsepower, unitCode: "BHP" },
    } : undefined,
    fuelType: car.fuelUa ? fuelMap[car.fuelUa] : undefined,
    vehicleTransmission: car.transmission || undefined,
    driveWheelConfiguration: car.drive || undefined,
    bodyType: car.bodyTypeUa || car.bodyType || undefined,
    itemCondition: car.condition === "used" ? "https://schema.org/UsedCondition" : "https://schema.org/NewCondition",
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: car.price,
      availability: car.status === "Sold" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      seller: { "@type": "AutoDealer", name: "Fresh Auto", url: "https://freshauto.ua" },
    },
  }

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Головна", item: "https://freshauto.ua" },
      { "@type": "ListItem", position: 2, name: "Каталог", item: "https://freshauto.ua/catalog" },
      { "@type": "ListItem", position: 3, name: `${car.make} ${car.model} ${car.year}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <CarDetailsClient car={car} />
    </>
  )
}