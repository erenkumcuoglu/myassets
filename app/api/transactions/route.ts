export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getTransactions, insertTransaction, initDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await initDb();
    const transactions = await getTransactions();
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch transactions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const transaction = await insertTransaction(body);
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save the transaction.",
      },
      { status: 500 },
    );
  }
}
