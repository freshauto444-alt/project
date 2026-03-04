import type { Metadata } from "next"
import { Star, Quote, ExternalLink } from "lucide-react"
import { clientReviews, galleryPhotos } from "@/lib/clients-data"

export const metadata: Metadata = {
  title: "Відгуки клієнтів — Fresh Auto",
  description: "Відгуки клієнтів Fresh Auto з Google, Trustpilot та соцмереж. Тисячі задоволених покупців авто з Європи. Реальні відгуки про купівлю Porsche, BMW, Mercedes, Audi.",
  alternates: { canonical: "/clients" },
  openGraph: {
    title: "Відгуки клієнтів | Fresh Auto",
    description: "Тисячі задоволених клієнтів обрали Fresh Auto. Відгуки з Google, Trustpilot та соцмереж.",
    url: "https://freshauto.ua/clients",
  },
}

export default function ClientsPage() {
  return (
    <section className="py-16 px-6 lg:px-10 pt-24">
      <div className="mx-auto max-w-6xl">
        <h1
          className="font-extrabold tracking-tight text-foreground mb-3 text-balance"
          style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)", letterSpacing: "-0.03em" }}
        >
          {"Наші клієнти"}
        </h1>
        <p className="text-base font-medium text-muted-foreground leading-relaxed mb-10">
          {"Тисячі задоволених клієнтів обрали Fresh Auto. Відгуки з Google, Trustpilot та соцмереж."}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-16">
          {clientReviews.map((r, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-6 flex flex-col">
              <div className="flex items-center gap-1 mb-3">
                {Array.from({ length: r.rating }).map((_, j) => (
                  <Star key={j} className="h-3 w-3 fill-primary text-primary" />
                ))}
                {Array.from({ length: 5 - r.rating }).map((_, j) => (
                  <Star key={`e${j}`} className="h-3 w-3 text-muted-foreground/20" />
                ))}
                <span className="ml-auto text-[9px] text-muted-foreground/50 font-medium">{r.source}</span>
              </div>
              <div className="flex-1">
                <Quote className="h-3 w-3 text-primary/30 mb-1" />
                <p className="text-xs text-muted-foreground leading-relaxed">{r.text}</p>
              </div>
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/[0.08] text-[10px] font-semibold text-primary">
                  {r.avatar}
                </div>
                <div>
                  <div className="text-xs font-medium text-foreground">{r.name}</div>
                  <div className="text-[10px] text-primary/60">{r.car}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-2">{"Фото наших клієнтів"}</h2>
          <p className="text-xs text-muted-foreground mb-6">{"Натисніть на фото для перегляду в Instagram."}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {galleryPhotos.map((photo, i) => (
            <a
              key={i}
              href={photo.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-xl border border-border"
              aria-label={photo.alt}
            >
              <img
                src={photo.src}
                alt={photo.alt}
                crossOrigin="anonymous"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                <ExternalLink className="h-5 w-5 text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
