import { z } from "zod";
import { HttpStatusError } from "../errors";
import { joinUrl, sendJson, type FetchLike } from "../http";
import { parseShape } from "../parse";
import {
  coreErrorBodySchema,
  coworkerSchema,
  taskEventSchema,
  taskListItemSchema,
  taskReceiptSchema,
  taskSchema,
  workspaceSchema,
  type Coworker,
  type Task,
  type TaskEvent,
  type TaskEventBody,
  type TaskListItem,
  type TaskReceipt,
} from "./schemas";

const service = "Sokosumi Core";
const dataEnvelope = z.object({ data: z.unknown() });

export interface CoreConnection {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly fetch: FetchLike;
}

export interface CoreClient {
  me(): Promise<Coworker>;
  readyTasks(): Promise<TaskListItem[]>;
  task(taskId: string): Promise<Task>;
  confirmPersonalWorkspace(workspaceId: string, ownerId: string): Promise<boolean>;
  postEvent(taskId: string, body: TaskEventBody): Promise<TaskEvent>;
  receipt(taskId: string): Promise<TaskReceipt>;
}

export function createCoreClient(connection: CoreConnection): CoreClient {
  if (!/^coworker_\S+$/.test(connection.apiKey)) {
    throw new Error("The Sokosumi runtime key must be a coworker_ key without whitespace");
  }

  async function call<Schema extends z.ZodType>(
    method: "GET" | "POST",
    path: string,
    schema: Schema,
    options: { body?: unknown; contextUserId?: string } = {},
  ): Promise<z.output<Schema>> {
    const reply = await sendJson(connection.fetch, {
      method,
      url: joinUrl(connection.baseUrl, path),
      headers: {
        authorization: `Bearer ${connection.apiKey}`,
        ...(options.contextUserId === undefined
          ? {}
          : { "x-context-user-id": options.contextUserId }),
      },
      ...(options.body === undefined ? {} : { body: options.body }),
    });
    if (reply.status < 200 || reply.status >= 300) {
      const failure = coreErrorBodySchema.safeParse(reply.body);
      throw new HttpStatusError(
        service,
        reply.status,
        failure.success ? `${failure.data.error}: ${failure.data.message}` : "no error body",
        failure.success ? (failure.data.kind ?? null) : null,
      );
    }
    const envelope = parseShape(`${service} ${path}`, dataEnvelope, reply.body);
    return parseShape(`${service} ${path}`, schema, envelope.data);
  }

  const taskPath = (taskId: string) => `/v1/tasks/${encodeURIComponent(taskId)}`;

  return {
    me: () => call("GET", "/v1/coworkers/me", coworkerSchema),
    readyTasks: () => call("GET", "/v1/tasks?status=READY", z.array(taskListItemSchema)),
    task: (taskId) => call("GET", taskPath(taskId), taskSchema),
    confirmPersonalWorkspace: async (workspaceId, ownerId) => {
      const workspace = await call(
        "GET",
        `/v1/workspaces/${encodeURIComponent(workspaceId)}`,
        workspaceSchema,
        { contextUserId: ownerId },
      );
      return workspace.organizationId === null;
    },
    postEvent: (taskId, body) =>
      call("POST", `${taskPath(taskId)}/events`, taskEventSchema, { body }),
    receipt: (taskId) => call("GET", `${taskPath(taskId)}/receipt`, taskReceiptSchema),
  };
}
