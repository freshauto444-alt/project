import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SettingsProvider } from '@/lib/settings-context'
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
    default: 'Fresh Auto — Автомобілі з Європи | Київ, Рівне, Львів',
    template: '%s | Fresh Auto',
  },
  description: 'Втілюй мрії разом з Fresh Auto. Швидка покупка авто на вигідних умовах, з гарантією та оформленням. AI-підбір, Trade-In, тест-драйв. Київ, Рівне, Львів.',
  keywords: ['автомобілі', 'авто з Європи', 'купити авто', 'trade-in', 'Fresh Auto', 'Київ', 'Рівне', 'Львів', 'перевірені авто', 'електромобіль', 'тест-драйв'],
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
  themeColor: '#030303',
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
    <html lang="uk" className="dark" suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://www.youtube.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        <link rel="preconnect" href="https://i.ytimg.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://img.youtube.com" />
        <link rel="preconnect" href="https://img.youtube.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}>
        <SettingsProvider>
          <div className="relative flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </div>
        </SettingsProvider>
        <Analytics />
      </body>
    </html>
  )
}
