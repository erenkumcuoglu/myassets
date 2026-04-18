import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TransactionsTable } from "@/components/transactions-table";
import { getTransactions } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TransactionsPage() {
  const transactions = getTransactions();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Transactions"
        title="Buy and sell history"
        description="Every portfolio calculation is derived from this ledger, so updates stay fully local and transparent."
      />

      {transactions.length > 0 ? (
        <TransactionsTable transactions={transactions} />
      ) : (
        <EmptyState
          title="No transactions yet"
          description="Start by logging a buy or sell to build your portfolio history."
          href="/add-transaction"
          actionLabel="Log your first trade"
        />
      )}
    </div>
  );
}
