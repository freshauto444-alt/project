import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { blogPosts } from "@/lib/blog-data"

interface BlogPostPageProps {
  params: { id: string }
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ id: post.id }))
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = blogPosts.find((p) => p.id === params.id)
  if (!post) return { title: "Стаття не знайдена" }
  return {
    title: `${post.title} | Fresh Auto`,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.id}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://freshauto.ua/blog/${post.id}`,
      images: [{ url: post.image, width: 1200, height: 630, alt: post.title }],
      type: "article",
    },
  }
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const post = blogPosts.find((p) => p.id === params.id)
  if (!post) notFound()

  return (
    <section className="py-16 px-6 lg:px-10 pt-24">
      <div className="mx-auto max-w-3xl w-full">
        <Link
          href="/blog"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowRight className="h-3.5 w-3.5 rotate-180" />
          {"Назад до блогу"}
        </Link>

        <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl mb-8">
          <img
            src={post.image}
            alt={post.title}
            crossOrigin="anonymous"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="text-xs text-muted-foreground mb-3">{post.date}</div>
        <h1
          className="font-extrabold text-foreground mb-8 text-balance"
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)", letterSpacing: "-0.02em" }}
        >
          {post.title}
        </h1>

        <div className="flex flex-col gap-5">
          {post.content.map((para, i) => (
            <p key={i} className="text-base font-medium text-muted-foreground leading-relaxed">
              {para}
            </p>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-border flex flex-wrap gap-3">
          <Link
            href="/catalog"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all"
          >
            {"Переглянути каталог"}
          </Link>
          <Link
            href="/picker"
            className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-all"
          >
            {"AI Підбір"}
          </Link>
        </div>
      </div>
    </section>
  )
}
