import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchYahooPrice(ticker: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`,
      { 
        next: { revalidate: 0 },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
    return price ? Number(price) : null;
  } catch (error) {
    return null;
  }
}

async function fetchUsdTryRate(): Promise<number> {
  // Fallback chain for USD/TRY
  let rate = await fetchYahooPrice("USDTRY=X");
  if (rate) return rate;
  
  rate = await fetchYahooPrice("TRY=X");
  if (rate) return 1 / rate; // TRY=X is inverse of USDTRY
  
  return 1.0; // Fallback
}

async function fetchEurTryRate(usdTryRate: number): Promise<number> {
  // Fallback chain for EUR/TRY
  let rate = await fetchYahooPrice("EURTRY=X");
  if (rate) return rate;
  
  // Try EURUSD then multiply by USDTRY
  const eurUsdRate = await fetchYahooPrice("EURUSD=X");
  if (eurUsdRate) return eurUsdRate * usdTryRate;
  
  return 1.0; // Fallback
}

async function fetchGoldUsd(): Promise<number> {
  // Fallback chain for Gold (USD/troy oz)
  let price = await fetchYahooPrice("GC=F");
  if (price) return price;
  
  price = await fetchYahooPrice("XAUUSD=X");
  if (price) return price;
  
  price = await fetchYahooPrice("GLD");
  if (price) return price;
  
  return 0; // Fallback
}

async function fetchSilverUsd(): Promise<number> {
  // Fallback chain for Silver (USD/troy oz)
  let price = await fetchYahooPrice("SI=F");
  if (price) return price;
  
  price = await fetchYahooPrice("XAGUSD=X");
  if (price) return price;
  
  price = await fetchYahooPrice("SLV");
  if (price) return price;
  
  return 0; // Fallback
}

export async function GET() {
  try {
    // Fetch all rates independently - don't let one failure break the whole response
    const [usdTry, goldUsd, silverUsd] = await Promise.all([
      fetchUsdTryRate(),
      fetchGoldUsd(),
      fetchSilverUsd(),
    ]);

    const eurTry = await fetchEurTryRate(usdTry);

    // Convert to TRY per gram (1 troy oz = 31.1035 grams)
    const gramGoldTry = goldUsd > 0 ? (goldUsd * usdTry) / 31.1035 : 0;
    const gramSilverTry = silverUsd > 0 ? (silverUsd * usdTry) / 31.1035 : 0;

    return NextResponse.json({
      usdTry,
      eurTry,
      gramGoldTry,
      gramSilverTry,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch market prices:", error);
    // Return zeros on error - don't crash
    return NextResponse.json({
      usdTry: 1.0,
      eurTry: 1.0,
      gramGoldTry: 0,
      gramSilverTry: 0,
      fetchedAt: new Date().toISOString(),
    });
  }
}
