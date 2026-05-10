import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Сторінку не знайдено",
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="text-[100px] font-extrabold tracking-tight text-primary/40 select-none leading-none">
        404
      </div>
      <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
        Сторінку не знайдено
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Сторінки, яку ви шукаєте, не існує або вона була переміщена. Повертайтесь на головну або перегляньте наш каталог авто.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link
          href="/"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all"
        >
          На головну
        </Link>
        <Link
          href="/catalog"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-all"
        >
          До каталогу
        </Link>
      </div>
    </main>
  )
}
