export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inset-0 rounded-full bg-ember pulse-dot" />
        <span className="absolute inset-0 rounded-full bg-ember/40 blur-[3px]" />
      </span>
      <span className="font-display text-[1.35rem] font-medium leading-none tracking-tight">
        Gerendo
      </span>
    </div>
  );
}
