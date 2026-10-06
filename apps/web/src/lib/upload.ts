import { ApiRequestError, apiBase, readBody } from "./http";

const uploadTimeoutMs = 180_000;

const keptText = "Your photo is still here, so you can send it again.";

export function postForm(
  path: string,
  form: FormData,
  onProgress: (fraction: number) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${apiBase}${path}`);
    request.setRequestHeader("Accept", "application/json");
    request.timeout = uploadTimeoutMs;
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    });
    request.addEventListener("load", () => {
      try {
        resolve(
          readBody(request.status, request.getResponseHeader("content-type"), request.responseText),
        );
      } catch (cause) {
        reject(cause instanceof Error ? cause : new Error(String(cause)));
      }
    });
    request.addEventListener("error", () => {
      reject(new ApiRequestError(0, "NETWORK", `The upload did not reach Datum. ${keptText}`));
    });
    request.addEventListener("timeout", () => {
      reject(new ApiRequestError(0, "TIMEOUT", `The upload took too long. ${keptText}`));
    });
    request.send(form);
  });
}
