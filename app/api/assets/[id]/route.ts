import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateAsset, deleteAsset, getTransactionCountByAsset, deleteTransaction, getTransactions } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT - Update asset
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    const body = await request.json();
    const { name, assetClass, currency } = body;

    await updateAsset(id, { name, assetClass, currency });
    
    revalidatePath("/portfolio");
    revalidatePath("/dashboard");
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update asset:", error);
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
  }
}

// DELETE - Delete asset (with CASCADE for transactions)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    
    await deleteAsset(id);
    
    revalidatePath("/portfolio");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete asset:", error);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}
