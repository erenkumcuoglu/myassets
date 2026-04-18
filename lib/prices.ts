import {
  getAssets,
  getLastCachedPrice,
  insertPriceCacheEntry,
  insertFxRate,
} from "@/lib/db";
import type { Asset } from "@/types";

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

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

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
      };
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type TefasResponse = {
  price?: number;
  error?: string;
};

function getCommodityYahooSymbol(asset: Asset) {
  const normalizedTicker = asset.ticker.toUpperCase();

  if (normalizedTicker === "XAU") {
    return "GC=F";
  }

  if (normalizedTicker === "XAG") {
    return "SI=F";
  }

  if (normalizedTicker.includes("=") || normalizedTicker.includes("=F")) {
    return normalizedTicker;
  }

  return normalizedTicker;
}

// Conversion factors for precious metals
const TROY_OUNCE_TO_GRAMS = 31.1035;

function convertToGrams(pricePerTroyOunce: number): number {
  return pricePerTroyOunce / TROY_OUNCE_TO_GRAMS;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function extractYahooPrice(payload: YahooChartResponse, fallbackTicker: string) {
  const result = payload.chart?.result?.[0];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const latestClose = [...closes].reverse().find((value) => typeof value === "number");

  const price =
    latestClose ??
    result?.meta?.regularMarketPrice ??
    result?.meta?.previousClose;

  if (typeof price !== "number" || Number.isNaN(price)) {
    throw new Error(`No price found for ${fallbackTicker}`);
  }

  return price;
}

async function fetchYahooPrice(symbol: string) {
  const payload = await fetchJson<YahooChartResponse>(
    `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}`,
  );

  return extractYahooPrice(payload, symbol);
}

export async function fetchUsdTryRate() {
  try {
    const rate = await fetchYahooPrice("USDTRY=X");
    await insertFxRate("USDTRY", rate);
    return rate;
  } catch (error) {
    console.warn("[prices] Failed to fetch USD/TRY rate, using fallback 1.0");
    return 1.0;
  }
}

export async function fetchEurTryRate() {
  try {
    const rate = await fetchYahooPrice("EURTRY=X");
    await insertFxRate("EURTRY", rate);
    return rate;
  } catch (error) {
    console.warn("[prices] Failed to fetch EUR/TRY rate, using fallback 1.0");
    return 1.0;
  }
}

async function fetchTefasPrice(fundCode: string, assetId?: number): Promise<number> {
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

  // Helper to check if response is HTML
  const checkHtmlResponse = async (response: Response): Promise<void> => {
    const text = await response.text();
    if (text.trim().startsWith('<')) {
      throw new Error('HTML response received instead of JSON — likely blocked');
    }
    return;
  };

  // PRIMARY: TEFAS API with full browser headers and session establishment
  try {
    // First, GET the TarihselVeriler.aspx page to establish session
    try {
      await fetch("https://www.tefas.gov.tr/TarihselVeriler.aspx", {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        cache: "no-store",
      });
    } catch (e) {
      console.warn('[TEFAS] Session establishment failed, continuing anyway');
    }

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
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://www.tefas.gov.tr/TarihselVeriler.aspx",
            "Origin": "https://www.tefas.gov.tr",
            "Cookie": "",
          },
          cache: "no-store",
          body,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) continue;

        await checkHtmlResponse(response);
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
          console.warn(`[TEFAS] Primary timeout for ${fundCode}`);
        }
        continue;
      }
    }
  } catch (error) {
    console.warn(`[TEFAS] Primary fallback failed for ${fundCode}:`, error);
  }

  // SECONDARY: Alternative TEFAS endpoint
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const url = `https://www.tefas.gov.tr/api/DB/BindHistoryAllocation?fontip=YAT&fonkod=${fundCode.toUpperCase()}`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        cache: "no-store",
      });
      clearTimeout(timeout);

      if (response.ok) {
        await checkHtmlResponse(response);
        const data = await response.json();
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          const rawPrice = data.data[0]?.FIYAT || data.data[0]?.SON_FIYAT;
          const numericPrice =
            typeof rawPrice === "string" ? Number(rawPrice.replace(",", ".")) : rawPrice;

          if (typeof numericPrice === "number" && !Number.isNaN(numericPrice) && numericPrice > 0) {
            return numericPrice;
          }
        }
      }
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn(`[TEFAS] Secondary timeout for ${fundCode}`);
      }
    }
  } catch (error) {
    console.warn(`[TEFAS] Secondary fallback failed for ${fundCode}:`, error);
  }

  // TERTIARY: fetinfos API (public Turkish fund data aggregator)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const url = `https://api.fonbul.com/api/fund/${fundCode.toUpperCase()}/price`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        cache: "no-store",
      });
      clearTimeout(timeout);

      if (response.ok) {
        await checkHtmlResponse(response);
        const data = await response.json();
        const price = data.price || data.data?.price;
        if (typeof price === "number" && !Number.isNaN(price) && price > 0) {
          return price;
        }
      }
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn(`[fetinfos] Timeout for ${fundCode}`);
      }
    }
  } catch (error) {
    console.warn(`[fetinfos] Fallback failed for ${fundCode}:`, error);
  }

  // QUATERNARY: Yahoo Finance with .IS suffix
  try {
    const price = await fetchYahooPrice(`${fundCode.toUpperCase()}.IS`);
    if (price && price > 0) {
      return price;
    }
  } catch (error) {
    console.warn(`[Yahoo] Fallback failed for ${fundCode}:`, error);
  }

  // ALL FALLBACKS FAILED - Return cached price if available
  if (assetId) {
    const cached = await getLastCachedPrice(assetId);
    if (cached && cached.price > 0) {
      console.warn(`[TEFAS] Using cached price ${cached.price} for ${fundCode}`);
      return cached.price;
    }
  }

  // No cache exists, return null (caller will handle it)
  throw new Error(`All TEFAS fallbacks failed for ${fundCode} and no cache available`);
}

async function fetchCommodityPriceWithFallback(asset: Asset): Promise<number> {
  const normalizedTicker = asset.ticker.toUpperCase();
  let symbols: string[] = [];

  // Check if ticker exists in COMMODITY_TICKER_MAP
  if (COMMODITY_TICKER_MAP[normalizedTicker]) {
    symbols = COMMODITY_TICKER_MAP[normalizedTicker];
  } else if (normalizedTicker.includes("=") || normalizedTicker.includes("=F")) {
    // Already a Yahoo futures symbol
    symbols = [normalizedTicker];
  } else {
    // Try ticker directly on Yahoo Finance
    symbols = [normalizedTicker];
  }

  // Try each symbol
  for (const symbol of symbols) {
    try {
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

        if (!response.ok) continue;

        const data = await response.json();
        const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
        
        if (typeof price === "number" && !Number.isNaN(price) && price > 0) {
          // Store raw USD price in cache with currency='USD'
          // Frontend will handle conversion to TRY or grams
          return price;
        }
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof Error && err.name === 'AbortError') {
          console.warn(`[Commodity] Timeout for ${symbol}`);
        }
        continue;
      }
    } catch (error) {
      console.warn(`[prices] Failed to fetch price for ${symbol}, trying next fallback`);
      continue;
    }
  }

  throw new Error(`All commodity fallback sources failed for ${asset.ticker}`);
}

async function fetchLivePrice(asset: Asset): Promise<{ price: number; currency: string }> {
  switch (asset.assetClass) {
    case "BIST":
      return { price: await fetchYahooPrice(`${asset.ticker}.IS`), currency: "TRY" };
    case "NASDAQ":
    case "FUND_US":
      return { price: await fetchYahooPrice(asset.ticker), currency: "USD" };
    case "FUND_TR":
      // TEFAS always returns TRY prices
      return { price: await fetchTefasPrice(asset.ticker, asset.id), currency: "TRY" };
    case "COMMODITY": {
      const price = await fetchCommodityPriceWithFallback(asset);
      // Store raw USD price in cache, frontend handles conversion
      return { price, currency: "USD" };
    }
    default:
      throw new Error(`Unsupported asset class for ${asset.ticker}`);
  }
}

async function getFallbackPrice(asset: Asset): Promise<{ price: number | null; currency: string }> {
  const cached = await getLastCachedPrice(asset.id);
  if (cached && cached.price > 0) {
    console.warn(`[prices] Using cached price ${cached.price} for ${asset.ticker}`);
    return { price: cached.price, currency: cached.currency };
  }

  // If no cache exists, return null — never return 0
  console.warn(`[prices] No cached price available for ${asset.ticker}`);
  return { price: null, currency: asset.currency };
}

export async function fetchPrice(asset: Asset): Promise<{ price: number | null; currency: string }> {
  try {
    return await fetchLivePrice(asset);
  } catch (error) {
    const fallback = await getFallbackPrice(asset);
    const message = error instanceof Error ? error.message : "Unknown error";

    console.warn(
      `[prices] Failed to fetch live price for ${asset.ticker}; using cached price ${fallback.price}. ${message}`,
    );

    return fallback;
  }
}

export async function fetchAllPrices(assets: Asset[]): Promise<Map<number, { price: number | null; currency: string }>> {
  const entries = await Promise.all(
    assets.map(async (asset) => [asset.id, await fetchPrice(asset)] as const),
  );

  return new Map(entries);
}

export async function refreshPriceCache(): Promise<void> {
  const assets = await getAssets();
  const prices = await fetchAllPrices(assets);

  for (const asset of assets) {
    const priceData = prices.get(asset.id);

    if (!priceData || priceData.price === null || typeof priceData.price !== "number" || Number.isNaN(priceData.price) || priceData.price <= 0) {
      console.warn(
        `[prices] Skipping cache update for ${asset.ticker}; no valid price available.`,
      );
      continue;
    }

    await insertPriceCacheEntry(asset.id, priceData.price, priceData.currency as "TRY" | "USD" | "EUR");
  }
}

// Helper functions for precious metals gram prices
export async function fetchGramGoldPrice(): Promise<number> {
  try {
    const goldAsset: Asset = {
      id: 0,
      ticker: "XAU",
      name: "Gold",
      assetClass: "COMMODITY",
      currency: "USD",
      createdAt: "",
    };
    const pricePerOunce = await fetchCommodityPriceWithFallback(goldAsset);
    return convertToGrams(pricePerOunce);
  } catch (error) {
    console.error("[prices] Failed to fetch gram gold price:", error);
    throw error;
  }
}

export async function fetchGramSilverPrice(): Promise<number> {
  try {
    const silverAsset: Asset = {
      id: 0,
      ticker: "XAG",
      name: "Silver",
      assetClass: "COMMODITY",
      currency: "USD",
      createdAt: "",
    };
    const pricePerOunce = await fetchCommodityPriceWithFallback(silverAsset);
    return convertToGrams(pricePerOunce);
  } catch (error) {
    console.error("[prices] Failed to fetch gram silver price:", error);
    throw error;
  }
}
