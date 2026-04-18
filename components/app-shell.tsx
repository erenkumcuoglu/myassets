import type { ReactNode } from "react";
import { NavLink } from "@/components/nav-link";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/transactions", label: "Transactions" },
  { href: "/add-transaction", label: "Add Transaction" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-lg shadow-stone-900/5 backdrop-blur md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-teal-700">
                Portfolio Pilot
              </p>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                  Personal investment tracking
                </h1>
                <p className="max-w-2xl text-sm text-[color:var(--muted)]">
                  A local-first dashboard for holdings, transactions, cost basis,
                  and performance analytics.
                </p>
              </div>
            </div>

            <nav className="flex flex-wrap gap-2">
              {navigation.map((item) => (
                <NavLink key={item.href} href={item.href}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <main className="flex-1 pb-10">{children}</main>
      </div>
    </div>
  );
}
