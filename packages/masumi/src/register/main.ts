import { cardanoNetwork, paymentSourceType } from "../constants";
import { loadEnv } from "../env";
import { systemClock } from "../lifecycle/deps";
import { createMpsAdminClient } from "../mps/admin";
import { registerEnvSchema } from "./env";
import { ensureRegistration, ensureScopedKey } from "./flow";
import { setupFiles, type SetupState } from "./state";

const log = (line: string) => {
  process.stdout.write(`[register ${new Date().toISOString()}] ${line}\n`);
};

async function main(): Promise<void> {
  const env = loadEnv(registerEnvSchema, process.env);
  const admin = createMpsAdminClient({
    baseUrl: env.MASUMI_PAYMENT_API_URL,
    token: env.MASUMI_ADMIN_KEY,
    fetch,
  });
  const health = await admin.health();
  if (health.status !== "ok") {
    throw new Error(`Masumi Payment Service health is ${health.status}`);
  }
  const wallet = await admin.sellingWallet(env.MASUMI_SELLING_WALLET_ID);
  if (wallet.walletAddress !== env.MASUMI_SELLER_ADDRESS) {
    throw new Error("MASUMI_SELLING_WALLET_ID does not hold MASUMI_SELLER_ADDRESS");
  }
  if (wallet.collectionAddress !== null) {
    throw new Error(
      "The selling wallet has a collectionAddress; PATCH /wallet with newCollectionAddress:null first",
    );
  }
  const sources = (await admin.paymentSources()).filter(
    (source) => source.network === cardanoNetwork && source.paymentSourceType === paymentSourceType,
  );
  const [source] = sources;
  if (source === undefined || sources.length !== 1) {
    throw new Error(
      `Expected one Preprod ${paymentSourceType} source, found ${String(sources.length)}`,
    );
  }
  const files = setupFiles(env.MASUMI_SETUP_DIR);
  const fresh: SetupState = {
    sellingWalletId: env.MASUMI_SELLING_WALLET_ID,
    sellerAddress: wallet.walletAddress,
    sellerVkey: wallet.walletVkey,
    smartContractAddress: source.smartContractAddress,
    registryPolicyId: source.policyId,
    apiBaseUrl: env.DATUM_AGENT_API_URL,
    registrationRequestedAt: null,
    registrationId: null,
    registrationState: null,
    registrationTxHash: null,
    agentIdentifier: null,
    supportedPaymentSourceIndex: null,
    apiKeyRequestedAt: null,
    apiKeyId: null,
  };
  const saved = await files.load();
  if (
    saved !== null &&
    (saved.sellingWalletId !== fresh.sellingWalletId ||
      saved.sellerVkey !== fresh.sellerVkey ||
      saved.apiBaseUrl !== fresh.apiBaseUrl ||
      saved.smartContractAddress !== fresh.smartContractAddress)
  ) {
    throw new Error(`${files.statePath} belongs to another wallet, source or agent URL`);
  }
  const context = { admin, files, clock: systemClock, log };
  const registered = await ensureRegistration(context, saved ?? fresh);
  const done = await ensureScopedKey(context, registered);
  log(
    `Registration ${done.registrationId ?? ""} confirmed in tx ${done.registrationTxHash ?? "unknown"}`,
  );
  log(`Non-secret setup saved to ${files.statePath}`);
  log("Add these to the Gate 0 environment (MASUMI_PAYMENT_API_KEY is in the runtime env file):");
  log(`  MASUMI_AGENT_IDENTIFIER=${done.agentIdentifier ?? ""}`);
  log(`  MASUMI_SUPPORTED_PAYMENT_SOURCE_INDEX=${String(done.supportedPaymentSourceIndex)}`);
  log(`  MASUMI_SELLER_ADDRESS=${done.sellerAddress}`);
  log(`  contract ${done.smartContractAddress}, seller vkey ${done.sellerVkey}`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `[register] stopped: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
