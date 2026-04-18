export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAssets, insertAsset, initDb } from "@/lib/db";
import type { AssetClass, Currency } from "@/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    await initDb();
    const assets = await getAssets();
    return NextResponse.json(assets);
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch assets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const { ticker, name, assetClass, currency } = body;

    if (!ticker || !name || !assetClass || !currency) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const asset = await insertAsset({
      ticker: ticker.toUpperCase(),
      name,
      assetClass,
      currency,
    });

    return NextResponse.json(asset);
  } catch (error) {
    console.error("Failed to create asset:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create asset" }, { status: 500 });
  }
}
