import { AddTransactionForm } from "@/components/add-transaction-form";
import { PageHeader } from "@/components/page-header";
import { getAssets } from "@/lib/db";

export const runtime = "nodejs";

export default function AddTransactionPage() {
  const assets = getAssets();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Add Transaction"
        title="Log a buy or sell"
        description="Capture trade details once and let the dashboard recalculate holdings, cost basis, and performance instantly."
      />

      <AddTransactionForm assets={assets} />
    </div>
  );
}
