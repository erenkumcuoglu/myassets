export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getTransactionCountByAsset, initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initDb();
    const id = Number(params.id);
    
    const count = await getTransactionCountByAsset(id);
    
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Failed to count transactions:", error);
    return NextResponse.json({ count: 0, error: error instanceof Error ? error.message : "Failed to count transactions" });
  }
}
