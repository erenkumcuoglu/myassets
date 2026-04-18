"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RefreshPricesButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRefresh() {
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/prices/refresh", {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "Refresh failed.");
        return;
      }

      router.refresh();
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
