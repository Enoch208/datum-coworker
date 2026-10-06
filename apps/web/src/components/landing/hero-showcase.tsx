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
            alt="Daybreak Bakery’s owner prepares pastries beside a sample card promoting the breakfast menu"
            fetchPriority="high"
            width={1600}
            height={901}
            className="aspect-video w-full object-cover opacity-85 sm:absolute sm:inset-0 sm:h-full"
          />
          <div className="photo-shade absolute inset-0 hidden sm:block" />
          <div className="relative p-6 sm:absolute sm:inset-x-0 sm:bottom-0 sm:p-8">
            <p className="eyebrow mb-3 text-accent">Example campaign · Daybreak Bakery</p>
            <h2 className="text-2xl font-normal tracking-tight text-ink sm:text-3xl">
              Bring the breakfast menu to the neighborhood.
            </h2>
            <p className="mt-3 max-w-md text-sm text-muted">
              Daybreak wants nearby workers to discover its coffee and fresh bakes. The owner
              approves a menu card for a coworking reception. Datum coordinates printing and
              placement, then checks the photo—while the owner keeps baking.
            </p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1 lg:gap-6">
          {[
            {
              image: print,
              title: "Print the approved card",
              caption: "One clear invitation: scan for Daybreak’s menu.",
              alt: "A print worker holds the Daybreak breakfast-menu card beside a printer",
              href: "#how-it-works",
            },
            {
              image: placement,
              title: "Place it. Photograph it.",
              caption: "At the permitted coworking reception, ready to scan.",
              alt: "A runner’s camera screen frames the same Daybreak card at coworking reception",
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
                alt={item.alt}
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
        Daybreak Bakery is a fictional brand. These generated scenes illustrate a campaign; they are
        not customer results or placement evidence.
      </p>
    </section>
  );
}
