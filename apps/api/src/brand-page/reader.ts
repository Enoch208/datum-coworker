import type { BrandPageReading } from "@datum/core";
import { BrandPageError } from "./errors";
import { readPageFacts } from "./metadata";
import type { HtmlFetcher } from "./safe-fetch";

export type BrandPageReader = (url: string | null) => Promise<BrandPageReading>;

export const createBrandPageReader =
  (fetchHtml: HtmlFetcher): BrandPageReader =>
  async (url) => {
    if (url === null) return { outcome: "NOT_GIVEN" };
    try {
      const page = await fetchHtml(url);
      return { outcome: "READ", url, facts: readPageFacts(page.html, page.finalUrl) };
    } catch (error) {
      if (error instanceof BrandPageError) return { outcome: "FAILED", url, reason: error.message };
      throw error;
    }
  };
