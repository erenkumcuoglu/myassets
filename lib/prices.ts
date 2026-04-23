/**
 * prices.ts
 *
 * Data sources:
 *  - NASDAQ / FUND_US  → Yahoo Finance
 *  - BIST              → Yahoo Finance
 *  - COMMODITY         → Yahoo Finance → TRY/gram
 *  - FX (USDTRY/EURTRY)→ Yahoo Finance
 *  - FUND_TR           → @firstthumb/tefas-api (fallback: fundfy.com → cache)
 *
 * All sources fall back to last cached price on failure.
 */

import {
  getAssets,
  getLastCachedPrice,
  insertPriceCacheEntry,
  insertFxRate,
} from "@/lib/db";
import type { Asset } from "@/types";

const TROY_OUNCE_TO_GRAMS = 31.1035;
const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

// Yahoo Finance fetch
async function fetchYahooPrice(symbol: string): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        cache: "no-store",
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const text = await response.text();
    if (text.trim().startsWith("<") || text.trim().startsWith("<!")) {
      throw new Error("HTML response received");
    }

    const data = JSON.parse(text);
    const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (typeof price !== "number" || Number.isNaN(price) || price <= 0) {
      throw new Error(`No valid price for ${symbol}`);
    }

    return price;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Asset class fetchers
// ---------------------------------------------------------------------------

async function fetchBistPrice(ticker: string): Promise<number> {
  return fetchYahooPrice(`${ticker}.IS`);
}

async function fetchNasdaqPrice(ticker: string): Promise<number> {
  return fetchYahooPrice(ticker);
}

// FX rates with 5-minute in-memory cache
const FX_TTL = 5 * 60 * 1000;
let _usdTry: { rate: number; at: number } | null = null;
let _eurTry: { rate: number; at: number } | null = null;

export async function fetchUsdTryRate(): Promise<number> {
  if (_usdTry && Date.now() - _usdTry.at < FX_TTL) return _usdTry.rate;
  try {
    const rate = await fetchYahooPrice("USDTRY=X");
    _usdTry = { rate, at: Date.now() };
    await insertFxRate("USDTRY", rate);
    return rate;
  } catch (e) {
    console.warn("[prices] USD/TRY fetch failed:", e);
    return _usdTry?.rate ?? 38.5;
  }
}

export async function fetchEurTryRate(): Promise<number> {
  if (_eurTry && Date.now() - _eurTry.at < FX_TTL) return _eurTry.rate;
  try {
    const rate = await fetchYahooPrice("EURTRY=X");
    _eurTry = { rate, at: Date.now() };
    await insertFxRate("EURTRY", rate);
    return rate;
  } catch (e) {
    console.warn("[prices] EUR/TRY fetch failed:", e);
    return _eurTry?.rate ?? 42.0;
  }
}

// Commodity symbol mapping
const COMMODITY_YAHOO_MAP: Record<string, string> = {
  GOLD: "GC=F",
  SILVER: "SI=F",
  PLATINUM: "PL=F",
  OIL_WTI: "CL=F",
  OIL_BRENT: "BZ=F",
};

async function fetchCommodityPriceTryPerGram(asset: Asset): Promise<number> {
  const ticker = asset.ticker.toUpperCase();
  const yahooSymbol = COMMODITY_YAHOO_MAP[ticker] ?? ticker;

  const usdPerOz = await fetchYahooPrice(yahooSymbol);
  const usdTry = await fetchUsdTryRate();
  return (usdPerOz * usdTry) / TROY_OUNCE_TO_GRAMS;
}

// ---------------------------------------------------------------------------
// Turkish mutual funds — @firstthumb/tefas-api (primary), fundfy.com (fallback)
// ---------------------------------------------------------------------------

async function fetchTefasPrice(asset: Asset): Promise<{ price: number; currency: string }> {
  const fundCode = asset.ticker.toUpperCase();
  
  // PRIMARY: @firstthumb/tefas-api
  try {
    const tefas = await import("@firstthumb/tefas-api");
    const result = await tefas.getFundPrice(fundCode);
    if (result && result.price > 0) {
      console.log(`[TEFAS-API] ${fundCode}: ${result.price} TL`);
      return { price: result.price, currency: "TRY" };
    }
  } catch (err) {
    console.error(`[TEFAS-API] Failed for ${fundCode}:`, err);
  }
  
  // FALLBACK 1: fundfy.com
  try {
    const url = `https://fundfy.com/api/fund/${fundCode}`;
    const res = await fetchWithTimeout(url, 6000);
    if (res.ok) {
      const data = await res.json();
      if (data && data.price > 0) {
        console.log(`[FUND FY] ${fundCode}: ${data.price} TL`);
        return { price: data.price, currency: "TRY" };
      }
    }
  } catch (err) {
    console.error(`[FUND FY] Failed for ${fundCode}:`, err);
  }
  
  // FALLBACK 2: cached DB price
  try {
    const cached = await getLastCachedPrice(asset.id);
    if (cached && cached.price > 0) {
      console.warn(`[CACHE] Using cached price for ${fundCode}: ${cached.price} TL`);
      return { price: cached.price, currency: cached.currency };
    }
  } catch (err) {
    console.error(`[CACHE] Failed to get cached price for ${fundCode}:`, err);
  }
  
  // All sources failed - log error but don't throw (app shouldn't crash)
  console.error(`[FUND_TR] All sources failed for ${fundCode}, returning null`);
  return { price: 0, currency: "TRY" };
}

// ---------------------------------------------------------------------------
// Navbar helpers — gram gold/silver in TRY
// ---------------------------------------------------------------------------
export async function fetchGramGoldTRY(): Promise<number> {
  const usdPerOz = await fetchYahooPrice("GC=F");
  const usdTry = await fetchUsdTryRate();
  return (usdPerOz * usdTry) / TROY_OUNCE_TO_GRAMS;
}

export async function fetchGramSilverTRY(): Promise<number> {
  const usdPerOz = await fetchYahooPrice("SI=F");
  const usdTry = await fetchUsdTryRate();
  return (usdPerOz * usdTry) / TROY_OUNCE_TO_GRAMS;
}

export const fetchGramGoldPrice = fetchGramGoldTRY;
export const fetchGramSilverPrice = fetchGramSilverTRY;

// ---------------------------------------------------------------------------
// Per-asset dispatch
// ---------------------------------------------------------------------------
async function fetchLivePrice(
  asset: Asset
): Promise<{ price: number; currency: string }> {
  switch (asset.assetClass) {
    case "BIST":
      return { price: await fetchBistPrice(asset.ticker), currency: "TRY" };

    case "NASDAQ":
    case "FUND_US":
      return { price: await fetchNasdaqPrice(asset.ticker), currency: "USD" };

    case "FUND_TR":
      return await fetchTefasPrice(asset);

    case "COMMODITY":
      return { price: await fetchCommodityPriceTryPerGram(asset), currency: "TRY" };

    default:
      console.error(`[FUND_TR] Unsupported asset class: ${asset.assetClass}`);
      return { price: 0, currency: asset.currency };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function refreshPrices(): Promise<Map<number, { price: number; currency: string }>> {
  const assets = await getAssets();
  const results = new Map<number, { price: number; currency: string }>();

  await Promise.all(
    assets.map(async (asset) => {
      try {
        const { price, currency } = await fetchLivePrice(asset);
        results.set(asset.id, { price, currency });
        if (price > 0) {
          await insertPriceCacheEntry(asset.id, price, currency);
          console.log(`[prices] Cached ${asset.ticker}: ${price} ${currency}`);
        }
      } catch (err) {
        console.error(`[prices] Error processing ${asset.ticker}:`, err);
        // Continue with other assets - don't let one failure stop the whole process
      }
    })
  );

  return results;
}

export async function getLatestPrices(): Promise<Map<number, { price: number; currency: string; fetchedAt: string }>> {
  const assets = await getAssets();
  const prices = new Map<number, { price: number; currency: string; fetchedAt: string }>();

  for (const asset of assets) {
    try {
      const cached = await getLastCachedPrice(asset.id);
      if (cached) {
        prices.set(asset.id, {
          price: cached.price,
          currency: cached.currency,
          fetchedAt: cached.fetchedAt,
        });
      }
    } catch (err) {
      console.error(`[prices] Error getting cached price for ${asset.ticker}:`, err);
    }
  }

  return prices;
}
