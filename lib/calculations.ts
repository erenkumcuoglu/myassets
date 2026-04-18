import type {
  Asset,
  PortfolioHistoryPoint,
  PortfolioSnapshot,
  PortfolioSummary,
  Position,
  PriceCache,
  TransactionWithAsset,
} from "@/types";

type Lot = {
  quantity: number;
  unitCost: number;
};

type PositionAccumulator = {
  asset: Asset;
  lots: Lot[];
  lastKnownPrice: number;
  realizedPnL: number;
};

function round(value: number) {
  return Number(value.toFixed(2));
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function cloneLots(lots: Lot[]) {
  return lots.map((lot) => ({ ...lot }));
}

function findCurrentPrice(
  assetId: number,
  latestPrices: Map<number, PriceCache>,
  fallbackPrice: number,
) {
  return latestPrices.get(assetId)?.price ?? fallbackPrice;
}

export function calculatePortfolioSnapshot(
  transactions: TransactionWithAsset[],
  latestPrices: Map<number, PriceCache> = new Map(),
): PortfolioSnapshot {
  const orderedTransactions = [...transactions].sort((a, b) =>
    a.date.localeCompare(b.date) || a.id - b.id,
  );

  const positions = new Map<number, PositionAccumulator>();
  const history: PortfolioHistoryPoint[] = [];
  let netInvested = 0;

  for (const transaction of orderedTransactions) {
    const existing = positions.get(transaction.assetId) ?? {
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
      netInvested += transaction.quantity * transaction.price;
      positions.set(transaction.assetId, existing);
    } else {
      let remainingToSell = transaction.quantity;
      let matchedCost = 0;

      if (remainingToSell > existing.lots.reduce((sum, lot) => sum + lot.quantity, 0)) {
        throw new Error(
          `Cannot sell ${transaction.quantity} ${transaction.asset.ticker}; insufficient quantity available.`,
        );
      }

      const updatedLots = cloneLots(existing.lots);

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
      netInvested -= saleProceeds;

      if (existing.lots.length > 0) {
        positions.set(transaction.assetId, existing);
      } else {
        positions.delete(transaction.assetId);
      }
    }

    const portfolioValue = Array.from(positions.values()).reduce((total, position) => {
      const quantity = position.lots.reduce((sum, lot) => sum + lot.quantity, 0);
      return total + quantity * position.lastKnownPrice;
    }, 0);

    history.push({
      date: transaction.date,
      dateLabel: formatDateLabel(transaction.date),
      value: round(portfolioValue),
      invested: round(netInvested),
    });
  }

  const allAssetStates = new Map<number, PositionAccumulator>();

  for (const transaction of orderedTransactions) {
    const existing = allAssetStates.get(transaction.assetId) ?? {
      asset: transaction.asset,
      lots: [],
      lastKnownPrice: transaction.price,
      realizedPnL: 0,
    };

    existing.lastKnownPrice = transaction.price;

    if (transaction.type === "BUY") {
      existing.lots.push({ quantity: transaction.quantity, unitCost: transaction.price });
    } else {
      let remainingToSell = transaction.quantity;

      while (remainingToSell > 0.0000001) {
        const lot = existing.lots[0];

        if (!lot) {
          throw new Error(
            `FIFO inventory exhausted while processing ${transaction.asset.ticker}.`,
          );
        }

        const matchedQuantity = Math.min(remainingToSell, lot.quantity);
        existing.realizedPnL += matchedQuantity * (transaction.price - lot.unitCost);
        lot.quantity -= matchedQuantity;
        remainingToSell -= matchedQuantity;

        if (lot.quantity <= 0.0000001) {
          existing.lots.shift();
        }
      }
    }

    allAssetStates.set(transaction.assetId, existing);
  }

  const computedPositions: Position[] = Array.from(allAssetStates.values())
    .map((state) => {
      const totalQuantity = state.lots.reduce((sum, lot) => sum + lot.quantity, 0);
      const totalCost = state.lots.reduce(
        (sum, lot) => sum + lot.quantity * lot.unitCost,
        0,
      );
      const averageCostBasis = totalQuantity > 0 ? totalCost / totalQuantity : 0;
      const currentPrice = findCurrentPrice(
        state.asset.id,
        latestPrices,
        state.lastKnownPrice,
      );
      const currentValue = totalQuantity * currentPrice;
      const unrealizedPnL = currentValue - totalCost;
      const unrealizedPnLPercent = totalCost > 0 ? unrealizedPnL / totalCost : 0;

      return {
        asset: state.asset,
        totalQuantity: round(totalQuantity),
        averageCostBasis: round(averageCostBasis),
        currentPrice: round(currentPrice),
        currentValue: round(currentValue),
        totalCost: round(totalCost),
        unrealizedPnL: round(unrealizedPnL),
        unrealizedPnLPercent,
        realizedPnL: round(state.realizedPnL),
      };
    })
    .filter((position) => position.totalQuantity > 0)
    .sort((a, b) => b.currentValue - a.currentValue);

  const totalValue = computedPositions.reduce(
    (sum, position) => sum + position.currentValue,
    0,
  );
  const totalCostBasis = computedPositions.reduce(
    (sum, position) => sum + position.totalCost,
    0,
  );
  const totalRealizedPnL = computedPositions.reduce(
    (sum, position) => sum + position.realizedPnL,
    0,
  );
  const unrealizedPnL = totalValue - totalCostBasis;
  const totalReturn = totalRealizedPnL + unrealizedPnL;

  const summary: PortfolioSummary = {
    totalValue: round(totalValue),
    totalCostBasis: round(totalCostBasis),
    netInvested: round(netInvested),
    realizedPnL: round(totalRealizedPnL),
    unrealizedPnL: round(unrealizedPnL),
    totalReturn: round(totalReturn),
    totalReturnPercent: totalCostBasis > 0 ? totalReturn / totalCostBasis : 0,
  };

  return {
    positions: computedPositions,
    history,
    summary,
  };
}
