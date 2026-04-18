import type { Metadata } from "next"
import InfoPage from "@/components/info-page"

export const metadata: Metadata = {
  title: "Про нас — Fresh Auto",
  description: "Fresh Auto — провідна платформа з продажу автомобілів з Європи. Понад 2 400 реалізованих авто. Перевірка, гарантія, повна прозорість. Київ, Рівне, Львів.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "Про нас | Fresh Auto",
    description: "Провідна платформа з продажу авто з Європи. Перевірка 150+ пунктів, юридична гарантія, персональний менеджер.",
    url: "https://freshauto.ua/about",
  },
}

export default function AboutPage() {
  return (
    <div className="pt-20">
      <InfoPage title="Про нас">
        <p>
          {"Fresh Auto — провідна платформа з продажу автомобілів з Європи. Ми реалізували понад 2 400 автомобілів для клієнтів з 14 країн, забезпечуючи повну прозорість на кожному етапі."}
        </p>
        <p>
          {"Наша місія — зробити процес придбання авто таким самим простим та прозорим, як покупку в локальному автосалоні. Кожен автомобіль проходить повну діагностику, перевірку через CarVertical та юридичну верифікацію."}
        </p>
        <p>
          {"Ми працюємо лише з перевіреними постачальниками та надаємо повну прозорість на кожному етапі. Можливий огляд авто з вашими експертами або на будь-якому СТО, включно з офіційним дилером."}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-4">
          {[
            { title: "Перевірка", desc: "Кожне авто проходить 150+ пунктів діагностики та перевірку через CarVertical." },
            { title: "Прозорість", desc: "Повна історія обслуговування, фото та відеозвіти з кожного огляду." },
            { title: "Гарантія", desc: "Юридична гарантія чистоти та технічного стану на 12 місяців." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-border bg-card p-6">
              <h3 className="text-sm font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4">
          {[
            { value: "2 400+", label: "Реалізованих авто" },
            { value: "14", label: "Країн" },
            { value: "50+", label: "Співробітників" },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 text-center">
              <div className="text-xl font-semibold text-foreground">{s.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="pt-4">
          <h3 className="text-base font-semibold text-foreground mb-4">{"Наша команда"}</h3>
          <p>
            {"Ігор Юрійович та Руслан Петрович — засновники Fresh Auto з багаторічним досвідом у сфері автомобільного бізнесу. Наша команда налічує понад 50 фахівців: менеджери з продажу, митні брокери, автомеханіки та фінансові консультанти."}
          </p>
          <p>
            {"Ми знаємо кожен нюанс імпорту авто з Європи та допомагаємо клієнтам отримати найкраще авто за найвигіднішою ціною."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <a
            href="tel:+380987081919"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all"
          >
            {"Зателефонувати"}
          </a>
          <a
            href="https://www.instagram.com/freshauto_ua/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-all"
          >
            {"Instagram @freshauto_ua"}
          </a>
        </div>
      </InfoPage>
    </div>
  )
}
