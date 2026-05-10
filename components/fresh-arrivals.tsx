"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Gauge, Fuel, MapPin, Zap, Heart, Calendar } from "lucide-react"
import { cars, type Car, formatMileage } from "@/lib/data"
import { useSettings } from "@/lib/settings-context"
import { useSavedCars } from "@/hooks/use-saved-cars"
import { t } from "@/lib/i18n"
import { calcTotalCost } from "@/lib/constants"

interface FreshArrivalsProps {
  onSelectCar: (car: Car) => void
  onViewAll: () => void
}

function Card({ car, onSelect, index }: { car: Car; onSelect: (car: Car) => void; index: number }) {
  const { formatPrice, language } = useSettings()
  const { savedCarIds, toggleSave } = useSavedCars()
  const [loaded, setLoaded] = useState(false)
  const isSaved = savedCarIds.has(car.id)

  return (
    <div
      onClick={() => onSelect(car)}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/[0.06]"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden">
        {!loaded && <div className="absolute inset-0 skeleton-loader" />}
        {car.image && (
          <Image
            src={car.image}
            alt={`${car.year} ${car.make} ${car.model}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={`object-cover transition-transform duration-700 group-hover:scale-[1.06] ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
            priority={index < 3}
            unoptimized={car.image.startsWith("data:")}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-primary-foreground shadow-lg shadow-primary/20">
            <Zap className="h-2.5 w-2.5" />
            {car.statusUa}
          </span>
        </div>

        {/* Save button */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleSave(car.id) }}
          className={`absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition-all cursor-pointer ${
            isSaved
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "bg-black/30 text-white/60 border border-white/10 hover:text-white hover:bg-black/50"
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${isSaved ? "fill-current" : ""}`} />
        </button>

        {/* Title on image */}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-lg font-bold text-white tracking-tight drop-shadow-lg leading-tight">
            {car.make} {car.model}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="flex items-center gap-1 text-xs text-white/70">
              <Calendar className="h-3 w-3" />
              {car.year}
            </span>
            {car.countryUa && (
              <span className="flex items-center gap-1 text-xs text-white/70">
                <MapPin className="h-3 w-3" />
                {car.countryUa}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info section */}
      <div className="px-4 py-3.5">
        {/* Price row */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-foreground">{formatPrice(calcTotalCost(car.price).total)}</span>
            <span className="text-[10px] font-medium text-muted-foreground/70">під ключ</span>
          </span>
          {car.horsepower != null && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              {car.horsepower} {t("common.hp", language)}
            </span>
          )}
        </div>

        {/* Specs */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-muted-foreground/50" />
            {formatMileage(car.mileage)}
          </span>
          <span className="flex items-center gap-1.5">
            <Fuel className="h-3.5 w-3.5 text-muted-foreground/50" />
            {car.fuelUa}
          </span>
          {car.transmission && (
            <span className="text-muted-foreground/60">{car.transmission}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FreshArrivals({ onSelectCar, onViewAll: _onViewAll }: FreshArrivalsProps) {
  const { language } = useSettings()
  const [activeTab, setActiveTab] = useState<"all" | "suv" | "sedan" | "electric">("all")

  // Pre-filter once, then slice per tab — avoids re-computing on re-render.
  const pool = cars.filter((c) => (c.status === "In Stock" || c.status === "Verified") && c.image)

  const freshCars = (() => {
    let list = pool
    if (activeTab === "suv")      list = pool.filter(c => c.bodyType === "SUV")
    if (activeTab === "sedan")    list = pool.filter(c => c.bodyType === "Sedan")
    if (activeTab === "electric") list = pool.filter(c => c.fuel === "Electric")
    return list.slice(0, 9) // 3×3 grid on desktop
  })()

  const tabs: Array<{ id: typeof activeTab; labelUa: string; labelEn: string }> = [
    { id: "all",      labelUa: "Усі",          labelEn: "All" },
    { id: "suv",      labelUa: "Позашляховик", labelEn: "SUV" },
    { id: "sedan",    labelUa: "Седан",        labelEn: "Sedan" },
    { id: "electric", labelUa: "Електро",      labelEn: "Electric" },
  ]

  return (
    <section className="py-24 px-6 lg:px-10">
      <div className="w-full">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-extrabold text-foreground text-balance" style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)", letterSpacing: "-0.03em" }}>
              {t("arrivals.title", language)}
            </h2>
            <p className="mt-3 text-base font-medium text-muted-foreground leading-relaxed max-w-lg">
              {t("arrivals.subtitle", language)}
            </p>
          </div>
          <Link
            href="/catalog"
            className="group flex items-center gap-2.5 rounded-full border border-border bg-card px-6 py-3 text-sm font-bold text-foreground transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/[0.06] self-start sm:self-auto"
          >
            {t("arrivals.viewAll", language)}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Quick-filter tab pills — AutoRia/freshauto.com.ua homepage style */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-all cursor-pointer ring-1 ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "bg-card text-muted-foreground ring-border hover:text-foreground hover:ring-primary/30"
              }`}
            >
              {language === "en" ? tab.labelEn : tab.labelUa}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {freshCars.map((car, i) => (
            <Card key={car.id} car={car} onSelect={onSelectCar} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
