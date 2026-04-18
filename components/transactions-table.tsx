"use client";

import { usePortfolioStore } from "@/lib/store";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { TransactionWithAsset } from "@/types";

export function TransactionsTable({
  transactions,
}: {
  transactions: TransactionWithAsset[];
}) {
  const filter = usePortfolioStore((state) => state.transactionFilter);
  const setFilter = usePortfolioStore((state) => state.setTransactionFilter);

  const filteredTransactions =
    filter === "all"
      ? transactions
      : transactions.filter((transaction) => transaction.type === filter);

  return (
    <section className="space-y-4">
      <div className="inline-flex rounded-full border border-[color:var(--border)] bg-white/80 p-1">
        {[
          { label: "All", value: "all" },
          { label: "Buys", value: "BUY" },
          { label: "Sells", value: "SELL" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value as "all" | "BUY" | "SELL")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              filter === option.value
                ? "bg-stone-900 text-white shadow"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--card)] shadow-lg shadow-stone-900/5 backdrop-blur">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200/80 text-left">
            <thead className="bg-stone-900/[0.03]">
              <tr className="text-xs uppercase tracking-[0.24em] text-stone-500">
                <th className="px-5 py-4 font-semibold">Date</th>
                <th className="px-5 py-4 font-semibold">Symbol</th>
                <th className="px-5 py-4 font-semibold">Type</th>
                <th className="px-5 py-4 font-semibold">Quantity</th>
                <th className="px-5 py-4 font-semibold">Price</th>
                <th className="px-5 py-4 font-semibold">Currency</th>
                <th className="px-5 py-4 font-semibold">Gross</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/80">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="text-sm text-stone-700">
                  <td className="px-5 py-4">{formatDate(transaction.date)}</td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-stone-900">
                      {transaction.asset.ticker}
                    </div>
                    <div className="text-xs text-[color:var(--muted)]">
                      {transaction.asset.name}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        transaction.type === "BUY"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-5 py-4">{formatNumber(transaction.quantity)}</td>
                  <td className="px-5 py-4">{formatCurrency(transaction.price)}</td>
                  <td className="px-5 py-4">{transaction.currency}</td>
                  <td className="px-5 py-4 font-medium text-stone-900">
                    {formatCurrency(transaction.quantity * transaction.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
