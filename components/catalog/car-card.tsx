"use client"

// ═══════════════════════════════════════════════════════════════════════════════
//  Catalog car tiles — CarCard (grid) + CarListItem (list) and the price-rating
//  helper they share. Extracted from inventory-catalog.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useRef, useEffect, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Car as CarIcon, Check, Eye, Fuel, Gauge, Heart, Images, MapPin, Maximize2, Shield,
} from "lucide-react"
import { type Car, formatCarTitle, formatMileage } from "@/lib/data"
import { calcTotalCost, ratePriceVsMarket, PRICE_RATING_CONFIG, lookupPriceGuide } from "@/lib/constants"
import { t } from "@/lib/i18n"
import { useSettings } from "@/lib/settings-context"
import { upgradeBbcdnUrl } from "@/lib/image-upgrade"

/* Compute a realistic price-rating badge for a car.
 * 1) Prefer same make+model comparable set (>= 3 samples).
 * 2) Fallback to same-make set if too few matches.
 * 3) Final fallback: static EU guide band (min/max).
 * All comparisons are on raw EU price (what's in car.price), consistent with the rating helper's domain.
 */
function computeCardRating(car: Car, pool: Car[]) {
  const sameModel = pool.filter(c => c.make === car.make && c.model === car.model && c.price > 0)
  let samples = sameModel.map(c => c.price)
  if (samples.length < 3) {
    const sameMake = pool.filter(c => c.make === car.make && c.price > 0)
    if (sameMake.length >= 3) samples = sameMake.map(c => c.price)
  }
  if (samples.length >= 3) return ratePriceVsMarket(car.price, samples)
  // Static guide fallback — use min/max to build a synthetic distribution
  const g = lookupPriceGuide(car.make, car.model)
  if (g) {
    const mid = (g.min + g.max) / 2
    const synth = [g.min, g.min + (g.max - g.min) * 0.3, mid, g.min + (g.max - g.min) * 0.7, g.max]
    return ratePriceVsMarket(car.price, synth)
  }
  return null
}

/* ═══════════════════════════════════════════
   CarCard — grid mode (memoized)
   ═══════════════════════════════════════════ */
export const CarCard = memo(function CarCard({
  car, onSelect, onGallery, liked, onLike, pool, onImageError,
}: {
  car: Car
  onSelect: (c: Car) => void
  onGallery: (c: Car, index: number) => void
  liked: boolean
  onLike: () => void
  pool: Car[]
  onImageError?: (carId: string) => void
}) {
  const { formatPrice, language } = useSettings()
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    if (imgRef.current?.complete) {
      // Image already in cache when this mounts. Check naturalWidth — if 0,
      // the cached request was an error (404, blocked), so we hide the card.
      if (imgRef.current.naturalWidth === 0) {
        onImageError?.(car.id)
      } else {
        setLoaded(true)
      }
    }
  }, [car.id, onImageError])
  const rating = useMemo(() => computeCardRating(car, pool), [car, pool])

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-white/[0.02] transition-all duration-300 hover:bg-white/[0.04] hover:border-border hover:shadow-2xl hover:shadow-black/20"
    >
      {/* Image */}
      <div className="relative aspect-[16/9] overflow-hidden cursor-pointer" onClick={() => onGallery(car, 0)}>
        {!loaded && <div className="absolute inset-0 animate-pulse bg-muted/50 rounded-t-2xl" />}
        {car.image && (
          <img
            ref={imgRef}
            src={upgradeBbcdnUrl(car.image)}
            alt={`${car.make} ${car.model}`}
            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${loaded ? "opacity-100" : "opacity-0"}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={e => {
              const el = e.currentTarget
              if (el.src !== car.image) { el.src = car.image!; return }
              onImageError?.(car.id)
            }}
          />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Photo count badge */}
        {car.gallery.length > 1 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/50 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-medium text-white/80">
            <Images className="h-2.5 w-2.5" />{car.gallery.length}
          </div>
        )}

        {/* Top badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          {car.verified && (
            <span className="rounded-lg bg-emerald-500/80 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
              <Shield className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />{t("catalog.verified", language)}
            </span>
          )}
          <span className={`rounded-lg px-2 py-0.5 text-[9px] font-semibold backdrop-blur-sm ${
            car.status === "In Stock" ? "bg-emerald-500/20 text-emerald-300" :
            car.status === "In Transit" ? "bg-amber-500/20 text-amber-300" :
            car.status === "Reserved" ? "bg-rose-500/20 text-rose-300" :
            "bg-primary/20 text-primary"
          }`}>{car.statusUa}</span>
        </div>

        {/* Action buttons on hover */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={e => { e.stopPropagation(); onLike() }}
            className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition-all cursor-pointer ${
              liked ? "bg-rose-500/20 text-rose-400" : "bg-black/40 text-white/70 hover:text-white"
            }`}
            aria-label="Like"
          >
            <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onSelect(car) }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/70 hover:text-white backdrop-blur-md transition-all cursor-pointer"
            aria-label="Details"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Quick specs overlay */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-2.5 text-[9px] text-white/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {car.fuelUa && <span className="flex items-center gap-1"><Fuel className="h-2.5 w-2.5" />{car.fuelUa}</span>}
          {car.horsepower != null && <span className="flex items-center gap-1"><Gauge className="h-2.5 w-2.5" />{car.horsepower} hp</span>}
          {car.drive && car.drive !== "unknown" && <span className="flex items-center gap-1"><CarIcon className="h-2.5 w-2.5" />{car.drive}</span>}
          {car.countryUa && <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{car.countryUa}</span>}
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-4 cursor-pointer" onClick={() => onSelect(car)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{formatCarTitle(car.make, car.model)}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{[car.year, car.engine, car.bodyTypeUa].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <span className="text-sm font-bold text-foreground tabular-nums block">{formatPrice(calcTotalCost(car.price).total)}</span>
            <span className="text-[9px] text-muted-foreground/70 block mt-0.5">{language === "en" ? "turnkey" : "під ключ"}</span>
            {rating && rating.rating !== "fair" && (
              <span
                className="mt-1 inline-block text-[9px] font-semibold tabular-nums rounded-md px-1.5 py-0.5"
                style={{ color: PRICE_RATING_CONFIG[rating.rating].color, background: `${PRICE_RATING_CONFIG[rating.rating].color}1A` }}
              >
                {language === "en" ? PRICE_RATING_CONFIG[rating.rating].labelEn : PRICE_RATING_CONFIG[rating.rating].label}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground/60">
          <span className="flex items-center gap-1"><Gauge className="h-3 w-3" />{formatMileage(car.mileage)}</span>
          {car.transmission && <span>{car.transmission}</span>}
          {car.countryUa && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{car.countryUa}</span>}
        </div>
      </div>
    </div>
  )
})

/* ═══════════════════════════════════════════
   CarListItem — AUTO.RIA style horizontal card
   ═══════════════════════════════════════════ */
export const CarListItem = memo(function CarListItem({
  car, onSelect, onGallery, liked, onLike, pool, onImageError,
}: {
  car: Car
  onSelect: (c: Car) => void
  onGallery: (c: Car, index: number) => void
  liked: boolean
  onLike: () => void
  pool: Car[]
  onImageError?: (carId: string) => void
}) {
  const { formatPrice, language } = useSettings()
  const [expanded, setExpanded] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    if (imgRef.current?.complete) {
      if (imgRef.current.naturalWidth === 0) onImageError?.(car.id)
      else setImgLoaded(true)
    }
  }, [car.id, onImageError])
  const rating = useMemo(() => computeCardRating(car, pool), [car, pool])

  return (
    <div className="rounded-2xl border border-border bg-white/[0.02] overflow-hidden transition-all duration-200 hover:border-border">
      {/* Main row: image left, info right */}
      <div className="flex flex-col sm:flex-row">
        {/* Image - consistent fixed size, clickable for gallery */}
        <div
          className="relative w-full sm:w-[260px] lg:w-[340px] flex-shrink-0 aspect-[16/9] overflow-hidden cursor-pointer group"
          onClick={() => onGallery(car, 0)}
        >
          {!imgLoaded && <div className="absolute inset-0 animate-pulse bg-white/[0.04]" />}
          {car.image && (
            <img
              ref={imgRef}
              src={upgradeBbcdnUrl(car.image)}
              alt={`${car.make} ${car.model}`}
              className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={e => {
                const el = e.currentTarget
                if (el.src !== car.image) { el.src = car.image!; return }
                onImageError?.(car.id)
              }}
            />
          )}
          {/* Badges on image */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            {car.verified && (
              <span className="rounded-lg bg-emerald-500/80 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm flex items-center gap-1">
                <Shield className="h-3 w-3" />{t("catalog.verifiedDealer", language)}
              </span>
            )}
          </div>
          {/* Expand icon on hover */}
          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur-md text-white/80">
              <Maximize2 className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        {/* Info section */}
        <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col">
          {/* Top: title + like */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-base sm:text-lg font-bold text-foreground hover:text-primary transition-colors cursor-pointer text-left"
                style={{ letterSpacing: "-0.01em" }}
              >
                {formatCarTitle(car.make, car.model)} {car.year}
              </button>
              <p className="text-xs text-muted-foreground mt-0.5">
                {[car.engine, car.horsepower != null ? `${car.horsepower} ${t("common.hp", language)}` : null, car.bodyTypeUa, car.conditionUa].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onLike() }}
              className={`p-2 rounded-full transition-colors cursor-pointer flex-shrink-0 ${liked ? "text-rose-400" : "text-muted-foreground/30 hover:text-muted-foreground"}`}
              aria-label="Like"
            >
              <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
            </button>
          </div>

          {/* Price — turnkey (what the buyer actually pays) */}
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <span className="text-lg sm:text-xl font-extrabold tabular-nums" style={{ color: "var(--primary)" }}>{formatPrice(calcTotalCost(car.price).total)}</span>
            <span className="text-[11px] font-medium text-muted-foreground/70">{language === "en" ? "turnkey" : "під ключ"}</span>
            {rating && rating.rating !== "fair" && (
              <span
                className="text-[10px] font-semibold tabular-nums rounded-md px-2 py-0.5"
                style={{ color: PRICE_RATING_CONFIG[rating.rating].color, background: `${PRICE_RATING_CONFIG[rating.rating].color}1A` }}
                title={`${rating.pct > 0 ? "+" : ""}${rating.pct}% vs market median`}
              >
                {language === "en" ? PRICE_RATING_CONFIG[rating.rating].labelEn : PRICE_RATING_CONFIG[rating.rating].label}
              </span>
            )}
          </div>

          {/* Specs row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" />{formatMileage(car.mileage)}</span>
            {car.fuelUa && <span className="flex items-center gap-1.5"><Fuel className="h-3.5 w-3.5" />{car.fuelUa}{car.engine && car.fuel !== "Electric" ? `, ${car.engine}` : ""}</span>}
            {car.transmission && <span className="flex items-center gap-1.5"><CarIcon className="h-3.5 w-3.5" />{car.transmission}</span>}
            {car.countryUa && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{car.countryUa}</span>}
          </div>

          {/* Tags */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${
              car.status === "In Stock" ? "bg-emerald-500/10 text-emerald-400" :
              car.status === "In Transit" ? "bg-amber-500/10 text-amber-400" :
              car.status === "Reserved" ? "bg-rose-500/10 text-rose-400" :
              "bg-primary/10 text-primary"
            }`}>{car.statusUa}</span>
            {car.drive && car.drive !== "unknown" && <span className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-white/[0.04] text-muted-foreground">{car.drive}</span>}
            {car.colorUa && <span className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-white/[0.04] text-muted-foreground">{car.colorUa}</span>}
            {car.featuresUa.slice(0, 2).map(f => (
              <span key={f} className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-white/[0.04] text-muted-foreground">{f}</span>
            ))}
          </div>

          {/* Description teaser */}
          <p className="mt-3 text-xs text-muted-foreground/60 line-clamp-2 leading-relaxed">
            {[car.make, car.model, String(car.year), car.conditionUa, car.fuelUa, car.transmission, car.colorUa, car.countryUa].filter(Boolean).join(", ")}.
          </p>
        </div>
      </div>

      {/* Expandable detail section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-5 sm:p-6 space-y-5">
              {/* Gallery thumbnails - clickable to open lightbox */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider mb-3">
                  {t("catalog.photos", language)}{car.gallery.length > 0 && <span className="ml-1.5 text-muted-foreground/30 font-normal normal-case tracking-normal">{car.gallery.length}</span>}
                </h4>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {car.gallery.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => onGallery(car, i)}
                      className="relative flex-shrink-0 w-28 h-20 sm:w-36 sm:h-24 rounded-xl overflow-hidden cursor-pointer group/thumb border border-border hover:border-primary/30 transition-colors"
                    >
                      <img
                        src={upgradeBbcdnUrl(src)}
                        alt={`${car.make} ${car.model} ${i + 1}`}
                                                className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                        loading="lazy"
                        onError={e => {
                          const el = e.currentTarget
                          if (el.src !== src) el.src = src
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/20 transition-colors flex items-center justify-center">
                        <Maximize2 className="h-4 w-4 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Specs grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { label: t("catalog.engine", language), value: car.engine },
                  { label: t("catalog.power", language), value: car.horsepower != null ? `${car.horsepower} ${t("common.hp", language)}` : null },
                  { label: t("catalog.fuel2", language), value: car.fuelUa },
                  { label: t("catalog.gearbox", language), value: car.transmission },
                  { label: t("catalog.drive2", language), value: car.drive && car.drive !== "unknown" ? car.drive : null },
                  { label: t("catalog.mileage2", language), value: formatMileage(car.mileage) },
                  { label: t("catalog.body", language), value: car.bodyTypeUa },
                  { label: t("catalog.color", language), value: car.colorUa },
                  { label: t("catalog.doors", language), value: car.doors != null ? `${car.doors}` : null },
                  { label: t("catalog.seats", language), value: car.seats != null ? `${car.seats}` : null },
                  { label: t("catalog.seatsCol", language), value: car.seatMaterialUa },
                  { label: t("catalog.country2", language), value: car.countryUa },
                ].filter((s): s is { label: string; value: string } => s.value != null && s.value !== "").map(s => (
                  <div key={s.label} className="rounded-xl bg-white/[0.02] border border-border px-3.5 py-2.5">
                    <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">{s.label}</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Features */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2">{t("catalog.features", language)}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {car.featuresUa.map(f => (
                    <span key={f} className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-primary/[0.06] text-primary">{f}</span>
                  ))}
                </div>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  onClick={() => onSelect(car)}
                  className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all cursor-pointer"
                >
                  {t("catalog.orderDetails", language)}
                </button>
                <a
                  href="tel:+380987081919"
                  className="rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-white/[0.04] transition-all"
                >
                  {t("catalog.call", language)}
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})
