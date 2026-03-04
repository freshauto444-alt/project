import type { Metadata } from "next"
import PickerClient from "@/components/picker-client"

export const metadata: Metadata = {
  title: "AI Підбір авто — Fresh Auto",
  description: "Інтелектуальний підбір автомобіля з Європи за допомогою AI. Оберіть тип авто, бюджет та параметри — система миттєво знайде найкращі варіанти з каталогу Fresh Auto.",
  alternates: { canonical: "/picker" },
  openGraph: {
    title: "AI Підбір авто | Fresh Auto",
    description: "Знайдіть ідеальне авто за секунди. AI аналізує ваші побажання та підбирає кращі варіанти.",
    url: "https://freshauto.ua/picker",
  },
}

export default function PickerPage() {
  return (
    <div className="pt-20">
      <PickerClient />
    </div>
  )
}
