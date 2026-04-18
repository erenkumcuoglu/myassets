export const dynamic = "force-dynamic";
export const maxDuration = 10;

import { NextResponse } from "next/server";
import type { AssetClass } from "@/types";
import { initDb } from "@/lib/db";

export const runtime = "nodejs";

async function fetchYahooPrice(ticker: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    try {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`,
        { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        }
      );
      clearTimeout(timeout);
      if (!response.ok) return null;
      const data = await response.json();
      const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
      return price ? Number(price) : null;
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn(`Yahoo fetch timeout for ${ticker}`);
      }
      return null;
    }
  } catch (error) {
    return null;
  }
}

async function fetchTefasPrice(fundCode: string): Promise<number | null> {
  try {
    const formatDate = (date: Date) => {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    };

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dates = [today, yesterday];

    for (const date of dates) {
      const dateStr = formatDate(date);
      const body = new URLSearchParams({
        fontip: "YAT",
        bastarih: dateStr,
        bittarih: dateStr,
        fonkod: fundCode.toUpperCase(),
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      
      try {
        const response = await fetch("https://www.tefas.gov.tr/api/DB/BindHistoryInfo", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": "https://www.tefas.gov.tr",
            "Origin": "https://www.tefas.gov.tr",
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) continue;

        const data = await response.json();
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          const rawPrice = data.data[0]?.FIYAT;
          const numericPrice =
            typeof rawPrice === "string" ? Number(rawPrice.replace(",", ".")) : rawPrice;

          if (typeof numericPrice === "number" && !Number.isNaN(numericPrice) && numericPrice > 0) {
            return numericPrice;
          }
        }
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof Error && err.name === 'AbortError') {
          console.warn(`TEFAS fetch timeout for ${fundCode}`);
          continue;
        }
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error("TEFAS API error:", error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get("ticker");
    const assetClass = searchParams.get("assetClass") as AssetClass;

    if (!ticker || !assetClass) {
      return NextResponse.json({ error: "Missing ticker or assetClass" }, { status: 400 });
    }

    let price: number | null = null;
    let currency = "USD";

    switch (assetClass) {
      case "BIST":
        price = await fetchYahooPrice(`${ticker.toUpperCase()}.IS`);
        currency = "TRY";
        break;
      case "NASDAQ":
        price = await fetchYahooPrice(ticker.toUpperCase());
        currency = "USD";
        break;
      case "FUND_TR":
        price = await fetchTefasPrice(ticker);
        currency = "TRY";
        break;
      case "FUND_US":
        price = await fetchYahooPrice(ticker.toUpperCase());
        currency = "USD";
        break;
      case "COMMODITY":
        // Handle gold and silver specifically
        const upperTicker = ticker.toUpperCase();
        if (upperTicker === "GC=F" || upperTicker === "XAUUSD=X" || upperTicker === "GLD") {
          price = await fetchYahooPrice("GC=F");
          if (!price) price = await fetchYahooPrice("XAUUSD=X");
          if (!price) price = await fetchYahooPrice("GLD");
        } else if (upperTicker === "SI=F" || upperTicker === "XAGUSD=X" || upperTicker === "SLV") {
          price = await fetchYahooPrice("SI=F");
          if (!price) price = await fetchYahooPrice("XAGUSD=X");
          if (!price) price = await fetchYahooPrice("SLV");
        } else {
          price = await fetchYahooPrice(ticker.toUpperCase());
        }
        currency = "USD";
        break;
      default:
        price = await fetchYahooPrice(ticker.toUpperCase());
        currency = "USD";
    }

    if (price === null) {
      return NextResponse.json({ price: null, currency, error: 'Price unavailable' }, { status: 200 });
    }

    // Return raw number with full decimal precision - do NOT round or truncate
    return NextResponse.json({ price, currency });
  } catch (error) {
    console.error("Failed to fetch price:", error);
    return NextResponse.json({ price: null, error: error instanceof Error ? error.message : 'Price unavailable' }, { status: 200 });
  }
}
