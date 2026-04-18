import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { Position } from "@/types";

export function HoldingsTable({ positions }: { positions: Position[] }) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--card)] shadow-lg shadow-stone-900/5 backdrop-blur">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200/80 text-left">
          <thead className="bg-stone-900/[0.03]">
            <tr className="text-xs uppercase tracking-[0.24em] text-stone-500">
              <th className="px-5 py-4 font-semibold">Symbol</th>
              <th className="px-5 py-4 font-semibold">Units</th>
              <th className="px-5 py-4 font-semibold">Avg Cost</th>
              <th className="px-5 py-4 font-semibold">Last Price</th>
              <th className="px-5 py-4 font-semibold">Value</th>
              <th className="px-5 py-4 font-semibold">Unrealized</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200/80">
            {positions.map((position) => (
              <tr key={position.asset.id} className="text-sm text-stone-700">
                <td className="px-5 py-4">
                  <div className="font-semibold text-stone-900">{position.asset.ticker}</div>
                  <div className="text-xs text-[color:var(--muted)]">
                    {position.asset.name}
                  </div>
                </td>
                <td className="px-5 py-4">{formatNumber(position.totalQuantity)}</td>
                <td className="px-5 py-4">{formatCurrency(position.averageCostBasis)}</td>
                <td className="px-5 py-4">{formatCurrency(position.currentPrice)}</td>
                <td className="px-5 py-4">{formatCurrency(position.currentValue)}</td>
                <td
                  className={`px-5 py-4 font-medium ${
                    position.unrealizedPnL >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {formatCurrency(position.unrealizedPnL)}
                  <div className="text-xs font-normal text-[color:var(--muted)]">
                    {formatPercent(position.unrealizedPnLPercent)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
