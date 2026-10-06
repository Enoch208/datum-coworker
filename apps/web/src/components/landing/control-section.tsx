import { Camera01Icon, Clock01Icon, Shield01Icon, RepeatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import placement from "@/assets/landing/placement.webp";

const controls = [
  {
    title: "Your budget is the boundary.",
    text: "Printing, runner fees and repeat attempts count toward your limit. If more is needed, Datum asks first.",
    icon: Shield01Icon,
  },
  {
    title: "Your deadline stays fixed.",
    text: "No new work after the deadline. An incomplete campaign is reported honestly.",
    icon: Clock01Icon,
  },
  {
    title: "A missed spot gets another look.",
    text: "Datum checks what is missing, then plans a recovery within your remaining time and budget.",
    icon: RepeatIcon,
  },
  {
    title: "The proof comes with the result.",
    text: "See spot photos, QR checks and recorded expenses in your final Campaign Receipt.",
    icon: Camera01Icon,
  },
];

export function ControlSection() {
  return (
    <section
      id="your-control"
      aria-labelledby="control-heading"
      className="border-y border-line bg-surface/40 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-14 text-center">
          <p className="eyebrow mb-4 text-muted">Less managing. Still your call.</p>
          <h2
            id="control-heading"
            className="text-3xl font-medium tracking-tight text-balance sm:text-5xl"
          >
            You set the limits.
            <br />
            <span className="text-gradient-grey">Datum works inside them.</span>
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <div className="photo-card flex flex-col md:col-span-2 lg:row-span-2 lg:min-h-[560px]">
            <div className="relative h-64 overflow-hidden sm:h-80 lg:h-auto lg:flex-1">
              <img
                src={placement}
                alt="Example runner photographing a bakery QR card at a nearby coworking reception"
                width={1000}
                height={667}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-75"
              />
              <div className="photo-fade absolute inset-0" />
            </div>
            <div className="relative px-7 pb-8 sm:px-10 sm:pb-10">
              <p className="eyebrow mb-3 text-muted">Physical work. Visible progress.</p>
              <h3 className="text-2xl font-medium tracking-tight text-balance sm:text-3xl">
                Finished means every spot is checked.
              </h3>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
                Follow printing, placement and recovery from one campaign page. Your receipt records
                what actually happened.
              </p>
            </div>
          </div>
          {controls.map((control) => (
            <article key={control.title} className="surface-card flex flex-col p-6 sm:p-8">
              <span className="mb-8 flex size-10 items-center justify-center rounded-lg border border-ink/10 bg-ink/[0.04] text-ink">
                <HugeiconsIcon icon={control.icon} size={18} aria-hidden />
              </span>
              <h3 className="text-lg font-medium tracking-tight text-balance">{control.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{control.text}</p>
            </article>
          ))}
        </div>
        <p className="mt-5 text-xs text-muted">
          A QR check confirms the expected campaign card appears in a photo; it does not
          independently prove the physical location.
        </p>
      </div>
    </section>
  );
}
