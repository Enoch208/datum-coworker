import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { PhotoCrop } from "./landing-photos";

const clamp = (value: number, max: number): number => Math.min(Math.max(value, 0), max);

const percent = (value: number): string => `${String(value * 100)}%`;

function cropStyle(crop: PhotoCrop, frameAspect: number): CSSProperties {
  const visibleHeight = (crop.width * crop.photo.width) / crop.photo.height / frameAspect;
  const left = clamp(crop.centerX - crop.width / 2, 1 - crop.width);
  const top = clamp(crop.centerY - visibleHeight / 2, 1 - visibleHeight);
  return {
    width: percent(1 / crop.width),
    left: percent(-left / crop.width),
    top: percent(-top / visibleHeight),
    transformOrigin: `${percent(left + crop.width / 2)} ${percent(top + visibleHeight / 2)}`,
  };
}

export function CroppedPhoto({
  crop,
  frameAspect,
  alt,
  className,
  children,
}: {
  crop: PhotoCrop;
  frameAspect: number;
  alt: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden" style={{ aspectRatio: String(frameAspect) }}>
      <img
        src={crop.photo.src}
        alt={alt}
        width={crop.photo.width}
        height={crop.photo.height}
        loading="lazy"
        style={cropStyle(crop, frameAspect)}
        className={cx("absolute h-auto max-w-none", className)}
      />
      {children}
    </div>
  );
}
