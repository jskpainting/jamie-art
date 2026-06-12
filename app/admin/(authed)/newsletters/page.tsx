import { getNewsletters, getSubscriberCount } from "@/lib/db/queries"
import { NewslettersClient } from "./newsletters-client"

export const metadata = { title: "Newsletters — Admin" }

export default async function NewslettersPage() {
  const [newsletters, subscriberCount] = await Promise.all([
    getNewsletters(),
    getSubscriberCount(),
  ])

  return (
    <NewslettersClient
      newsletters={newsletters}
      subscriberCount={subscriberCount}
    />
  )
}
