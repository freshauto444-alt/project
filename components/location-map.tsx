"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { MapPin, Navigation, Clock, Phone, ExternalLink } from "lucide-react"

const LOCATION = {
  lat: 50.4501,
  lng: 30.5234,
  address: "Київ / Рівне / Львів",
  name: "Fresh Auto",
  phone: "098 708 19 19",
  phone2: "067 816 05 05",
  hours: "Пн-Сб: 09:00 - 19:00",
}

// Apple Maps link
const APPLE_MAPS_URL = `https://maps.apple.com/?daddr=${LOCATION.lat},${LOCATION.lng}&dirflg=d`
// Google Maps link (fallback for non-Apple)
const GOOGLE_MAPS_URL = `https://www.google.com/maps/dir/?api=1&destination=${LOCATION.lat},${LOCATION.lng}`

function getDirectionsUrl() {
  // Detect Apple devices
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("macintosh")) {
      return APPLE_MAPS_URL
    }
  }
  return GOOGLE_MAPS_URL
}

export default function LocationMap() {
  const [mapHover, setMapHover] = useState(false)

  return (
    <section className="py-20 px-6 border-t border-white/[0.04]">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl text-balance">
            {"Наш шоурум"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {"Завітайте до нас для живого огляду автомобілів."}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Map */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <a
              href={getDirectionsUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={() => setMapHover(true)}
              onMouseLeave={() => setMapHover(false)}
              className="relative block aspect-[16/9] lg:aspect-[2/1] rounded-2xl overflow-hidden border border-white/[0.06] group cursor-pointer"
            >
              {/* Dark-style map using OSM tiles with dark filter */}
              <div className="absolute inset-0 bg-[#0A0A0A]">
                <iframe
                  title="Fresh Auto Location"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${LOCATION.lng - 0.02}%2C${LOCATION.lat - 0.01}%2C${LOCATION.lng + 0.02}%2C${LOCATION.lat + 0.01}&layer=mapnik&marker=${LOCATION.lat}%2C${LOCATION.lng}`}
                  className="w-full h-full border-0 pointer-events-none"
                  style={{
                    filter: "invert(1) hue-rotate(180deg) saturate(0.3) brightness(0.7) contrast(1.2)",
                  }}
                  loading="lazy"
                />
              </div>

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#030303]/80 via-transparent to-transparent" />

              {/* Pin indicator */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <div className="relative">
                  <div className="absolute -inset-3 rounded-full bg-primary/20 animate-ping" />
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/20">
                    <MapPin className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-foreground font-medium">{LOCATION.address}</span>
                </div>
                <div className={`flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5 text-[11px] font-medium text-primary transition-all ${mapHover ? "bg-primary/20" : ""}`}>
                  <Navigation className="h-3 w-3" />
                  {"Побудувати маршрут"}
                  <ExternalLink className="h-2.5 w-2.5" />
                </div>
              </div>
            </a>
          </motion.div>

          {/* Info cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col gap-3"
          >
            <div className="rounded-2xl border border-white/[0.06] bg-card p-5 flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.08]">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{"Адреса"}</h3>
                  <p className="text-[11px] text-muted-foreground">{LOCATION.address}</p>
                </div>
              </div>
              <a
                href={getDirectionsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/[0.06] border border-primary/10 py-3 text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              >
                <Navigation className="h-3.5 w-3.5" />
                {"Відкрити в картах"}
              </a>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-card p-5 flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.08]">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{"Графік роботи"}</h3>
                  <p className="text-[11px] text-muted-foreground">{LOCATION.hours}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-[11px]">
                {[
                  { day: "Пн-Пт", time: "09:00 - 19:00" },
                  { day: "Сб", time: "10:00 - 17:00" },
                  { day: "Нд", time: "Вихідний" },
                ].map(s => (
                  <div key={s.day} className="flex justify-between text-muted-foreground">
                    <span>{s.day}</span>
                    <span className="text-foreground">{s.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-card p-5 flex-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.08]">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{"Контакти"}</h3>
                  <a href={`tel:+380${LOCATION.phone.replace(/\s/g, "").slice(1)}`} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors block">{LOCATION.phone} (Ігор)</a>
                  <a href={`tel:+380${LOCATION.phone2.replace(/\s/g, "").slice(1)}`} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors block">{LOCATION.phone2} (Руслан)</a>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
