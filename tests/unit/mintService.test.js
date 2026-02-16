import { describe, expect, it } from "vitest";
import {
  mintClassicSplTokenToOwner,
  normalizeMintDecimals,
  parseUiTokenAmount,
} from "../../src/solana/mintService.js";

describe("mintService", () => {
  it("normalizes mint decimals in range 0..9", () => {
    expect(normalizeMintDecimals("0")).toBe(0);
    expect(normalizeMintDecimals("9")).toBe(9);
    expect(() => normalizeMintDecimals("-1")).toThrow(/between 0 and 9/);
    expect(() => normalizeMintDecimals("10")).toThrow(/between 0 and 9/);
    expect(() => normalizeMintDecimals("1.5")).toThrow(/between 0 and 9/);
  });

  it("parses UI token amount to raw bigint with decimals", () => {
    expect(parseUiTokenAmount("1", 6)).toBe(1000000n);
    expect(parseUiTokenAmount("1.25", 6)).toBe(1250000n);
    expect(parseUiTokenAmount("0.000001", 6)).toBe(1n);
    expect(() => parseUiTokenAmount("0", 6)).toThrow(/greater than zero/);
    expect(() => parseUiTokenAmount("1.234", 2)).toThrow(/exceeds 2 decimal place/);
  });

  it("throws clear input errors before any transaction work starts", async () => {
    await expect(
      mintClassicSplTokenToOwner({
        connection: null,
        provider: null,
        ownerPublicKey: null,
        decimals: 6,
        initialSupplyUi: "1000",
      }),
    ).rejects.toThrow(/Missing Solana connection/);

    await expect(
      mintClassicSplTokenToOwner({
        connection: {},
        provider: null,
        ownerPublicKey: "11111111111111111111111111111111",
        decimals: 6,
        initialSupplyUi: "1000",
      }),
    ).rejects.toThrow(/Phantom wallet is not ready/);
  });
});
