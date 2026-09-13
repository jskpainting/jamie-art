import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/admin/page-header"
import {
  getContactDetail,
  getGroups,
  getAllPaintingsForPicker,
} from "@/lib/db/queries"
import { getContactTags } from "@/lib/actions/crm"
import { getSchemaCapabilities } from "@/lib/schema-capabilities"
import { ContactDetailClient } from "./contact-detail-client"

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const contact = await getContactDetail(id)
  const name = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email
    : "Person"
  return { title: `${name} · People · Admin · Jamie Kendrioski` }
}

export default async function ContactDetailPage({ params }: Props) {
  const { id } = await params
  const capabilities = await getSchemaCapabilities()

  const [contact, groups, tagsResult, paintings] = await Promise.all([
    getContactDetail(id),
    capabilities.crm ? getGroups() : Promise.resolve([]),
    capabilities.crm ? getContactTags() : Promise.resolve({ ok: true as const, tags: [] }),
    getAllPaintingsForPicker(),
  ])

  if (!contact) notFound()

  const tags = tagsResult.ok ? tagsResult.tags : []
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email

  return (
    <div>
      <Link
        href="/admin/contacts"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All people
      </Link>
      <PageHeader eyebrow="People" title={name} description={contact.email} />
      <ContactDetailClient
        contact={contact}
        groups={groups}
        allTags={tags.map((t) => t.name)}
        paintings={paintings}
        crmEnabled={capabilities.crm}
      />
    </div>
  )
}
