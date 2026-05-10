"use client"

import { useEffect } from "react"
import Link from "next/link"
import { logClientError } from "@/lib/logger"

// Route-level error boundary — catches errors in any page below /app.
// Caught by Next.js automatically; gets `reset()` to retry client-side.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app-error]", error)
    logClientError({
      source: "site-client",
      level: "error",
      msg: error.message || "app error boundary",
      stack: error.stack,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
      details: { digest: error.digest },
    })
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="text-5xl font-extrabold tracking-tight text-primary/30 select-none">
        Упс
      </div>
      <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
        Щось пішло не так
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Ми вже знаємо про помилку. Спробуйте ще раз — часто це тимчасовий збій звʼязку.
      </p>
      {error.digest && (
        <p className="text-[11px] text-muted-foreground/60 font-mono">Код помилки: {error.digest}</p>
      )}
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <button
          onClick={reset}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all"
        >
          Повторити
        </button>
        <Link
          href="/"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-all"
        >
          На головну
        </Link>
      </div>
    </main>
  )
}
