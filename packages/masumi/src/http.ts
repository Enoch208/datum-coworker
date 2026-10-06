export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface JsonRequest {
  readonly method: "GET" | "POST";
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

export interface JsonReply {
  readonly status: number;
  readonly body: unknown;
}

const requestTimeoutMs = 30_000;

export async function sendJson(fetchImpl: FetchLike, request: JsonRequest): Promise<JsonReply> {
  const hasBody = request.body !== undefined;
  const response = await fetchImpl(request.url, {
    method: request.method,
    headers: {
      accept: "application/json",
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...request.headers,
    },
    ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
    redirect: "error",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`${request.url} tried to redirect (HTTP ${String(response.status)})`);
  }
  const text = await response.text();
  return { status: response.status, body: text.trim().length === 0 ? null : parseJson(text) };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Expected a JSON body, received ${String(text.length)} bytes of something else`,
        { cause: error },
      );
    }
    throw error;
  }
}

export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}
