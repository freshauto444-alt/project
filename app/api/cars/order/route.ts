import { NextResponse } from "next/server"
import { getFeaturedOrderCars } from "@/lib/cars"

// Server pagination for the /order page. Returns parsed-feed cars in pages
// of `limit` starting at `offset`. The client appends each batch to the
// already-rendered list.

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0") || 0)
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "20") || 20
  const limit = Math.min(50, Math.max(1, limitRaw))
  const query = (url.searchParams.get("q") ?? "").slice(0, 80)

  const { cars, total } = await getFeaturedOrderCars(offset, limit, query)
  return NextResponse.json({
    cars,
    offset,
    limit,
    total,
    query,
    hasMore: offset + cars.length < total,
  })
}
