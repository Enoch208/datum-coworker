import datumMark from "@/assets/brand/datum-mark.webp";

export function BrandMark({ height }: { height: number }) {
  return (
    <img src={datumMark} alt="Datum" height={height} width={Math.round(height * (480 / 287))} />
  );
}
