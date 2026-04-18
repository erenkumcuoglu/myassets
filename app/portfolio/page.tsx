import { EmptyState } from "@/components/empty-state";
import { HoldingsTable } from "@/components/holdings-table";
import { PageHeader } from "@/components/page-header";
import { getPortfolioSnapshot } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function PortfolioPage() {
  const snapshot = getPortfolioSnapshot();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Portfolio"
        title="Current holdings"
        description="Review each position, its average cost basis, latest tracked price, and unrealized performance."
      />

      {snapshot.positions.length > 0 ? (
        <HoldingsTable positions={snapshot.positions} />
      ) : (
        <EmptyState
          title="No holdings to display"
          description="Your holdings list will populate automatically as you record buys and sells."
          href="/add-transaction"
          actionLabel="Add a transaction"
        />
      )}
    </div>
  );
}
