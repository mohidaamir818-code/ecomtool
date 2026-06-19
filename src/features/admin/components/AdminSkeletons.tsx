export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="h-10 animate-pulse rounded-xl bg-white/10" />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

export function UserDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 animate-pulse rounded-full bg-white/10" />
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-64 animate-pulse rounded bg-white/5" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
      <TableSkeleton rows={6} />
    </div>
  );
}

export function CardSkeleton() {
  return <div className="h-32 animate-pulse rounded-2xl bg-white/5" />;
}
