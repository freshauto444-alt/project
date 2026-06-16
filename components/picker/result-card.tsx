"use client"

// ═══════════════════════════════════════════════════════════════════════════════
//  ResultCard — a single car result tile (gallery, turnkey price, market rating).
//  Shared by the chat stream and the results screen. Extracted from unified-picker.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import { Car, ChevronLeft, ChevronRight, Gauge } from "lucide-react"
import { type Car as CarType, formatCarTitle } from "@/lib/data"
import { calcTotalCost, SOURCE_SITES, ratePriceVsMarket, PRICE_RATING_CONFIG } from "@/lib/constants"
import { upgradeBbcdnUrl } from "@/lib/image-upgrade"
import { t } from "@/lib/i18n"
import { useSettings } from "@/lib/settings-context"

export function ResultCard({ car, onClick, allCars }: { car: CarType; onClick: () => void; allCars: CarType[] }) {
  const { language } = useSettings()
  const totalCost = car.price ? calcTotalCost(car.price) : null
  const sourceSiteKey = (car as any).sourceSite || (car as any).source_site || ""
  const source = SOURCE_SITES[sourceSiteKey] || null

  // Gallery for in-card carousel.
  const gallery: string[] = Array.isArray((car as any).gallery)
    ? ((car as any).gallery as unknown[]).filter((g): g is string => typeof g === "string" && g.length > 0)
    : []
  const [imgIdx, setImgIdx] = useState(0)
  const displayImage = gallery.length > 0 ? gallery[imgIdx] ?? gallery[0] : car.image
  const totalImages = gallery.length || (car.image ? 1 : 0)

  // Price rating vs market — prefer same make+model (tighter comparable set) with make fallback.
  const samePrices = allCars
    .filter(c => c.make === car.make && c.model === car.model && c.price)
    .map(c => c.price!)
  const fallbackPrices = allCars
    .filter(c => c.make === car.make && c.price)
    .map(c => c.price!)
  const comparable = samePrices.length >= 3 ? samePrices : fallbackPrices
  const priceInfo = car.price ? ratePriceVsMarket(car.price, comparable) : null
  const ratingConfig = priceInfo ? PRICE_RATING_CONFIG[priceInfo.rating] : null
  const ratingLabel = ratingConfig ? t(ratingConfig.labelKey, language) : ""
  const ratingTooltip = priceInfo && ratingConfig
    ? (priceInfo.pct <= -4
        ? t("price.tooltipGood", language, { pct: Math.abs(priceInfo.pct) })
        : priceInfo.pct >= 8
        ? t("price.tooltipHigh", language, { pct: priceInfo.pct })
        : t("price.tooltipMarket", language))
    : ""

  return (
    <div
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white/[0.02] cursor-pointer transition-all hover:border-white/[0.1] hover:bg-white/[0.03] hover:-translate-y-0.5"
    >
      {/* Image carousel — arrows show on hover, dots always when multi-image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-white/[0.03]">
        {displayImage ? (
          <img
            src={upgradeBbcdnUrl(displayImage)}
            alt={`${car.make} ${car.model}`}
            crossOrigin="anonymous"
            onError={e => {
              // Upgraded CDN URL didn't resolve — fall back to whatever the
              // parser saved. Only swap once; if the original 404s we let it.
              const el = e.currentTarget
              if (el.src !== displayImage) el.src = displayImage
            }}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Car className="h-10 w-10 text-white/[0.06]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent pointer-events-none" />

        {gallery.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Попереднє фото"
              onClick={e => {
                e.stopPropagation()
                setImgIdx(i => (i - 1 + gallery.length) % gallery.length)
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-black/80 group-hover:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Наступне фото"
              onClick={e => {
                e.stopPropagation()
                setImgIdx(i => (i + 1) % gallery.length)
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-black/80 group-hover:opacity-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-1.5 left-1/2 z-10 flex -translate-x-1/2 gap-1">
              {gallery.slice(0, 8).map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i === imgIdx ? "w-3 bg-white" : "w-1 bg-white/40"
                  }`}
                />
              ))}
              {gallery.length > 8 && (
                <span className="text-[9px] text-white/60 ml-1">+{gallery.length - 8}</span>
              )}
            </div>
          </>
        )}

        <div className="absolute bottom-2.5 left-3 text-xs font-semibold text-white drop-shadow pointer-events-none">
          {car.year} {formatCarTitle(car.make, car.model)}
        </div>
        {source && (
          <div className="absolute top-2 right-2 rounded-lg bg-black/60 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-sm pointer-events-none">
            {source.flag} {source.name}
            {totalImages > 1 && <span className="ml-1 opacity-60">· {imgIdx + 1}/{totalImages}</span>}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2 px-3.5 py-2.5">
        {/* Specs row */}
        <div className="flex items-center gap-3 text-[11px] text-white/32">
          {car.mileage && (
            <span className="flex items-center gap-1">
              <Gauge className="h-3 w-3" />
              {(car.mileage / 1000).toFixed(0)}k {t("result.km", language)}
            </span>
          )}
          {(car.fuelUa || car.fuel) && <span>{car.fuelUa || car.fuel}</span>}
          {car.engine && <span>{car.engine}</span>}
          {car.transmission && <span>{car.transmission}</span>}
        </div>

        {/* Prices — turnkey (under-key) is the primary number; raw EU shown as context */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm font-semibold text-primary">
              {totalCost ? `€${totalCost.total.toLocaleString(language === "en" ? "en-US" : "uk-UA")}` : "—"}
              <span className="text-[10px] font-normal text-muted-foreground/70 ml-1.5">{t("result.turnkey", language)}</span>
            </div>
            {car.price && (
              <div className="text-[11px] text-muted-foreground/50">
                €{car.price.toLocaleString(language === "en" ? "en-US" : "uk-UA")} {t("result.inEu", language)}
              </div>
            )}
          </div>
          {/* Price rating */}
          {ratingConfig && priceInfo && (
            <div className="flex flex-col items-end gap-0.5" title={ratingTooltip}>
              <span className="text-[10px] font-medium" style={{ color: ratingConfig.color }}>
                {ratingLabel}
              </span>
              {/* Mini price bar */}
              <div className="relative h-1 w-16 rounded-full bg-white/[0.08]">
                <div
                  className="absolute top-[-1px] h-[6px] w-[6px] rounded-full"
                  style={{
                    left: `${Math.min(95, Math.max(5, priceInfo.percentile))}%`,
                    backgroundColor: ratingConfig.color,
                    transform: "translateX(-50%)",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
