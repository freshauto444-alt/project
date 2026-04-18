import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { SettingsProvider } from '@/lib/settings-context'
import { AuthProvider } from '@/lib/auth-context'
import Navbar from '@/components/navbar'
import SiteFooter from '@/components/site-footer'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Fresh Auto — Автомобілі з Європи під ключ | Київ, Рівне, Львів',
    template: '%s | Fresh Auto — Авто з Європи',
  },
  description: 'Купити авто з Європи під ключ. BMW, Audi, Mercedes, Volvo, Toyota від 20 000 EUR. AI-підбір за 30 секунд, розмитнення, доставка, гарантія. Парсимо AutoScout24, Mobile.de. Київ, Рівне, Львів.',
  keywords: ['авто з європи', 'купити авто з німеччини', 'автомобілі з європи ціни', 'авто під ключ', 'bmw з німеччини', 'audi з європи', 'mercedes з німеччини', 'розмитнення авто', 'fresh auto', 'AI підбір авто', 'trade-in', 'Київ', 'Рівне', 'Львів', 'авто зі швеції', 'volvo з європи', 'авто під ключ ціна'],
  authors: [{ name: 'Fresh Auto' }],
  creator: 'Fresh Auto',
  publisher: 'Fresh Auto',
  metadataBase: new URL('https://freshauto.ua'),
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    url: 'https://freshauto.ua',
    siteName: 'Fresh Auto',
    title: 'Fresh Auto — Втілюй мрії разом з Fresh Auto',
    description: 'Швидка покупка авто на вигідних умовах, з гарантією та оформленням. Київ, Рівне, Львів.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fresh Auto — Автомобілі з Європи',
    description: 'Швидка покупка авто на вигідних умовах, з гарантією та оформленням.',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'format-detection': 'telephone=no',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F8FA' },
    { media: '(prefers-color-scheme: dark)', color: '#030303' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="uk" className="light" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("fa-theme");if(t==="dark"||t==="light"){document.documentElement.className=t}}catch(e){}` }} />

        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://www.youtube.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        <link rel="preconnect" href="https://i.ytimg.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://img.youtube.com" />
        <link rel="preconnect" href="https://img.youtube.com" crossOrigin="anonymous" />
        {/* Organization Schema for Google */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "AutoDealer",
              name: "Fresh Auto",
              url: "https://freshauto.ua",
              description: "Імпорт та продаж перевірених автомобілів з Європи. BMW, Audi, Mercedes, Volvo, Toyota під ключ.",
              address: [
                { "@type": "PostalAddress", addressLocality: "Київ", addressCountry: "UA" },
                { "@type": "PostalAddress", addressLocality: "Рівне", addressCountry: "UA" },
                { "@type": "PostalAddress", addressLocality: "Львів", addressCountry: "UA" },
              ],
              telephone: ["+380987081919", "+380678160505"],
              sameAs: ["https://instagram.com/freshauto_ua"],
              priceRange: "€20,000 - €200,000",
              openingHours: "Mo-Sa 09:00-19:00",
              areaServed: { "@type": "Country", name: "Ukraine" },
              makesOffer: {
                "@type": "Offer",
                itemOffered: { "@type": "Product", name: "Автомобілі з Європи", category: "Vehicles" },
              },
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}>
        <SettingsProvider>
          <AuthProvider>
            <div className="relative flex flex-col min-h-screen">
              <Navbar />
              <main className="flex-1">
                {children}
              </main>
              <SiteFooter />
            </div>
          </AuthProvider>
        </SettingsProvider>
        <Toaster position="bottom-right" richColors />
        <Analytics />
      </body>
    </html>
  )
}
