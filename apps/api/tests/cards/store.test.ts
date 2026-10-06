import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cardAssetKey, cardAssetUrl, readAsset, writeAsset } from "../../src/cards/store";

describe("the card store", () => {
  it("names card files by campaign, asset version and spot", () => {
    const key = cardAssetKey("cmp_k3j9x2m4p7q8r5t6", 2, "B", "pdf");
    expect(key).toBe("cmp_k3j9x2m4p7q8r5t6/v2/B.pdf");
    expect(cardAssetUrl("https://api.usedatum.xyz", key)).toBe(
      "https://api.usedatum.xyz/assets/cmp_k3j9x2m4p7q8r5t6/v2/B.pdf",
    );
  });

  it("writes atomically and reads back the same bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "datum-assets-"));
    const key = cardAssetKey("cmp_k3j9x2m4p7q8r5t6", 1, "A", "png");
    await writeAsset(root, key, Buffer.from("card"));
    await writeAsset(root, key, Buffer.from("card v2"));
    expect((await readAsset(root, key))?.toString()).toBe("card v2");
    expect(await readdir(join(root, "cmp_k3j9x2m4p7q8r5t6", "v1"))).toEqual(["A.png"]);
  });

  it("reports a missing file as null", async () => {
    const root = await mkdtemp(join(tmpdir(), "datum-assets-"));
    expect(await readAsset(root, "cmp_k3j9x2m4p7q8r5t6/v1/A.png")).toBeNull();
  });
});
