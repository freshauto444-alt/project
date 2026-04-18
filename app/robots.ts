import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/login", "/profile", "/api/"],
      },
    ],
    sitemap: "https://freshauto.ua/sitemap.xml",
  }
}
