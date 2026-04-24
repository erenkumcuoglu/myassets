export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getPortfolioSnapshot, initDb, getTransactions, getLatestPrices } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await initDb();
    const transactions = await getTransactions();
    const prices = await getLatestPrices();
    const snapshot = await getPortfolioSnapshot();
    return NextResponse.json({ 
      ...snapshot, 
      _debug: {
        transactionsCount: transactions.length,
        pricesCount: prices.size,
        transactions: transactions.map(t => ({ id: t.id, assetId: t.assetId, ticker: t.asset?.ticker, type: t.type, quantity: t.quantity })),
        prices: Array.from(prices.entries())
      }
    });
  } catch (error) {
    console.error("Failed to fetch portfolio snapshot:", error);
    return NextResponse.json({ positions: [], error: error instanceof Error ? error.message : "Unknown error" }, { status: 200 });
  }
}
