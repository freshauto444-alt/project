"use client"

import { useState, useCallback, useEffect } from "react"
import { AnimatePresence } from "framer-motion"
import UnifiedPicker from "@/components/unified-picker"
import CarDetailsModal from "@/components/car-details-modal"
import CheckoutFlow from "@/components/checkout-flow"
import type { Car } from "@/lib/data"

export default function PickerClient() {
  const [selectedCar, setSelectedCar] = useState<Car | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [checkoutCar, setCheckoutCar] = useState<Car | null>(null)

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
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

  const handleCloseCheckout = useCallback(() => {
    setCheckoutCar(null)
  }, [])

  if (checkoutCar) {
    return <CheckoutFlow car={checkoutCar} onClose={handleCloseCheckout} />
  }

  return (
    <>
      <UnifiedPicker onSelectCar={handleSelectCar} />

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
