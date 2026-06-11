import { NextResponse } from "next/server"
import { searchTags } from "@/lib/db/queries"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 20)

  if (!q) return NextResponse.json({ tags: [] })

  const tags = await searchTags(q, limit)
  return NextResponse.json({ tags })
}
