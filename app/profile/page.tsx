import type { Metadata } from "next"
import ProfileClient from "./profile-client"

export const metadata: Metadata = {
  title: "Мій кабінет — Fresh Auto",
  description: "Ваш особистий кабінет Fresh Auto. Збережені авто, історія замовлень, налаштування.",
  alternates: { canonical: "/profile" },
}

export default function ProfilePage() {
  return <ProfileClient />
}
