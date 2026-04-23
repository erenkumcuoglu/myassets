export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { refreshPrices } from "@/lib/prices";
import { initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  try {
    await initDb();
    await refreshPrices();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to refresh prices:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to refresh prices" }, { status: 500 });
  }
}
