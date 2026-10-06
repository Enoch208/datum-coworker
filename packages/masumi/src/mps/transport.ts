import { z } from "zod";
import { HttpStatusError } from "../errors";
import { joinUrl, sendJson, type FetchLike } from "../http";
import { parseShape } from "../parse";
import { mpsErrorBodySchema } from "./schemas";

const service = "Masumi Payment Service";
const successEnvelope = z.object({ status: z.literal("success"), data: z.unknown() });

export interface MpsConnection {
  readonly baseUrl: string;
  readonly token: string;
  readonly fetch: FetchLike;
}

export interface MpsTransport {
  get<Schema extends z.ZodType>(path: string, schema: Schema): Promise<z.output<Schema>>;
  post<Schema extends z.ZodType>(
    path: string,
    body: unknown,
    schema: Schema,
  ): Promise<z.output<Schema>>;
}

export function createMpsTransport(connection: MpsConnection): MpsTransport {
  async function call<Schema extends z.ZodType>(
    method: "GET" | "POST",
    path: string,
    body: unknown,
    schema: Schema,
  ): Promise<z.output<Schema>> {
    const reply = await sendJson(connection.fetch, {
      method,
      url: joinUrl(connection.baseUrl, path),
      headers: { token: connection.token },
      ...(body === undefined ? {} : { body }),
    });
    if (reply.status < 200 || reply.status >= 300) {
      throw new HttpStatusError(service, reply.status, errorMessage(reply.body), null);
    }
    const envelope = parseShape(`${service} ${path}`, successEnvelope, reply.body);
    return parseShape(`${service} ${path}`, schema, envelope.data);
  }

  return {
    get: (path, schema) => call("GET", path, undefined, schema),
    post: (path, body, schema) => call("POST", path, body, schema),
  };
}

function errorMessage(body: unknown): string {
  const parsed = mpsErrorBodySchema.safeParse(body);
  return parsed.success ? parsed.data.error.message : "no error message";
}
