import {
  getAssets,
  getLastCachedPrice,
  insertPriceCacheEntry,
} from "@/lib/db";
import type { Asset } from "@/types";

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const TEFAS_URL = "https://www.tefas.gov.tr/api/DB/BindHistoryInfo";

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

type TefasRow = {
  FIYAT?: number | string;
  FONKODU?: string;
};

type TefasResponse = {
  data?: TefasRow[];
};

function formatTodayForTefas() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  return `${day}.${month}.${year}`;
}

function getCommodityYahooSymbol(asset: Asset) {
  const normalizedTicker = asset.ticker.toUpperCase();

  if (normalizedTicker === "XAU") {
    return "XAU=X";
  }

  if (normalizedTicker === "XAG") {
    return "XAG=X";
  }

  if (normalizedTicker.includes("=") || normalizedTicker.includes("=F")) {
    return normalizedTicker;
  }

  return normalizedTicker;
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
  return fetchYahooPrice("USDTRY=X");
}

async function fetchTefasPrice(fundCode: string) {
  const today = formatTodayForTefas();
  const payload = await fetchJson<TefasResponse>(TEFAS_URL, {
    method: "POST",
    body: JSON.stringify({
      fontip: "YAT",
      bastarih: today,
      bittarih: today,
      fonkod: fundCode.toUpperCase(),
    }),
  });

  const rawPrice = payload.data?.[0]?.FIYAT;
  const numericPrice =
    typeof rawPrice === "string" ? Number(rawPrice.replace(",", ".")) : rawPrice;

  if (typeof numericPrice !== "number" || Number.isNaN(numericPrice)) {
    throw new Error(`No TEFAS price found for ${fundCode}`);
  }

  return numericPrice;
}

async function fetchLivePrice(asset: Asset) {
  switch (asset.assetClass) {
    case "BIST":
      return fetchYahooPrice(`${asset.ticker}.IS`);
    case "NASDAQ":
    case "FUND_US":
      return fetchYahooPrice(asset.ticker);
    case "FUND_TR":
      return fetchTefasPrice(asset.ticker);
    case "COMMODITY": {
      const basePrice = await fetchYahooPrice(getCommodityYahooSymbol(asset));

      if (asset.currency === "TRY") {
        const usdTry = await fetchUsdTryRate();
        return basePrice * usdTry;
      }

      return basePrice;
    }
    default:
      throw new Error(`Unsupported asset class for ${asset.ticker}`);
  }
}

function getFallbackPrice(asset: Asset) {
  const cached = getLastCachedPrice(asset.id);
  if (cached) {
    return cached.price;
  }

  return 0;
}

export async function fetchPrice(asset: Asset): Promise<number> {
  try {
    return await fetchLivePrice(asset);
  } catch (error) {
    const fallback = getFallbackPrice(asset);
    const message = error instanceof Error ? error.message : "Unknown error";

    console.warn(
      `[prices] Failed to fetch live price for ${asset.ticker}; using cached price ${fallback}. ${message}`,
    );

    return fallback;
  }
}

export async function fetchAllPrices(assets: Asset[]): Promise<Map<number, number>> {
  const entries = await Promise.all(
    assets.map(async (asset) => [asset.id, await fetchPrice(asset)] as const),
  );

  return new Map(entries);
}

export async function refreshPriceCache(): Promise<void> {
  const assets = getAssets();
  const prices = await fetchAllPrices(assets);

  for (const asset of assets) {
    const price = prices.get(asset.id);

    if (typeof price !== "number" || Number.isNaN(price) || price <= 0) {
      console.warn(
        `[prices] Skipping cache update for ${asset.ticker}; no valid price available.`,
      );
      continue;
    }

    insertPriceCacheEntry(asset.id, price, asset.currency);
  }
}
