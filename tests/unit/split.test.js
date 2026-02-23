import { describe, expect, it } from "vitest";
import {
  buildEqualSplitPlan,
  formatRawWithDecimals,
} from "../../src/domain/split.js";

describe("split domain", () => {
  it("builds equal split plan with remainder", () => {
    const plan = buildEqualSplitPlan("10", 2, 3);

    expect(plan.totalRaw).toBe(1000n);
    expect(plan.perRecipientRaw).toBe(333n);
    expect(plan.remainderRaw).toBe(1n);
    expect(plan.plannedTransferTotalRaw).toBe(999n);
  });

  it("builds equal split plan with zero remainder", () => {
    const plan = buildEqualSplitPlan("9", 0, 3);

    expect(plan.totalRaw).toBe(9n);
    expect(plan.perRecipientRaw).toBe(3n);
    expect(plan.remainderRaw).toBe(0n);
    expect(plan.plannedTransferTotalRaw).toBe(9n);
  });

  it("rejects amount precision above token decimals", () => {
    expect(() => buildEqualSplitPlan("1.234", 2, 2)).toThrow(
      /exceeds 2 decimal place/,
    );
  });

  it("rejects amount too small for recipient count", () => {
    expect(() => buildEqualSplitPlan("0.000001", 6, 2)).toThrow(
      /too small for the recipient count/i,
    );
  });

  it("rejects invalid recipient counts", () => {
    expect(() => buildEqualSplitPlan("1", 6, 0)).toThrow(/Recipient count/);
  });

  it("formats raw amounts with token decimals", () => {
    expect(formatRawWithDecimals(1000n, 2)).toBe("10");
    expect(formatRawWithDecimals(1005n, 2)).toBe("10.05");
  });
});
