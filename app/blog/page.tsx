import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import InfoPage from "@/components/info-page"
import { blogPosts } from "@/lib/blog-data"

export const metadata: Metadata = {
  title: "Блог та новини — Fresh Auto",
  description: "Статті та новини Fresh Auto: розмитнення авто, огляди моделей, поради щодо вибору електромобілів та бізнес-авто. Актуальна інформація про автомобільний ринок України.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Блог та новини | Fresh Auto",
    description: "Актуальні новини, огляди авто та поради від Fresh Auto.",
    url: "https://freshauto.ua/blog",
  },
}

export default function BlogPage() {
  return (
    <div className="pt-20">
      <InfoPage title="Блог та новини">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {blogPosts.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl border border-border bg-card overflow-hidden transition-colors hover:border-primary/20 group"
            >
              <Link href={`/blog/${post.id}`}>
                <div className="aspect-[16/9] w-full overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <div className="text-[10px] text-muted-foreground mb-2">{post.date}</div>
                  <h2 className="text-sm font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">{post.excerpt}</p>
                  <span className="inline-flex items-center gap-1 mt-3 text-[11px] font-medium text-primary">
                    {"Читати далі"}
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </InfoPage>
    </div>
  )
}
