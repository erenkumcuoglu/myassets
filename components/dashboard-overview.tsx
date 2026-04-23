"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshPricesButton } from "@/components/refresh-prices-button";
import {
  formatCompactCurrencyByCode,
  formatCurrencyByCode,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { Position } from "@/types";

type DashboardPositionRow = Position & {
  currentValueTry: number;
  unrealizedPnLTry: number;
  realizedPnLTry: number;
  previousPrice: number | null;
  todayChangeTry: number;
};

type SortKey =
  | "ticker"
  | "name"
  | "assetClass"
  | "totalQuantity"
  | "averageCostBasis"
  | "currentPrice"
  | "currentValueTry"
  | "unrealizedPnLTry"
  | "unrealizedPnLPercent";

const allocationColors: Record<string, string> = {
  BIST: "#2563eb",
  NASDAQ: "#0f766e",
  FUND_TR: "#d97706",
  FUND_US: "#7c3aed",
  COMMODITY: "#dc2626",
};

function CurrencyBadge({ currency }: { currency: "TRY" | "USD" | "EUR" }) {
  return (
    <span className="rounded-full border border-stone-200 bg-stone-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-600">
      {currency}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <article className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.25)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-stone-500">
        {label}
      </p>
      <p
        className={`finance-mono mt-4 text-3xl font-semibold tracking-tight ${
          tone === "positive"
            ? "text-emerald-700"
            : tone === "negative"
              ? "text-rose-700"
              : "text-stone-950"
        }`}
        suppressHydrationWarning
      >
        {value}
      </p>
      <p className="mt-3 text-sm leading-6 text-stone-500" suppressHydrationWarning>{helper}</p>
    </article>
  );
}

function SortHeader({
  active,
  direction,
  label,
  onClick,
}: {
  active: boolean;
  direction: "asc" | "desc";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-[0.24em] text-stone-500 transition hover:text-stone-900"
    >
      {label}
      <span className={`${active ? "opacity-100" : "opacity-30"}`}>
        {direction === "asc" ? "↑" : "↓"}
      </span>
    </button>
  );
}

export function DashboardOverview({
  positions,
  summary,
  allocation,
  topPositions,
}: {
  positions: DashboardPositionRow[];
  summary: {
    totalPortfolioTry: number;
    totalPortfolioUsd: number;
    totalUnrealizedTry: number;
    totalRealizedTry: number;
    todaysChangeTry: number;
    tryBreakdown: number;
    usdBreakdown: number;
    usdTryRate: number;
  };
  allocation: Array<{ assetClass: string; value: number }>;
  topPositions: Array<{ ticker: string; name: string; valueTry: number }>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("currentValueTry");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedPositions = useMemo(() => {
    const rows = [...positions];

    rows.sort((left, right) => {
      const leftValue =
        sortKey === "ticker"
          ? left.asset.ticker
          : sortKey === "name"
            ? left.asset.name
            : sortKey === "assetClass"
              ? left.asset.assetClass
              : left[sortKey];
      const rightValue =
        sortKey === "ticker"
          ? right.asset.ticker
          : sortKey === "name"
            ? right.asset.name
            : sortKey === "assetClass"
              ? right.asset.assetClass
              : right[sortKey];

      if (typeof leftValue === "string" && typeof rightValue === "string") {
        return sortDirection === "asc"
          ? leftValue.localeCompare(rightValue)
          : rightValue.localeCompare(leftValue);
      }

      return sortDirection === "asc"
        ? Number(leftValue) - Number(rightValue)
        : Number(rightValue) - Number(leftValue);
    });

    return rows;
  }, [positions, sortDirection, sortKey]);

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("desc");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total Portfolio Value"
            value={formatCurrencyByCode(summary.totalPortfolioTry, "TRY")}
            helper={`TRY ${formatCurrencyByCode(summary.tryBreakdown, "TRY")} • USD ${formatCurrencyByCode(summary.usdBreakdown, "USD")} • Total ${formatCurrencyByCode(summary.totalPortfolioUsd, "USD")}`}
          />
          <SummaryCard
            label="Total Unrealized P&L"
            value={formatCurrencyByCode(summary.totalUnrealizedTry, "TRY")}
            helper="Open-position mark-to-market performance"
            tone={summary.totalUnrealizedTry >= 0 ? "positive" : "negative"}
          />
          <SummaryCard
            label="Total Realized P&L"
            value={formatCurrencyByCode(summary.totalRealizedTry, "TRY")}
            helper="All completed SELL transactions, FIFO basis"
            tone={summary.totalRealizedTry >= 0 ? "positive" : "negative"}
          />
          <SummaryCard
            label="Today's Change"
            value={formatCurrencyByCode(summary.todaysChangeTry, "TRY")}
            helper={`Based on latest cached vs previous cached prices${summary.usdTryRate > 0 ? ` • USDTRY ${summary.usdTryRate.toFixed(2)}` : ""}`}
            tone={summary.todaysChangeTry >= 0 ? "positive" : "negative"}
          />
        </div>

        <RefreshPricesButton fundTrAssets={positions
          .filter(p => p.asset.assetClass === "FUND_TR")
          .map(p => ({ id: p.asset.id, ticker: p.asset.ticker, assetClass: p.asset.assetClass }))} />
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.25)]">
          <div className="mb-5">
            <h3 className="text-lg font-semibold tracking-tight text-stone-950">
              Allocation by asset class
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              Portfolio exposure based on current value converted to TRY.
            </p>
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocation}
                  dataKey="value"
                  nameKey="assetClass"
                  innerRadius={72}
                  outerRadius={112}
                  paddingAngle={4}
                >
                  {allocation.map((entry) => (
                    <Cell
                      key={entry.assetClass}
                      fill={allocationColors[entry.assetClass] ?? "#64748b"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) =>
                    formatCurrencyByCode(Number(value ?? 0), "TRY")
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {allocation.map((entry) => (
              <div
                key={entry.assetClass}
                className="flex items-center justify-between rounded-2xl border border-stone-200 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor:
                        allocationColors[entry.assetClass] ?? "#64748b",
                    }}
                  />
                  <span className="text-sm font-medium text-stone-700">
                    {entry.assetClass}
                  </span>
                </div>
                <span className="finance-mono text-sm text-stone-950" suppressHydrationWarning>
                  {formatCompactCurrencyByCode(entry.value, "TRY")}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.25)]">
          <div className="mb-5">
            <h3 className="text-lg font-semibold tracking-tight text-stone-950">
              Top 5 positions
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              Ranked by current value after TRY conversion.
            </p>
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPositions} layout="vertical" margin={{ left: 8, right: 12 }}>
                <XAxis
                  type="number"
                  tickFormatter={(value) =>
                    formatCompactCurrencyByCode(Number(value), "TRY")
                  }
                  tick={{ fill: "#78716c", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="ticker"
                  tick={{ fill: "#1c1917", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip
                  formatter={(value) =>
                    formatCurrencyByCode(Number(value ?? 0), "TRY")
                  }
                  labelFormatter={(label) => {
                    const position = topPositions.find((item) => item.ticker === label);
                    return position ? `${position.ticker} • ${position.name}` : label;
                  }}
                />
                <Bar dataKey="valueTry" radius={[0, 14, 14, 0]} fill="#0f766e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.25)]">
        <div className="border-b border-stone-200 px-5 py-4">
          <h3 className="text-lg font-semibold tracking-tight text-stone-950">
            Current positions
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            Click any column header to change sorting.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-left">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-5 py-4">
                  <SortHeader
                    active={sortKey === "ticker"}
                    direction={sortDirection}
                    label="Ticker"
                    onClick={() => handleSort("ticker")}
                  />
                </th>
                <th className="px-5 py-4">
                  <SortHeader
                    active={sortKey === "name"}
                    direction={sortDirection}
                    label="Name"
                    onClick={() => handleSort("name")}
                  />
                </th>
                <th className="px-5 py-4">
                  <SortHeader
                    active={sortKey === "assetClass"}
                    direction={sortDirection}
                    label="Class"
                    onClick={() => handleSort("assetClass")}
                  />
                </th>
                <th className="px-5 py-4">
                  <SortHeader
                    active={sortKey === "totalQuantity"}
                    direction={sortDirection}
                    label="Quantity"
                    onClick={() => handleSort("totalQuantity")}
                  />
                </th>
                <th className="px-5 py-4">
                  <SortHeader
                    active={sortKey === "averageCostBasis"}
                    direction={sortDirection}
                    label="Avg Cost"
                    onClick={() => handleSort("averageCostBasis")}
                  />
                </th>
                <th className="px-5 py-4">
                  <SortHeader
                    active={sortKey === "currentPrice"}
                    direction={sortDirection}
                    label="Current Price"
                    onClick={() => handleSort("currentPrice")}
                  />
                </th>
                <th className="px-5 py-4">
                  <SortHeader
                    active={sortKey === "currentValueTry"}
                    direction={sortDirection}
                    label="Current Value"
                    onClick={() => handleSort("currentValueTry")}
                  />
                </th>
                <th className="px-5 py-4">
                  <SortHeader
                    active={sortKey === "unrealizedPnLTry"}
                    direction={sortDirection}
                    label="Unrealized P&L"
                    onClick={() => handleSort("unrealizedPnLTry")}
                  />
                </th>
                <th className="px-5 py-4">
                  <SortHeader
                    active={sortKey === "unrealizedPnLPercent"}
                    direction={sortDirection}
                    label="Unrealized P&L %"
                    onClick={() => handleSort("unrealizedPnLPercent")}
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {sortedPositions.map((position) => (
                <tr key={position.asset.id} className="text-sm text-stone-700">
                  <td className="px-5 py-4">
                    <div className="finance-mono font-semibold text-stone-950">
                      {position.asset.ticker}
                    </div>
                  </td>
                  <td className="px-5 py-4">{position.asset.name}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                      {position.asset.assetClass}
                    </span>
                  </td>
                  <td className="finance-mono px-5 py-4">
                    {formatNumber(position.totalQuantity)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="finance-mono">
                        {formatCurrencyByCode(
                          position.averageCostBasis,
                          position.asset.currency,
                        )}
                      </span>
                      <CurrencyBadge currency={position.asset.currency} />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="finance-mono">
                        {formatCurrencyByCode(
                          position.currentPrice,
                          position.asset.currency,
                        )}
                      </span>
                      <CurrencyBadge currency={position.asset.currency} />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="finance-mono text-stone-950">
                      {formatCurrencyByCode(
                        position.currentValue,
                        position.asset.currency,
                      )}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">
                      {formatCurrencyByCode(position.currentValueTry, "TRY")}
                    </div>
                  </td>
                  <td
                    className={`px-5 py-4 finance-mono ${
                      position.unrealizedPnLTry >= 0
                        ? "text-emerald-700"
                        : "text-rose-700"
                    }`}
                  >
                    <div>
                      {formatCurrencyByCode(
                        position.unrealizedPnL,
                        position.asset.currency,
                      )}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">
                      {formatCurrencyByCode(position.unrealizedPnLTry, "TRY")}
                    </div>
                  </td>
                  <td
                    className={`px-5 py-4 finance-mono ${
                      position.unrealizedPnLPercent >= 0
                        ? "text-emerald-700"
                        : "text-rose-700"
                    }`}
                  >
                    {formatPercent(position.unrealizedPnLPercent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
