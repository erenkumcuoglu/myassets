export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { insertPriceCacheEntry, getAssets } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ticker, price, currency = "TRY" } = body;

    if (!ticker || typeof price !== "number" || price <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid ticker/price" },
        { status: 400 }
      );
    }

    // Find asset by ticker
    const assets = await getAssets();
    const asset = assets.find((a) => a.ticker.toUpperCase() === ticker.toUpperCase());

    if (!asset) {
      return NextResponse.json(
        { error: `Asset not found: ${ticker}` },
        { status: 404 }
      );
    }

    // Insert manual price into cache
    await insertPriceCacheEntry(asset.id, price, currency as "TRY" | "USD" | "EUR");

    console.log(`[prices] Manual price entry: ${ticker} = ${price} ${currency}`);

    return NextResponse.json({
      success: true,
      ticker: ticker.toUpperCase(),
      price,
      currency,
      assetId: asset.id,
    });
  } catch (error) {
    console.error("Manual price entry error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
