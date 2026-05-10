/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript is clean — don't mask future regressions.
  typescript: { ignoreBuildErrors: false },
  experimental: {
    viewTransition: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "prod.pictures.autoscout24.net" },
      { protocol: "https", hostname: "**.bbcdn.io" },
      { protocol: "https", hostname: "images.blocketcdn.se" },
      { protocol: "https", hostname: "**.mobile.de" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,
  },
  async headers() {
    // CSP tuned for: inline theme script, Supabase, Anthropic API, YouTube hero,
    // Google Fonts, image CDNs. 'unsafe-inline' on scripts is required because
    // we use inline theme-init script in <head>; moving to a nonce-based CSP would
    // require middleware injection. For a consumer-facing site without
    // user-generated HTML this is an acceptable tradeoff.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://prod.pictures.autoscout24.net https://*.bbcdn.io https://images.blocketcdn.se https://*.mobile.de https://images.unsplash.com https://i.ytimg.com https://img.youtube.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.exchangerate-api.com",
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
      "media-src 'self' https://www.youtube.com blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; ")

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ]
  },
}

export default nextConfig
