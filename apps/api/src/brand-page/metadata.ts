import type { BrandPageFacts } from "@datum/core";

const maxTextLength = 300;
const titlePattern = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i;
const metaTagPattern = /<meta\b[^>]*>/gi;
const attributePattern = /([^\s"'=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

const namedEntities: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const fromCodePoint = (codePoint: number, original: string): string =>
  Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : original;

const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (original, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return fromCodePoint(Number.parseInt(entity.slice(2), 16), original);
    }
    if (entity.startsWith("#"))
      return fromCodePoint(Number.parseInt(entity.slice(1), 10), original);
    return namedEntities[entity.toLowerCase()] ?? original;
  });

const cleanText = (raw: string | undefined): string | null => {
  if (raw === undefined) return null;
  const text = decodeEntities(raw).replace(/\s+/g, " ").trim();
  if (text.length === 0) return null;
  return text.length > maxTextLength ? `${text.slice(0, maxTextLength - 1)}…` : text;
};

const metaAttributes = (tag: string): Map<string, string> => {
  const attributes = new Map<string, string>();
  for (const match of tag.matchAll(attributePattern)) {
    const [, name, doubleQuoted, singleQuoted, bare] = match;
    if (name !== undefined) {
      attributes.set(name.toLowerCase(), doubleQuoted ?? singleQuoted ?? bare ?? "");
    }
  }
  return attributes;
};

const metaContents = (html: string): Map<string, string> => {
  const contents = new Map<string, string>();
  for (const [tag] of html.matchAll(metaTagPattern)) {
    const attributes = metaAttributes(tag);
    const key = attributes.get("property") ?? attributes.get("name");
    const content = attributes.get("content");
    if (key !== undefined && content !== undefined && !contents.has(key.toLowerCase())) {
      contents.set(key.toLowerCase(), content);
    }
  }
  return contents;
};

const absoluteHttpUrl = (raw: string | undefined, pageUrl: string): string | null => {
  const text = cleanText(raw);
  const url = text === null ? null : URL.parse(text, pageUrl);
  if (url === null || (url.protocol !== "http:" && url.protocol !== "https:")) return null;
  return url.href;
};

export function readPageFacts(html: string, finalUrl: string): BrandPageFacts {
  const meta = metaContents(html);
  return {
    finalUrl,
    title: cleanText(titlePattern.exec(html)?.[1]) ?? cleanText(meta.get("og:title")),
    description: cleanText(meta.get("description")) ?? cleanText(meta.get("og:description")),
    imageUrl: absoluteHttpUrl(meta.get("og:image"), finalUrl),
  };
}
