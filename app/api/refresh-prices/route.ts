import { NextResponse } from "next/server";
import { refreshPriceCache } from "@/lib/prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await refreshPriceCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to refresh prices:", error);
    return NextResponse.json({ error: "Failed to refresh prices" }, { status: 500 });
  }
}
