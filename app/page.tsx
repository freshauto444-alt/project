"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { AnimatePresence } from "framer-motion"
import HeroSection from "@/components/hero-section"
import FreshArrivals from "@/components/fresh-arrivals"
import ServiceCard from "@/components/service-card"

// Lazy load heavy components — only loaded when needed
const InventoryCatalog = dynamic(() => import("@/components/inventory-catalog"), { ssr: false })
const CarDetailsModal = dynamic(() => import("@/components/car-details-modal"), { ssr: false })
const CheckoutFlow = dynamic(() => import("@/components/checkout-flow"), { ssr: false })
const LocationMap = dynamic(() => import("@/components/location-map"), { ssr: false })
const AiShowcaseCard = dynamic(() => import("@/components/ai-showcase-card"), { ssr: false })
import { type Car } from "@/lib/data"
import { createClient } from "@/lib/supabase/client"
import { mapDbCar } from "@/lib/data"
import { serviceModules } from "@/lib/services-data"
import { useSettings } from "@/lib/settings-context"
import { t } from "@/lib/i18n"
import { Sparkles, ArrowRight } from "lucide-react"

type HomeView = "home" | "catalog" | "checkout"

export default function Page() {
  const router = useRouter()
  const { language } = useSettings()
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
    // Check sessionStorage cache first (avoids re-fetch on navigation)
    try {
      const cached = sessionStorage.getItem("homeCars")
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < 300000) { // 5 min cache
          setAllCarsData(data)
          return
        }
      }
    } catch {}

    const supabase = createClient()
    supabase
      .from("cars")
      .select("id,make,model,year,price,mileage,fuel,fuel_ua,transmission,drive,body_type,body_type_ua,color,color_ua,horsepower,image,gallery,source_type,source_url,source_site,country,country_ua,condition,status")
      .order("price", { ascending: true })
      .limit(100) // Don't load ALL cars — limit for homepage
      .then(({ data }) => {
        if (data) {
          const mapped = data.map(mapDbCar)
          setAllCarsData(mapped)
          try { sessionStorage.setItem("homeCars", JSON.stringify({ data: mapped, ts: Date.now() })) } catch {}
        }
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
        <AnimatePresence mode="wait">
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

      {/* AI Picker Showcase — only show if we have car data */}
      <section className="py-20 px-6 lg:px-10">
        <div className="w-full text-center mb-12">
          <div
            className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-widest mb-6 bg-primary/[0.08] text-primary border border-primary/15"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("ai.badge", language)}
          </div>
          <h2
            className="font-extrabold tracking-tight text-foreground text-balance"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)", letterSpacing: "-0.03em" }}
          >
            {t("ai.title", language)}
          </h2>
          <p className="mt-4 text-lg font-medium text-muted-foreground max-w-lg mx-auto leading-relaxed">
            {t("ai.subtitle", language)}
          </p>
        </div>
        {allCarsData.length > 0 && (
          <div className="mx-auto max-w-4xl flex flex-col gap-4 mb-10">
            {allCarsData.slice(0, 3).map((car) => (
              <AiShowcaseCard key={car.id} car={car} onSelect={handleSelectCar} />
            ))}
          </div>
        )}
        <div className="text-center">
          <Link
            href="/picker"
            className="inline-flex items-center gap-2 rounded-full px-10 py-4 font-bold text-base cursor-pointer transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:brightness-110"
          >
            <Sparkles className="h-4 w-4" />
            {t("ai.cta", language)}
            <ArrowRight className="h-4 w-4" />
          </Link>
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
              {t("services.title", language)}
            </h2>
            <p className="mt-4 text-lg font-medium text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t("services.subtitle", language)}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {serviceModules.map((svc) => (
              <ServiceCard key={svc.id} svc={svc} />
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all"
            >
              {t("services.all", language)}
              <ArrowRight className="h-4 w-4" />
            </Link>
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
            {t("trust.title", language)}
          </h2>
          <p className="text-base font-medium text-muted-foreground max-w-lg mx-auto leading-relaxed mb-14">
            {t("trust.subtitle", language)}
          </p>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            {[
              { value: "2 400+", label: t("trust.stat1", language) },
              { value: "14", label: t("trust.stat2", language) },
              { value: language === "en" ? "< 1 min" : "< 1 хв", label: t("trust.stat3", language) },
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
