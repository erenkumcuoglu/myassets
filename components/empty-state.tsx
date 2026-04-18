import Link from "next/link";

export function EmptyState({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <section className="rounded-[2rem] border border-dashed border-[color:var(--border)] bg-white/60 p-10 text-center shadow-lg shadow-stone-900/5 backdrop-blur">
      <h3 className="text-2xl font-semibold tracking-tight text-stone-900">
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[color:var(--muted)]">
        {description}
      </p>
      <Link
        href={href}
        className="mt-6 inline-flex rounded-full bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 transition hover:bg-teal-600"
      >
        {actionLabel}
      </Link>
    </section>
  );
}
