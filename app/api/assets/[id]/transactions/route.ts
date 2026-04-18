import { NextResponse } from "next/server";
import { getTransactionCountByAsset } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    
    const count = await getTransactionCountByAsset(id);
    
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Failed to count transactions:", error);
    return NextResponse.json({ count: 0 });
  }
}
