import { NextResponse } from "next/server";
import { insertAsset, insertTransaction } from "@/lib/db";
import { fetchPrice } from "@/lib/prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ticker, name, assetClass, currency, transaction } = body;

    // Validate required fields
    if (!ticker || !name || !assetClass || !currency) {
      return NextResponse.json(
        { message: "Missing required fields for asset" },
        { status: 400 }
      );
    }

    if (!transaction || !transaction.type || !transaction.quantity || !transaction.price || !transaction.date) {
      return NextResponse.json(
        { message: "Missing required transaction fields" },
        { status: 400 }
      );
    }

    // Insert asset
    const asset = await insertAsset({
      ticker: ticker.toUpperCase(),
      name,
      assetClass,
      currency,
    });

    // Insert initial transaction
    await insertTransaction({
      assetId: asset.id,
      type: transaction.type,
      quantity: transaction.quantity,
      price: transaction.price,
      currency: transaction.currency,
      date: transaction.date,
      notes: transaction.notes || null,
    });

    // Trigger price fetch for the new asset
    try {
      const price = await fetchPrice(asset);
      // Note: Price will be cached by the fetchPrice function
    } catch (error) {
      console.warn(`Failed to fetch initial price for ${ticker}:`, error);
      // Don't fail the request if price fetch fails
    }

    return NextResponse.json({ assetId: asset.id, success: true });
  } catch (error) {
    console.error("Failed to create asset with transaction:", error);
    return NextResponse.json(
      { message: "Failed to create asset" },
      { status: 500 }
    );
  }
}
