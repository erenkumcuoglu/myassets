export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-teal-700">
        {eyebrow}
      </p>
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          {title}
        </h2>
        <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted)] sm:text-base">
          {description}
        </p>
      </div>
    </div>
  );
}
