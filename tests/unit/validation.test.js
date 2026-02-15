import { describe, expect, it } from "vitest";
import { isValidSolanaAddress, validateWalletCount } from "../../src/domain/validation.js";

describe("validateWalletCount", () => {
  it("accepts integer values from 1 to 100", () => {
    expect(validateWalletCount("1")).toEqual({ ok: true, count: 1 });
    expect(validateWalletCount("100")).toEqual({ ok: true, count: 100 });
  });

  it("rejects out-of-range or non-integer values", () => {
    expect(validateWalletCount("0").ok).toBe(false);
    expect(validateWalletCount("101").ok).toBe(false);
    expect(validateWalletCount("1.2").ok).toBe(false);
    expect(validateWalletCount("abc").ok).toBe(false);
  });
});

describe("isValidSolanaAddress", () => {
  it("accepts valid base58 public keys", () => {
    expect(isValidSolanaAddress("11111111111111111111111111111111")).toBe(true);
    expect(isValidSolanaAddress("So11111111111111111111111111111111111111112")).toBe(true);
  });

  it("rejects invalid addresses", () => {
    expect(isValidSolanaAddress("")).toBe(false);
    expect(isValidSolanaAddress("invalid-key")).toBe(false);
    expect(isValidSolanaAddress("O0O0O0O0O0O0O0")).toBe(false);
  });
});
