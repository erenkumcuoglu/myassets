import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateTransaction, deleteTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    const body = await request.json();
    const { type, quantity, price, currency, date, notes } = body;

    await updateTransaction(id, { type, quantity, price, currency, date, notes });

    revalidatePath("/portfolio");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update transaction:", error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    
    await deleteTransaction(id);
    
    revalidatePath("/portfolio");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete transaction:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
