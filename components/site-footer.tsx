"use client"

import Link from "next/link"
import { useSettings } from "@/lib/settings-context"
import { t } from "@/lib/i18n"

export default function SiteFooter() {
  const { language } = useSettings()

  const serviceLinks = language === "en"
    ? [
        { label: "Catalog", href: "/catalog" },
        { label: "AI Picker", href: "/picker" },
        { label: "Selection & Delivery", href: "/services" },
        { label: "Trade-In", href: "/services" },
        { label: "Car Sales", href: "/services" },
        { label: "Service & Warranty", href: "/services" },
      ]
    : [
        { label: "Каталог", href: "/catalog" },
        { label: "AI Підбір", href: "/picker" },
        { label: "Підбір та доставка", href: "/services" },
        { label: "Викуп та Trade-In", href: "/services" },
        { label: "Реалізація авто", href: "/services" },
        { label: "Сервіс та гарантія", href: "/services" },
      ]

  const companyLinks = language === "en"
    ? [
        { label: "About Us", href: "/about" },
        { label: "Blog / News", href: "/blog" },
        { label: "Client Reviews", href: "/clients" },
        { label: "Services", href: "/services" },
        { label: "Contacts", href: "/contacts" },
      ]
    : [
        { label: "Про нас", href: "/about" },
        { label: "Блог / Новини", href: "/blog" },
        { label: "Клієнти та відгуки", href: "/clients" },
        { label: "Послуги", href: "/services" },
        { label: "Контакти", href: "/contacts" },
      ]

  const legalLinks = language === "en"
    ? [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Use", href: "/terms" },
        { label: "Cookie Policy", href: "/cookies" },
      ]
    : [
        { label: "Політика конфіденційності", href: "/privacy" },
        { label: "Умови використання", href: "/terms" },
        { label: "Політика Cookies", href: "/cookies" },
      ]

  return (
    <footer className="border-t border-border py-14 px-6 lg:px-10 mt-auto">
      <div className="w-full">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link
              href="/"
              className="text-xl font-bold text-foreground tracking-tight hover:opacity-70 transition-opacity"
            >
              Fresh Auto
            </Link>
            <p className="mt-3 text-sm font-medium text-muted-foreground leading-relaxed max-w-xs">
              {language === "en"
                ? "European cars in stock and to order. Kyiv, Rivne, Lviv."
                : "Автомобілі з Європи в наявності та під замовлення. Київ, Рівне, Львів."}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-primary/70 uppercase tracking-wider mb-3">{t("footer.services", language)}</h4>
            <ul className="flex flex-col gap-2">
              {serviceLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-primary/70 uppercase tracking-wider mb-3">{t("footer.company", language)}</h4>
            <ul className="flex flex-col gap-2">
              {companyLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-primary/70 uppercase tracking-wider mb-3">{t("footer.contacts", language)}</h4>
            <ul className="flex flex-col gap-2">
              <li>
                <a href="tel:+380987081919" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  098 708 19 19 ({language === "en" ? "Igor" : "Ігор"})
                </a>
              </li>
              <li>
                <a href="tel:+380678160505" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  067 816 05 05 ({language === "en" ? "Ruslan" : "Руслан"})
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/freshauto_ua/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Instagram: @freshauto_ua
                </a>
              </li>
              <li className="text-sm text-muted-foreground">{t("footer.location", language)}</li>
              <li className="text-sm text-muted-foreground">{t("footer.hours", language)}</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-primary/70 uppercase tracking-wider mb-3">{t("footer.legal", language)}</h4>
            <ul className="flex flex-col gap-2">
              {legalLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs font-medium text-muted-foreground/70">{t("footer.copyright", language)}</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-xs font-medium text-muted-foreground/70 hover:text-foreground transition-colors">
              {language === "en" ? "Privacy" : "Конфіденційність"}
            </Link>
            <Link href="/terms" className="text-xs font-medium text-muted-foreground/70 hover:text-foreground transition-colors">
              {language === "en" ? "Terms" : "Умови"}
            </Link>
            <Link href="/cookies" className="text-xs font-medium text-muted-foreground/70 hover:text-foreground transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
