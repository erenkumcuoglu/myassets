"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Currency = "TRY" | "USD" | "EUR";

interface CurrencyContextType {
  baseCurrency: Currency;
  setBaseCurrency: (currency: Currency) => void;
  cycleBaseCurrency: () => void;
  usdTryRate: number;
  setUsdTryRate: (rate: number) => void;
  eurTryRate: number;
  setEurTryRate: (rate: number) => void;
  convertAmount: (amount: number, fromCurrency: Currency) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [baseCurrency, setBaseCurrency] = useState<Currency>("TRY");
  const [usdTryRate, setUsdTryRate] = useState<number>(1);
  const [eurTryRate, setEurTryRate] = useState<number>(1);

  useEffect(() => {
    // Load base currency from localStorage
    const savedCurrency = localStorage.getItem("baseCurrency") as Currency;
    if (savedCurrency === "TRY" || savedCurrency === "USD" || savedCurrency === "EUR") {
      setBaseCurrency(savedCurrency);
    }
  }, []);

  useEffect(() => {
    // Save base currency to localStorage
    localStorage.setItem("baseCurrency", baseCurrency);
  }, [baseCurrency]);

  const cycleBaseCurrency = () => {
    const currencies: Currency[] = ["TRY", "USD", "EUR"];
    const currentIndex = currencies.indexOf(baseCurrency);
    const nextIndex = (currentIndex + 1) % currencies.length;
    setBaseCurrency(currencies[nextIndex]);
  };

  const convertAmount = (amount: number, fromCurrency: Currency): number => {
    if (baseCurrency === fromCurrency) {
      return amount;
    }

    // Simple direct conversions
    if (fromCurrency === "USD" && baseCurrency === "TRY") {
      return amount * usdTryRate;
    }
    if (fromCurrency === "TRY" && baseCurrency === "USD") {
      return amount / usdTryRate;
    }
    if (fromCurrency === "EUR" && baseCurrency === "TRY") {
      return amount * eurTryRate;
    }
    if (fromCurrency === "TRY" && baseCurrency === "EUR") {
      return amount / eurTryRate;
    }
    if (fromCurrency === "USD" && baseCurrency === "EUR") {
      return amount * (usdTryRate / eurTryRate);
    }
    if (fromCurrency === "EUR" && baseCurrency === "USD") {
      return amount * (eurTryRate / usdTryRate);
    }

    return amount;
  };

  return (
    <CurrencyContext.Provider
      value={{
        baseCurrency,
        setBaseCurrency,
        cycleBaseCurrency,
        usdTryRate,
        setUsdTryRate,
        eurTryRate,
        setEurTryRate,
        convertAmount,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
