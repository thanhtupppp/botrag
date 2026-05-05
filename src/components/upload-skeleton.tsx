export function UploadSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-9 w-32 rounded-md bg-white/10 animate-pulse" />
      <div className="h-10 w-full rounded-md bg-white/10 animate-pulse" />
      <div className="space-y-3 pt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 animate-pulse"
          >
            <div className="h-9 w-9 rounded-md bg-white/10" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-2/3 rounded bg-white/10" />
              <div className="h-3 w-1/3 rounded bg-white/10/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
