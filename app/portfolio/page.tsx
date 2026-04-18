"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatNumberWithCommas } from "@/lib/format";
import type { AssetClass, Currency, Position, Asset } from "@/types";

export default function PortfolioPage() {
  const router = useRouter();
  const { convertAmount, baseCurrency, usdTryRate, eurTryRate } = useCurrency();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [transactionCount, setTransactionCount] = useState(0);
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set());

  // Add asset form state
  const [newAsset, setNewAsset] = useState({
    ticker: "",
    name: "",
    assetClass: "BIST" as AssetClass,
    currency: "TRY" as Currency,
    // Initial transaction fields
    transactionDate: new Date().toISOString().split('T')[0],
    transactionQuantity: "",
    transactionPrice: "",
    transactionNotes: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Edit asset form state
  const [editAsset, setEditAsset] = useState({
    ticker: "",
    name: "",
    assetClass: "BIST" as AssetClass,
    currency: "TRY" as Currency,
  });

  useEffect(() => {
    fetchPositions();
  }, []);

  const fetchPositions = async () => {
    try {
      const response = await fetch("/api/portfolio");
      const data = await response.json();
      setPositions(data.positions);
    } catch (error) {
      console.error("Failed to fetch positions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all required fields
    const errors: Record<string, string> = {};
    if (!newAsset.ticker.trim()) errors.ticker = "Ticker gerekli";
    if (!newAsset.name.trim()) errors.name = "Name gerekli";
    if (!newAsset.transactionDate) errors.transactionDate = "Tarih gerekli";
    if (!newAsset.transactionQuantity || parseFloat(newAsset.transactionQuantity) <= 0) {
      errors.transactionQuantity = "Adet 0'dan büyük olmalı";
    }
    if (!newAsset.transactionPrice || parseFloat(newAsset.transactionPrice) <= 0) {
      errors.transactionPrice = "Fiyat 0'dan büyük olmalı";
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setFormErrors({});
    
    try {
      const response = await fetch("/api/assets/with-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: newAsset.ticker.toUpperCase(),
          name: newAsset.name,
          assetClass: newAsset.assetClass,
          currency: newAsset.currency,
          transaction: {
            type: "BUY",
            quantity: parseFloat(newAsset.transactionQuantity),
            price: parseFloat(newAsset.transactionPrice),
            currency: newAsset.currency,
            date: newAsset.transactionDate,
            notes: newAsset.transactionNotes || null,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setShowAddModal(false);
        setNewAsset({ 
          ticker: "", 
          name: "", 
          assetClass: "BIST", 
          currency: "TRY",
          transactionDate: new Date().toISOString().split('T')[0],
          transactionQuantity: "",
          transactionPrice: "",
          transactionNotes: "",
        });
        setFormErrors({});
        fetchPositions();
      } else {
        const error = await response.json();
        setFormErrors({ submit: error.message || "Varlık eklenemedi" });
      }
    } catch (error) {
      console.error("Failed to add asset:", error);
      setFormErrors({ submit: "Bir hata oluştu" });
    }
  };

  const handleEditAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    try {
      const response = await fetch(`/api/assets/${selectedAsset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: editAsset.ticker.toUpperCase(),
          name: editAsset.name,
          assetClass: editAsset.assetClass,
          currency: editAsset.currency,
        }),
      });

      if (response.ok) {
        setShowEditModal(false);
        setSelectedAsset(null);
        setSelectedPosition(null);
        fetchPositions();
      }
    } catch (error) {
      console.error("Failed to update asset:", error);
    }
  };

  const handleDeleteAsset = async () => {
    if (!selectedAsset) return;

    try {
      const response = await fetch(`/api/assets/${selectedAsset.id}`, { method: "DELETE" });
      if (response.ok) {
        setShowDeleteDialog(false);
        setSelectedAsset(null);
        setTransactionCount(0);
        fetchPositions();
      } else {
        const error = await response.json();
        alert(error.error || "Varlık silinemedi");
      }
    } catch (error) {
      console.error("Failed to delete asset:", error);
      alert("Bir hata oluştu");
    }
  };

  const openEditModal = (asset: Asset, position: Position) => {
    setSelectedAsset(asset);
    setSelectedPosition(position);
    setEditAsset({
      ticker: asset.ticker,
      name: asset.name,
      assetClass: asset.assetClass,
      currency: asset.currency,
    });
    setShowEditModal(true);
  };

  const openDeleteDialog = async (asset: Asset) => {
    setSelectedAsset(asset);
    try {
      const response = await fetch(`/api/assets/${asset.id}/transactions`);
      const data = await response.json();
      setTransactionCount(data.count || 0);
    } catch (error) {
      setTransactionCount(0);
    }
    setShowDeleteDialog(true);
  };

  const toggleCollapse = (assetClass: string) => {
    setCollapsedClasses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetClass)) {
        newSet.delete(assetClass);
      } else {
        newSet.add(assetClass);
      }
      return newSet;
    });
  };

  // Group positions by asset class
  const groupedPositions = positions.reduce((acc, position) => {
    const assetClass = position.asset.assetClass;
    if (!acc[assetClass]) {
      acc[assetClass] = [];
    }
    acc[assetClass].push(position);
    return acc;
  }, {} as Record<string, Position[]>);

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-sans">Portfolio</h1>
          <p className="text-stone-600 mt-1 font-sans">Current holdings</p>
        </div>
        <a
          href="/add-transaction"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-sans"
        >
          + İşlem Ekle
        </a>
      </div>

      {positions.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          {Object.entries(groupedPositions).map(([assetClass, classPositions]) => {
            const isCollapsed = collapsedClasses.has(assetClass);
            const classTotalValue = classPositions.reduce((sum, p) => sum + p.currentValue, 0);
            const classCurrency = assetClass === "FUND_TR" ? "TRY" : assetClass === "BIST" ? "TRY" : classPositions[0]?.asset.currency || baseCurrency;
            const symbol = classCurrency === "TRY" ? "₺" : classCurrency === "EUR" ? "€" : "$";
            
            return (
              <div key={assetClass} className="border-b border-stone-200 last:border-b-0">
                <button
                  onClick={() => toggleCollapse(assetClass)}
                  className="w-full px-4 py-3 bg-stone-50 hover:bg-stone-100 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{isCollapsed ? "▶" : "▼"}</span>
                    <span className="font-semibold text-stone-900 font-sans">{assetClass}</span>
                    <span className="text-sm text-stone-500 font-sans">({classPositions.length} positions)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-stone-900">{symbol}{formatNumberWithCommas(classTotalValue)}</span>
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-stone-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700 font-sans">Ticker</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700 font-sans">Name</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700 font-sans">Class</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Qty</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Avg Cost</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Ana Para</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Current Price</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Current Value</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-stone-700 font-sans">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classPositions.map((position) => (
                          <tr key={position.asset.id} className="border-b border-stone-100 hover:bg-stone-50">
                            <td className="px-4 py-3 font-semibold font-mono text-stone-900 sticky left-0 bg-white hover:bg-stone-50 z-10">
                              <a
                                href={`/portfolio/${position.asset.ticker}`}
                                className="hover:text-blue-600 hover:underline"
                              >
                                {position.asset.ticker}
                              </a>
                            </td>
                            <td className="px-4 py-3 font-sans text-stone-700">{position.asset.name}</td>
                            <td className="px-4 py-3 font-sans text-stone-700">{position.asset.assetClass}</td>
                            <td className="px-4 py-3 text-right font-mono text-stone-900">{formatNumberWithCommas(position.totalQuantity)}</td>
                            <td className="px-4 py-3 text-right font-mono text-stone-900">
                              {position.asset.currency === "TRY" ? "₺" : position.asset.currency === "EUR" ? "€" : "$"}{formatNumberWithCommas(position.averageCostBasis)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-stone-900">
                              {position.asset.currency === "TRY" ? "₺" : position.asset.currency === "EUR" ? "€" : "$"}{formatNumberWithCommas(position.totalCost)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-stone-900">
                              {position.asset.currency === "TRY" ? "₺" : position.asset.currency === "EUR" ? "€" : "$"}{formatNumberWithCommas(position.currentPrice)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-stone-900">
                              {position.asset.currency === "TRY" ? "₺" : position.asset.currency === "EUR" ? "€" : "$"}{formatNumberWithCommas(position.currentValue)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openEditModal(position.asset, position)}
                                  className="text-stone-600 hover:text-blue-600"
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => openDeleteDialog(position.asset)}
                                  className="text-stone-600 hover:text-rose-600"
                                  title="Delete"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 text-center">
          <p className="text-xl font-semibold text-stone-700 font-sans mb-2">Henüz pozisyon yok</p>
          <p className="text-stone-600 font-sans mb-6">Portföyünüzü oluşturmak için yeni bir varlık ekleyin.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-sans"
          >
            Yeni Varlık Ekle
          </button>
        </div>
      )}

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 w-full md:max-w-lg lg:max-w-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 font-sans">Yeni Varlık Ekle</h3>
            {formErrors.submit && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-sm text-rose-700 font-sans">{formErrors.submit}</p>
              </div>
            )}
            <form onSubmit={handleAddAsset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Ticker</label>
                <input
                  type="text"
                  value={newAsset.ticker}
                  onChange={(e) => setNewAsset({ ...newAsset, ticker: e.target.value.toUpperCase() })}
                  className={`w-full p-2 border rounded-lg font-mono uppercase ${formErrors.ticker ? 'border-rose-300' : 'border-stone-300'}`}
                  required
                />
                {formErrors.ticker && <p className="text-xs text-rose-600 font-sans mt-1">{formErrors.ticker}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Name</label>
                <input
                  type="text"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                  className={`w-full p-2 border rounded-lg font-sans ${formErrors.name ? 'border-rose-300' : 'border-stone-300'}`}
                  required
                />
                {formErrors.name && <p className="text-xs text-rose-600 font-sans mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Asset Class</label>
                <select
                  value={newAsset.assetClass}
                  onChange={(e) => setNewAsset({ ...newAsset, assetClass: e.target.value as AssetClass })}
                  className="w-full p-2 border border-stone-300 rounded-lg font-sans"
                  required
                >
                  <option value="BIST">BIST</option>
                  <option value="NASDAQ">NASDAQ</option>
                  <option value="FUND_TR">FUND_TR</option>
                  <option value="FUND_US">FUND_US</option>
                  <option value="COMMODITY">COMMODITY</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Currency</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="TRY"
                      checked={newAsset.currency === "TRY"}
                      onChange={(e) => setNewAsset({ ...newAsset, currency: e.target.value as Currency })}
                      className="mr-2"
                    />
                    <span className="font-sans">TRY</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="USD"
                      checked={newAsset.currency === "USD"}
                      onChange={(e) => setNewAsset({ ...newAsset, currency: e.target.value as Currency })}
                      className="mr-2"
                    />
                    <span className="font-sans">USD</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="EUR"
                      checked={newAsset.currency === "EUR"}
                      onChange={(e) => setNewAsset({ ...newAsset, currency: e.target.value as Currency })}
                      className="mr-2"
                    />
                    <span className="font-sans">EUR</span>
                  </label>
                </div>
              </div>
              
              <div className="border-t border-stone-200 pt-4">
                <h4 className="text-sm font-semibold mb-3 font-sans text-stone-700">── İlk İşlem (Zorunlu) ──</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Alış Tarihi</label>
                    <input
                      type="date"
                      value={newAsset.transactionDate}
                      onChange={(e) => setNewAsset({ ...newAsset, transactionDate: e.target.value })}
                      className={`w-full p-2 border rounded-lg font-sans ${formErrors.transactionDate ? 'border-rose-300' : 'border-stone-300'}`}
                      required
                    />
                    {formErrors.transactionDate && <p className="text-xs text-rose-600 font-sans mt-1">{formErrors.transactionDate}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Adet / Quantity</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newAsset.transactionQuantity}
                      onChange={(e) => setNewAsset({ ...newAsset, transactionQuantity: e.target.value })}
                      className={`w-full p-2 border rounded-lg font-mono ${formErrors.transactionQuantity ? 'border-rose-300' : 'border-stone-300'}`}
                      required
                    />
                    {formErrors.transactionQuantity && <p className="text-xs text-rose-600 font-sans mt-1">{formErrors.transactionQuantity}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Alış Fiyatı / Price per unit</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newAsset.transactionPrice}
                      onChange={(e) => setNewAsset({ ...newAsset, transactionPrice: e.target.value })}
                      className={`w-full p-2 border rounded-lg font-mono ${formErrors.transactionPrice ? 'border-rose-300' : 'border-stone-300'}`}
                      required
                    />
                    {formErrors.transactionPrice && <p className="text-xs text-rose-600 font-sans mt-1">{formErrors.transactionPrice}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Notlar (Opsiyonel)</label>
                    <textarea
                      value={newAsset.transactionNotes}
                      onChange={(e) => setNewAsset({ ...newAsset, transactionNotes: e.target.value })}
                      className="w-full p-2 border border-stone-300 rounded-lg font-sans"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormErrors({});
                  }}
                  className="flex-1 px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 font-sans"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-sans"
                >
                  Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {showEditModal && selectedAsset && selectedPosition && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 w-full md:max-w-lg lg:max-w-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 font-sans">Varlığı Düzenle</h3>
            <form onSubmit={handleEditAsset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Ticker</label>
                <input
                  type="text"
                  value={editAsset.ticker}
                  onChange={(e) => setEditAsset({ ...editAsset, ticker: e.target.value.toUpperCase() })}
                  className="w-full p-2 border border-stone-300 rounded-lg font-mono uppercase"
                  required
                />
                <p className="text-xs text-amber-600 mt-1 font-sans">⚠️ Ticker değiştirmek fiyat çekmeyi etkileyebilir</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Name</label>
                <input
                  type="text"
                  value={editAsset.name}
                  onChange={(e) => setEditAsset({ ...editAsset, name: e.target.value })}
                  className="w-full p-2 border border-stone-300 rounded-lg font-sans"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Asset Class</label>
                <select
                  value={editAsset.assetClass}
                  onChange={(e) => setEditAsset({ ...editAsset, assetClass: e.target.value as AssetClass })}
                  className="w-full p-2 border border-stone-300 rounded-lg font-sans"
                  required
                >
                  <option value="BIST">BIST</option>
                  <option value="NASDAQ">NASDAQ</option>
                  <option value="FUND_TR">FUND_TR</option>
                  <option value="FUND_US">FUND_US</option>
                  <option value="COMMODITY">COMMODITY</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 font-sans text-stone-700">Currency</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="TRY"
                      checked={editAsset.currency === "TRY"}
                      onChange={(e) => setEditAsset({ ...editAsset, currency: e.target.value as Currency })}
                      className="mr-2"
                    />
                    <span className="font-sans">TRY</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="USD"
                      checked={editAsset.currency === "USD"}
                      onChange={(e) => setEditAsset({ ...editAsset, currency: e.target.value as Currency })}
                      className="mr-2"
                    />
                    <span className="font-sans">USD</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="EUR"
                      checked={editAsset.currency === "EUR"}
                      onChange={(e) => setEditAsset({ ...editAsset, currency: e.target.value as Currency })}
                      className="mr-2"
                    />
                    <span className="font-sans">EUR</span>
                  </label>
                </div>
              </div>
              
              {/* Position Summary (read-only) */}
              <div className="bg-stone-50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-semibold font-sans text-stone-700">Pozisyon Özeti</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-stone-500 font-sans">Toplam Miktar</p>
                    <p className="font-mono text-stone-900">{formatNumberWithCommas(selectedPosition.totalQuantity)}</p>
                  </div>
                  <div>
                    <p className="text-stone-500 font-sans">Ortalama Maliyet</p>
                    <p className="font-mono text-stone-900">{baseCurrency === "TRY" ? "₺" : baseCurrency === "EUR" ? "€" : "$"}{formatNumberWithCommas(convertAmount(selectedPosition.averageCostBasis, selectedAsset.currency))}</p>
                  </div>
                  <div>
                    <p className="text-stone-500 font-sans">Güncel Değer</p>
                    <p className="font-mono text-stone-900">{baseCurrency === "TRY" ? "₺" : baseCurrency === "EUR" ? "€" : "$"}{formatNumberWithCommas(convertAmount(selectedPosition.currentValue, selectedAsset.currency))}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedAsset(null);
                    setSelectedPosition(null);
                  }}
                  className="flex-1 px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 font-sans"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-sans"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && selectedAsset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 w-full md:max-w-lg lg:max-w-xl">
            <h3 className="text-lg font-semibold mb-4 font-sans">Varlığı Sil</h3>
            {transactionCount > 0 ? (
              <div>
                <p className="text-stone-600 mb-2 font-sans">
                  Bu varlığa ait <span className="font-semibold">{transactionCount}</span> işlem var.
                </p>
                <p className="text-stone-600 mb-6 font-sans">
                  Varlığı silmek tüm işlemleri de silecek. Devam etmek istiyor musunuz?
                </p>
              </div>
            ) : (
              <p className="text-stone-600 mb-6 font-sans">
                Bu varlık silinecek. Emin misiniz?
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedAsset(null);
                }}
                className="flex-1 px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 font-sans"
              >
                İptal
              </button>
              <button
                onClick={handleDeleteAsset}
                className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-sans"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
