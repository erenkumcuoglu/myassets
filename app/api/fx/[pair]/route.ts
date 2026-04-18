export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getFxRate, initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { pair: string } }
) {
  try {
    await initDb();
    const { pair } = params;
    const fxRate = await getFxRate(pair.toUpperCase());

    if (!fxRate) {
      return NextResponse.json({ rate: 1 }); // Fallback to 1:1 if no rate found
    }

    return NextResponse.json({ rate: fxRate.rate });
  } catch (error) {
    console.error("Failed to fetch FX rate:", error);
    return NextResponse.json({ rate: 1, error: error instanceof Error ? error.message : "Failed to fetch FX rate" }); // Fallback to 1:1 on error
  }
}
