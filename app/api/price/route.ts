export const dynamic = "force-dynamic";
export const maxDuration = 10;

import { NextResponse } from "next/server";
import type { AssetClass } from "@/types";
import { initDb, getLastCachedPrice } from "@/lib/db";

export const runtime = "nodejs";

const COMMODITY_TICKER_MAP: Record<string, string[]> = {
  // Gold
  'GOLD': ['GC=F', 'XAUUSD=X', 'GLD'],
  'XAU': ['GC=F', 'XAUUSD=X', 'GLD'],
  'ALTIN': ['GC=F', 'XAUUSD=X', 'GLD'],
  'GAU': ['GC=F', 'XAUUSD=X', 'GLD'],
  // Silver
  'SILVER': ['SI=F', 'XAGUSD=X', 'SLV'],
  'XAG': ['SI=F', 'XAGUSD=X', 'SLV'],
  'GUMUS': ['SI=F', 'XAGUSD=X', 'SLV'],
  'AUG': ['SI=F', 'XAGUSD=X', 'SLV'],
  'GUM': ['SI=F', 'XAGUSD=X', 'SLV'],
  // Platinum
  'PLAT': ['PL=F'],
  'XPT': ['PL=F'],
  // Oil
  'OIL': ['CL=F', 'BZ=F'],
  'PETROL': ['CL=F', 'BZ=F'],
};

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
        // Use ticker mapping for Turkish commodity names
        const upperTicker = ticker.toUpperCase();
        let symbols: string[] = [];
        
        if (COMMODITY_TICKER_MAP[upperTicker]) {
          symbols = COMMODITY_TICKER_MAP[upperTicker];
        } else if (upperTicker.includes("=") || upperTicker.includes("=F")) {
          symbols = [upperTicker];
        } else {
          symbols = [upperTicker];
        }
        
        // Try each symbol in order
        for (const symbol of symbols) {
          price = await fetchYahooPrice(symbol);
          if (price !== null) break;
        }
        
        currency = "USD";
        break;
      default:
        price = await fetchYahooPrice(ticker.toUpperCase());
        currency = "USD";
    }

    if (price === null) {
      // Try to get cached price as fallback
      try {
        const assets = await import("@/lib/db").then(m => m.getAssets());
        const asset = assets.find(a => a.ticker.toUpperCase() === ticker.toUpperCase());
        if (asset) {
          const cached = await getLastCachedPrice(asset.id);
          if (cached && cached.price > 0) {
            console.warn(`[API] Using cached price ${cached.price} for ${ticker}`);
            return NextResponse.json({ price: cached.price, currency: cached.currency, error: 'Using cached price' }, { status: 200 });
          }
        }
      } catch (e) {
        console.warn('[API] Failed to fetch cached price:', e);
      }
      
      return NextResponse.json({ price: null, currency, error: 'Price unavailable' }, { status: 200 });
    }

    // Return raw number with full decimal precision - do NOT round or truncate
    return NextResponse.json({ price, currency });
  } catch (error) {
    console.error("Failed to fetch price:", error);
    return NextResponse.json({ price: null, error: error instanceof Error ? error.message : 'Price unavailable' }, { status: 200 });
  }
}
