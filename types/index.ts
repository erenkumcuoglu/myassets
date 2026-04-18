export type AssetClass = "BIST" | "NASDAQ" | "FUND_TR" | "FUND_US" | "COMMODITY";
export type Currency = "TRY" | "USD" | "EUR";
export type TransactionType = "BUY" | "SELL";

export interface Asset {
  id: number;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  currency: Currency;
  createdAt: string;
}

export interface Transaction {
  id: number;
  assetId: number;
  type: TransactionType;
  quantity: number;
  price: number;
  currency: Currency;
  date: string;
  notes: string | null;
  createdAt: string;
}

export interface TransactionWithAsset extends Transaction {
  asset: Asset;
}

export interface PriceCache {
  id: number;
  assetId: number;
  price: number;
  currency: Currency;
  fetchedAt: string;
}

export interface FxRate {
  id: number;
  pair: string;
  rate: number;
  fetchedAt: string;
}

export interface Position {
  asset: Asset;
  totalQuantity: number;
  averageCostBasis: number;
  currentPrice: number;
  currentValue: number;
  totalCost: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  realizedPnL: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCostBasis: number;
  netInvested: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalReturn: number;
  totalReturnPercent: number;
}

export interface PortfolioHistoryPoint {
  date: string;
  dateLabel: string;
  value: number;
  invested: number;
}

export interface PortfolioSnapshot {
  positions: Position[];
  history: PortfolioHistoryPoint[];
  summary: PortfolioSummary;
}
