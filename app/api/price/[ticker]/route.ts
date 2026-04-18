export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAssets, getLastCachedPrice, initDb } from "@/lib/db";
import { fetchPrice } from "@/lib/prices";
import type { Asset } from "@/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  try {
    await initDb();
    const { ticker } = params;
    const url = new URL(request.url);
    const assetClass = url.searchParams.get("assetClass");

    const assets = await getAssets();
    const asset = assets.find((a) => a.ticker === ticker);

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    try {
      const price = await fetchPrice(asset);
      return NextResponse.json({ price, currency: asset.currency });
    } catch (error) {
      console.error("Failed to fetch live price, using cached:", error);
      
      // Fallback to cached price
      const cached = await getLastCachedPrice(asset.id);
      if (cached) {
        return NextResponse.json({ price: cached.price, currency: cached.currency });
      }
      
      return NextResponse.json({ price: null, error: error instanceof Error ? error.message : "Failed to fetch price" }, { status: 200 });
    }
  } catch (error) {
    console.error("Failed to fetch price:", error);
    return NextResponse.json({ price: null, error: error instanceof Error ? error.message : "Failed to fetch price" }, { status: 200 });
  }
}
