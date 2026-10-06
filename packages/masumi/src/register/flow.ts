import { minuteMs } from "../constants";
import type { Clock } from "../lifecycle/deps";
import type { MpsAdminClient } from "../mps/admin";
import type { MpsRegistryEntry } from "../mps/schemas";
import {
  datumRegistration,
  registrationBody,
  scopedKeyBody,
  scopedKeyProblems,
  supportedSourceIndex,
} from "./body";
import type { SetupFiles, SetupState } from "./state";

export interface RegisterContext {
  readonly admin: MpsAdminClient;
  readonly files: SetupFiles;
  readonly clock: Clock;
  readonly log: (line: string) => void;
}

const pollMs = 15_000;
const registrationTimeoutMs = 30 * minuteMs;
const abandonedStates = new Set(["RegistrationFailed", "DeregistrationConfirmed"]);

function ours(entry: MpsRegistryEntry, state: SetupState): boolean {
  return state.registrationId === null
    ? entry.name === datumRegistration.name &&
        entry.apiBaseUrl === state.apiBaseUrl &&
        entry.SmartContractWallet.walletVkey === state.sellerVkey &&
        !abandonedStates.has(entry.state)
    : entry.id === state.registrationId;
}

async function findOurs(context: RegisterContext, state: SetupState) {
  return (await context.admin.registrations()).find((entry) => ours(entry, state)) ?? null;
}

async function save(context: RegisterContext, state: SetupState): Promise<SetupState> {
  await context.files.save(state);
  return state;
}

export async function ensureRegistration(
  context: RegisterContext,
  initial: SetupState,
): Promise<SetupState> {
  let state = initial;
  let entry = await findOurs(context, state);
  if (entry === null) {
    if (state.registrationRequestedAt !== null) {
      context.log("An earlier registration request left no registry entry; registering again");
    }
    const at = new Date(context.clock.now()).toISOString();
    state = await save(context, { ...state, registrationRequestedAt: at });
    entry = await context.admin.register(
      registrationBody(state.sellerVkey, state.smartContractAddress, state.apiBaseUrl),
    );
    context.log(`Registration ${entry.id} requested`);
  } else {
    context.log(`Registration ${entry.id} already exists in state ${entry.state}`);
  }
  state = await save(context, {
    ...state,
    registrationId: entry.id,
    registrationState: entry.state,
  });
  const deadline = context.clock.now() + registrationTimeoutMs;
  while (entry.state !== "RegistrationConfirmed") {
    if (abandonedStates.has(entry.state)) {
      throw new Error(
        `Registration ${entry.id} ended ${entry.state}: ${entry.error ?? "no error"}`,
      );
    }
    if (context.clock.now() > deadline) {
      throw new Error(`Registration ${entry.id} is still ${entry.state} after 30 min`);
    }
    context.log(`Registration ${entry.id} is ${entry.state}; checking again in 15 s`);
    await context.clock.sleep(pollMs);
    const refreshed = await findOurs(context, state);
    if (refreshed === null) {
      throw new Error(`Registration ${entry.id} disappeared from the registry list`);
    }
    entry = refreshed;
  }
  const index = supportedSourceIndex(entry, state.smartContractAddress);
  if (entry.agentIdentifier === null || index < 0) {
    throw new Error("Confirmed registration lacks an agentIdentifier or the V2 Preprod source");
  }
  if (
    state.registryPolicyId !== null &&
    entry.agentIdentifier.slice(0, 56) !== state.registryPolicyId
  ) {
    throw new Error("agentIdentifier does not start with the payment source registry policy");
  }
  return save(context, {
    ...state,
    registrationState: entry.state,
    registrationTxHash: entry.CurrentTransaction?.txHash ?? null,
    agentIdentifier: entry.agentIdentifier,
    supportedPaymentSourceIndex: index,
  });
}

export async function ensureScopedKey(
  context: RegisterContext,
  initial: SetupState,
): Promise<SetupState> {
  if (initial.apiKeyId !== null && (await context.files.hasRuntimeToken())) {
    context.log(`Scoped runtime key ${initial.apiKeyId} already saved`);
    return initial;
  }
  if (initial.apiKeyRequestedAt !== null) {
    context.log(
      "An earlier key request has no saved token; creating a new key (revoke unused keys in the MPS admin UI)",
    );
  }
  const at = new Date(context.clock.now()).toISOString();
  const state = await save(context, { ...initial, apiKeyRequestedAt: at, apiKeyId: null });
  const key = await context.admin.createApiKey(scopedKeyBody(state.sellingWalletId));
  const problems = scopedKeyProblems(key, state.sellingWalletId);
  if (problems.length > 0) {
    await save(context, { ...state, apiKeyId: key.id });
    throw new Error(`Created key ${key.id} is not usable: ${problems.join("; ")}`);
  }
  await context.files.saveRuntimeToken(key.token);
  context.log(
    `Scoped runtime key ${key.id} created and written to ${context.files.runtimeEnvPath}`,
  );
  return save(context, { ...state, apiKeyId: key.id });
}
