/** Placeholder abu-abu saat data dimuat (fallback <Suspense>). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-card bg-surface ${className}`} />;
}
