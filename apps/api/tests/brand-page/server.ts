import { createServer, type RequestListener, type Server } from "node:http";
import { afterEach } from "vitest";

export interface PageServer {
  readonly origin: string;
  readonly port: number;
  readonly requests: string[];
}

const open: Server[] = [];

afterEach(async () => {
  const closing = open.splice(0).map(
    (server) =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  );
  await Promise.all(closing);
});

export async function servePages(handler: RequestListener): Promise<PageServer> {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? "");
    handler(request, response);
  });
  open.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("The test page server has no TCP address");
  }
  const { port } = address;
  return { origin: `http://127.0.0.1:${String(port)}`, port, requests };
}

export const htmlPage = (body: string): RequestListener => {
  return (_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(body);
  };
};
