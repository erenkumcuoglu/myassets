"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-teal-700 bg-teal-700 text-white shadow-md shadow-teal-900/20"
          : "border-[color:var(--border)] bg-white/70 text-stone-700 hover:border-teal-200 hover:bg-teal-50"
      }`}
    >
      {children}
    </Link>
  );
}
