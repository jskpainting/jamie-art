import {
  getNewsletters,
  getSubscriberCount,
  getAllPaintingsForPicker,
  getEventForRsvp,
  getEventRsvpCounts,
  getGroups,
} from "@/lib/db/queries"
import { getContactTags } from "@/lib/actions/crm"
import { aiConfigured } from "@/lib/ai/router"
import { getSchemaCapabilities } from "@/lib/schema-capabilities"
import { formatEventDateRange } from "@/lib/utils"
import { NewslettersClient } from "./newsletters-client"

export const metadata = { title: "Newsletters — Admin" }

interface Props {
  searchParams: Promise<{ event?: string }>
}

export default async function NewslettersPage({ searchParams }: Props) {
  const sp = await searchParams
  const [newsletters, subscriberCount, paintings, capabilities] = await Promise.all([
    getNewsletters(),
    getSubscriberCount(),
    getAllPaintingsForPicker(),
    getSchemaCapabilities(),
  ])

  const [groups, tagsResult, eventRsvpCounts, inviteEvent] = await Promise.all([
    capabilities.crm ? getGroups() : Promise.resolve([]),
    capabilities.crm ? getContactTags() : Promise.resolve({ ok: false as const, error: "" }),
    capabilities.rsvp ? getEventRsvpCounts() : Promise.resolve(new Map()),
    sp.event ? getEventForRsvp(sp.event) : Promise.resolve(null),
  ])
  const tags = tagsResult.ok ? tagsResult.tags : []

  const inviteRequest = inviteEvent
    ? `Invite people to ${inviteEvent.title} on ${formatEventDateRange(inviteEvent.starts_at, inviteEvent.ends_at)}${
        inviteEvent.location ? ` at ${inviteEvent.location}` : ""
      }.${inviteEvent.description ? ` ${inviteEvent.description}` : ""}`
    : null

  return (
    <NewslettersClient
      newsletters={newsletters}
      subscriberCount={subscriberCount}
      paintings={paintings}
      aiConfigured={aiConfigured()}
      crmEnabled={capabilities.crm}
      rsvpEnabled={capabilities.rsvp}
      groups={groups}
      tags={tags}
      eventRsvpCounts={Object.fromEntries(eventRsvpCounts)}
      inviteEvent={inviteEvent}
      inviteRequest={inviteRequest}
    />
  )
}
