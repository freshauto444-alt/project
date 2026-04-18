import type { Metadata } from "next"
import LoginClient from "./login-client"

export const metadata: Metadata = {
  title: "Увійти — Fresh Auto",
  description: "Увійдіть до свого акаунту Fresh Auto або створіть новий. Email, Google, телефон.",
  alternates: { canonical: "/login" },
}

export default function LoginPage() {
  return <LoginClient />
}
