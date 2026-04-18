export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { fetchUsdTryRate, fetchEurTryRate } from "@/lib/prices";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { initDb } = await import("@/lib/db");
    await initDb();
    const usdTryRate = await fetchUsdTryRate();
    const eurTryRate = await fetchEurTryRate();

    return NextResponse.json({ 
      success: true, 
      usdTryRate, 
      eurTryRate 
    });
  } catch (error) {
    console.error("Failed to fetch FX rates:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
