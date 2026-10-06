import bakery from "@/assets/landing/bakery.webp";
import placement from "@/assets/landing/placement.webp";
import print from "@/assets/landing/print.webp";

export interface Photo {
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

export interface PhotoCrop {
  readonly photo: Photo;
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
}

export const photos = {
  bakery: { src: bakery, width: 1600, height: 900 },
  print: { src: print, width: 1000, height: 667 },
  placement: { src: placement, width: 1000, height: 667 },
} as const satisfies Record<string, Photo>;

export const bakeryFocus = "75% 50%";

export const crops = {
  counterCard: { photo: photos.bakery, centerX: 0.81, centerY: 0.59, width: 0.4 },
  cardInHand: { photo: photos.print, centerX: 0.66, centerY: 0.53, width: 0.5 },
  phoneScreen: { photo: photos.placement, centerX: 0.665, centerY: 0.48, width: 0.38 },
  standAndSign: { photo: photos.placement, centerX: 0.28, centerY: 0.29, width: 0.56 },
} as const satisfies Record<string, PhotoCrop>;
