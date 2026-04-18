"use client";

import { create } from "zustand";

type DashboardRange = "7D" | "30D" | "ALL";
type TransactionFilter = "all" | "BUY" | "SELL";

type PortfolioStore = {
  dashboardRange: DashboardRange;
  transactionFilter: TransactionFilter;
  setDashboardRange: (range: DashboardRange) => void;
  setTransactionFilter: (filter: TransactionFilter) => void;
};

export const usePortfolioStore = create<PortfolioStore>((set) => ({
  dashboardRange: "ALL",
  transactionFilter: "all",
  setDashboardRange: (dashboardRange) => set({ dashboardRange }),
  setTransactionFilter: (transactionFilter) => set({ transactionFilter }),
}));
