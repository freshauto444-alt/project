export default function PageLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-5">
        {/* Spinner ring */}
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"
            style={{ animationDuration: "0.8s" }}
          />
        </div>
        {/* Brand wordmark */}
        <span className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Fresh Auto
        </span>
      </div>
    </div>
  )
}
