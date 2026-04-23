"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fetchTefasPriceFromBrowser } from "@/lib/tefas-client";

interface Asset {
  id: number;
  ticker: string;
  assetClass: string;
}

interface RefreshPricesButtonProps {
  fundTrAssets: Asset[];
}

export function RefreshPricesButton({ fundTrAssets }: RefreshPricesButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRefresh() {
    setError(null);

    startTransition(async () => {
      try {
        // Step 1: Server-side refresh for non-FUND_TR assets (Yahoo, BIST, etc.)
        const serverResponse = await fetch("/api/prices/refresh", {
          method: "POST",
        });

        if (!serverResponse.ok) {
          const payload = (await serverResponse.json()) as { error?: string };
          setError(payload.error ?? "Server refresh failed.");
          return;
        }

        // Step 2: Client-side TEFAS fetch for FUND_TR assets (browser → tefas.gov.tr)
        const failedFunds: string[] = [];
        
        for (const asset of fundTrAssets) {
          try {
            const result = await fetchTefasPriceFromBrowser(asset.ticker);
            
            if (result && result.price > 0) {
              // Save to DB via API
              const saveResponse = await fetch("/api/save-tefas-price", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fundCode: asset.ticker,
                  price: result.price,
                  currency: "TRY",
                }),
              });

              if (!saveResponse.ok) {
                failedFunds.push(asset.ticker);
              }
            } else {
              failedFunds.push(asset.ticker);
            }
          } catch (err) {
            console.error(`[Refresh] Failed for ${asset.ticker}:`, err);
            failedFunds.push(asset.ticker);
          }
        }

        if (failedFunds.length > 0) {
          setError(`Failed to refresh: ${failedFunds.join(", ")}`);
        }

        router.refresh();
      } catch (err) {
        setError("Refresh failed. Please try again.");
        console.error("[RefreshPricesButton] Error:", err);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={pending}
        className="rounded-full border border-teal-700 bg-teal-700 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:border-teal-300 disabled:bg-teal-300"
      >
        {pending ? "Refreshing..." : "Refresh Prices"}
      </button>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
