"use client";

import { useState, useEffect } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import Link from "next/link";

export default function Navbar() {
  const { usdTryRate, setUsdTryRate, eurTryRate, setEurTryRate } = useCurrency();
  const [gramGold, setGramGold] = useState<number | null>(null);
  const [gramSilver, setGramSilver] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/prices");
      const data = await response.json();
      
      if (data.usdTry) setUsdTryRate(data.usdTry);
      if (data.eurTry) setEurTryRate(data.eurTry);
      if (data.gramGoldTry) setGramGold(data.gramGoldTry);
      if (data.gramSilverTry) setGramSilver(data.gramSilverTry);
    } catch (error) {
      console.error("Failed to fetch rates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white border-b border-stone-200 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold font-sans text-stone-900">
            Portföyüm
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-sans text-stone-600 hover:text-stone-900">
              Dashboard
            </Link>
            <Link href="/portfolio" className="text-sm font-sans text-stone-600 hover:text-stone-900">
              Portföy
            </Link>
            <Link href="/transactions" className="text-sm font-sans text-stone-600 hover:text-stone-900">
              İşlemler
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-4">
            {/* Gram Gold */}
            <div className="text-right">
              <p className="text-xs text-stone-500 font-sans">Gram Altın</p>
              {loading ? (
                <div className="h-5 w-16 bg-stone-200 animate-pulse rounded" />
              ) : (
                <p className="text-sm font-mono font-semibold text-stone-900">
                  ₺{gramGold ? gramGold.toFixed(2) : "—"}
                </p>
              )}
            </div>
            <div className="text-xs text-stone-400">|</div>
            {/* Gram Silver */}
            <div className="text-right">
              <p className="text-xs text-stone-500 font-sans">Gram Gümüş</p>
              {loading ? (
                <div className="h-5 w-16 bg-stone-200 animate-pulse rounded" />
              ) : (
                <p className="text-sm font-mono font-semibold text-stone-900">
                  ₺{gramSilver ? gramSilver.toFixed(2) : "—"}
                </p>
              )}
            </div>
            <div className="text-xs text-stone-400">|</div>
            {/* USD/TRY */}
            <div className="text-right">
              <p className="text-xs text-stone-500 font-sans">USD/TRY</p>
              {loading ? (
                <div className="h-5 w-16 bg-stone-200 animate-pulse rounded" />
              ) : (
                <p className="text-sm font-mono font-semibold text-stone-900">
                  {usdTryRate.toFixed(2)}
                </p>
              )}
            </div>
            <div className="text-xs text-stone-400">|</div>
            {/* EUR/TRY */}
            <div className="text-right">
              <p className="text-xs text-stone-500 font-sans">EUR/TRY</p>
              {loading ? (
                <div className="h-5 w-16 bg-stone-200 animate-pulse rounded" />
              ) : (
                <p className="text-sm font-mono font-semibold text-stone-900">
                  {eurTryRate.toFixed(2)}
                </p>
              )}
            </div>
          </div>
          {/* Mobile view - simplified */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs text-stone-500 font-sans">Altın</p>
              {loading ? (
                <div className="h-5 w-12 bg-stone-200 animate-pulse rounded" />
              ) : (
                <p className="text-sm font-mono font-semibold text-stone-900">
                  ₺{gramGold ? gramGold.toFixed(0) : "—"}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-500 font-sans">USD</p>
              {loading ? (
                <div className="h-5 w-12 bg-stone-200 animate-pulse rounded" />
              ) : (
                <p className="text-sm font-mono font-semibold text-stone-900">
                  {usdTryRate.toFixed(1)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={fetchRates}
            className="px-3 py-1 bg-stone-100 text-stone-700 rounded hover:bg-stone-200 text-xs font-sans"
          >
            Refresh
          </button>
        </div>
      </div>
    </nav>
  );
}
