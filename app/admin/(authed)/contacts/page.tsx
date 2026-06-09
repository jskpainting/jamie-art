import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { getAllContacts, getContactsStats } from "@/lib/db/queries"
import { ContactsClient } from "./contacts-client"

export const metadata: Metadata = {
  title: "Contacts · Admin · Jamie Kendrioski",
}

export default async function ContactsAdminPage() {
  const [contacts, stats] = await Promise.all([
    getAllContacts(),
    getContactsStats(),
  ])

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Contacts"
        description="Mailing list and newsletter subscribers."
      />
      <ContactsClient contacts={contacts} stats={stats} />
    </div>
  )
}
