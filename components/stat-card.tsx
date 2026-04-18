type Tone = "neutral" | "positive" | "negative";

const toneClasses: Record<Tone, string> = {
  neutral: "text-stone-900",
  positive: "text-emerald-700",
  negative: "text-rose-700",
};

export function StatCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: Tone;
}) {
  return (
    <article className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-lg shadow-stone-900/5 backdrop-blur">
      <p className="text-sm font-medium text-[color:var(--muted)]">{label}</p>
      <p className={`mt-4 text-3xl font-semibold tracking-tight ${toneClasses[tone]}`}>
        {value}
      </p>
      <p className="mt-2 text-sm text-[color:var(--muted)]">{helper}</p>
    </article>
  );
}
