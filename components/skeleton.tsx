export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-3">
          {[...Array(cols)].map((_, j) => (
            <div
              key={j}
              className="h-10 bg-stone-200 rounded animate-pulse"
              style={{ flex: 1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-stone-200">
      <div className="h-4 bg-stone-200 rounded w-1/3 mb-4 animate-pulse" />
      <div className="h-8 bg-stone-200 rounded w-1/2 animate-pulse" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-stone-200">
      <div className="h-4 bg-stone-200 rounded w-1/3 mb-4 animate-pulse" />
      <div className="h-64 bg-stone-200 rounded animate-pulse" />
    </div>
  );
}
