"use client"

import { useState } from "react"
import { ArrowRight, Gauge, Fuel, MapPin, Zap } from "lucide-react"
import { cars, type Car, formatMileage } from "@/lib/data"
import { useSettings } from "@/lib/settings-context"

interface FreshArrivalsProps {
  onSelectCar: (car: Car) => void
  onViewAll: () => void
}

function Card({ car, onSelect, index }: { car: Car; onSelect: (car: Car) => void; index: number }) {
  const { formatPrice } = useSettings()
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      onClick={() => onSelect(car)}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-white/[0.06] bg-card transition-colors duration-300 hover:border-primary/20"
    >
      {/* -- Large image -- */}
      <div className="relative aspect-[16/9] overflow-hidden">
        {!loaded && <div className="absolute inset-0 skeleton-loader" />}
        <img
          src={car.image}
          alt={`${car.year} ${car.make} ${car.model}`}
          crossOrigin="anonymous"
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Status badge */}
        <div className="absolute top-4 left-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1.5 text-xs font-bold text-primary-foreground backdrop-blur-sm">
            <Zap className="h-3 w-3" />
            {car.statusUa}
          </span>
        </div>

        {/* Price badge */}
        <div className="absolute top-4 right-4">
          <span className="rounded-full bg-background/80 backdrop-blur-sm px-4 py-1.5 text-sm font-bold text-foreground">
            {formatPrice(car.price)}
          </span>
        </div>

        {/* Title overlay on image */}
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-xl font-bold text-white tracking-tight drop-shadow-md">
            {car.make} {car.model}
          </h3>
          <p className="text-sm font-medium text-white/70 mt-0.5 drop-shadow-sm">{car.year}</p>
        </div>
      </div>

      {/* -- Specs row -- */}
      <div className="flex items-center gap-5 px-5 py-4 text-sm font-medium text-muted-foreground">
        <span className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary/50" />
          {formatMileage(car.mileage)}
        </span>
        <span className="flex items-center gap-2">
          <Fuel className="h-4 w-4 text-primary/50" />
          {car.fuelUa}
        </span>
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary/50" />
          {car.countryUa}
        </span>
        <span className="ml-auto text-sm font-bold text-primary/70">
          {car.horsepower} {"k.c."}
        </span>
      </div>
    </div>
  )
}

export default function FreshArrivals({ onSelectCar, onViewAll }: FreshArrivalsProps) {
  const freshCars = cars.filter((c) => c.status === "In Stock" || c.status === "Verified").slice(0, 6)

  return (
    <section className="py-24 px-6 lg:px-10">
      <div className="w-full">
        <div
          className="mb-14 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h2 className="font-extrabold text-foreground text-balance" style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)", letterSpacing: "-0.03em" }}>
              {"Свіжі надходження"}
            </h2>
            <p className="mt-3 text-base font-medium text-muted-foreground leading-relaxed max-w-lg">
              {"Перевірені автомобілі з Європи, готові до оформлення та доставки."}
            </p>
          </div>
          <button
            onClick={onViewAll}
            className="group flex items-center gap-2.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-sm font-bold text-foreground transition-all hover:bg-white/[0.08] cursor-pointer self-start sm:self-auto"
          >
            {"Весь каталог"}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* -- 3-column grid for large cards, 2-col tablet, 1-col mobile -- */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {freshCars.map((car, i) => (
            <Card key={car.id} car={car} onSelect={onSelectCar} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
