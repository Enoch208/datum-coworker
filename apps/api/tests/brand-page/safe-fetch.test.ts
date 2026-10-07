import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { AddressPolicy } from "../../src/brand-page/address-policy";
import {
  brandPageLimits,
  createHtmlFetcher,
  type HtmlFetchLimits,
} from "../../src/brand-page/safe-fetch";
import { htmlPage, servePages } from "./server";

const onlyLoopbackV4: AddressPolicy = (address) => address === "127.0.0.1";
const testLimits: HtmlFetchLimits = { ...brandPageLimits, allowAddress: onlyLoopbackV4 };
const fetchForTest = createHtmlFetcher(testLimits);
const fetchForProduction = createHtmlFetcher(brandPageLimits);

describe("the brand page fetcher", () => {
  it("reads an HTML page from an allowed address", async () => {
    const server = await servePages(htmlPage("<title>Kopi Lab</title>"));
    await expect(fetchForTest(`${server.origin}/`)).resolves.toEqual({
      finalUrl: `${server.origin}/`,
      html: "<title>Kopi Lab</title>",
    });
  });

  it("refuses loopback, private and metadata addresses before connecting", async () => {
    const server = await servePages(htmlPage("<title>secret</title>"));
    for (const url of [
      `${server.origin}/`,
      `http://localhost:${String(server.port)}/`,
      `http://0x7f.1:${String(server.port)}/`,
      `http://[::1]:${String(server.port)}/`,
      "http://169.254.169.254/latest/meta-data/",
      "http://10.0.0.1/",
    ]) {
      await expect(fetchForProduction(url)).rejects.toMatchObject({ code: "BLOCKED_ADDRESS" });
    }
    expect(server.requests).toEqual([]);
  });

  it("refuses a redirect to a blocked address", async () => {
    const server = await servePages((_request, response) => {
      response.writeHead(302, { location: "http://127.0.0.2/admin" });
      response.end();
    });
    await expect(fetchForTest(`${server.origin}/`)).rejects.toMatchObject({
      code: "BLOCKED_ADDRESS",
    });
    expect(server.requests).toEqual(["/"]);
  });

  it("follows a redirect to an allowed page and reports where it ended", async () => {
    const server = await servePages((request, response) => {
      if (request.url === "/old") {
        response.writeHead(301, { location: "/new" });
        response.end();
        return;
      }
      htmlPage("<title>moved</title>")(request, response);
    });
    const page = await fetchForTest(`${server.origin}/old`);
    expect(page.finalUrl).toBe(`${server.origin}/new`);
  });

  it("stops after too many redirects", async () => {
    const server = await servePages((_request, response) => {
      response.writeHead(302, { location: "/again" });
      response.end();
    });
    await expect(fetchForTest(`${server.origin}/`)).rejects.toMatchObject({
      code: "TOO_MANY_REDIRECTS",
    });
    expect(server.requests).toHaveLength(testLimits.maxRedirects + 1);
  });

  it.each(["file:///etc/passwd", "ftp://example.com/", "javascript:alert(1)", "not a url"])(
    "refuses the non-web address %s",
    async (url) => {
      await expect(fetchForProduction(url)).rejects.toMatchObject({ code: "UNSUPPORTED_URL" });
    },
  );

  it("refuses an address that carries credentials", async () => {
    await expect(fetchForTest("http://user:pass@127.0.0.1/")).rejects.toMatchObject({
      code: "UNSUPPORTED_URL",
    });
  });

  it("reports a name that does not resolve as DNS_FAILED instead of crashing", async () => {
    await expect(fetchForProduction("https://no-such-brand.invalid/")).rejects.toMatchObject({
      code: "DNS_FAILED",
    });
  });

  it("refuses a response that is not HTML", async () => {
    const server = await servePages((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
    await expect(fetchForTest(`${server.origin}/`)).rejects.toMatchObject({ code: "NOT_HTML" });
  });

  it("refuses an error status", async () => {
    const server = await servePages((_request, response) => {
      response.writeHead(404, { "content-type": "text/html" });
      response.end("<title>missing</title>");
    });
    await expect(fetchForTest(`${server.origin}/`)).rejects.toMatchObject({
      code: "HTTP_STATUS",
      message: "the server answered HTTP 404",
    });
  });

  it("refuses a page declared larger than the cap", async () => {
    const server = await servePages((_request, response) => {
      response.writeHead(200, { "content-type": "text/html", "content-length": "2000000" });
      response.end();
    });
    await expect(fetchForTest(`${server.origin}/`)).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("stops reading a streamed page once it passes the cap", async () => {
    const server = await servePages((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("x".repeat(testLimits.maxBytes + 1));
    });
    await expect(fetchForTest(`${server.origin}/`)).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("caps the decompressed size of a compressed page", async () => {
    const bomb = gzipSync(Buffer.alloc(testLimits.maxBytes * 4, 32));
    const server = await servePages((_request, response) => {
      response.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" });
      response.end(bomb);
    });
    await expect(fetchForTest(`${server.origin}/`)).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("reads a gzip page", async () => {
    const server = await servePages((_request, response) => {
      response.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" });
      response.end(gzipSync("<title>zipped</title>"));
    });
    expect((await fetchForTest(`${server.origin}/`)).html).toBe("<title>zipped</title>");
  });

  it("gives up on a page that does not answer in time", async () => {
    const fetchQuickly = createHtmlFetcher({ ...testLimits, timeoutMs: 300 });
    const silent = await servePages(() => undefined);
    await expect(fetchQuickly(`${silent.origin}/`)).rejects.toMatchObject({ code: "TIMEOUT" });
    const stalling = await servePages((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.write("<title>half");
    });
    await expect(fetchQuickly(`${stalling.origin}/`)).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
