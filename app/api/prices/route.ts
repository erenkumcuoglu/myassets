export const dynamic = "force-dynamic";
export const maxDuration = 10;

import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { fetchUsdTryRate, fetchEurTryRate, fetchGramGoldTRY, fetchGramSilverTRY } from "@/lib/prices";

export const runtime = "nodejs";

export async function GET() {
  try {
    await initDb();
    // Fetch all rates independently - don't let one failure break the whole response
    const [usdTry, eurTry, gramGoldTry, gramSilverTry] = await Promise.all([
      fetchUsdTryRate(),
      fetchEurTryRate(),
      fetchGramGoldTRY(),
      fetchGramSilverTRY(),
    ]);

    console.log('[Prices] Fetched values:', { usdTry, eurTry, gramGoldTry, gramSilverTry });

    return NextResponse.json({
      usdTry,
      eurTry,
      gramGoldTry,
      gramSilverTry,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch market prices:", error);
    // Return zeros on error - don't crash
    return NextResponse.json({
      usdTry: 1.0,
      eurTry: 1.0,
      gramGoldTry: 0,
      gramSilverTry: 0,
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Price unavailable',
    }, { status: 200 });
  }
}
