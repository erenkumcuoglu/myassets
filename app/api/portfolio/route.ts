export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getPortfolioSnapshot, initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await initDb();
    const snapshot = await getPortfolioSnapshot();
    return NextResponse.json({ ...snapshot, _test: "DEPLOYMENT_TEST_v2" });
  } catch (error) {
    console.error("Failed to fetch portfolio snapshot:", error);
    return NextResponse.json({ positions: [], error: error instanceof Error ? error.message : "Unknown error", _test: "DEPLOYMENT_TEST_v2" }, { status: 200 });
  }
}
