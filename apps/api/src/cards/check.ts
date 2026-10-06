import type { PrintFormat, PublicCopy } from "@datum/core";
import { unprintableCharacters } from "./fonts";
import { CardLayoutError } from "./layout";
import { cardSvg } from "./template";

export interface PrintRejection {
  readonly reason: "UNPRINTABLE_COPY" | "COPY_DOES_NOT_FIT";
  readonly detail: string;
}

export interface CardSubject {
  readonly brandName: string;
  readonly printFormat: PrintFormat;
  readonly spots: readonly { readonly code: string; readonly qrTargetUrl: string }[];
}

const layoutRejection = (copy: PublicCopy, subject: CardSubject): PrintRejection | null => {
  for (const spot of subject.spots) {
    try {
      cardSvg({ ...subject, copy, spotCode: spot.code, qrTargetUrl: spot.qrTargetUrl });
    } catch (error) {
      if (error instanceof CardLayoutError) {
        return { reason: "COPY_DOES_NOT_FIT", detail: error.message };
      }
      throw error;
    }
  }
  return null;
};

export const printRejection = (copy: PublicCopy, subject: CardSubject): PrintRejection | null => {
  const unprintable = unprintableCharacters(`${copy.headline} ${copy.subcopy}`);
  if (unprintable.length > 0) {
    return {
      reason: "UNPRINTABLE_COPY",
      detail: `The card font cannot print ${unprintable.map((character) => JSON.stringify(character)).join(", ")}`,
    };
  }
  return layoutRejection(copy, subject);
};
