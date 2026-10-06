import { describe, expect, it } from "vitest";
import {
  assertAsciiSafeResult,
  canonicalJson,
  isAsciiSafeResult,
  mip004ResultHash,
  newPurchaserNonce,
  sokosumiResultHash,
  taskInputHash,
} from "../src/hash";

const vectorNonce = "01234567890123456789";
const vectorResult = 'line\n"next"\\end';

describe("result hashes", () => {
  it("matches the Sokosumi escaped-result vector", () => {
    expect(sokosumiResultHash(vectorResult, vectorNonce)).toBe(
      "36767ae2635033ebfa81d977b51a72b9d9ea541c73c9c7e6f55302543ba97db3",
    );
  });

  it("matches the MIP-004 raw-result vector", () => {
    expect(mip004ResultHash(vectorResult, vectorNonce)).toBe(
      "7274791448dbdd3200d56594716830eec96cc7e4929e90a1f5d005dbbd3c1dcd",
    );
  });

  it("gives one hash under both rules once the result is ASCII-safe", () => {
    const result = "Datum completed Sokosumi Task 01a10ef7-d2cf-73d8-b084-47898de89fce.";
    const nonce = "0123456789abcdef0123";
    expect(sokosumiResultHash(result, nonce)).toBe(
      "4af6aba6ee9c1664799b5d5347188c299bcc41cc35f1837da9a7f722bd9a874e",
    );
    expect(mip004ResultHash(result, nonce)).toBe(sokosumiResultHash(result, nonce));
  });

  it.each(["", "0123", "0123456789abcdef012", "0123456789ABCDEF0123", "z".repeat(20)])(
    "refuses nonce %j",
    (nonce) => {
      expect(() => sokosumiResultHash("x", nonce)).toThrow(RangeError);
    },
  );

  it("draws fresh 20-hex nonces", () => {
    const nonce = newPurchaserNonce();
    expect(nonce).toMatch(/^[0-9a-f]{20}$/);
    expect(newPurchaserNonce()).not.toBe(nonce);
  });
});

describe("canonical input hash", () => {
  it("canonicalizes like RFC 8785", () => {
    expect(
      canonicalJson({
        numbers: [333333333.3333333, 1e30, 4.5, 0.002, 1e-27],
        literals: [null, true, false],
      }),
    ).toBe('{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27]}');
  });

  it("hashes nonce;JCS({taskId,name,description}) with sorted keys", () => {
    const nonce = "0123456789abcdef0123";
    const taskId = "01a10ef7-d2cf-73d8-b084-47898de89fce";
    expect(taskInputHash({ taskId, name: "Gate 0 rehearsal", description: null }, nonce)).toBe(
      "8cb9b36f8aac9db1e805813979cba5ae31114571ddc2485686b5e403fa5213a8",
    );
    expect(
      taskInputHash(
        { description: "Reply with one sentence.", name: "Gate 0 rehearsal", taskId },
        nonce,
      ),
    ).toBe("d640d061649380c58832218dd964c7d1e62855e7c95d1385714f83f444000a1e");
  });
});

describe("ASCII-safe result guard", () => {
  it("accepts printable ASCII", () => {
    expect(isAsciiSafeResult("Datum: 4/4 spots live, input hash 0a1b.")).toBe(true);
  });

  it.each(['say "hi"', "back\\slash", "two\nlines", "tab\there", "café", "", "bell\u0007"])(
    "rejects %j",
    (result) => {
      expect(() => {
        assertAsciiSafeResult(result);
      }).toThrow(RangeError);
    },
  );
});
