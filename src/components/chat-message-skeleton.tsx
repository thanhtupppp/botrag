export function ChatMessageSkeleton() {
  return (
    <div className="flex gap-3 py-3">
      <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-11/12 animate-pulse rounded bg-white/10/80" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-white/10/70" />
      </div>
    </div>
  );
}
