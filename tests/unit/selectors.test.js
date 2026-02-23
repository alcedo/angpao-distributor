import { describe, expect, it } from "vitest";
import {
  canRunWalletRequiredActions,
  getDistributionGateModel,
  getRunRecipientStats,
  getRunRecipients,
  getSelectedTokenAsset,
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

  it("getRunRecipients merges generated and csv recipients with deduplication", () => {
    const recipients = getRunRecipients({
      generatedWallets: [
        { index: 1, publicAddress: "AddrA" },
        { index: 2, publicAddress: "AddrB" },
      ],
      importedRecipients: [
        { id: "csv-1", publicAddress: "AddrB", source: "csv" },
        { id: "csv-2", publicAddress: "AddrC", source: "csv" },
      ],
    });

    expect(recipients).toEqual([
      { id: "generated-1", publicAddress: "AddrA", source: "generated" },
      { id: "generated-2", publicAddress: "AddrB", source: "generated" },
      { id: "csv-2", publicAddress: "AddrC", source: "csv" },
    ]);
  });

  it("getRunRecipientStats returns counts and duplicate totals", () => {
    const stats = getRunRecipientStats({
      generatedWallets: [
        { index: 1, publicAddress: "AddrA" },
        { index: 2, publicAddress: "AddrA" },
      ],
      importedRecipients: [
        { id: "csv-1", publicAddress: "AddrA", source: "csv" },
        { id: "csv-2", publicAddress: "AddrB", source: "csv" },
      ],
    });

    expect(stats.generatedCount).toBe(2);
    expect(stats.importedCount).toBe(2);
    expect(stats.duplicatesSkipped).toBe(2);
    expect(stats.recipients).toHaveLength(2);
  });

  it("getSelectedTokenAsset returns selected token from inventory", () => {
    const selected = getSelectedTokenAsset({
      tokenInventory: {
        selectedMint: "MintB",
        items: [
          { mint: "MintA", displayName: "Token A" },
          { mint: "MintB", displayName: "Token B" },
        ],
      },
    });

    expect(selected).toEqual({
      mint: "MintB",
      displayName: "Token B",
    });
  });

  it("getDistributionGateModel derives static and start gating flags", () => {
    const gate = getDistributionGateModel({
      distribution: {
        checks: {
          walletConnected: true,
          tokenSelected: true,
          tokenClassicSupported: true,
          recipientsReady: true,
          amountValid: true,
          tokenBalanceSufficient: true,
          feeHeadroomSufficient: true,
          mainnetChecklistAccepted: true,
          preflightPassed: true,
        },
        preflight: {
          status: "passed",
        },
      },
    });

    expect(gate.allStaticChecksPass).toBe(true);
    expect(gate.canRunPreflight).toBe(true);
    expect(gate.canStartDistribution).toBe(true);
    expect(gate.preflightRunning).toBe(false);
  });
});
