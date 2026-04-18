"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatNumberWithCommas } from "@/lib/format";
import type { Asset, TransactionWithAsset } from "@/types";

type RealizedPair = {
  buyDate: string;
  sellDate: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  profit: number;
};

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticker = params.ticker as string;
  
  const [asset, setAsset] = useState<Asset | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [realizedPairs, setRealizedPairs] = useState<RealizedPair[]>([]);

  useEffect(() => {
    fetchAssetData();
  }, [ticker]);

  const fetchAssetData = async () => {
    try {
      const [transactionsRes] = await Promise.all([
        fetch("/api/transactions"),
      ]);
      const transactionsData = await transactionsRes.json();
      
      const assetTransactions = transactionsData.filter((t: TransactionWithAsset) => 
        t.asset.ticker === ticker
      );
      
      if (assetTransactions.length === 0) {
        router.push("/portfolio");
        return;
      }
      
      setAsset(assetTransactions[0].asset);
      setTransactions(assetTransactions);
      
      calculatePosition(assetTransactions);
      calculateChartData(assetTransactions);
      calculateRealizedPnL(assetTransactions);
    } catch (error) {
      console.error("Failed to fetch asset data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePosition = (assetTransactions: TransactionWithAsset[]) => {
    let totalQuantity = 0;
    let totalCost = 0;
    let realizedPnL = 0;
    
    const sorted = [...assetTransactions].sort((a, b) => a.date.localeCompare(b.date));
    
    const lots: { quantity: number; price: number }[] = [];
    
    for (const t of sorted) {
      if (t.type === "BUY") {
        lots.push({ quantity: t.quantity, price: t.price });
        totalQuantity += t.quantity;
        totalCost += t.quantity * t.price;
      } else {
        let remainingToSell = t.quantity;
        let matchedCost = 0;
        
        while (remainingToSell > 0.0000001 && lots.length > 0) {
          const lot = lots[0];
          const matchedQuantity = Math.min(remainingToSell, lot.quantity);
          matchedCost += matchedQuantity * lot.price;
          lot.quantity -= matchedQuantity;
          remainingToSell -= matchedQuantity;
          
          if (lot.quantity <= 0.0000001) {
            lots.shift();
          }
        }
        
        const saleProceeds = t.quantity * t.price;
        realizedPnL += saleProceeds - matchedCost;
        totalQuantity -= t.quantity;
      }
    }
    
    const averageCostBasis = totalQuantity > 0 ? totalCost / totalQuantity : 0;
    const lastPrice = assetTransactions[assetTransactions.length - 1]?.price || 0;
    const currentValue = totalQuantity * lastPrice;
    const unrealizedPnL = currentValue - (lots.reduce((sum, lot) => sum + lot.quantity * lot.price, 0));
    
    setPosition({
      totalQuantity,
      averageCostBasis,
      currentPrice: lastPrice,
      currentValue,
      unrealizedPnL,
      realizedPnL,
      currency: assetTransactions[0]?.asset.currency || "USD",
    });
  };

  const calculateChartData = (assetTransactions: TransactionWithAsset[]) => {
    const sorted = [...assetTransactions].sort((a, b) => a.date.localeCompare(b.date));
    
    let runningQuantity = 0;
    let runningCost = 0;
    
    const data = sorted.map((t) => {
      if (t.type === "BUY") {
        runningQuantity += t.quantity;
        runningCost += t.quantity * t.price;
      } else {
        const avgCost = runningQuantity > 0 ? runningCost / runningQuantity : 0;
        const costToReduce = t.quantity * avgCost;
        runningCost -= costToReduce;
        runningQuantity -= t.quantity;
      }
      
      const avgCostBasis = runningQuantity > 0 ? runningCost / runningQuantity : 0;
      
      return {
        date: t.date,
        costBasis: avgCostBasis,
        currentPrice: t.price,
      };
    });
    
    setChartData(data);
  };

  const calculateRealizedPnL = (assetTransactions: TransactionWithAsset[]) => {
    const sorted = [...assetTransactions].sort((a, b) => a.date.localeCompare(b.date));
    
    const lots: { quantity: number; price: number; date: string }[] = [];
    const pairs: RealizedPair[] = [];
    
    for (const t of sorted) {
      if (t.type === "BUY") {
        lots.push({ quantity: t.quantity, price: t.price, date: t.date });
      } else {
        let remainingToSell = t.quantity;
        
        while (remainingToSell > 0.0000001 && lots.length > 0) {
          const lot = lots[0];
          const matchedQuantity = Math.min(remainingToSell, lot.quantity);
          const profit = matchedQuantity * (t.price - lot.price);
          
          pairs.push({
            buyDate: lot.date,
            sellDate: t.date,
            buyPrice: lot.price,
            sellPrice: t.price,
            quantity: matchedQuantity,
            profit,
          });
          
          lot.quantity -= matchedQuantity;
          remainingToSell -= matchedQuantity;
          
          if (lot.quantity <= 0.0000001) {
            lots.shift();
          }
        }
      }
    }
    
    setRealizedPairs(pairs);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!asset) {
    return <div className="p-8 text-center">Asset not found</div>;
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-sans">{asset.ticker}</h1>
          <p className="text-stone-600 mt-1 font-sans">{asset.name}</p>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-1 bg-stone-100 text-stone-700 rounded text-xs font-sans">
              {asset.assetClass}
            </span>
            <span className="px-2 py-1 bg-stone-100 text-stone-700 rounded text-xs font-sans">
              {asset.currency}
            </span>
          </div>
        </div>
        <button
          onClick={() => router.push("/portfolio")}
          className="px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 font-sans"
        >
          Back to Portfolio
        </button>
      </div>

      {/* Position Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-stone-200">
          <p className="text-sm text-stone-600 font-sans">Total Quantity</p>
          <p className="text-2xl font-bold mt-2 font-mono text-stone-900">
            {formatNumberWithCommas(position.totalQuantity)}
          </p>
          <p className="text-sm text-stone-500 font-sans mt-1">Units</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-stone-200">
          <p className="text-sm text-stone-600 font-sans">Average Cost Basis</p>
          <p className="text-2xl font-bold mt-2 font-mono text-stone-900">
            ${formatNumberWithCommas(position.averageCostBasis)}
          </p>
          <p className="text-sm text-stone-500 font-sans mt-1">Avg Cost</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-stone-200">
          <p className="text-sm text-stone-600 font-sans">Current Price</p>
          <p className="text-2xl font-bold mt-2 font-mono text-stone-900">
            ${formatNumberWithCommas(position.currentPrice)}
          </p>
          <p className="text-sm text-stone-500 font-sans mt-1">Current Price</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-stone-200">
          <p className="text-sm text-stone-600 font-sans">Unrealized P&L</p>
          <p className={`text-2xl font-bold mt-2 font-mono ${position.unrealizedPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {position.unrealizedPnL >= 0 ? "+" : ""}${formatNumberWithCommas(position.unrealizedPnL)}
          </p>
          <p className="text-sm text-stone-500 font-sans mt-1">Unrealized P&L</p>
        </div>
      </div>

      {/* Price History Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5">
          <h2 className="text-lg font-semibold font-sans mb-4">Price History</h2>
          <ResponsiveContainer width="100%" height={400} minWidth={300}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontFamily: "Inter" }} />
              <YAxis tick={{ fontFamily: "Inter" }} />
              <Tooltip formatter={(value: any) => `$${formatNumberWithCommas(value ?? 0)}`} />
              <Legend />
              <Line type="monotone" dataKey="costBasis" stroke="#3b82f6" name="Cost Basis" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="currentPrice" stroke="#10b981" name="Current Price" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Realized P&L Breakdown */}
      {realizedPairs.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="p-5 border-b border-stone-200">
            <h2 className="text-lg font-semibold font-sans">Realized P&L Breakdown (FIFO)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700 font-sans">Buy Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700 font-sans">Sell Date</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Buy Price</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Sell Price</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Quantity</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Profit/Loss</th>
                </tr>
              </thead>
              <tbody>
                {realizedPairs.map((pair, index) => (
                  <tr key={index} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="px-4 py-3 font-sans text-stone-700">{pair.buyDate}</td>
                    <td className="px-4 py-3 font-sans text-stone-700">{pair.sellDate}</td>
                    <td className="px-4 py-3 text-right font-mono text-stone-900">${formatNumberWithCommas(pair.buyPrice)}</td>
                    <td className="px-4 py-3 text-right font-mono text-stone-900">${formatNumberWithCommas(pair.sellPrice)}</td>
                    <td className="px-4 py-3 text-right font-mono text-stone-900">{formatNumberWithCommas(pair.quantity)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${pair.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {pair.profit >= 0 ? "+" : ""}${formatNumberWithCommas(pair.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-5 border-b border-stone-200">
          <h2 className="text-lg font-semibold font-sans">Transaction History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700 font-sans sticky left-0 bg-stone-50 z-10">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700 font-sans">Type</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Quantity</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Price</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-stone-700 font-sans">Total</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700 font-sans">Notes</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-3 font-sans text-stone-700 sticky left-0 bg-white hover:bg-stone-50 z-10">{transaction.date}</td>
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
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-stone-900">
                    ${formatNumberWithCommas(transaction.quantity * transaction.price)}
                  </td>
                  <td className="px-4 py-3 font-sans text-stone-700">
                    {transaction.notes || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
