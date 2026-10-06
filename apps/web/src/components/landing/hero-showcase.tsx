import { ArrowUpRight01Icon, Camera01Icon, PrinterIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import bakery from "@/assets/landing/bakery.webp";
import print from "@/assets/landing/print.webp";
import placement from "@/assets/landing/placement.webp";

const stages = [
  {
    image: print,
    icon: PrinterIcon,
    title: "Print the approved card",
    caption: "One clear invitation: scan for Daybreak’s menu.",
    alt: "A print worker holds the Daybreak breakfast-menu card beside a printer",
    href: "#how-it-works",
  },
  {
    image: placement,
    icon: Camera01Icon,
    title: "Place it. Photograph it.",
    caption: "At the permitted coworking reception, ready to scan.",
    alt: "A runner’s camera screen frames the same Daybreak card at coworking reception",
    href: "#your-control",
  },
];

export function HeroShowcase() {
  return (
    <section aria-label="From campaign idea to physical placement" className="mb-24 sm:mb-32">
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="photo-card group md:min-h-[500px] lg:col-span-8">
          <img
            src={bakery}
            alt="Daybreak Bakery’s owner prepares pastries beside a sample card promoting the breakfast menu"
            fetchPriority="high"
            width={1600}
            height={901}
            className="aspect-video w-full object-cover opacity-90 md:absolute md:inset-0 md:aspect-auto md:h-full md:object-[75%_50%]"
          />
          <div className="photo-shade absolute inset-0 hidden md:block" />
          <div className="photo-shade-side absolute inset-0 hidden md:block" />
          <div className="relative p-6 sm:p-8 md:absolute md:bottom-0 md:left-0 md:max-w-sm xl:max-w-[30rem]">
            <p className="eyebrow mb-3 text-muted">Example campaign · Daybreak Bakery</p>
            <h2 className="text-2xl font-normal tracking-tight text-balance text-ink sm:text-3xl">
              Bring the breakfast menu to the neighborhood.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">
              Daybreak wants nearby workers to discover its coffee and fresh bakes. The owner
              approves a menu card for a coworking reception. Datum coordinates printing and
              placement, then checks the photo while the owner keeps baking.
            </p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1 lg:gap-6">
          {stages.map((item) => (
            <a
              href={item.href}
              key={item.title}
              className="photo-card group flex min-h-60 flex-col p-6 transition-colors hover:border-line-strong"
            >
              <div className="absolute inset-x-0 top-0 h-[68%] overflow-hidden">
                <img
                  src={item.image}
                  alt={item.alt}
                  width={1000}
                  height={667}
                  loading="lazy"
                  className="h-full w-full object-cover opacity-70 group-hover:opacity-90"
                />
                <div className="photo-fade absolute inset-0" />
              </div>
              <span className="relative mb-auto flex size-9 items-center justify-center rounded-lg border border-ink/10 bg-canvas/40 text-ink backdrop-blur-md">
                <HugeiconsIcon icon={item.icon} size={18} aria-hidden />
              </span>
              <div className="relative mt-16">
                <h3 className="text-xl font-normal tracking-tight text-ink">{item.title}</h3>
                <div className="my-3 h-px bg-ink/10" />
                <p className="flex items-center justify-between gap-3 text-xs text-pretty text-muted">
                  {item.caption}
                  <HugeiconsIcon
                    icon={ArrowUpRight01Icon}
                    size={16}
                    className="shrink-0 transition-colors group-hover:text-ink"
                    aria-hidden
                  />
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs text-pretty text-muted sm:text-right">
        Daybreak Bakery is a fictional brand. These generated scenes illustrate a campaign; they are
        not customer results or placement evidence.
      </p>
    </section>
  );
}
