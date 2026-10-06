import { tusdmUnit } from "../../src/constants";
import { mpsPaymentSchema, type MpsPayment, type OnChainState } from "../../src/mps/schemas";
import type { PaymentSchedule } from "../../src/schedule";

export const recordedSeller = {
  agentIdentifier:
    "67ab0c92c4ac1610895a1c965ee50aba41a8f1513b15240723b3bd0b1046fff6458c9e53d82cea71877fbaf7cc4619be8a516a2657c1ae9b81000000",
  registryPolicyId: "67ab0c92c4ac1610895a1c965ee50aba41a8f1513b15240723b3bd0b",
  sellerVkey: "500bd050898ba80e1cd68be6a999ce919f07252184f0a87f167a8192",
  sellerAddress:
    "addr_test1qpgqh5zs3x96srsu6697d2vee6ge7pe9yxz0p2rlzeagryhjd8j8edvxlfg33fy0f8qjz8dcjx2kw22kt935d9u2kp6qlq9e6y",
  smartContractAddress: "addr_test1wzs4e6wc95hkwezlccjw9mdvq0r0rsgx6zk34avptga3ftgn37w4g",
  walletId: "cmuw0yy7w0009zcvbzcjwnn33",
  sourceId: "cmuw0yy7t0004zcvbk96rybns",
} as const;

export const recordedTxs = {
  escrow: "266a9de6b45200a3084d98173e76013289100217ac0de5b69c28c4095b5197e3",
  result: "b96438fd7fc871c8c808a46cc0a289feedc636a29bb374a52d5363af2c3c09cc",
  collection: "3837cb22152da57006f419ed67c1484da7b1b4b11388d11ccac32168497eaef0",
} as const;

export interface FixtureTransaction {
  readonly txHash: string;
  readonly previous: OnChainState | null;
  readonly next: OnChainState;
}

export interface PaymentFixture {
  readonly blockchainIdentifier: string;
  readonly inputHash: string;
  readonly schedule: PaymentSchedule;
  readonly onChainState?: OnChainState | null;
  readonly requestedAction?: MpsPayment["NextAction"]["requestedAction"];
  readonly nextActionResultHash?: string | null;
  readonly resultHash?: string;
  readonly transactions?: readonly FixtureTransaction[];
  readonly overrides?: Record<string, unknown>;
}

const stamp = "2026-10-06T02:21:58.000Z";

function transaction(fixture: FixtureTransaction, index: number) {
  return {
    id: `tx${String(index)}`,
    createdAt: stamp,
    updatedAt: stamp,
    txHash: fixture.txHash,
    layer: "L1",
    hydraHeadId: null,
    status: "Confirmed",
    fees: "673627",
    blockHeight: 5259041,
    blockTime: 1791256137,
    previousOnChainState: fixture.previous,
    newOnChainState: fixture.next,
    confirmations: 3,
  };
}

export function paymentJson(fixture: PaymentFixture): Record<string, unknown> {
  const history = (fixture.transactions ?? []).map(transaction);
  const settled = fixture.onChainState === "Withdrawn";
  return {
    id: "cmuwpay0000000000000000001",
    createdAt: stamp,
    updatedAt: stamp,
    blockchainIdentifier: fixture.blockchainIdentifier,
    agentIdentifier: recordedSeller.agentIdentifier,
    agentName: "Datum",
    pricingType: "Dynamic",
    lastCheckedAt: null,
    payByTime: String(fixture.schedule.payByTime),
    submitResultTime: String(fixture.schedule.submitResultTime),
    unlockTime: String(fixture.schedule.unlockTime),
    collateralReturnLovelace: null,
    buyerReturnAddress: null,
    sellerReturnAddress: null,
    externalDisputeUnlockTime: String(fixture.schedule.externalDisputeUnlockTime),
    requestedById: "cmuw15kk30000b9vbuwdgob1d",
    resultHash: fixture.resultHash ?? "",
    nextActionLastChangedAt: stamp,
    onChainStateOrResultLastChangedAt: stamp,
    nextActionOrOnChainStateOrResultLastChangedAt: stamp,
    inputHash: fixture.inputHash,
    totalBuyerCardanoFees: 0,
    totalSellerCardanoFees: 0,
    cooldownTime: 0,
    cooldownTimeOtherParty: 0,
    onChainState: fixture.onChainState ?? null,
    forceLayer: null,
    NextAction: {
      requestedAction: fixture.requestedAction ?? "WaitingForExternalAction",
      errorType: null,
      errorNote: null,
      resultHash: fixture.nextActionResultHash ?? null,
    },
    ActionHistory: [],
    CurrentTransaction: history.at(-1) ?? null,
    TransactionHistory: history,
    RequestedFunds: [{ amount: "1000000", unit: tusdmUnit }],
    WithdrawnForSeller: settled ? [{ amount: "1000000", unit: tusdmUnit }] : [],
    WithdrawnForBuyer: [],
    PaymentSource: {
      id: recordedSeller.sourceId,
      network: "Preprod",
      paymentSourceType: "Web3CardanoV2",
      smartContractAddress: recordedSeller.smartContractAddress,
      policyId: recordedSeller.registryPolicyId,
    },
    BuyerWallet: null,
    SmartContractWallet: {
      id: recordedSeller.walletId,
      walletVkey: recordedSeller.sellerVkey,
      walletAddress: recordedSeller.sellerAddress,
    },
    metadata: '{"taskId":"01a10ef7-d2cf-73d8-b084-47898de89fce"}',
    ...fixture.overrides,
  };
}

export function payment(fixture: PaymentFixture): MpsPayment {
  return mpsPaymentSchema.parse(paymentJson(fixture));
}
