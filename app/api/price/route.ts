export const dynamic = "force-dynamic";
export const maxDuration = 10;

import { NextResponse } from "next/server";
import type { AssetClass } from "@/types";
import { initDb, getLastCachedPrice, getAssets, insertPriceCacheEntry } from "@/lib/db";
import { fetchYahooPrice, fetchTefasPrice } from "@/lib/prices";

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

async function fetchYahooPriceWithTimeout(ticker: string): Promise<number | null> {
  try {
    return await fetchYahooPrice(ticker);
  } catch (error) {
    console.warn(`[API] Yahoo fetch failed for ${ticker}:`, error);
    return null;
  }
}

async function fetchTefasPriceWithTimeout(fundCode: string, assetId?: number): Promise<number | null> {
  try {
    return await fetchTefasPrice(fundCode, assetId);
  } catch (error) {
    console.warn(`[API] Fund fetch failed for ${fundCode}:`, error);
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
        price = await fetchYahooPriceWithTimeout(`${ticker.toUpperCase()}.IS`);
        currency = "TRY";
        break;
      case "NASDAQ":
        price = await fetchYahooPriceWithTimeout(ticker.toUpperCase());
        currency = "USD";
        break;
      case "FUND_TR":
        // Get asset ID for cached price fallback
        const assets = await getAssets();
        const asset = assets.find(a => a.ticker.toUpperCase() === ticker.toUpperCase());
        price = await fetchTefasPriceWithTimeout(ticker, asset?.id);
        currency = "TRY";
        break;
      case "FUND_US":
        price = await fetchYahooPriceWithTimeout(ticker.toUpperCase());
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
          price = await fetchYahooPriceWithTimeout(symbol);
          if (price !== null) break;
        }
        
        currency = "USD";
        break;
      default:
        price = await fetchYahooPriceWithTimeout(ticker.toUpperCase());
        currency = "USD";
    }

    if (price === null) {
      // Try to get cached price as fallback
      try {
        const assets = await getAssets();
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

    // Cache the fetched price
    try {
      const assets = await getAssets();
      const asset = assets.find(a => a.ticker.toUpperCase() === ticker.toUpperCase());
      if (asset && price > 0) {
        await insertPriceCacheEntry(asset.id, price, currency as "TRY" | "USD" | "EUR");
        console.log(`[API] Cached price ${price} ${currency} for ${ticker}`);
      }
    } catch (e) {
      console.warn('[API] Failed to cache price:', e);
    }

    // Return raw number with full decimal precision - do NOT round or truncate
    return NextResponse.json({ price, currency });
  } catch (error) {
    console.error("Failed to fetch price:", error);
    return NextResponse.json({ price: null, error: error instanceof Error ? error.message : 'Price unavailable' }, { status: 200 });
  }
}
