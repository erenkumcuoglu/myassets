import {
  getAssets,
  getLastCachedPrice,
  insertPriceCacheEntry,
  insertFxRate,
} from "@/lib/db";
import type { Asset } from "@/types";

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

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

async function fetchTefasPrice(fundCode: string) {
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

      const response = await fetch("https://www.tefas.gov.tr/api/DB/BindHistoryInfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": "https://www.tefas.gov.tr",
          "Origin": "https://www.tefas.gov.tr",
        },
        cache: "no-store",
        body,
      });

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
    }

    throw new Error(`No valid TEFAS price found for ${fundCode}`);
  } catch (error) {
    throw new Error(`TEFAS price fetch failed for ${fundCode}: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

async function fetchCommodityPriceWithFallback(asset: Asset): Promise<number> {
  const normalizedTicker = asset.ticker.toUpperCase();
  const symbols = [];

  // Build list of symbols to try in order
  if (normalizedTicker === "XAU") {
    symbols.push("GC=F", "XAU=X", "GOLD");
  } else if (normalizedTicker === "XAG") {
    symbols.push("SI=F", "XAG=X", "SILVER");
  } else {
    symbols.push(getCommodityYahooSymbol(asset));
  }

  // Try each symbol
  for (const symbol of symbols) {
    try {
      const price = await fetchYahooPrice(symbol);
      
      // Convert from troy ounces to grams
      const pricePerGram = price / TROY_OUNCE_TO_GRAMS;
      
      // Convert to TRY if needed
      if (asset.currency === "TRY") {
        const usdTry = await fetchUsdTryRate();
        return pricePerGram * usdTry;
      }
      
      return pricePerGram;
    } catch (error) {
      console.warn(`[prices] Failed to fetch price for ${symbol}, trying next fallback`);
      continue;
    }
  }

  throw new Error(`All fallback sources failed for ${asset.ticker}`);
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
      return { price: await fetchTefasPrice(asset.ticker), currency: "TRY" };
    case "COMMODITY": {
      const price = await fetchCommodityPriceWithFallback(asset);
      return { price, currency: asset.currency };
    }
    default:
      throw new Error(`Unsupported asset class for ${asset.ticker}`);
  }
}

async function getFallbackPrice(asset: Asset): Promise<{ price: number; currency: string }> {
  const cached = await getLastCachedPrice(asset.id);
  if (cached) {
    return { price: cached.price, currency: cached.currency };
  }

  return { price: 0, currency: asset.currency };
}

export async function fetchPrice(asset: Asset): Promise<{ price: number; currency: string }> {
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

export async function fetchAllPrices(assets: Asset[]): Promise<Map<number, { price: number; currency: string }>> {
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

    if (!priceData || typeof priceData.price !== "number" || Number.isNaN(priceData.price) || priceData.price <= 0) {
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
