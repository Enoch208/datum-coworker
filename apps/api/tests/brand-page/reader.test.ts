import { describe, expect, it } from "vitest";
import { BrandPageError } from "../../src/brand-page/errors";
import { readPageFacts } from "../../src/brand-page/metadata";
import { createBrandPageReader } from "../../src/brand-page/reader";

const pageUrl = "https://kopilab.example/about/";

describe("readPageFacts", () => {
  it("reads the title, description and share image", () => {
    const html = `<html><head>
      <TITLE> Kopi Lab &amp; Friends </TITLE>
      <meta content="Single-origin coffee on Amoy Street" name="description">
      <meta property='og:image' content='/img/og.png'/>
    </head></html>`;
    expect(readPageFacts(html, pageUrl)).toEqual({
      finalUrl: pageUrl,
      title: "Kopi Lab & Friends",
      description: "Single-origin coffee on Amoy Street",
      imageUrl: "https://kopilab.example/img/og.png",
    });
  });

  it("falls back to Open Graph text when the plain tags are missing", () => {
    const html = `<meta property="og:title" content="Kopi Lab">
      <meta property="og:description" content="Coffee &#8211; done well &#x2615;">`;
    expect(readPageFacts(html, pageUrl)).toMatchObject({
      title: "Kopi Lab",
      description: "Coffee – done well ☕",
    });
  });

  it("returns nulls for a page without metadata", () => {
    expect(readPageFacts("<p>hello</p>", pageUrl)).toEqual({
      finalUrl: pageUrl,
      title: null,
      description: null,
      imageUrl: null,
    });
  });

  it("ignores a share image that is not a web address", () => {
    const html = `<meta property="og:image" content="javascript:alert(1)">`;
    expect(readPageFacts(html, pageUrl).imageUrl).toBeNull();
  });

  it("caps very long text", () => {
    const title = readPageFacts(`<title>${"a".repeat(1_000)}</title>`, pageUrl).title;
    expect(title).toHaveLength(300);
    expect(title?.endsWith("…")).toBe(true);
  });
});

describe("createBrandPageReader", () => {
  it("reads a page into facts", async () => {
    const read = createBrandPageReader((url) =>
      Promise.resolve({ finalUrl: url, html: "<title>Kopi Lab</title>" }),
    );
    await expect(read("https://kopilab.example")).resolves.toMatchObject({
      outcome: "READ",
      url: "https://kopilab.example",
      facts: { title: "Kopi Lab" },
    });
  });

  it("does not fetch when no brand page was given", async () => {
    const read = createBrandPageReader(() => Promise.reject(new Error("must not fetch")));
    await expect(read(null)).resolves.toEqual({ outcome: "NOT_GIVEN" });
  });

  it("turns a refused page into a recorded failure", async () => {
    const read = createBrandPageReader(() =>
      Promise.reject(new BrandPageError("NOT_HTML", "it is not an HTML page")),
    );
    await expect(read("https://kopilab.example")).resolves.toEqual({
      outcome: "FAILED",
      url: "https://kopilab.example",
      reason: "it is not an HTML page",
    });
  });

  it("lets an unexpected error through", async () => {
    const read = createBrandPageReader(() => Promise.reject(new TypeError("bug")));
    await expect(read("https://kopilab.example")).rejects.toThrow(TypeError);
  });
});
