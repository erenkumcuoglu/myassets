import { DashboardOverview } from "@/components/dashboard-overview";
import { PageHeader } from "@/components/page-header";
import { getPortfolioSnapshot, getRecentPriceCacheEntries } from "@/lib/db";
import { fetchUsdTryRate } from "@/lib/prices";
import type { AssetClass, Position } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DashboardPositionRow = Position & {
  currentValueTry: number;
  unrealizedPnLTry: number;
  realizedPnLTry: number;
  previousPrice: number | null;
  todayChangeTry: number;
};

function round(value: number) {
  return Number(value.toFixed(2));
}

function convertToTry(value: number, currency: "USD" | "TRY", usdTryRate: number) {
  return currency === "TRY" ? value : value * usdTryRate;
}

export default async function DashboardPage() {
  const snapshot = getPortfolioSnapshot();
  const recentPrices = getRecentPriceCacheEntries(2);
  let usdTryRate = 0;

  try {
    usdTryRate = await fetchUsdTryRate();
  } catch {
    usdTryRate = 0;
  }

  const positions: DashboardPositionRow[] = snapshot.positions.map((position) => {
    const recentEntries = recentPrices.get(position.asset.id) ?? [];
    const previousPrice = recentEntries[1]?.price ?? null;
    const fxRate = position.asset.currency === "TRY" ? 1 : usdTryRate || 1;
    const priceDelta =
      previousPrice !== null ? position.currentPrice - previousPrice : 0;

    return {
      ...position,
      currentValueTry: round(
        convertToTry(position.currentValue, position.asset.currency, fxRate),
      ),
      unrealizedPnLTry: round(
        convertToTry(position.unrealizedPnL, position.asset.currency, fxRate),
      ),
      realizedPnLTry: round(
        convertToTry(position.realizedPnL, position.asset.currency, fxRate),
      ),
      previousPrice,
      todayChangeTry: round(priceDelta * position.totalQuantity * fxRate),
    };
  });

  const totalPortfolioTry = positions.reduce(
    (sum, position) => sum + position.currentValueTry,
    0,
  );
  const totalPortfolioUsd = positions.reduce((sum, position) => {
    if (position.asset.currency === "USD") {
      return sum + position.currentValue;
    }

    return usdTryRate > 0 ? sum + position.currentValue / usdTryRate : sum;
  }, 0);
  const tryBreakdown = positions
    .filter((position) => position.asset.currency === "TRY")
    .reduce((sum, position) => sum + position.currentValue, 0);
  const usdBreakdown = positions
    .filter((position) => position.asset.currency === "USD")
    .reduce((sum, position) => sum + position.currentValue, 0);
  const totalUnrealizedTry = positions.reduce(
    (sum, position) => sum + position.unrealizedPnLTry,
    0,
  );
  const totalRealizedTry = positions.reduce(
    (sum, position) => sum + position.realizedPnLTry,
    0,
  );
  const todaysChangeTry = positions.reduce(
    (sum, position) => sum + position.todayChangeTry,
    0,
  );

  const allocation = Array.from(
    positions.reduce((accumulator, position) => {
      const current = accumulator.get(position.asset.assetClass) ?? 0;
      accumulator.set(position.asset.assetClass, current + position.currentValueTry);
      return accumulator;
    }, new Map<AssetClass, number>()),
  ).map(([assetClass, value]) => ({
    assetClass,
    value: round(value),
  }));

  const topPositions = [...positions]
    .sort((a, b) => b.currentValueTry - a.currentValueTry)
    .slice(0, 5)
    .map((position) => ({
      ticker: position.asset.ticker,
      name: position.asset.name,
      valueTry: position.currentValueTry,
    }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title="Market-wide overview"
        description="A dense but readable summary of allocation, P&L, and current positions across Turkish and US assets."
      />

      <DashboardOverview
        positions={positions}
        summary={{
          totalPortfolioTry: round(totalPortfolioTry),
          totalPortfolioUsd: round(totalPortfolioUsd),
          totalUnrealizedTry: round(totalUnrealizedTry),
          totalRealizedTry: round(totalRealizedTry),
          todaysChangeTry: round(todaysChangeTry),
          tryBreakdown: round(tryBreakdown),
          usdBreakdown: round(usdBreakdown),
          usdTryRate: round(usdTryRate),
        }}
        allocation={allocation}
        topPositions={topPositions}
      />
    </div>
  );
}
