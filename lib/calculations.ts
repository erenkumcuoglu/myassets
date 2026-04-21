import type {
  PortfolioSnapshot,
  PortfolioSummary,
  Position,
  PriceCache,
  TransactionWithAsset,
  FxRate,
} from "@/types";
import { getFxRates } from "@/lib/db";

type Lot = {
  quantity: number;
  unitCost: number;
};

type PositionAccumulator = {
  assetId: number;
  asset: TransactionWithAsset["asset"];
  lots: Lot[];
  lastKnownPrice: number;
  realizedPnL: number;
};

function round(value: number) {
  return Number(value.toFixed(2));
}

export async function calculatePortfolioSnapshot(
  transactions: TransactionWithAsset[],
  latestPrices: Map<number, PriceCache> = new Map(),
): Promise<PortfolioSnapshot> {
  // Fetch FX rates for currency conversion
  const fxRates = await getFxRates();
  const usdTryRate = fxRates.find((r) => r.pair === "USDTRY")?.rate ?? 32;
  const eurTryRate = fxRates.find((r) => r.pair === "EURTRY")?.rate ?? 35;

  const orderedTransactions = [...transactions].sort((a, b) =>
    a.date.localeCompare(b.date) || a.id - b.id,
  );

  const positions = new Map<number, PositionAccumulator>();

  for (const transaction of orderedTransactions) {
    const existing = positions.get(transaction.assetId) ?? {
      assetId: transaction.assetId,
      asset: transaction.asset,
      lots: [],
      lastKnownPrice: transaction.price,
      realizedPnL: 0,
    };

    existing.lastKnownPrice = transaction.price;

    if (transaction.type === "BUY") {
      existing.lots.push({
        quantity: transaction.quantity,
        unitCost: transaction.price,
      });
      positions.set(transaction.assetId, existing);
    } else {
      let remainingToSell = transaction.quantity;
      let matchedCost = 0;

      if (remainingToSell > existing.lots.reduce((sum, lot) => sum + lot.quantity, 0)) {
        throw new Error(
          `Cannot sell ${transaction.quantity} ${transaction.asset.ticker}; insufficient quantity available.`,
        );
      }

      const updatedLots = existing.lots.map((lot) => ({ ...lot }));

      while (remainingToSell > 0.0000001) {
        const lot = updatedLots[0];

        if (!lot) {
          throw new Error(
            `FIFO inventory exhausted while processing ${transaction.asset.ticker}.`,
          );
        }

        const matchedQuantity = Math.min(remainingToSell, lot.quantity);
        matchedCost += matchedQuantity * lot.unitCost;
        lot.quantity -= matchedQuantity;
        remainingToSell -= matchedQuantity;

        if (lot.quantity <= 0.0000001) {
          updatedLots.shift();
        }
      }

      const saleProceeds = transaction.quantity * transaction.price;
      existing.lots = updatedLots;
      existing.realizedPnL += saleProceeds - matchedCost;

      if (existing.lots.length > 0) {
        positions.set(transaction.assetId, existing);
      } else {
        positions.delete(transaction.assetId);
      }
    }
  }

  const computedPositions: Position[] = Array.from(positions.values())
    .map((state) => {
      const totalQuantity = state.lots.reduce((sum, lot) => sum + lot.quantity, 0);
      const totalCost = state.lots.reduce(
        (sum, lot) => sum + lot.quantity * lot.unitCost,
        0,
      );
      const averageCostBasis = totalQuantity > 0 ? totalCost / totalQuantity : 0;
      
      const priceCache = latestPrices.get(state.assetId);
      const latestPrice = priceCache?.price ?? state.lastKnownPrice;
      const priceCurrency = priceCache?.currency ?? state.asset.currency;

      // Convert price to asset currency if they differ
      let convertedPrice = latestPrice;
      if (priceCurrency !== state.asset.currency) {
        if (priceCurrency === "TRY" && state.asset.currency === "USD") {
          convertedPrice = latestPrice / usdTryRate; // TRY to USD
        } else if (priceCurrency === "TRY" && state.asset.currency === "EUR") {
          convertedPrice = latestPrice / eurTryRate; // TRY to EUR
        } else if (priceCurrency === "USD" && state.asset.currency === "TRY") {
          convertedPrice = latestPrice * usdTryRate; // USD to TRY
        } else if (priceCurrency === "EUR" && state.asset.currency === "TRY") {
          convertedPrice = latestPrice * eurTryRate; // EUR to TRY
        }
      }
      
      const currentValue = totalQuantity * convertedPrice;
      const unrealizedPnL = currentValue - totalCost;
      const unrealizedPnLPercent = totalCost > 0 ? unrealizedPnL / totalCost : 0;

      return {
        asset: state.asset,
        totalQuantity: round(totalQuantity),
        averageCostBasis: round(averageCostBasis),
        currentPrice: round(convertedPrice),
        currentValue: round(currentValue),
        totalCost: round(totalCost),
        unrealizedPnL: round(unrealizedPnL),
        unrealizedPnLPercent,
        realizedPnL: round(state.realizedPnL),
      };
    })
    .filter((position) => position.totalQuantity > 0)
    .sort((a, b) => b.currentValue - a.currentValue);

  // Convert all position values to TRY for summary
  const totalValue = computedPositions.reduce((sum, position) => {
    if (position.asset.currency === "TRY") return sum + position.currentValue;
    if (position.asset.currency === "USD") return sum + position.currentValue * usdTryRate;
    if (position.asset.currency === "EUR") return sum + position.currentValue * eurTryRate;
    return sum;
  }, 0);
  
  const totalCostBasis = computedPositions.reduce((sum, position) => {
    if (position.asset.currency === "TRY") return sum + position.totalCost;
    if (position.asset.currency === "USD") return sum + position.totalCost * usdTryRate;
    if (position.asset.currency === "EUR") return sum + position.totalCost * eurTryRate;
    return sum;
  }, 0);
  
  const totalRealizedPnL = computedPositions.reduce((sum, position) => {
    if (position.asset.currency === "TRY") return sum + position.realizedPnL;
    if (position.asset.currency === "USD") return sum + position.realizedPnL * usdTryRate;
    if (position.asset.currency === "EUR") return sum + position.realizedPnL * eurTryRate;
    return sum;
  }, 0);
  
  const unrealizedPnL = totalValue - totalCostBasis;
  const totalReturn = totalRealizedPnL + unrealizedPnL;

  const summary: PortfolioSummary = {
    totalValue: round(totalValue),
    totalCostBasis: round(totalCostBasis),
    netInvested: round(totalCostBasis),
    realizedPnL: round(totalRealizedPnL),
    unrealizedPnL: round(unrealizedPnL),
    totalReturn: round(totalReturn),
    totalReturnPercent: totalCostBasis > 0 ? totalReturn / totalCostBasis : 0,
  };

  return {
    positions: computedPositions,
    history: [],
    summary,
  };
}
