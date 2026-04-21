export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { initDb, clearPriceCache, updateCommodityAssetCurrencies } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  try {
    await initDb();
    await updateCommodityAssetCurrencies();
    await clearPriceCache();
    return NextResponse.json({ success: true, message: "Commodity currencies updated to TRY and price cache cleared" });
  } catch (error) {
    console.error("Failed to clear price cache:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
