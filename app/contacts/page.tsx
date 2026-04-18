import type { Metadata } from "next"
import InfoPage from "@/components/info-page"
import LocationMap from "@/components/location-map"

export const metadata: Metadata = {
  title: "Контакти — Fresh Auto",
  description: "Зв'яжіться з Fresh Auto. Телефони: 098 708 19 19 (Ігор), 067 816 05 05 (Руслан). Шоуруми в Києві, Рівному та Львові. Instagram @freshauto_ua.",
  alternates: { canonical: "/contacts" },
  openGraph: {
    title: "Контакти | Fresh Auto",
    description: "Зв'яжіться з нами будь-яким зручним способом. Менеджери відповідають миттєво.",
    url: "https://freshauto.ua/contacts",
  },
}

export default function ContactsPage() {
  return (
    <div className="pt-20">
      <InfoPage title="Контакти">
        <p>{"Зв'яжіться з нами будь-яким зручним способом. Наші менеджери відповідають моментально!"}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { label: "Ігор Юрійович", value: "+380 98 708 19 19", sub: "Пн-Сб: 09:00 - 19:00", href: "tel:+380987081919" },
            { label: "Руслан Петрович", value: "+380 67 816 05 05", sub: "Моментальна відповідь менеджера", href: "tel:+380678160505" },
            { label: "Адреса", value: "Київ / Рівне / Львів", sub: "Шоуруми та офіси по Україні" },
            { label: "Instagram", value: "@freshauto_ua", sub: "Онлайн-консультація 24/7", href: "https://www.instagram.com/freshauto_ua/" },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-border bg-card p-6">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{c.label}</div>
              {c.href ? (
                <a href={c.href} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                  {c.value}
                </a>
              ) : (
                <div className="text-sm font-medium text-foreground">{c.value}</div>
              )}
              <div className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-8">
          <h3 className="text-base font-semibold text-foreground mb-2">{"Напишіть нам"}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            {"Опишіть, яке авто ви шукаєте, і ми зв'яжемося з вами протягом 30 хвилин."}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="tel:+380987081919"
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all"
            >
              {"098 708 19 19"}
            </a>
            <a
              href="tel:+380678160505"
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all"
            >
              {"067 816 05 05"}
            </a>
            <a
              href="https://www.instagram.com/freshauto_ua/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-all"
            >
              {"Instagram"}
            </a>
          </div>
        </div>

        <div className="mt-6 -mx-6 lg:-mx-10">
          <LocationMap />
        </div>
      </InfoPage>
    </div>
  )
}
