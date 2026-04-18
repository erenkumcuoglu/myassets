"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePortfolioStore } from "@/lib/store";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import type { PortfolioHistoryPoint } from "@/types";

const dayOptions = [
  { label: "7D", value: "7D" },
  { label: "30D", value: "30D" },
  { label: "ALL", value: "ALL" },
] as const;

export function DashboardChart({ data }: { data: PortfolioHistoryPoint[] }) {
  const range = usePortfolioStore((state) => state.dashboardRange);
  const setRange = usePortfolioStore((state) => state.setDashboardRange);

  const filtered = data.filter((point) => {
    if (range === "ALL") return true;
    const days = range === "7D" ? 7 : 30;
    const pointDate = new Date(point.date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return pointDate >= cutoff;
  });

  const chartData = filtered.length > 0 ? filtered : data.slice(-1);

  return (
    <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-lg shadow-stone-900/5 backdrop-blur sm:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-stone-900">
            Portfolio history
          </h3>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Value and net invested calculated from your local transaction ledger.
          </p>
        </div>

        <div className="inline-flex rounded-full border border-[color:var(--border)] bg-white/80 p-1">
          {dayOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                range === option.value
                  ? "bg-teal-700 text-white shadow"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%" minHeight={320}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0f766e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#0f766e" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="investedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.24} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(28,25,23,0.08)" vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#6b645d", fontSize: 12 }}
            />
            <YAxis
              tickFormatter={formatCompactCurrency}
              tickLine={false}
              axisLine={false}
              width={90}
              tick={{ fill: "#6b645d", fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value ?? 0))}
              labelClassName="font-medium text-stone-900"
              contentStyle={{
                borderRadius: "1rem",
                border: "1px solid rgba(28,25,23,0.12)",
                background: "rgba(255,255,255,0.96)",
              }}
            />
            <Area
              type="monotone"
              dataKey="invested"
              stroke="#f59e0b"
              fill="url(#investedGradient)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#0f766e"
              fill="url(#valueGradient)"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
