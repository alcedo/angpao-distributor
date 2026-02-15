import { describe, expect, it } from "vitest";
import { validateWalletCount } from "../../src/domain/validation.js";

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
