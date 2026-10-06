import type { CampaignView } from "@datum/core";
import { SectionHeading } from "@/components/campaign/section-heading";
import { ByRules } from "@/components/status/provenance";
import { SpotTile } from "./spot-tile";

export function SpotBoard({ campaign }: { campaign: CampaignView }) {
  const attemptsAt = (code: string) =>
    campaign.tasks.filter((task) => task.type === "PLACE_SPOT" && task.spotCode === code).length;
  return (
    <section aria-labelledby="spots-heading">
      <SectionHeading id="spots-heading" title="Spots">
        <ByRules label="Checked by rules" />
      </SectionHeading>
      <p className="mt-2 max-w-2xl text-[15px] font-light text-muted">
        A spot counts only when a photo sent through its open task, before the deadline, shows that
        spot&apos;s own QR code. QR scans are reported, never used to decide.
      </p>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2">
        {campaign.spots.map((spot) => (
          <SpotTile key={spot.id} spot={spot} attempts={attemptsAt(spot.code)} />
        ))}
      </ul>
    </section>
  );
}
