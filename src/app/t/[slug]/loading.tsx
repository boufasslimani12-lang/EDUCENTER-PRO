import { Skeleton } from "@/components/ui";

/** Shown while a workspace page streams in. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-72" /></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-6 w-32" /><Skeleton className="h-3 w-40" /></div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card xl:col-span-2"><Skeleton className="mb-4 h-4 w-40" /><Skeleton className="h-56 w-full" /></div>
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card"><Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
      </div>
    </div>
  );
}
