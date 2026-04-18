import { NextResponse } from "next/server";
import { insertTransaction } from "@/lib/db";
import { TransactionInputSchema } from "@/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = TransactionInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please provide valid transaction details." },
      { status: 400 },
    );
  }

  try {
    const transaction = insertTransaction(parsed.data);
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
