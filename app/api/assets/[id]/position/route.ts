export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getPositionQuantity, initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initDb();
    const id = Number(params.id);
    
    const quantity = await getPositionQuantity(id);
    
    return NextResponse.json({ quantity });
  } catch (error) {
    console.error("Failed to get position:", error);
    return NextResponse.json({ quantity: 0, error: error instanceof Error ? error.message : "Failed to get position" });
  }
}
