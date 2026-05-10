"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, Shield, FileCheck, Sparkles, Search, RefreshCw, Truck, Wrench } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ServiceModule, ServiceIconName } from "@/lib/services-data"

const iconMap: Record<ServiceIconName, LucideIcon> = {
  FileCheck,
  Sparkles,
  Search,
  RefreshCw,
  Truck,
  Wrench,
}

export default function ServiceCard({ svc }: { svc: ServiceModule }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const Icon = iconMap[svc.iconName]

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden transition-colors duration-200 hover:border-primary/20">
      <button onClick={() => setOpen(!open)} className="w-full text-left p-6 lg:p-8 cursor-pointer">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.06] flex-shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-foreground mb-1">{svc.title}</h3>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">{svc.short}</p>
          </div>
          <div className="flex-shrink-0 mt-1">
            <ArrowRight
              className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            />
          </div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 lg:px-8 lg:pb-8 pt-0">
              <div className="border-t border-border pt-5">
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">{svc.detail}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {svc.highlights.map((h) => (
                    <div key={h} className="flex items-center gap-2 text-xs text-foreground/80">
                      <Shield className="h-3 w-3 text-primary/60 flex-shrink-0" />
                      {h}
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {svc.href && (
                    <button
                      onClick={() => router.push(svc.href!)}
                      className="rounded-full bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground hover:brightness-110 transition-all cursor-pointer"
                    >
                      {"Перейти"}
                    </button>
                  )}
                  <a
                    href="tel:+380987081919"
                    className="rounded-full border border-border px-5 py-2.5 text-xs font-medium text-foreground hover:bg-secondary transition-all"
                  >
                    {"Зателефонувати"}
                  </a>
                  <a
                    href="https://www.instagram.com/freshauto_ua/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-border px-5 py-2.5 text-xs font-medium text-foreground hover:bg-secondary transition-all"
                  >
                    {"Instagram"}
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
