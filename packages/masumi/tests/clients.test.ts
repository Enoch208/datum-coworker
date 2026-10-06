import { describe, expect, it } from "vitest";
import { createBlockfrostReader } from "../src/chain/blockfrost";
import { HttpStatusError } from "../src/errors";
import type { FetchLike } from "../src/http";
import { createMpsClient } from "../src/mps/client";
import { buildSchedule } from "../src/schedule";
import { createCoreClient } from "../src/sokosumi/client";
import collection from "./fixtures/collection-tx-3837cb22.json";
import { paymentJson, recordedTxs } from "./fixtures/mps-payment";

interface Seen {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
  readonly redirect: RequestInit["redirect"];
}

function replying(status: number, body: unknown) {
  const seen: Seen[] = [];
  const fetch: FetchLike = (url, init) => {
    seen.push({
      url,
      method: init.method ?? "GET",
      headers: init.headers as Record<string, string>,
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      redirect: init.redirect,
    });
    return Promise.resolve(
      new Response(body === undefined ? "" : JSON.stringify(body), { status }),
    );
  };
  return { fetch, seen };
}

const schedule = buildSchedule(Date.parse("2026-10-06T02:21:58.062Z"));
const recordedPayment = paymentJson({
  blockchainIdentifier: "00e04c0860a60c61066056281180462d0b120001",
  inputHash: "a".repeat(64),
  schedule,
});

describe("Masumi Payment Service client", () => {
  const baseUrl = "http://127.0.0.1:3012/api/v1";

  it("resolves with history, authenticating with the token header and refusing redirects", async () => {
    const { fetch, seen } = replying(200, { status: "success", data: recordedPayment });
    const mps = createMpsClient({ baseUrl, token: "scoped-runtime-token", fetch });
    const resolved = await mps.resolvePayment("00e04c0860a60c61066056281180462d0b120001");
    expect(resolved.PaymentSource.paymentSourceType).toBe("Web3CardanoV2");
    expect(seen[0]).toMatchObject({
      url: `${baseUrl}/payment/resolve-blockchain-identifier`,
      method: "POST",
      redirect: "error",
      headers: { token: "scoped-runtime-token", "content-type": "application/json" },
      body: {
        network: "Preprod",
        blockchainIdentifier: "00e04c0860a60c61066056281180462d0b120001",
        includeHistory: "true",
      },
    });
    expect(seen[0]?.headers).not.toHaveProperty("API-Key");
  });

  it("surfaces the MPS error message and status", async () => {
    const { fetch } = replying(404, {
      status: "error",
      error: { message: "Payment not found or in invalid state" },
    });
    const mps = createMpsClient({ baseUrl, token: "scoped-runtime-token", fetch });
    const failure = mps.submitResult("bid", "b".repeat(64));
    await expect(failure).rejects.toThrow("HTTP 404: Payment not found or in invalid state");
    await expect(failure).rejects.toBeInstanceOf(HttpStatusError);
  });

  it("rejects a success envelope whose data breaks the payment schema", async () => {
    const { fetch } = replying(200, {
      status: "success",
      data: { ...recordedPayment, onChainState: "Paid" },
    });
    const mps = createMpsClient({ baseUrl, token: "scoped-runtime-token", fetch });
    await expect(mps.resolvePayment("bid")).rejects.toThrow("unexpected shape");
  });
});

describe("Sokosumi Core client", () => {
  const baseUrl = "https://api.preprod.sokosumi.com";
  const apiKey = "coworker_test_runtime_key";

  it("refuses anything but a coworker runtime key", () => {
    expect(() =>
      createCoreClient({ baseUrl, apiKey: "sk_live_x", fetch: replying(200, {}).fetch }),
    ).toThrow("coworker_");
  });

  it("reads the receipt from the data envelope with a bearer key", async () => {
    const receipt = {
      blockchainIdentifier: "bid",
      claimStatus: "PURCHASED",
      onChainState: "Withdrawn",
      settled: true,
      txHash: recordedTxs.collection,
      withdrawnForSeller: [],
    };
    const { fetch, seen } = replying(200, {
      data: receipt,
      meta: { timestamp: "t", requestId: "r" },
    });
    const core = createCoreClient({ baseUrl, apiKey, fetch });
    await expect(core.receipt("task/../x")).resolves.toEqual(receipt);
    expect(seen[0]?.url).toBe(`${baseUrl}/v1/tasks/task%2F..%2Fx/receipt`);
    expect(seen[0]?.headers).toMatchObject({ authorization: `Bearer ${apiKey}` });
  });

  it("scopes the personal Workspace check to the Task owner", async () => {
    const { fetch, seen } = replying(200, { data: { organizationId: null } });
    const core = createCoreClient({ baseUrl, apiKey, fetch });
    await expect(core.confirmPersonalWorkspace("ws-1", "user_owner")).resolves.toBe(true);
    expect(seen[0]?.headers).toMatchObject({ "x-context-user-id": "user_owner" });
  });

  it("keeps the error kind so grant and credit problems are recognisable", async () => {
    const { fetch } = replying(403, {
      error: "Forbidden",
      message: "Vendor grant required",
      kind: "grant_required",
    });
    const core = createCoreClient({ baseUrl, apiKey, fetch });
    await expect(core.postEvent("t", { status: "RUNNING" })).rejects.toMatchObject({
      status: 403,
      kind: "grant_required",
    });
  });

  it("treats a redirect as a failure", async () => {
    const { fetch } = replying(302, undefined);
    const core = createCoreClient({ baseUrl, apiKey, fetch });
    await expect(core.me()).rejects.toThrow("tried to redirect");
  });
});

describe("Blockfrost reader", () => {
  it("sends the project id and parses the recorded utxos", async () => {
    const { fetch, seen } = replying(200, collection.utxos);
    const chain = createBlockfrostReader({
      baseUrl: "https://cardano-preprod.blockfrost.io/api/v0",
      projectId: "preprodTestProject",
      fetch,
    });
    const utxos = await chain.txUtxos(recordedTxs.collection);
    expect(utxos.inputs.filter((input) => input.collateral)).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      url: `https://cardano-preprod.blockfrost.io/api/v0/txs/${recordedTxs.collection}/utxos`,
      headers: { project_id: "preprodTestProject" },
    });
  });
});
