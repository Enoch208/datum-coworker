const block = "rounded-lg bg-raised motion-safe:animate-pulse";

export function CampaignSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading the campaign…</span>
      <div aria-hidden>
        <div className={`${block} h-7 w-48`} />
        <div className={`${block} mt-6 h-14 w-3/4 max-w-xl`} />
        <div className={`${block} mt-4 h-6 w-full max-w-2xl`} />
        <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {["a", "b", "c", "d"].map((key) => (
            <div key={key} className={`${block} h-14`} />
          ))}
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-2">
          {["a", "b"].map((key) => (
            <div key={key} className={`${block} aspect-[1/1.414]`} />
          ))}
        </div>
      </div>
    </div>
  );
}
