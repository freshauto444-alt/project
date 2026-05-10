import type { Metadata } from "next"
import AdminClient from "./admin-client"

export const metadata: Metadata = {
  title: "Admin CRM — Fresh Auto",
  robots: { index: false, follow: false, nocache: true },
}

export default function AdminPage() {
  return <AdminClient />
}
