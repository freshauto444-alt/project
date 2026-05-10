"use client"

import { useEffect } from "react"
import { logClientError } from "@/lib/logger"

/**
 * Global client-side error capture. Installed once at root layout.
 * Catches:
 *   1. Uncaught synchronous errors (window.onerror)
 *   2. Unhandled Promise rejections (unhandledrejection)
 *   3. console.error calls (optional — off by default; very noisy during dev)
 */
export default function ClientErrorHandler() {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      logClientError({
        source: "site-client",
        level: "error",
        msg: ev.message || "window.onerror",
        stack: ev.error?.stack || `${ev.filename}:${ev.lineno}:${ev.colno}`,
        path: window.location.pathname + window.location.search,
      })
    }
    const onReject = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason
      let msg = "unhandledrejection"
      let stack: string | undefined
      if (reason instanceof Error) {
        msg = reason.message || msg
        stack = reason.stack
      } else if (typeof reason === "string") {
        msg = reason
      } else if (reason && typeof reason === "object") {
        try { msg = JSON.stringify(reason).slice(0, 500) } catch {}
      }
      logClientError({
        source: "site-client",
        level: "error",
        msg,
        stack,
        path: window.location.pathname + window.location.search,
      })
    }
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onReject)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onReject)
    }
  }, [])
  return null
}
