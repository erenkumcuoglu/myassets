import { NextRequest, NextResponse } from "next/server";
import { insertPriceCacheEntry, getAssets } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { fundCode, price, currency = "TRY" } = await req.json();

    if (!fundCode || typeof price !== "number" || price <= 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const assets = await getAssets();
    const asset = assets.find(
      (a) => a.ticker.toUpperCase() === fundCode.toUpperCase() && a.assetClass === "FUND_TR"
    );

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    await insertPriceCacheEntry(asset.id, price, currency);
    console.log(`[save-tefas-price] Saved ${fundCode}: ${price} ${currency}`);

    return NextResponse.json({ ok: true, fundCode, price });
  } catch (err) {
    console.error("[save-tefas-price] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
