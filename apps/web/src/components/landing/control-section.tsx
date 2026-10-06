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
      className="border-y border-line bg-surface/40 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-12 text-center">
          <p className="eyebrow mb-4 text-accent">Less managing. Still your call.</p>
          <h2 id="control-heading" className="text-3xl font-medium tracking-tight sm:text-5xl">
            You set the limits.
            <br />
            <span className="text-faint">Datum works inside them.</span>
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="photo-card flex min-h-[380px] items-end md:col-span-2 lg:row-span-2 lg:min-h-[560px]">
            <img
              src={placement}
              alt="Example runner photographing a bakery QR card at a nearby coworking reception"
              width={1000}
              height={667}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
            <div className="photo-shade absolute inset-0" />
            <div className="relative p-7 sm:p-10">
              <p className="eyebrow mb-3 text-accent">Physical work. Visible progress.</p>
              <h3 className="text-3xl font-medium tracking-tight">
                Finished means
                <br />
                every spot is checked.
              </h3>
              <p className="mt-4 max-w-xs text-sm text-muted">
                Follow printing, placement and recovery from one campaign page. Your receipt records
                what actually happened.
              </p>
            </div>
          </div>
          {controls.map((control) => (
            <article key={control.title} className="surface-card flex flex-col p-6 sm:p-7">
              <span className="mb-6 flex size-11 items-center justify-center rounded-full border border-accent/20 bg-accent/5 text-accent">
                <HugeiconsIcon icon={control.icon} size={20} aria-hidden />
              </span>
              <h3 className="text-lg font-medium tracking-tight">{control.title}</h3>
              <p className="mt-3 text-sm text-muted">{control.text}</p>
            </article>
          ))}
        </div>
        <p className="mt-5 text-xs text-faint">
          A QR check confirms the expected campaign card appears in a photo; it does not
          independently prove the physical location.
        </p>
      </div>
    </section>
  );
}
