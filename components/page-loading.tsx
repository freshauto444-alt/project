export default function PageLoading() {
  return (
    <div className="pt-20 min-h-screen">
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-[2px]">
        <div
          className="h-full bg-primary rounded-r-full"
          style={{
            animation: "loading-progress 1.2s ease-in-out infinite",
            transformOrigin: "left",
          }}
        />
      </div>
      {/* Skeleton content */}
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="h-4 w-80 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-8">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-2xl border border-border overflow-hidden">
              <div className="aspect-[16/9] bg-muted animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                <div className="h-3 w-48 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes loading-progress {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.7); }
          100% { transform: scaleX(1); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
