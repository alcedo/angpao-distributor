import { describe, expect, it } from "vitest";
import {
  canRunWalletRequiredActions,
  isWalletConnected,
} from "../../src/state/selectors.js";

describe("state selectors", () => {
  it("isWalletConnected returns true only when wallet has connection and public key", () => {
    expect(
      isWalletConnected({
        phantom: { isConnected: true, publicKey: "abc" },
      }),
    ).toBe(true);

    expect(
      isWalletConnected({
        phantom: { isConnected: true, publicKey: null },
      }),
    ).toBe(false);
  });

  it("canRunWalletRequiredActions follows wallet connection status", () => {
    expect(
      canRunWalletRequiredActions({
        phantom: { isConnected: false, publicKey: null },
      }),
    ).toBe(false);

    expect(
      canRunWalletRequiredActions({
        phantom: { isConnected: true, publicKey: "abc" },
      }),
    ).toBe(true);
  });
});
