import { useEffect, useRef, useState, type ReactNode } from "react";

/** Keep placeholders visible for at least 500ms; never shorten a pending request. */
export function useMinimumLoading(loading: boolean, duration = 500) {
  const [held, setHeld] = useState(loading);
  const started = useRef(Date.now());
  useEffect(() => {
    if (loading) {
      started.current = Date.now();
      setHeld(true);
      return;
    }
    const remaining = Math.max(0, duration - (Date.now() - started.current));
    const timer = window.setTimeout(() => setHeld(false), remaining);
    return () => window.clearTimeout(timer);
  }, [loading, duration]);
  return loading || held;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={
        "rounded-md bg-slate-200/65 motion-safe:animate-pulse " + className
      }
    />
  );
}
export function FormSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading data"
      className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2"
    >
      <span className="sr-only">Loading data</span>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-6">
      <span className="sr-only">Loading page</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-6"
          >
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex justify-between gap-6 border-b border-slate-200 p-5">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-60" />
        </div>
        <div className="h-88 space-y-6 p-5 sm:h-96">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="grid grid-cols-4 gap-5">
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-slate-200 p-5">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    </div>
  );
}
export function LoadingBoundary({
  loading,
  children,
}: {
  loading: boolean;
  children: ReactNode;
}) {
  const visible = useMinimumLoading(loading);
  return visible ? <FormSkeleton /> : <>{children}</>;
}
export function SessionSkeleton() {
  return (
    <main className="min-h-dvh bg-[#f3f5f2] p-6 sm:p-10">
      <div className="mb-8">
        <Skeleton className="h-10 w-60" />
      </div>
      <PageSkeleton />
    </main>
  );
}
