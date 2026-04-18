export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getPortfolioSnapshot, initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await initDb();
    const snapshot = await getPortfolioSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Failed to fetch portfolio snapshot:", error);
    return NextResponse.json({ positions: [], error: error instanceof Error ? error.message : "Unknown error" }, { status: 200 });
  }
}
