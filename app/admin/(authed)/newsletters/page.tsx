import { getNewsletters, getSubscriberCount, getAllPaintingsForPicker } from "@/lib/db/queries"
import { aiConfigured } from "@/lib/ai/router"
import { NewslettersClient } from "./newsletters-client"

export const metadata = { title: "Newsletters — Admin" }

export default async function NewslettersPage() {
  const [newsletters, subscriberCount, paintings] = await Promise.all([
    getNewsletters(),
    getSubscriberCount(),
    getAllPaintingsForPicker(),
  ])

  return (
    <NewslettersClient
      newsletters={newsletters}
      subscriberCount={subscriberCount}
      paintings={paintings}
      aiConfigured={aiConfigured()}
    />
  )
}
