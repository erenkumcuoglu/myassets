import { NextResponse } from "next/server";
import { getPortfolioSnapshot } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getPortfolioSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Failed to fetch portfolio snapshot:", error);
    return NextResponse.json({ positions: [], error: error instanceof Error ? error.message : "Unknown error" }, { status: 200 });
  }
}
