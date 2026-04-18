"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Asset, TransactionInput } from "@/types";

function createInitialForm(assets: Asset[]): TransactionInput {
  const defaultAsset = assets[0];

  return {
    assetId: defaultAsset?.id ?? 0,
    type: "BUY",
    quantity: 0,
    price: 0,
    currency: defaultAsset?.currency ?? "USD",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  };
}

export function AddTransactionForm({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const [form, setForm] = useState<TransactionInput>(() => createInitialForm(assets));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === form.assetId) ?? assets[0],
    [assets, form.assetId],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          currency: selectedAsset?.currency ?? form.currency,
          notes: form.notes?.trim() ?? "",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to save transaction.");
      }

      setForm(createInitialForm(assets));
      router.push("/transactions");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save transaction.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-lg shadow-stone-900/5 backdrop-blur lg:grid-cols-2"
    >
      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-700">Asset</span>
        <select
          required
          value={form.assetId}
          onChange={(event) => {
            const asset = assets.find((item) => item.id === Number(event.target.value));
            setForm((current) => ({
              ...current,
              assetId: Number(event.target.value),
              currency: asset?.currency ?? current.currency,
            }));
          }}
          className="w-full rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        >
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.ticker} - {asset.name}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-700">Asset class</span>
        <input
          readOnly
          value={selectedAsset?.assetClass ?? ""}
          className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-600 outline-none"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-700">Transaction type</span>
        <select
          value={form.type}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              type: event.target.value as TransactionInput["type"],
            }))
          }
          className="w-full rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        >
          <option value="BUY">Buy</option>
          <option value="SELL">Sell</option>
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-700">Date</span>
        <input
          required
          type="date"
          value={form.date}
          onChange={(event) =>
            setForm((current) => ({ ...current, date: event.target.value }))
          }
          className="w-full rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-700">Quantity</span>
        <input
          required
          min="0.0001"
          step="0.0001"
          type="number"
          value={form.quantity || ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              quantity: Number(event.target.value),
            }))
          }
          className="w-full rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          placeholder="10"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-700">Price per unit</span>
        <input
          required
          min="0.0001"
          step="0.0001"
          type="number"
          value={form.price || ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              price: Number(event.target.value),
            }))
          }
          className="w-full rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          placeholder="185.50"
        />
      </label>

      <label className="space-y-2 lg:col-span-2">
        <span className="text-sm font-medium text-stone-700">Currency</span>
        <input
          readOnly
          value={selectedAsset?.currency ?? form.currency}
          className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-600 outline-none"
        />
      </label>

      <label className="space-y-2 lg:col-span-2">
        <span className="text-sm font-medium text-stone-700">Notes</span>
        <textarea
          rows={4}
          value={form.notes ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
          className="w-full rounded-3xl border border-stone-200 bg-white/90 px-4 py-3 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          placeholder="Optional rationale, broker note, or order context."
        />
      </label>

      <div className="flex flex-col gap-3 lg:col-span-2">
        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || assets.length === 0}
          className="inline-flex items-center justify-center rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {submitting ? "Saving transaction..." : "Save transaction"}
        </button>
      </div>
    </form>
  );
}
