import type { ReactNode } from "react"

interface InfoPageProps {
  title: string
  children: ReactNode
}

export default function InfoPage({ title, children }: InfoPageProps) {
  return (
    <section className="py-16 px-6 lg:px-10">
      <div className="mx-auto max-w-6xl w-full">
        <h1
          className="font-extrabold tracking-tight text-foreground mb-10 text-balance"
          style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)", letterSpacing: "-0.03em" }}
        >
          {title}
        </h1>
        <div className="flex flex-col gap-6 text-base font-medium text-muted-foreground leading-relaxed">
          {children}
        </div>
      </div>
    </section>
  )
}
