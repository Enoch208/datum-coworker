import { lookup } from "node:dns";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import type { Readable, Transform } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { publicAddressesOnly, type AddressPolicy } from "./address-policy";
import { BrandPageError, networkFailure } from "./errors";

export interface HtmlFetchLimits {
  readonly timeoutMs: number;
  readonly maxBytes: number;
  readonly maxRedirects: number;
  readonly allowAddress: AddressPolicy;
}

export const brandPageLimits: HtmlFetchLimits = {
  timeoutMs: 5_000,
  maxBytes: 1_048_576,
  maxRedirects: 3,
  allowAddress: publicAddressesOnly,
};

export interface FetchedHtml {
  readonly finalUrl: string;
  readonly html: string;
}

export type HtmlFetcher = (url: string) => Promise<FetchedHtml>;

const redirectStatuses: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

const blocked = (host: string): BrandPageError =>
  new BrandPageError("BLOCKED_ADDRESS", `${host} is not a public internet address`);

const guardedLookup =
  (allow: AddressPolicy): LookupFunction =>
  (hostname, options, callback) => {
    lookup(hostname, { ...options, all: true }, (error, addresses) => {
      const [first] = addresses;
      if (error !== null) callback(error, "");
      else if (first === undefined || addresses.some((entry) => !allow(entry.address))) {
        callback(blocked(hostname), "");
      } else if (options.all === true) callback(null, addresses);
      else callback(null, first.address, first.family);
    });
  };

const checkedUrl = (raw: string, allow: AddressPolicy): URL => {
  const url = URL.parse(raw);
  if (url === null || (url.protocol !== "http:" && url.protocol !== "https:")) {
    throw new BrandPageError("UNSUPPORTED_URL", "only http and https pages can be read");
  }
  if (url.username !== "" || url.password !== "") {
    throw new BrandPageError("UNSUPPORTED_URL", "addresses with credentials are not read");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0 && !allow(host)) throw blocked(host);
  return url;
};

const send = (url: URL, limits: HtmlFetchLimits, signal: AbortSignal): Promise<IncomingMessage> =>
  new Promise((resolve, reject) => {
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    request(url, {
      method: "GET",
      signal,
      lookup: guardedLookup(limits.allowAddress),
      headers: {
        accept: "text/html",
        "accept-encoding": "gzip, deflate, br",
        "user-agent": "Datum brand page reader",
      },
    })
      .on("response", resolve)
      .on("error", (error) => {
        reject(networkFailure(error, signal.aborted, limits.timeoutMs));
      })
      .end();
  });

const decoderFor = (encoding: string): Transform | null => {
  if (encoding === "identity") return null;
  if (encoding === "gzip" || encoding === "x-gzip") return createGunzip();
  if (encoding === "deflate") return createInflate();
  if (encoding === "br") return createBrotliDecompress();
  throw new BrandPageError("UNSUPPORTED_ENCODING", `the page uses the ${encoding} encoding`);
};

const decoded = (response: IncomingMessage): Readable => {
  const encoding = (response.headers["content-encoding"] ?? "identity").trim().toLowerCase();
  const decoder = decoderFor(encoding);
  if (decoder === null) return response;
  response.on("error", (error) => decoder.destroy(error));
  return response.pipe(decoder);
};

const tooLarge = (maxBytes: number): BrandPageError =>
  new BrandPageError("TOO_LARGE", `the page is larger than ${String(maxBytes / 1_048_576)} MB`);

const collect = (stream: Readable, maxBytes: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    stream.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) stream.destroy(tooLarge(maxBytes));
      else chunks.push(chunk);
    });
    stream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    stream.on("error", reject);
  });

const pageRefusal = (response: IncomingMessage, maxBytes: number): BrandPageError | null => {
  const status = response.statusCode ?? 0;
  if (status < 200 || status > 299) {
    return new BrandPageError("HTTP_STATUS", `the server answered HTTP ${String(status)}`);
  }
  const contentType = (response.headers["content-type"] ?? "").toLowerCase();
  if (!contentType.startsWith("text/html")) {
    return new BrandPageError("NOT_HTML", "it is not an HTML page");
  }
  const declaredLength = Number(response.headers["content-length"] ?? 0);
  return declaredLength > maxBytes ? tooLarge(maxBytes) : null;
};

const readPage = async (
  response: IncomingMessage,
  limits: HtmlFetchLimits,
  signal: AbortSignal,
): Promise<string> => {
  const refusal = pageRefusal(response, limits.maxBytes);
  if (refusal !== null) {
    response.destroy();
    throw refusal;
  }
  const body = await collect(decoded(response), limits.maxBytes).catch((error: unknown) => {
    response.destroy();
    if (error instanceof Error) throw networkFailure(error, signal.aborted, limits.timeoutMs);
    throw new BrandPageError("NETWORK", "the page stream failed", { cause: error });
  });
  return new TextDecoder("utf-8").decode(body);
};

const nextHop = (response: IncomingMessage, current: URL): string | null => {
  const location = response.headers.location;
  if (!redirectStatuses.has(response.statusCode ?? 0) || location === undefined) return null;
  return new URL(location, current).href;
};

export const createHtmlFetcher =
  (limits: HtmlFetchLimits): HtmlFetcher =>
  async (startUrl) => {
    const signal = AbortSignal.timeout(limits.timeoutMs);
    let url = checkedUrl(startUrl, limits.allowAddress);
    for (let hop = 0; hop <= limits.maxRedirects; hop += 1) {
      const response = await send(url, limits, signal);
      const redirect = nextHop(response, url);
      if (redirect === null) {
        return { finalUrl: url.href, html: await readPage(response, limits, signal) };
      }
      response.resume();
      url = checkedUrl(redirect, limits.allowAddress);
    }
    throw new BrandPageError("TOO_MANY_REDIRECTS", "it redirected too many times");
  };
