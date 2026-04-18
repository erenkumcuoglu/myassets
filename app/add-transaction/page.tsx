"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatNumberWithCommas } from "@/lib/format";
import type { AssetClass, Currency, TransactionType } from "@/types";

interface FormErrors {
  ticker?: string;
  name?: string;
  assetClass?: string;
  currency?: string;
  type?: string;
  date?: string;
  quantity?: string;
  price?: string;
  submit?: string;
}

export default function AddTransactionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState({
    // Asset Information
    ticker: "",
    name: "",
    assetClass: "BIST" as AssetClass,
    currency: "TRY" as Currency,
    // Transaction Details
    type: "BUY" as TransactionType,
    date: new Date().toISOString().split("T")[0],
    quantity: "",
    price: "",
    currentPrice: "",
    notes: "",
  });

  const [fetchingPrice, setFetchingPrice] = useState(false);

  const handleFetchPrice = async () => {
    if (!formData.ticker || !formData.assetClass) return;

    setFetchingPrice(true);
    try {
      const response = await fetch(`/api/price?ticker=${formData.ticker}&assetClass=${formData.assetClass}`);
      const data = await response.json();
      if (data.price) {
        setFormData((prev) => ({ ...prev, currentPrice: data.price.toString() }));
      }
    } catch (error) {
      console.error("Failed to fetch price:", error);
    } finally {
      setFetchingPrice(false);
    }
  };

  // Auto-fetch price when ticker and asset class are entered
  useEffect(() => {
    if (formData.ticker && formData.assetClass && formData.ticker.length > 0) {
      const timer = setTimeout(() => {
        handleFetchPrice();
      }, 500); // Debounce to avoid too many requests
      return () => clearTimeout(timer);
    }
  }, [formData.ticker, formData.assetClass]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const today = new Date().toISOString().split("T")[0];

    // Asset Information validation
    if (!formData.ticker.trim()) {
      newErrors.ticker = "Ticker gerekli";
    }
    if (!formData.name.trim()) {
      newErrors.name = "Name gerekli";
    }
    if (!formData.assetClass) {
      newErrors.assetClass = "Asset Class gerekli";
    }
    if (!formData.currency) {
      newErrors.currency = "Currency gerekli";
    }

    // Transaction Details validation
    if (!formData.type) {
      newErrors.type = "Transaction Type gerekli";
    }
    if (!formData.date) {
      newErrors.date = "Tarih gerekli";
    } else if (formData.date > today) {
      newErrors.date = "Tarih gelecekte olamaz";
    }

    const quantity = Number(formData.quantity);
    if (!formData.quantity || isNaN(quantity) || quantity <= 0) {
      newErrors.quantity = "Adet 0'dan büyük olmalı ve geçerli bir sayı olmalı";
    }

    const price = Number(formData.price);
    if (!formData.price || isNaN(price) || price <= 0) {
      newErrors.price = "Fiyat 0'dan büyük olmalı ve geçerli bir sayı olmalı";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      // Check if asset with same ticker already exists
      const assetsResponse = await fetch("/api/assets");
      const assetsData = await assetsResponse.json();
      const assets = Array.isArray(assetsData) ? assetsData : [];
      const existingAsset = assets.find((a: { ticker: string }) => a.ticker === formData.ticker.toUpperCase());

      let assetId: number;

      if (existingAsset) {
        // Use existing asset
        assetId = existingAsset.id;
      } else {
        // Insert new asset first
        const assetResponse = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticker: formData.ticker.toUpperCase(),
            name: formData.name,
            assetClass: formData.assetClass,
            currency: formData.currency,
          }),
        });

        if (!assetResponse.ok) {
          const error = await assetResponse.json();
          setErrors({ submit: error.message || "Varlık oluşturulamadı" });
          setLoading(false);
          return;
        }

        const assetData = await assetResponse.json();
        assetId = assetData.id;

        // Fetch current price for new asset and cache it
        try {
          await fetch(`/api/price?ticker=${formData.ticker}&assetClass=${formData.assetClass}`);
        } catch (error) {
          console.warn("Failed to fetch initial price:", error);
        }
      }

      // Insert transaction
      const transactionResponse = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          type: formData.type,
          quantity: Number(formData.quantity),
          price: Number(formData.price),
          currency: formData.currency,
          date: formData.date,
          notes: formData.notes || null,
        }),
      });

      if (!transactionResponse.ok) {
        const error = await transactionResponse.json();
        setErrors({ submit: error.message || "İşlem eklenemedi" });
        setLoading(false);
        return;
      }

      // Success - redirect to portfolio
      router.push("/portfolio?toast=İşlem başarıyla eklendi");
    } catch (error) {
      console.error("Failed to submit transaction:", error);
      setErrors({ submit: "Bir hata oluştu" });
      setLoading(false);
    }
  };

  const total = Number(formData.quantity || 0) * Number(formData.price || 0);

  return (
    <div className="space-y-6 p-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-sans">İşlem Ekle</h1>
        <p className="text-stone-600 mt-1 font-sans">Yeni varlık ve işlem ekle</p>
      </div>

      {errors.submit && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
          <p className="text-rose-800 font-sans">{errors.submit}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 space-y-6">
        {/* ── Asset Information ── */}
        <div className="border-b border-stone-200 pb-6">
          <h2 className="text-sm font-semibold mb-4 font-sans text-stone-700">── Varlık Bilgileri ──</h2>
          
          <div className="space-y-4">
            {/* Ticker */}
            <div>
              <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Ticker</label>
              <input
                type="text"
                value={formData.ticker}
                onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                className={`w-full p-3 border rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.ticker ? 'border-rose-300' : 'border-stone-300'}`}
              />
              {errors.ticker && <p className="text-xs text-rose-600 font-sans mt-1">{errors.ticker}</p>}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full p-3 border rounded-lg font-sans focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.name ? 'border-rose-300' : 'border-stone-300'}`}
              />
              {errors.name && <p className="text-xs text-rose-600 font-sans mt-1">{errors.name}</p>}
            </div>

            {/* Asset Class */}
            <div>
              <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Asset Class</label>
              <select
                value={formData.assetClass}
                onChange={(e) => setFormData({ ...formData, assetClass: e.target.value as AssetClass })}
                className={`w-full p-3 border rounded-lg font-sans focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.assetClass ? 'border-rose-300' : 'border-stone-300'}`}
              >
                <option value="BIST">BIST</option>
                <option value="NASDAQ">NASDAQ</option>
                <option value="FUND_TR">FUND_TR</option>
                <option value="FUND_US">FUND_US</option>
                <option value="COMMODITY">COMMODITY</option>
              </select>
              {errors.assetClass && <p className="text-xs text-rose-600 font-sans mt-1">{errors.assetClass}</p>}
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Currency</label>
              <div className="flex gap-4">
                {(["TRY", "USD", "EUR"] as Currency[]).map((curr) => (
                  <label key={curr} className="flex items-center">
                    <input
                      type="radio"
                      value={curr}
                      checked={formData.currency === curr}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value as Currency })}
                      className="mr-2"
                    />
                    <span className="font-sans">{curr}</span>
                  </label>
                ))}
              </div>
              {errors.currency && <p className="text-xs text-rose-600 font-sans mt-1">{errors.currency}</p>}
            </div>
          </div>
        </div>

        {/* ── Transaction Details ── */}
        <div className="border-b border-stone-200 pb-6">
          <h2 className="text-sm font-semibold mb-4 font-sans text-stone-700">── İşlem Detayları ──</h2>
          
          <div className="space-y-4">
            {/* Transaction Type */}
            <div>
              <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Transaction Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, type: "BUY" }))}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold font-sans ${
                    formData.type === "BUY"
                      ? "bg-emerald-600 text-white"
                      : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                  }`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, type: "SELL" }))}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold font-sans ${
                    formData.type === "SELL"
                      ? "bg-rose-600 text-white"
                      : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                  }`}
                >
                  SELL
                </button>
              </div>
              {errors.type && <p className="text-xs text-rose-600 font-sans mt-1">{errors.type}</p>}
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className={`w-full p-3 border rounded-lg font-sans focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.date ? 'border-rose-300' : 'border-stone-300'}`}
              />
              {errors.date && <p className="text-xs text-rose-600 font-sans mt-1">{errors.date}</p>}
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Quantity</label>
              <input
                type="number"
                step="any"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className={`w-full p-3 border rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.quantity ? 'border-rose-300' : 'border-stone-300'}`}
              />
              {errors.quantity && <p className="text-xs text-rose-600 font-sans mt-1">{errors.quantity}</p>}
            </div>

            {/* Price per Unit */}
            <div>
              <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Alış Fiyatı ({formData.currency})</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className={`flex-1 p-3 border rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.price ? 'border-rose-300' : 'border-stone-300'}`}
                />
                <button
                  type="button"
                  onClick={handleFetchPrice}
                  disabled={fetchingPrice}
                  className="px-4 py-3 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 disabled:bg-stone-200 disabled:text-stone-400 font-sans text-sm"
                >
                  {fetchingPrice ? "Loading..." : "Güncel Fiyatı Getir"}
                </button>
              </div>
              {errors.price && <p className="text-xs text-rose-600 font-sans mt-1">{errors.price}</p>}
            </div>

            {/* Total (Calculated) */}
            <div>
              <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Toplam ({formData.currency})</label>
              <input
                type="text"
                value={formData.quantity && formData.price && Number(formData.quantity) > 0 && Number(formData.price) > 0
                  ? `${formatNumberWithCommas(total)}`
                  : ""}
                readOnly
                className="w-full p-3 border border-stone-200 rounded-lg font-mono bg-stone-50 text-stone-700"
                placeholder="Adet ve fiyat girin"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Notes (Optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full p-3 border border-stone-300 rounded-lg font-sans focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* ── Summary ── */}
        <div className="p-4 bg-stone-50 rounded-lg">
          <p className="text-sm font-medium font-sans text-stone-700">Toplam</p>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">
            {formData.quantity && formData.price && Number(formData.quantity) > 0 && Number(formData.price) > 0
              ? `${formatNumberWithCommas(total)} ${formData.currency}`
              : "—"}
          </p>
          <p className="text-xs text-stone-500 font-mono mt-1">
            {formData.quantity && formData.price && Number(formData.quantity) > 0 && Number(formData.price) > 0
              ? `${formatNumberWithCommas(Number(formData.quantity))} × ${formatNumberWithCommas(Number(formData.price))}`
              : "Adet ve fiyat girin"}
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-semibold font-sans"
        >
          {loading ? "Ekleniyor..." : "İşlem Ekle"}
        </button>
      </form>
    </div>
  );
}
