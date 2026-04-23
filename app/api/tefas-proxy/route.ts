export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TEFAS_URL = "https://www.tefas.gov.tr/api/DB/BindHistoryInfo";

// CORS headers for external access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Helper to format date as DD.MM.YYYY
type DateInfo = {
  dateStr: string;
  isoDate: string;
};

function getDateString(daysAgo: number): DateInfo {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return {
    dateStr: `${day}.${month}.${year}`,
    isoDate: `${year}-${month}-${day}`,
  };
}

// Try to fetch price from TEFAS for a specific date
async function tryFetchTefas(fundCode: string, dateInfo: DateInfo): Promise<number | null> {
  const body = new URLSearchParams({
    fontip: "YAT",
    fonkod: fundCode.toUpperCase(),
    bastarih: dateInfo.dateStr,
    bittarih: dateInfo.dateStr,
  });

  const response = await fetch(TEFAS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json, text/javascript, */*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": `https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${fundCode.toUpperCase()}`,
      "Origin": "https://www.tefas.gov.tr",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    return null;
  }

  const text = await response.text();
  
  // Check if we got HTML (blocked)
  if (text.trim().startsWith("<")) {
    console.error("[TEFAS-Proxy] Got HTML response (likely blocked)");
    return null;
  }

  try {
    const payload = JSON.parse(text);
    const rawPrice = payload.data?.[0]?.FIYAT;
    const numericPrice =
      typeof rawPrice === "string" ? Number(rawPrice.replace(",", ".")) : rawPrice;

    if (typeof numericPrice === "number" && !Number.isNaN(numericPrice) && numericPrice > 0) {
      return numericPrice;
    }
  } catch (e) {
    console.error("[TEFAS-Proxy] Failed to parse response:", e);
  }

  return null;
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

// GET handler
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json(
        { error: "Missing symbol parameter" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Try yesterday first, then go back up to 3 days
    for (let daysAgo = 1; daysAgo <= 3; daysAgo++) {
      const dateInfo = getDateString(daysAgo);
      console.log(`[TEFAS-Proxy] Trying ${symbol} for ${dateInfo.dateStr}`);
      
      const price = await tryFetchTefas(symbol, dateInfo);
      
      if (price !== null && price > 0) {
        console.log(`[TEFAS-Proxy] Found price for ${symbol}: ${price} on ${dateInfo.dateStr}`);
        return NextResponse.json(
          { price, date: dateInfo.isoDate },
          { status: 200, headers: corsHeaders }
        );
      }
    }

    return NextResponse.json(
      { error: "No price found for last 3 days" },
      { status: 404, headers: corsHeaders }
    );
  } catch (error) {
    console.error("[TEFAS-Proxy] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
