import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-20" />
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
        <div className="flex gap-5"><Skeleton className="h-14 w-14 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-6 w-56" /><Skeleton className="h-4 w-72" /></div></div>
        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
      </div>
      <div className="flex gap-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-8 w-28" />)}</div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3"><Skeleton className="h-96 rounded-2xl xl:col-span-2" /><Skeleton className="h-64 rounded-2xl" /></div>
    </div>
  );
}
