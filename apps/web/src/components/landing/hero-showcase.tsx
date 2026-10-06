import bakery from "@/assets/landing/bakery.webp";
import print from "@/assets/landing/print.webp";
import placement from "@/assets/landing/placement.webp";

export function HeroShowcase() {
  return (
    <section aria-label="From campaign idea to physical placement" className="mb-24 sm:mb-32">
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="photo-card group sm:min-h-[500px] lg:col-span-8">
          <img
            src={bakery}
            alt="Example bakery owner preparing pastries while QR campaign cards are ready on the counter"
            fetchPriority="high"
            width={1600}
            height={901}
            className="aspect-video w-full object-cover opacity-85 sm:absolute sm:inset-0 sm:h-full"
          />
          <div className="photo-shade absolute inset-0 hidden sm:block" />
          <div className="relative p-6 sm:absolute sm:inset-x-0 sm:bottom-0 sm:p-8">
            <p className="eyebrow mb-3 text-accent">An example: a neighborhood bakery</p>
            <h2 className="text-2xl font-normal tracking-tight text-ink sm:text-3xl">
              More time for your business. Less time chasing flyers.
            </h2>
            <p className="mt-3 max-w-md text-sm text-muted">
              A bakery owner has customers to serve. Datum coordinates the QR cards for nearby,
              permitted spots, then checks the photos.
            </p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1 lg:gap-6">
          {[
            {
              image: print,
              title: "From a brief to print",
              caption: "The bakery’s menu, one scan away",
              href: "#how-it-works",
            },
            {
              image: placement,
              title: "Every spot needs proof",
              caption: "A nearby spot, a runner’s photo, a QR check",
              href: "#your-control",
            },
          ].map((item) => (
            <a
              href={item.href}
              key={item.title}
              className="photo-card group flex min-h-60 items-end"
            >
              <img
                src={item.image}
                alt=""
                width={1000}
                height={667}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-60"
              />
              <div className="photo-shade absolute inset-0" />
              <div className="relative w-full p-6">
                <h3 className="text-lg font-medium text-ink">
                  {item.title}
                  <span className="float-right text-accent" aria-hidden>
                    ↗
                  </span>
                </h3>
                <p className="mt-1 text-xs text-muted">{item.caption}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
      <p className="mt-3 text-right text-[10px] text-faint">
        Daybreak Bakery is an illustrative example, not a customer result. Actual evidence comes
        from runner uploads.
      </p>
    </section>
  );
}
