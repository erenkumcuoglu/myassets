"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { getAssets } from "@/lib/db";
import { formatNumberWithCommas } from "@/lib/format";
import type { Asset, TransactionWithAsset } from "@/types";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithAsset[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filterAsset, setFilterAsset] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    type: "BUY" as "BUY" | "SELL",
    quantity: "",
    price: "",
    currency: "USD" as "USD" | "TRY" | "EUR",
    date: "",
    notes: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [transactionsRes, assetsRes] = await Promise.all([
        fetch("/api/transactions"),
        fetch("/api/assets"),
      ]);
      const transactionsData = await transactionsRes.json();
      const assetsData = await assetsRes.json();
      setTransactions(transactionsData);
      setAssets(assetsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filterAsset !== "all" && t.assetId !== Number(filterAsset)) return false;
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterStartDate && t.date < filterStartDate) return false;
    if (filterEndDate && t.date > filterEndDate) return false;
    return true;
  });

  const handleExportCSV = () => {
    const headers = ["Date", "Ticker", "Name", "Type", "Quantity", "Price", "Currency", "Total Value", "Notes"];
    const rows = filteredTransactions.map((t) => [
      t.date,
      t.asset.ticker,
      t.asset.name,
      t.type,
      t.quantity.toString(),
      t.price.toString(),
      t.currency,
      (t.quantity * t.price).toString(),
      t.notes || "",
    ]);
    
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const handleDeleteTransaction = async (id: number) => {
    try {
      const response = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (response.ok) {
        fetchData();
        setShowDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Failed to delete transaction:", error);
    }
  };

  const openEditModal = (transaction: TransactionWithAsset) => {
    setShowEditModal(transaction.id);
    setEditForm({
      type: transaction.type,
      quantity: transaction.quantity.toString(),
      price: transaction.price.toString(),
      currency: transaction.currency as "USD" | "TRY" | "EUR",
      date: transaction.date,
      notes: transaction.notes || "",
    });
  };

  const handleEditTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (showEditModal === null) return;

    try {
      const response = await fetch(`/api/transactions/${showEditModal}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editForm.type,
          quantity: Number(editForm.quantity),
          price: Number(editForm.price),
          currency: editForm.currency as "USD" | "TRY" | "EUR",
          date: editForm.date,
          notes: editForm.notes,
        }),
      });

      if (response.ok) {
        fetchData();
        setShowEditModal(null);
      }
    } catch (error) {
      console.error("Failed to update transaction:", error);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-sans">Transactions</h1>
          <p className="text-stone-600 mt-1 font-sans">Buy and sell history</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-sans"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Asset</label>
            <select
              value={filterAsset}
              onChange={(e) => setFilterAsset(e.target.value)}
              className="w-full p-2 border border-stone-300 rounded-lg font-sans"
            >
              <option value="all">All Assets</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.ticker} - {asset.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full p-2 border border-stone-300 rounded-lg font-sans"
            >
              <option value="all">All Types</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Start Date</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full p-2 border border-stone-300 rounded-lg font-sans"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 font-sans text-stone-700">End Date</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full p-2 border border-stone-300 rounded-lg font-sans"
            />
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700 font-sans sticky left-0 bg-stone-50 z-10">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700 font-sans">Ticker</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700 font-sans">Type</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Quantity</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Price</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Total Value</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700 font-sans">Notes</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="px-4 py-3 font-sans text-stone-700 sticky left-0 bg-white hover:bg-stone-50 z-10">{transaction.date}</td>
                    <td className="px-4 py-3 font-semibold font-mono text-stone-900">
                      <a
                        href={`/portfolio/${transaction.asset.ticker}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {transaction.asset.ticker}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold font-sans ${
                          transaction.type === "BUY"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-stone-900">
                      {formatNumberWithCommas(transaction.quantity)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-stone-900">
                      ${formatNumberWithCommas(transaction.price)}
                      <span className="ml-1 text-xs text-stone-500">{transaction.currency}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-stone-900">
                      ${formatNumberWithCommas(transaction.quantity * transaction.price)}
                    </td>
                    <td className="px-4 py-3 font-sans text-stone-700">
                      {transaction.notes || "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(transaction)}
                          className="text-stone-600 hover:text-blue-600 font-sans text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(transaction.id)}
                          className="text-rose-600 hover:text-rose-800 font-sans text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-stone-600 font-sans">
                    No transactions found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 font-sans">Delete Transaction</h3>
            <p className="text-stone-600 mb-6 font-sans">
              Are you sure you want to delete this transaction? This will recalculate P&L for all affected positions.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 font-sans"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTransaction(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-sans"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditModal !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 w-full">
            <h3 className="text-lg font-semibold mb-4 font-sans">Edit Transaction</h3>
            <form onSubmit={handleEditTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, type: "BUY" })}
                    className={`flex-1 py-2 px-4 rounded-lg font-semibold font-sans ${
                      editForm.type === "BUY"
                        ? "bg-emerald-600 text-white"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, type: "SELL" })}
                    className={`flex-1 py-2 px-4 rounded-lg font-semibold font-sans ${
                      editForm.type === "SELL"
                        ? "bg-rose-600 text-white"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    SELL
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                  className="w-full p-2 border border-stone-300 rounded-lg font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                  className="w-full p-2 border border-stone-300 rounded-lg font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Currency</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="USD"
                      checked={editForm.currency === "USD"}
                      onChange={(e) => setEditForm({ ...editForm, currency: e.target.value as "USD" | "TRY" | "EUR" })}
                      className="mr-2"
                    />
                    <span className="font-sans">USD</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="TRY"
                      checked={editForm.currency === "TRY"}
                      onChange={(e) => setEditForm({ ...editForm, currency: e.target.value as "USD" | "TRY" | "EUR" })}
                      className="mr-2"
                    />
                    <span className="font-sans">TRY</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="EUR"
                      checked={editForm.currency === "EUR"}
                      onChange={(e) => setEditForm({ ...editForm, currency: e.target.value as "USD" | "TRY" | "EUR" })}
                      className="mr-2"
                    />
                    <span className="font-sans">EUR</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Date</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full p-2 border border-stone-300 rounded-lg font-sans"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full p-2 border border-stone-300 rounded-lg font-sans"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(null);
                    setEditForm({ type: "BUY", quantity: "", price: "", currency: "USD", date: "", notes: "" });
                  }}
                  className="flex-1 px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-sans"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
