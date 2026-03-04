"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence } from "framer-motion"
import CarDetailsModal from "@/components/car-details-modal"
import CheckoutFlow from "@/components/checkout-flow"
import type { Car } from "@/lib/data"

interface CarDetailsClientProps {
  car: Car
}

export default function CarDetailsClient({ car }: CarDetailsClientProps) {
  const router = useRouter()
  const [showCheckout, setShowCheckout] = useState(false)

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  const handleClose = useCallback(() => {
    router.back()
  }, [router])

  const handleCheckout = useCallback(() => {
    setShowCheckout(true)
  }, [])

  const handleCloseCheckout = useCallback(() => {
    setShowCheckout(false)
  }, [])

  if (showCheckout) {
    return <CheckoutFlow car={car} onClose={handleCloseCheckout} />
  }

  return (
    <AnimatePresence>
      <CarDetailsModal car={car} onClose={handleClose} onCheckout={handleCheckout} />
    </AnimatePresence>
  )
}
