"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence } from "framer-motion"
import HeroSection from "@/components/hero-section"
import FreshArrivals from "@/components/fresh-arrivals"
import InventoryCatalog from "@/components/inventory-catalog"
import CarDetailsModal from "@/components/car-details-modal"
import CheckoutFlow from "@/components/checkout-flow"
import LocationMap from "@/components/location-map"
import AiShowcaseCard from "@/components/ai-showcase-card"
import ServiceCard from "@/components/service-card"
import { type Car } from "@/lib/data"
import { createClient } from "@/lib/supabase/client"
import { mapDbCar } from "@/lib/data"
import { serviceModules } from "@/lib/services-data"
import { Sparkles, ArrowRight } from "lucide-react"

type HomeView = "home" | "catalog" | "checkout"

export default function Page() {
  const router = useRouter()
  const [allCarsData, setAllCarsData] = useState<Car[]>([])
  const [homeView, setHomeView] = useState<HomeView>("home")
  const [selectedCar, setSelectedCar] = useState<Car | null>(null)
  const [checkoutCar, setCheckoutCar] = useState<Car | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [showModal])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("cars")
      .select("*")
      .order("price", { ascending: true })
      .then(({ data }) => {
        if (data) setAllCarsData(data.map(mapDbCar))
      })
  }, [])

  const handleSelectCar = useCallback((car: Car) => {
    setSelectedCar(car)
    setShowModal(true)
  }, [])

  const handleCheckout = useCallback((car: Car) => {
    setCheckoutCar(car)
    setShowModal(false)
    setSelectedCar(null)
    setHomeView("checkout")
  }, [])

  const handleCloseModal = useCallback(() => {
    setShowModal(false)
    setTimeout(() => setSelectedCar(null), 350)
  }, [])

  const handleCloseCheckout = useCallback(() => {
    setCheckoutCar(null)
    setHomeView("home")
  }, [])

  if (homeView === "catalog") {
    return (
      <div className="pt-20">
        <InventoryCatalog onSelectCar={handleSelectCar} user={null} cars={allCarsData} />
        <AnimatePresence>
          {showModal && selectedCar && (
            <CarDetailsModal car={selectedCar} onClose={handleCloseModal} onCheckout={handleCheckout} />
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (homeView === "checkout") {
    return (
      <div className="pt-20">
        <CheckoutFlow car={checkoutCar} onClose={handleCloseCheckout} />
      </div>
    )
  }

  return (
    <>
      {/* Hero */}
      <HeroSection
        onExplore={() => router.push("/catalog")}
        onFinder={() => router.push("/picker")}
      />

      {/* Fresh Arrivals */}
      <FreshArrivals
        onSelectCar={handleSelectCar}
        onViewAll={() => router.push("/catalog")}
      />

      {/* AI Picker Showcase */}
      <section className="py-20 px-6 lg:px-10">
        <div className="w-full text-center mb-16">
          <div
            className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-widest mb-6"
            style={{ background: "rgba(0,210,198,0.08)", color: "#00D2C6", border: "1px solid rgba(0,210,198,0.15)" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {"AI Підбір"}
          </div>
          <h2
            className="font-extrabold tracking-tight text-foreground text-balance"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)", letterSpacing: "-0.03em" }}
          >
            {"Розумний підбір авто"}
          </h2>
          <p className="mt-4 text-lg font-medium text-muted-foreground max-w-lg mx-auto leading-relaxed">
            {"Опишіть побажання, а AI знайде ідеальний варіант серед сотень перевірених авто."}
          </p>
        </div>
        <div className="mx-auto max-w-4xl flex flex-col gap-5">
          {allCarsData.slice(0, 3).map((car) => (
            <AiShowcaseCard key={car.id} car={car} onSelect={handleSelectCar} />
          ))}
        </div>
        <div className="text-center mt-12">
          <button
            onClick={() => router.push("/picker")}
            className="inline-flex items-center gap-2 rounded-full px-10 py-4 font-bold text-base cursor-pointer transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(16px)",
              color: "#00D2C6",
              border: "1px solid rgba(0,210,198,0.2)",
            }}
          >
            <Sparkles className="h-4 w-4" />
            {"Спробувати AI Підбір"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Services preview */}
      <section className="py-24 px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2
              className="font-extrabold text-foreground text-balance"
              style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)", letterSpacing: "-0.03em" }}
            >
              {"Наші послуги"}
            </h2>
            <p className="mt-4 text-lg font-medium text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {"Повний цикл роботи з автомобілями: від підбору та доставки до викупу, обміну та сервісу."}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {serviceModules.map((svc) => (
              <ServiceCard key={svc.id} svc={svc} />
            ))}
          </div>
          <div className="text-center mt-10">
            <button
              onClick={() => router.push("/services")}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all cursor-pointer"
            >
              {"Всі послуги"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Trust section */}
      <section className="py-20 px-6 lg:px-10 border-t border-border">
        <div className="mx-auto max-w-5xl text-center">
          <h2
            className="font-extrabold text-foreground mb-5 text-balance"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)", letterSpacing: "-0.03em" }}
          >
            {"Нам довіряють"}
          </h2>
          <p className="text-base font-medium text-muted-foreground max-w-lg mx-auto leading-relaxed mb-14">
            {"Тисячі задоволених клієнтів з різних країн Європи та України."}
          </p>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            {[
              { value: "2 400+", label: "Реалізованих авто" },
              { value: "14", label: "Країн присутності" },
              { value: "< 1 хв", label: "Відповідь менеджера" },
            ].map((stat, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-8 lg:p-10">
                <div className="text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">{stat.value}</div>
                <div className="mt-2 text-sm font-medium text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Map */}
      <LocationMap />

      {/* Car detail modal */}
      <AnimatePresence>
        {showModal && selectedCar && (
          <CarDetailsModal car={selectedCar} onClose={handleCloseModal} onCheckout={handleCheckout} />
        )}
      </AnimatePresence>
    </>
  )
}
