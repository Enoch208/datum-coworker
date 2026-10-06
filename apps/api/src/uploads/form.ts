import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { errorBody, invalidRequest } from "../http/errors";
import { maxUploadBytes } from "./image";

const multipartOverhead = 1024 * 1024;

export const uploadBodyLimit = bodyLimit({
  maxSize: maxUploadBytes + multipartOverhead,
  onError: (c) => c.json(errorBody("UPLOAD_TOO_LARGE", "The upload is larger than 12 MB"), 413),
});

export type UploadForm = Record<string, string | File>;

export async function readForm(c: Context): Promise<UploadForm> {
  const type = c.req.header("content-type") ?? "";
  if (!type.startsWith("multipart/form-data")) {
    throw invalidRequest("Send the upload as multipart/form-data");
  }
  return c.req.parseBody();
}

export async function fileField(form: UploadForm, field: string): Promise<Uint8Array> {
  const value = form[field];
  if (!(value instanceof File)) {
    throw invalidRequest(`Attach the image as the multipart field "${field}"`);
  }
  return new Uint8Array(await value.arrayBuffer());
}

export function textField(form: UploadForm, field: string): string | null {
  const value = form[field];
  return typeof value === "string" ? value : null;
}
