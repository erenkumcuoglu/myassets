import { NextResponse } from "next/server";
import { getPositionQuantity } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    
    const quantity = await getPositionQuantity(id);
    
    return NextResponse.json({ quantity });
  } catch (error) {
    console.error("Failed to get position:", error);
    return NextResponse.json({ quantity: 0 });
  }
}
