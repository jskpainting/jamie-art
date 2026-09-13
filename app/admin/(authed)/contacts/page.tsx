import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import {
  getAllContacts,
  getContactsStats,
  getContactRows,
  getGroups,
} from "@/lib/db/queries"
import { getContactTags } from "@/lib/actions/crm"
import { getSchemaCapabilities } from "@/lib/schema-capabilities"
import { ContactsClient } from "./contacts-client"

export const metadata: Metadata = {
  title: "People · Admin · Jamie Kendrioski",
}

export default async function ContactsAdminPage() {
  const capabilities = await getSchemaCapabilities()

  const [contacts, stats, rows, groups, tagsResult] = await Promise.all([
    getAllContacts(),
    getContactsStats(),
    capabilities.crm ? getContactRows() : Promise.resolve([]),
    capabilities.crm ? getGroups() : Promise.resolve([]),
    capabilities.crm ? getContactTags() : Promise.resolve({ ok: true as const, tags: [] }),
  ])

  const tags = tagsResult.ok ? tagsResult.tags : []

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="People"
        description="Everyone on your mailing list — what they bought, and everything they did."
      />
      <ContactsClient
        contacts={contacts}
        stats={stats}
        rows={rows}
        groups={groups}
        tags={tags}
        crmEnabled={capabilities.crm}
      />
    </div>
  )
}
