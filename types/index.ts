import { z } from "zod";

export const AssetClassSchema = z.enum([
  "BIST",
  "NASDAQ",
  "FUND_TR",
  "FUND_US",
  "COMMODITY",
]);

export const CurrencySchema = z.enum(["TRY", "USD"]);
export const TransactionTypeSchema = z.enum(["BUY", "SELL"]);

export type AssetClass = z.infer<typeof AssetClassSchema>;
export type Currency = z.infer<typeof CurrencySchema>;
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

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

export interface PriceCache {
  id: number;
  assetId: number;
  price: number;
  currency: Currency;
  fetchedAt: string;
}

export interface TransactionWithAsset extends Transaction {
  asset: Asset;
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

export type PortfolioSummary = {
  totalValue: number;
  totalCostBasis: number;
  netInvested: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalReturn: number;
  totalReturnPercent: number;
};

export type PortfolioHistoryPoint = {
  date: string;
  dateLabel: string;
  value: number;
  invested: number;
};

export type PortfolioSnapshot = {
  positions: Position[];
  history: PortfolioHistoryPoint[];
  summary: PortfolioSummary;
};

export const TransactionInputSchema = z.object({
  assetId: z.number().int().positive(),
  type: TransactionTypeSchema,
  quantity: z.number().positive(),
  price: z.number().positive(),
  currency: CurrencySchema,
  date: z.string().min(1),
  notes: z.string().optional().nullable().default(""),
});

export type TransactionInput = z.infer<typeof TransactionInputSchema>;
