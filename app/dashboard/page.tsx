"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from "react";
import nextDynamic from "next/dynamic";
import { CardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/skeleton";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatNumberWithCommas } from "@/lib/format";
import { fetchTefasPriceFromBrowser } from "@/lib/tefas-client";
import type { AssetClass, Position, PortfolioSnapshot } from "@/types";

const PieChart = nextDynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = nextDynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = nextDynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const BarChart = nextDynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = nextDynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = nextDynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = nextDynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = nextDynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = nextDynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const Legend = nextDynamic(() => import('recharts').then(m => m.Legend), { ssr: false });
const LineChart = nextDynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = nextDynamic(() => import('recharts').then(m => m.Line), { ssr: false });

const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  BIST: "#3b82f6",
  NASDAQ: "#10b981",
  FUND_TR: "#f59e0b",
  FUND_US: "#8b5cf6",
  COMMODITY: "#ef4444",
};

type SortField = "ticker" | "name" | "class" | "quantity" | "avgCost" | "currentPrice" | "currentValue" | "unrealizedPnL" | "unrealizedPnLPercent";
type SortDirection = "asc" | "desc";

function DashboardContent() {
  const { baseCurrency, cycleBaseCurrency, usdTryRate, eurTryRate, convertAmount } = useCurrency();
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortField, setSortField] = useState<SortField>("currentValue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    fetchSnapshot();
  }, []);

  const fetchSnapshot = async () => {
    try {
      const portfolioRes = await fetch("/api/portfolio");
      const portfolioData = await portfolioRes.json();
      setSnapshot({
        positions: Array.isArray(portfolioData?.positions) ? portfolioData.positions : [],
        history: Array.isArray(portfolioData?.history) ? portfolioData.history : [],
        summary: portfolioData?.summary || {
          totalValue: 0,
          totalCostBasis: 0,
          netInvested: 0,
          realizedPnL: 0,
          unrealizedPnL: 0,
          totalReturn: 0,
          totalReturnPercent: 0
        }
      });
    } catch (error) {
      console.error("Failed to fetch portfolio snapshot:", error);
      setSnapshot({ 
        positions: [], 
        history: [],
        summary: { 
          totalValue: 0, 
          totalCostBasis: 0, 
          netInvested: 0, 
          realizedPnL: 0, 
          unrealizedPnL: 0, 
          totalReturn: 0, 
          totalReturnPercent: 0 
        } 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    try {
      // Fetch server-side prices (NASDAQ, BIST, COMMODITY)
      await fetch("/api/refresh-prices", { method: "POST" });

      // Fetch TEFAS fund prices from browser
      const tefasPositions = snapshot?.positions?.filter(p => p.asset.assetClass === "FUND_TR") || [];
      const tefasPricePromises = tefasPositions.map(async (position) => {
        try {
          const result = await fetchTefasPriceFromBrowser(position.asset.ticker);
          if (result) {
            // Update price cache via API
            await fetch("/api/price", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ticker: position.asset.ticker,
                price: result.price,
                currency: "TRY",
                assetClass: "FUND_TR"
              })
            });
          }
        } catch (error) {
          console.error(`Failed to fetch TEFAS price for ${position.asset.ticker}:`, error);
        }
      });

      await Promise.all(tefasPricePromises);
      await fetchSnapshot();
    } catch (error) {
      console.error("Failed to refresh prices:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const formatCurrency = (amount: number): string => {
    const symbol = baseCurrency === "TRY" ? "₺" : baseCurrency === "EUR" ? "€" : "$";
    return `${symbol}${formatNumberWithCommas(amount)}`;
  };

  const sortedPositions = (snapshot?.positions ?? []).sort((a, b) => {
    let aVal: any, bVal: any;
    
    switch (sortField) {
      case "ticker":
        aVal = a.asset.ticker;
        bVal = b.asset.ticker;
        break;
      case "name":
        aVal = a.asset.name;
        bVal = b.asset.name;
        break;
      case "class":
        aVal = a.asset.assetClass;
        bVal = b.asset.assetClass;
        break;
      case "quantity":
        aVal = a.totalQuantity;
        bVal = b.totalQuantity;
        break;
      case "avgCost":
        aVal = a.averageCostBasis;
        bVal = b.averageCostBasis;
        break;
      case "currentPrice":
        aVal = a.currentPrice;
        bVal = b.currentPrice;
        break;
      case "currentValue":
        aVal = a.currentValue;
        bVal = b.currentValue;
        break;
      case "unrealizedPnL":
        aVal = a.unrealizedPnL;
        bVal = b.unrealizedPnL;
        break;
      case "unrealizedPnLPercent":
        aVal = a.unrealizedPnLPercent;
        bVal = b.unrealizedPnLPercent;
        break;
      default:
        aVal = a.currentValue;
        bVal = b.currentValue;
    }

    if (typeof aVal === "string") {
      return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
  });

  const allocationData = (snapshot?.positions ?? []).reduce((acc: Array<{ name: AssetClass; value: number; fill: string }>, position) => {
    const existing = acc.find((item) => item.name === position.asset.assetClass);
    const convertedValue = convertAmount(position.currentValue, position.asset.currency);
    if (existing) {
      existing.value += convertedValue;
    } else {
      acc.push({ 
        name: position.asset.assetClass, 
        value: convertedValue,
        fill: ASSET_CLASS_COLORS[position.asset.assetClass]
      });
    }
    return acc;
  }, []).filter(item => item.value > 0) || [];

  const topPositionsData = sortedPositions.slice(0, 10).map((position) => {
    const costBasis = convertAmount(position.totalCost, position.asset.currency);
    const currentValue = convertAmount(position.currentValue, position.asset.currency);
    const unrealizedPnL = convertAmount(position.unrealizedPnL, position.asset.currency);
    
    return {
      ticker: position.asset.ticker,
      name: position.asset.name,
      costBasis,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPercent: position.unrealizedPnLPercent,
      quantity: position.totalQuantity,
      // For stacked bar: costBasis (blue) + gain (green) or loss (red)
      gain: unrealizedPnL > 0 ? unrealizedPnL : 0,
      loss: unrealizedPnL < 0 ? Math.abs(unrealizedPnL) : 0,
    };
  });

  // Calculate asset class cluster data
  const assetClassClusters = Object.keys(ASSET_CLASS_COLORS).map((assetClass) => {
    const classPositions = (snapshot?.positions ?? []).filter(p => p.asset.assetClass === assetClass);
    const totalValue = classPositions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalUnrealizedPnL = classPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
    const positionCount = classPositions.length;
    
    // Generate mock sparkline data (in real app, fetch historical data)
    const sparklineData = Array.from({ length: 7 }, (_, i) => {
      const baseValue = totalValue / 7;
      const variance = baseValue * 0.1;
      return {
        day: i,
        value: baseValue + (Math.random() - 0.5) * variance,
      };
    });

    return {
      assetClass: assetClass as AssetClass,
      totalValue,
      totalUnrealizedPnL,
      positionCount,
      sparklineData,
    };
  });

  if (loading) {
    return (
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-sans">Dashboard</h1>
          <p className="text-stone-600 mt-1 font-sans">Portfolio overview</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <TableSkeleton rows={5} cols={9} />
      </div>
    );
  }

  if (!snapshot || snapshot.positions.length === 0) {
    return (
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold font-sans">Dashboard</h1>
            <p className="text-stone-600 mt-1 font-sans">Portfolio overview</p>
          </div>
          <button
            onClick={handleRefreshPrices}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-sans"
          >
            {refreshing ? "Refreshing..." : "Refresh Prices"}
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 text-center">
          <p className="text-xl font-semibold text-stone-700 font-sans mb-2">Henüz işlem yok</p>
          <p className="text-stone-600 font-sans mb-6">Portföyünüzü oluşturmak için ilk işleminizi ekleyin.</p>
          <a
            href="/add-transaction"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-sans"
          >
            İlk İşlemi Ekle
          </a>
        </div>
      </div>
    );
  }

  const totalUnrealizedPnL = snapshot.summary.unrealizedPnL;
  const totalRealizedPnL = snapshot.summary.realizedPnL;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-sans">Dashboard</h1>
          <p className="text-stone-600 mt-1 font-sans">Portfolio overview</p>
        </div>
        <button
          onClick={handleRefreshPrices}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-sans"
        >
          {refreshing ? "Refreshing..." : "Refresh Prices"}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          className="bg-white p-5 rounded-xl shadow-sm border border-stone-200 cursor-pointer hover:bg-stone-50 transition-colors"
          onClick={cycleBaseCurrency}
        >
          <p className="text-sm text-stone-600 font-sans">Total Portfolio Value</p>
          <p className="text-2xl font-bold mt-2 font-mono text-stone-900">
            {formatCurrency(convertAmount(snapshot.summary.totalValue, "TRY"))}
            <span className="text-sm text-stone-500 ml-2">{baseCurrency}</span>
          </p>
          <p className="text-xs text-stone-500 mt-1 font-mono">
            Para birimi değiştirmek için tıkla
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-stone-200">
          <p className="text-sm text-stone-600 font-sans">Total Unrealized P&L</p>
          <p className={`text-2xl font-bold mt-2 font-mono ${totalUnrealizedPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {totalUnrealizedPnL >= 0 ? "+" : ""}{formatCurrency(convertAmount(totalUnrealizedPnL, "TRY"))}
          </p>
          <p className={`text-xs mt-1 font-mono ${totalUnrealizedPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {totalUnrealizedPnL >= 0 ? "+" : ""}{formatNumberWithCommas(snapshot.summary.totalReturnPercent * 100, 2)}%
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-stone-200">
          <p className="text-sm text-stone-600 font-sans">Total Realized P&L</p>
          <p className={`text-2xl font-bold mt-2 font-mono ${totalRealizedPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {totalRealizedPnL >= 0 ? "+" : ""}{formatCurrency(convertAmount(totalRealizedPnL, "TRY"))}
          </p>
          <p className="text-xs text-stone-500 mt-1 font-mono">All time</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-stone-200">
          <p className="text-sm text-stone-600 font-sans">Today's Change</p>
          <p className="text-2xl font-bold mt-2 font-mono text-stone-900">
            N/A
          </p>
          <p className="text-xs text-stone-500 mt-1 font-mono">Daily price movements</p>
        </div>
      </div>

      {/* Asset Class Clusters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {assetClassClusters.filter(c => c.positionCount > 0).map((cluster) => (
          <div
            key={cluster.assetClass}
            className="bg-white p-4 rounded-xl shadow-sm border border-stone-200"
            style={{ borderTop: `3px solid ${ASSET_CLASS_COLORS[cluster.assetClass]}` }}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs text-stone-500 font-sans">{cluster.assetClass}</p>
                <p className="text-lg font-bold font-mono text-stone-900">
                  {formatCurrency(convertAmount(cluster.totalValue, "TRY"))}
                </p>
              </div>
              <p className="text-xs text-stone-500 font-sans">{cluster.positionCount} pos</p>
            </div>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cluster.sparklineData}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={ASSET_CLASS_COLORS[cluster.assetClass]}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className={`text-xs font-mono mt-2 ${cluster.totalUnrealizedPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {cluster.totalUnrealizedPnL >= 0 ? "+" : ""}{formatCurrency(convertAmount(cluster.totalUnrealizedPnL, "TRY"))}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-stone-200">
          <h2 className="text-lg font-semibold mb-4 font-sans">Allocation by Asset Class</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={allocationData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={0}
                paddingAngle={2}
                fill="fill"
                stroke="#fff"
                strokeWidth={2}
                label={({ name, percent }) => `${name} ${percent ? formatNumberWithCommas(percent * 100, 0) : 0}%`}
                isAnimationActive={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const assetClass = data.name as AssetClass;
                    const classPositions = (snapshot?.positions ?? []).filter(p => p.asset.assetClass === assetClass);
                    const totalUnrealizedPnL = classPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
                    const classTotalValue = classPositions.reduce((sum, p) => sum + p.currentValue, 0);
                    const allocationPercent = snapshot?.summary.totalValue > 0 
                      ? (classTotalValue / snapshot.summary.totalValue) * 100 
                      : 0;
                    
                    return (
                      <div className="bg-white p-3 rounded-lg shadow-lg border border-stone-200">
                        <p className="font-semibold text-stone-900 font-sans">{data.name}</p>
                        <p className="text-sm text-stone-600 font-mono">Value: {formatCurrency(convertAmount(data.value, "TRY"))}</p>
                        <p className="text-sm text-stone-600 font-mono">Allocation: {formatNumberWithCommas(allocationPercent, 1)}%</p>
                        <p className={`text-sm font-mono ${totalUnrealizedPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          P&L: {totalUnrealizedPnL >= 0 ? "+" : ""}{formatCurrency(convertAmount(totalUnrealizedPnL, "TRY"))}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-stone-200">
          <h2 className="text-lg font-semibold mb-4 font-sans">Top 10 Positions by Value</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topPositionsData} layout="vertical">
              <XAxis type="number" tick={{ fontFamily: "IBM Plex Mono" }} />
              <YAxis dataKey="ticker" type="category" tick={{ fontFamily: "IBM Plex Mono" }} width={60} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const pnlPercent = data.costBasis > 0 ? (data.unrealizedPnL / data.costBasis) * 100 : 0;
                    
                    return (
                      <div className="bg-white p-3 rounded-lg shadow-lg border border-stone-200">
                        <p className="font-semibold text-stone-900 font-sans">{data.name} ({data.ticker})</p>
                        <p className="text-sm text-stone-600 font-mono">Ana Para: {formatCurrency(data.costBasis)}</p>
                        <p className={`text-sm font-mono ${data.unrealizedPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          Getiri/Zarar: {data.unrealizedPnL >= 0 ? "+" : ""}{formatCurrency(data.unrealizedPnL)} ({pnlPercent >= 0 ? "+" : ""}{formatNumberWithCommas(pnlPercent, 2)}%)
                        </p>
                        <p className="text-sm text-stone-600 font-mono">Güncel Değer: {formatCurrency(data.currentValue)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="costBasis" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 4]} />
              <Bar dataKey="gain" fill="#22c55e" stackId="a" radius={[0, 4, 4, 0]} />
              <Bar dataKey="loss" fill="#ef4444" stackId="a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Positions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-5 border-b border-stone-200">
          <h2 className="text-lg font-semibold font-sans">All Positions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                {[
                  { field: "ticker" as SortField, label: "Ticker" },
                  { field: "name" as SortField, label: "Name" },
                  { field: "class" as SortField, label: "Class" },
                  { field: "quantity" as SortField, label: "Qty" },
                  { field: "avgCost" as SortField, label: "Avg Cost" },
                  { field: "totalCost" as SortField, label: "Ana Para" },
                  { field: "currentPrice" as SortField, label: "Current Price" },
                  { field: "currentValue" as SortField, label: "Current Value" },
                  { field: "unrealizedPnL" as SortField, label: "Unrealized P&L" },
                  { field: "unrealizedPnLPercent" as SortField, label: "P&L %" },
                ].map(({ field, label }) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className={`px-4 py-3 text-left text-sm font-semibold text-stone-700 cursor-pointer hover:bg-stone-100 font-sans whitespace-nowrap ${
                      field === "ticker" ? "sticky left-0 bg-stone-50 z-10" : ""
                    }`}
                  >
                    {label}
                    {sortField === field && (
                      <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPositions.map((position) => (
                <tr key={position.asset.id} className="border-b border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-3 font-semibold font-mono text-stone-900 sticky left-0 bg-white hover:bg-stone-50 z-10">
                    <a
                      href={`/portfolio/${position.asset.ticker}`}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {position.asset.ticker}
                    </a>
                  </td>
                  <td className="px-4 py-3 font-sans text-stone-700 whitespace-nowrap">{position.asset.name}</td>
                  <td className="px-4 py-3 font-sans text-stone-700">{position.asset.assetClass}</td>
                  <td className="px-4 py-3 text-right font-mono text-stone-900">{formatNumberWithCommas(position.totalQuantity)}</td>
                  <td className="px-4 py-3 text-right font-mono text-stone-900">
                    {formatCurrency(convertAmount(position.averageCostBasis, position.asset.currency))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-stone-900">
                    {formatCurrency(convertAmount(position.totalCost, position.asset.currency))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-stone-900">
                    {formatCurrency(convertAmount(position.currentPrice, position.asset.currency))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-stone-900">
                    {formatCurrency(convertAmount(position.currentValue, position.asset.currency))}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${position.unrealizedPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {position.unrealizedPnL >= 0 ? "+" : ""}{formatCurrency(convertAmount(position.unrealizedPnL, position.asset.currency))}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${position.unrealizedPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {position.unrealizedPnLPercent >= 0 ? "+" : ""}{formatNumberWithCommas(position.unrealizedPnLPercent * 100, 2)}%
                  </td>
                </tr>
              ))}
              <tr className="bg-stone-100 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-left font-sans text-stone-900">Toplam</td>
                <td className="px-4 py-3 text-right font-mono text-stone-900"></td>
                <td className="px-4 py-3 text-right font-mono text-stone-900">
                  {baseCurrency === "TRY" ? "₺" : baseCurrency === "EUR" ? "€" : "$"}{formatNumberWithCommas(Math.floor(sortedPositions.reduce((sum, p) => sum + convertAmount(p.totalCost, p.asset.currency), 0)), 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-stone-900"></td>
                <td className="px-4 py-3 text-right font-mono text-stone-900">
                  {baseCurrency === "TRY" ? "₺" : baseCurrency === "EUR" ? "€" : "$"}{formatNumberWithCommas(Math.floor(sortedPositions.reduce((sum, p) => sum + convertAmount(p.currentValue, p.asset.currency), 0)), 0)}
                </td>
                <td className={`px-4 py-3 text-right font-mono ${sortedPositions.reduce((sum, p) => sum + convertAmount(p.unrealizedPnL, p.asset.currency), 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {sortedPositions.reduce((sum, p) => sum + convertAmount(p.unrealizedPnL, p.asset.currency), 0) >= 0 ? "+" : ""}{baseCurrency === "TRY" ? "₺" : baseCurrency === "EUR" ? "€" : "$"}{formatNumberWithCommas(Math.floor(sortedPositions.reduce((sum, p) => sum + convertAmount(p.unrealizedPnL, p.asset.currency), 0)), 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-stone-900"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-sans">Dashboard</h1>
          <p className="text-stone-600 mt-1 font-sans">Portfolio overview</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <TableSkeleton rows={5} cols={9} />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
