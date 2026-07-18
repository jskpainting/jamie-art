import { NextResponse } from "next/server"
import { searchTags } from "@/lib/db/queries"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100)
  const parsedLimit = parseInt(searchParams.get("limit") ?? "10", 10)
  const limit = Math.max(1, Math.min(Number.isNaN(parsedLimit) ? 10 : parsedLimit, 20))

  if (!q) return NextResponse.json({ tags: [] })

  const tags = await searchTags(q, limit)
  return NextResponse.json({ tags })
}
