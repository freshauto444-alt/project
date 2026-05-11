"use client"

import { useState, useCallback, useEffect } from "react"
import { AnimatePresence } from "framer-motion"
import InventoryCatalog from "@/components/inventory-catalog"
import CarDetailsModal from "@/components/car-details-modal"
import CheckoutFlow from "@/components/checkout-flow"
import type { Car } from "@/lib/data"

// Server-paginated catalog for /order. Holds the accumulated cars list in
// state; "Load more" fetches the next page from /api/cars/order?offset=… and
// appends. Wraps the standard CatalogClient flow (modal + checkout).

interface Props {
  initialCars: Car[]
  initialTotal: number
}

const PAGE_SIZE = 20  // additional cars per "Load more" click

export default function OrderCatalogClient({ initialCars, initialTotal }: Props) {
  const [cars, setCars] = useState<Car[]>(initialCars)
  const [total, setTotal] = useState<number>(initialTotal)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedCar, setSelectedCar] = useState<Car | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [checkoutCar, setCheckoutCar] = useState<Car | null>(null)
  // Active server-side search query. Empty string = no query (default page).
  const [query, setQuery] = useState<string>("")

  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [showModal])

  const handleSelectCar = useCallback((car: Car) => {
    setSelectedCar(car)
    setShowModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setShowModal(false)
    setTimeout(() => setSelectedCar(null), 350)
  }, [])

  const handleCheckout = useCallback((car: Car) => {
    setCheckoutCar(car)
    setShowModal(false)
    setSelectedCar(null)
  }, [])

  const handleCloseCheckout = useCallback(() => setCheckoutCar(null), [])

  // Called by InventoryCatalog when its "Show more" button is clicked AND
  // the locally-visible slice has reached the end of the available cars list.
  const loadMore = useCallback(async (): Promise<Car[]> => {
    if (loadingMore) return []
    if (cars.length >= total && total > 0) return []
    setLoadingMore(true)
    try {
      const qs = new URLSearchParams({ offset: String(cars.length), limit: String(PAGE_SIZE) })
      if (query) qs.set("q", query)
      const res = await fetch(`/api/cars/order?${qs}`)
      if (!res.ok) return []
      const data = await res.json() as { cars: Car[]; total: number; hasMore: boolean }
      const newCars: Car[] = data.cars ?? []
      if (newCars.length > 0) {
        setCars(prev => {
          // Dedup by id (in case scoring shuffled order between fetches)
          const seen = new Set(prev.map(c => c.id))
          const fresh = newCars.filter(c => !seen.has(c.id))
          return [...prev, ...fresh]
        })
      }
      if (typeof data.total === "number") setTotal(data.total)
      return newCars
    } catch {
      return []
    } finally {
      setLoadingMore(false)
    }
  }, [cars.length, total, loadingMore, query])

  // Server-side search — debounced upstream by InventoryCatalog (350 ms).
  // Replaces the visible list with the first 50 results from /api/cars/order
  // matching `q` across make + model. Empty query resets to the default page.
  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    try {
      const qs = new URLSearchParams({ offset: "0", limit: "50" })
      if (q) qs.set("q", q)
      const res = await fetch(`/api/cars/order?${qs}`)
      if (!res.ok) return
      const data = await res.json() as { cars: Car[]; total: number }
      setCars(data.cars ?? [])
      setTotal(typeof data.total === "number" ? data.total : 0)
    } catch { /* keep current state on network error */ }
  }, [])

  if (checkoutCar) {
    return <CheckoutFlow car={checkoutCar} onClose={handleCloseCheckout} />
  }

  const hasMoreOnServer = cars.length < total

  return (
    <>
      <InventoryCatalog
        onSelectCar={handleSelectCar}
        user={null}
        cars={cars}
        onLoadMore={hasMoreOnServer ? loadMore : undefined}
        loadingMore={loadingMore}
        totalCount={total}
        onSearchChange={handleSearch}
      />

      <AnimatePresence>
        {showModal && selectedCar && (
          <CarDetailsModal
            car={selectedCar}
            onClose={handleCloseModal}
            onCheckout={handleCheckout}
          />
        )}
      </AnimatePresence>
    </>
  )
}
