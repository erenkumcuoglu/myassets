/**
* prices.ts
*
* Data sources:
*  - NASDAQ / FUND_US  → Twelve Data API
*  - BIST              → Twelve Data API (TICKER:BIST format)
*  - COMMODITY         → Twelve Data API (XAU/USD, XAG/USD) → TRY/gram
*  - FX (USDTRY/EURTRY)→ Twelve Data API
*  - FUND_TR           → TEFAS.gov.tr API (no auth required)
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
const TD_BASE = "https://api.twelvedata.com";
const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
 
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
 
function getTwelveDataKey(): string | null {
 const key = process.env.TWELVEDATA_API_KEY;
 if (!key || key === "your_twelve_data_api_key_here") {
   console.error("[prices] TWELVEDATA_API_KEY is not set! Get a free API key from https://twelvedata.com/pricing");
   return null;
 }
 return key;
}

// Yahoo Finance fallback fetch
async function fetchYahooPrice(symbol: string): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        cache: "no-store",
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const text = await response.text();
    if (text.trim().startsWith('<') || text.trim().startsWith('<!')) {
      throw new Error('HTML response received');
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
 
// ---------------------------------------------------------------------------
// Twelve Data — single price fetch
// symbol examples: "AAPL", "GARAN:BIST", "XAU/USD", "USD/TRY"
// ---------------------------------------------------------------------------
type TwelveDataQuote = {
 price?: string;
 close?: string;
 status?: string;
 code?: number;
 message?: string;
};
 
// Yahoo Finance symbol mapping for Twelve Data symbols
const TWELVE_TO_YAHOO_MAP: Record<string, string> = {
  "XAU/USD": "GC=F",
  "XAG/USD": "SI=F",
  "XPT/USD": "PL=F",
  "WTI/USD": "CL=F",
  "BRENT/USD": "BZ=F",
  "USD/TRY": "USDTRY=X",
  "EUR/TRY": "EURTRY=X",
};

async function fetchTwelveDataPrice(symbol: string): Promise<number> {
 const apiKey = getTwelveDataKey();
 
 if (!apiKey) {
   throw new Error(`No Twelve Data API key configured for ${symbol}`);
 }
 
 const url = `${TD_BASE}/price?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
 
 try {
   const res = await fetchWithTimeout(url);
   
   if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status} for ${symbol}`);
   
   const text = await res.text();
   if (text.trim().startsWith("<")) throw new Error(`HTML response for ${symbol}`);
   
   const data = JSON.parse(text) as TwelveDataQuote;
   if (data.status === "error" || data.code) {
     // Check if this is a "plan upgrade required" error
     const errorMsg = data.message ?? "";
     if (errorMsg.includes("Grow") || errorMsg.includes("Venture") || errorMsg.includes("upgrading")) {
       console.warn(`[prices] Twelve Data plan limit for ${symbol}, using Yahoo Finance fallback`);
       const yahooSymbol = TWELVE_TO_YAHOO_MAP[symbol] ?? symbol;
       return fetchYahooPrice(yahooSymbol);
     }
     throw new Error(`Twelve Data error for ${symbol}: ${data.message}`);
   }
   
   const raw = data.price ?? data.close;
   const price = typeof raw === "string" ? parseFloat(raw) : NaN;
   if (isNaN(price) || price <= 0) throw new Error(`No valid price for ${symbol}`);
   
   return price;
 } catch (error) {
   // For network errors, try Yahoo Finance if we have a mapping
   if (error instanceof Error && TWELVE_TO_YAHOO_MAP[symbol]) {
     console.warn(`[prices] Twelve Data network error for ${symbol}, trying Yahoo Finance:`, error.message);
     return fetchYahooPrice(TWELVE_TO_YAHOO_MAP[symbol]);
   }
   throw error;
 }
}
 
// ---------------------------------------------------------------------------
// FX rates with 5-minute in-memory cache
// ---------------------------------------------------------------------------
const FX_TTL = 5 * 60 * 1000;
let _usdTry: { rate: number; at: number } | null = null;
let _eurTry: { rate: number; at: number } | null = null;
 
export async function fetchUsdTryRate(): Promise<number> {
 if (_usdTry && Date.now() - _usdTry.at < FX_TTL) return _usdTry.rate;
 try {
   const apiKey = getTwelveDataKey();
   let rate: number;
   
   if (apiKey) {
     rate = await fetchTwelveDataPrice("USD/TRY");
   } else {
     // Use Yahoo Finance directly
     rate = await fetchYahooPrice("USDTRY=X");
   }
   
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
   const apiKey = getTwelveDataKey();
   let rate: number;
   
   if (apiKey) {
     rate = await fetchTwelveDataPrice("EUR/TRY");
   } else {
     // Use Yahoo Finance directly
     rate = await fetchYahooPrice("EURTRY=X");
   }
   
   _eurTry = { rate, at: Date.now() };
   await insertFxRate("EURTRY", rate);
   return rate;
 } catch (e) {
   console.warn("[prices] EUR/TRY fetch failed:", e);
   return _eurTry?.rate ?? 42.0;
 }
}
 
// ---------------------------------------------------------------------------
// BIST — Borsa Istanbul equities
// ---------------------------------------------------------------------------
async function fetchBistPrice(ticker: string): Promise<number> {
 return fetchTwelveDataPrice(`${ticker.toUpperCase()}:BIST`);
}
 
// ---------------------------------------------------------------------------
// NASDAQ / US equities and ETFs
// ---------------------------------------------------------------------------
async function fetchNasdaqPrice(ticker: string): Promise<number> {
 return fetchTwelveDataPrice(ticker.toUpperCase());
}
 
// ---------------------------------------------------------------------------
// Commodities — USD/troy oz → TRY/gram
// ---------------------------------------------------------------------------
const COMMODITY_SYMBOL_MAP: Record<string, string> = {
 XAU:    "XAU/USD",
 GOLD:   "XAU/USD",
 ALTIN:  "XAU/USD",
 GAU:    "XAU/USD",
 XAG:    "XAG/USD",
 SILVER: "XAG/USD",
 GUMUS:  "XAG/USD",
 AUG:    "XAG/USD",
 GUM:    "XAG/USD",
 XPT:    "XPT/USD",
 PLAT:   "XPT/USD",
 OIL:    "WTI/USD",
 PETROL: "WTI/USD",
 BRENT:  "BRENT/USD",
};

// Yahoo Finance symbols for fallback
const COMMODITY_YAHOO_MAP: Record<string, string> = {
 XAU:    "GC=F",
 GOLD:   "GC=F",
 ALTIN:  "GC=F",
 GAU:    "GC=F",
 XAG:    "SI=F",
 SILVER: "SI=F",
 GUMUS:  "SI=F",
 AUG:    "SI=F",
 GUM:    "SI=F",
 XPT:    "PL=F",
 PLAT:   "PL=F",
 OIL:    "CL=F",
 PETROL: "CL=F",
 BRENT:  "BZ=F",
};
 
async function fetchCommodityPriceTryPerGram(asset: Asset): Promise<number> {
 const ticker = asset.ticker.toUpperCase();
 const apiKey = getTwelveDataKey();
 
 let usdPerOz: number;
 
 if (apiKey) {
   // Use Twelve Data
   const tdSymbol = COMMODITY_SYMBOL_MAP[ticker] ?? `${ticker}/USD`;
   usdPerOz = await fetchTwelveDataPrice(tdSymbol);
 } else {
   // Use Yahoo Finance directly
   const yahooSymbol = COMMODITY_YAHOO_MAP[ticker] ?? ticker;
   usdPerOz = await fetchYahooPrice(yahooSymbol);
 }
 
 const usdTry = await fetchUsdTryRate();
 return (usdPerOz * usdTry) / TROY_OUNCE_TO_GRAMS;
}
 
// ---------------------------------------------------------------------------
// Turkish mutual funds — Cloudflare Worker proxy (bypasses Railway IP blocks)
// ---------------------------------------------------------------------------
async function fetchTefasViaProxy(fundCode: string): Promise<number> {
  const proxyUrl = process.env.TEFAS_PROXY_URL;
  if (!proxyUrl) throw new Error("TEFAS_PROXY_URL not set");

  const url = `${proxyUrl}?code=${encodeURIComponent(fundCode.toUpperCase())}`;
  const res = await fetchWithTimeout(url, 8000);

  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);

  const text = await res.text();
  const data = JSON.parse(text);

  if (data.error) throw new Error(`Proxy error: ${data.error}`);
  if (!data.price || data.price <= 0) throw new Error("No valid price from proxy");

  console.log(`[TEFAS-Proxy] Fetched price ${data.price} for ${fundCode.toUpperCase()}`);
  return data.price;
}

// Fallback: Fintables.com (legacy, may be blocked by Cloudflare)
// ---------------------------------------------------------------------------
async function fetchFintablesPrice(fundCode: string): Promise<number> {
  const code = fundCode.toUpperCase();
  const urls = [
    `https://fintables.com/api/funds/${code}`,
    `https://fintables.com/api/v2/funds/${code}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, 6000);
      if (!res.ok) continue;

      const text = await res.text();
      if (text.trim().startsWith("<")) {
        console.warn(`[Fintables] HTML response for ${code}`);
        continue;
      }

      const data = JSON.parse(text) as {
        price?: number;
        lastPrice?: number;
        nav?: number;
        data?: { price?: number; lastPrice?: number; nav?: number };
      };
      const price =
        data.price ??
        data.lastPrice ??
        data.nav ??
        data.data?.price ??
        data.data?.lastPrice ??
        data.data?.nav;

      if (typeof price === "number" && price > 0) return price;
    } catch (e) {
      console.warn(`[Fintables] ${code} at ${url}:`, e);
    }
  }

  throw new Error(`Fintables: no valid price for ${fundCode}`);
}
 
// ---------------------------------------------------------------------------
// Navbar helpers — gram gold/silver in TRY
// ---------------------------------------------------------------------------
export async function fetchGramGoldTRY(): Promise<number> {
 const apiKey = getTwelveDataKey();
 let usdPerOz: number;
 
 if (apiKey) {
   usdPerOz = await fetchTwelveDataPrice("XAU/USD");
 } else {
   usdPerOz = await fetchYahooPrice("GC=F");
 }
 
 const usdTry = await fetchUsdTryRate();
 return (usdPerOz * usdTry) / TROY_OUNCE_TO_GRAMS;
}
 
export async function fetchGramSilverTRY(): Promise<number> {
 const apiKey = getTwelveDataKey();
 let usdPerOz: number;
 
 if (apiKey) {
   usdPerOz = await fetchTwelveDataPrice("XAG/USD");
 } else {
   usdPerOz = await fetchYahooPrice("SI=F");
 }
 
 const usdTry = await fetchUsdTryRate();
 return (usdPerOz * usdTry) / TROY_OUNCE_TO_GRAMS;
}
 
// Backward-compatible aliases
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
     // PRIMARY: Cloudflare Worker proxy
     // FALLBACK: Fintables (legacy)
     // FINAL FALLBACK: cached price
     let fundPrice: number;
     try {
       fundPrice = await fetchTefasViaProxy(asset.ticker);
     } catch (proxyErr) {
       console.warn(`[prices] Proxy failed for ${asset.ticker}, trying Fintables:`, proxyErr);
       try {
         fundPrice = await fetchFintablesPrice(asset.ticker);
       } catch (fintablesErr) {
         console.warn(`[prices] Fintables failed for ${asset.ticker}, using cache:`, fintablesErr);
         const cached = await getLastCachedPrice(asset.id);
         if (cached && cached.price > 0) {
           console.warn(`[prices] Cached fallback for ${asset.ticker}: ${cached.price}`);
           return { price: cached.price, currency: cached.currency };
         }
         throw new Error(`All sources failed for ${asset.ticker}, no cache available`);
       }
     }
     return { price: fundPrice, currency: "TRY" };
 
   case "COMMODITY":
     return { price: await fetchCommodityPriceTryPerGram(asset), currency: "TRY" };
 
   default:
     throw new Error(`Unsupported asset class: ${asset.assetClass}`);
 }
}
 
// ---------------------------------------------------------------------------
// Cache fallback
// ---------------------------------------------------------------------------
async function getFallbackPrice(
 asset: Asset
): Promise<{ price: number | null; currency: string }> {
 const cached = await getLastCachedPrice(asset.id);
 if (cached && cached.price > 0) {
   console.warn(`[prices] Cached fallback for ${asset.ticker}: ${cached.price}`);
   return { price: cached.price, currency: cached.currency };
 }
 console.warn(`[prices] No cache for ${asset.ticker}`);
 return { price: null, currency: asset.currency };
}
 
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function fetchPrice(
 asset: Asset
): Promise<{ price: number | null; currency: string }> {
 try {
   return await fetchLivePrice(asset);
 } catch (error) {
   const msg = error instanceof Error ? error.message : String(error);
   console.warn(`[prices] Live fetch failed for ${asset.ticker}: ${msg}`);
   return getFallbackPrice(asset);
 }
}
 
export async function fetchAllPrices(
 assets: Asset[]
): Promise<Map<number, { price: number | null; currency: string }>> {
 const entries = await Promise.all(
   assets.map(async (asset) => [asset.id, await fetchPrice(asset)] as const)
 );
 return new Map(entries);
}
 
export async function refreshPriceCache(): Promise<void> {
 const assets = await getAssets();
 const prices = await fetchAllPrices(assets);
 
 for (const asset of assets) {
   const p = prices.get(asset.id);
   if (!p || p.price === null || p.price <= 0 || isNaN(p.price)) {
     console.warn(`[prices] Skipping cache for ${asset.ticker} — no valid price`);
     continue;
   }
   await insertPriceCacheEntry(
     asset.id,
     p.price,
     p.currency as "TRY" | "USD" | "EUR"
   );
 }
}

