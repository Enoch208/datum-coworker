import type { ApiError, EvidenceView } from "@datum/core";
import { evidence } from "@datum/db";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { startedCampaign, taskFor } from "./runners/campaign";
import { jpegFile, postForm, runnerCall, taskPath } from "./runners/calls";
import { app, db, resetDatabaseBetweenTests } from "./support";

resetDatabaseBetweenTests();

const twelveMegabytes = 12 * 1024 * 1024;

async function readyTask() {
  const { campaign, runner } = await startedCampaign();
  const taskId = taskFor(campaign, "A").id;
  await runnerCall("POST", taskPath(runner.token, taskId, "accept"));
  return (fields: Record<string, string | Blob>) =>
    postForm<EvidenceView & ApiError>(taskPath(runner.token, taskId, "evidence"), fields);
}

const withJpegMagic = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return bytes;
};

const heicBytes = (): Uint8Array => {
  const bytes = new Uint8Array(64);
  bytes.set(new TextEncoder().encode("ftypheic"), 4);
  return bytes;
};

const phoneJpegWithGps = () =>
  sharp({ create: { width: 1200, height: 800, channels: 3, background: "#4a6b8a" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({
      IFD0: { Make: "TestPhone", Copyright: "Ana" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "1/1 17/1 0/1" },
    })
    .toBuffer();

describe("uploaded images (spec 21.4)", () => {
  it("refuses a photo over 12 MB", async () => {
    const send = await readyTask();
    const reply = await send({ photo: jpegFile(withJpegMagic(twelveMegabytes + 1)) });
    expect(reply).toMatchObject({ status: 413, body: { error: "UPLOAD_TOO_LARGE" } });
  });

  it("refuses a request body far over the limit before reading it", async () => {
    const send = await readyTask();
    const reply = await send({ photo: jpegFile(withJpegMagic(twelveMegabytes * 2)) });
    expect(reply).toMatchObject({ status: 413, body: { error: "UPLOAD_TOO_LARGE" } });
  });

  it("refuses HEIC with a fix the runner can follow, whatever the declared type", async () => {
    const send = await readyTask();
    const reply = await send({ photo: jpegFile(heicBytes(), "IMG_0001.jpg", "image/jpeg") });
    expect(reply).toMatchObject({ status: 415, body: { error: "UNSUPPORTED_IMAGE" } });
    expect(reply.body.message).toContain("Set the camera to Most Compatible or upload a JPEG");
  });

  it("judges the bytes, not the name or declared type", async () => {
    const send = await readyTask();
    const text = jpegFile(new TextEncoder().encode("#!/bin/sh\necho hi\n"), "photo.jpg");
    expect(await send({ photo: text })).toMatchObject({
      status: 415,
      body: { error: "UNSUPPORTED_IMAGE" },
    });
    const pdf = jpegFile(new TextEncoder().encode("%PDF-1.7\n"), "card.pdf", "application/pdf");
    expect((await send({ photo: pdf })).status).toBe(415);
  });

  it("refuses a file that looks like a JPEG but does not decode", async () => {
    const send = await readyTask();
    const reply = await send({ photo: jpegFile(withJpegMagic(2_048)) });
    expect(reply).toMatchObject({ status: 422, body: { error: "UNREADABLE_IMAGE" } });
    expect(await db.select().from(evidence)).toEqual([]);
  });

  it("requires the photo field", async () => {
    const send = await readyTask();
    expect(await send({ picture: jpegFile(withJpegMagic(64)) })).toMatchObject({
      status: 400,
      body: { error: "VALIDATION_FAILED" },
    });
  });

  it("stores an upright JPEG with every piece of metadata, GPS included, removed", async () => {
    const original = await phoneJpegWithGps();
    const before = await sharp(original).metadata();
    expect(before).toMatchObject({ orientation: 6, width: 1200, height: 800 });
    expect(before.exif?.includes(Buffer.from("TestPhone"))).toBe(true);
    const send = await readyTask();
    const reply = await send({ photo: jpegFile(original) });
    expect(reply.status).toBe(201);
    const response = await app.request(new URL(reply.body.photoUrl).pathname);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toMatch(/^private, max-age=\d+$/);
    const stored = Buffer.from(await response.arrayBuffer());
    const after = await sharp(stored).metadata();
    expect(after).toMatchObject({ format: "jpeg", width: 800, height: 1200 });
    expect(after.exif).toBeUndefined();
    expect(after.orientation).toBeUndefined();
    expect(after.icc).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(stored.includes(Buffer.from("TestPhone"))).toBe(false);
  });
});
