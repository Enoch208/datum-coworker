const block = "rounded-xl bg-raised motion-safe:animate-pulse";

export function RunnerSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading your tasks…</span>
      <div aria-hidden>
        <div className={`${block} h-4 w-20`} />
        <div className={`${block} mt-3 h-9 w-48`} />
        <div className={`${block} mt-4 h-4 w-32`} />
        <div className="mt-10 flex flex-col gap-3">
          {["a", "b", "c"].map((key) => (
            <div key={key} className={`${block} h-36`} />
          ))}
        </div>
      </div>
    </div>
  );
}
