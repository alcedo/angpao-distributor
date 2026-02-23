import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  estimateDistributionHeadroom,
  inspectRecipientAtas,
  runDistributionPreflight,
} from "../../src/solana/distributionService.js";

function createAddresses(count) {
  const onCurveKeys = [
    "FfsfLyRsxuVz4KtanH9tunuYyduvb8ZLTtWqP27yxM8J",
    "5sT8v1h4zXqxNw9RyTRPngbcTszjyKFcXQwXeizoVAeH",
    "2xatZCCzpzvipiT7tpZrjtqTBWyfAsDFvviuAcZ1QEJL",
    "JCQxKRETEADxHPZ7k4xME4pAA6X72vmmQWkzk5dipAbF",
    "9eaRFZmkoBfidF9n9ea32sAJJBEWcGK1vhaPsbLDsU9F",
    "HBqq8jfQbWjcqwpz1bW73Hgv6gJ9zjCCZ8NfTrGkY2si",
  ];
  return onCurveKeys.slice(0, count);
}

describe("distributionService", () => {
  it("inspects recipient ATAs and marks missing vs existing", async () => {
    const [mint, recipientA, recipientB] = createAddresses(3);
    const inspection = await inspectRecipientAtas(
      {
        async getMultipleAccountsInfo() {
          return [{ data: new Uint8Array([1]) }, null];
        },
      },
      mint,
      [{ publicAddress: recipientA }, { publicAddress: recipientB }],
    );

    expect(inspection.entries).toHaveLength(2);
    expect(inspection.entries[0].needsAta).toBe(false);
    expect(inspection.entries[1].needsAta).toBe(true);
    expect(inspection.existingAtaCount).toBe(1);
    expect(inspection.missingAtaCount).toBe(1);
  });

  it("estimates fee headroom using fee + rent + safety buffer", async () => {
    const [owner, mint, recipientA, recipientB] = createAddresses(4);
    let feeCall = 0;
    const estimate = await estimateDistributionHeadroom(
      {
        async getBalance() {
          return 5_000_000;
        },
        async getMinimumBalanceForRentExemption() {
          return 2_039_280;
        },
        async getLatestBlockhash() {
          return {
            blockhash: "5M8Qp6Hf6mCwNtt8wX8FzfdjU8aZfR4s2A9jNq6tFYfV",
            lastValidBlockHeight: 123,
          };
        },
        async getFeeForMessage() {
          feeCall += 1;
          return { value: feeCall === 1 ? 5_000 : 7_000 };
        },
      },
      owner,
      mint,
      1_000n,
      {
        decimals: 6,
        entries: [
          {
            recipient: recipientA,
            recipientAta: PublicKey.unique().toBase58(),
            needsAta: false,
          },
          {
            recipient: recipientB,
            recipientAta: PublicKey.unique().toBase58(),
            needsAta: true,
          },
        ],
      },
    );

    expect(estimate.requiredLamports).toBe(4_051_280);
    expect(estimate.walletLamports).toBe(5_000_000);
    expect(estimate.feeExistingAtaLamports).toBe(5_000);
    expect(estimate.feeMissingAtaLamports).toBe(7_000);
    expect(estimate.ataRentLamportsEach).toBe(2_039_280);
    expect(estimate.missingAtaCount).toBe(1);
    expect(estimate.safetyBufferLamports).toBe(2_000_000);
    expect(estimate.passes).toBe(true);
  });

  it("fails headroom when wallet lamports are insufficient", async () => {
    const [owner, mint, recipient] = createAddresses(3);
    const estimate = await estimateDistributionHeadroom(
      {
        async getBalance() {
          return 10_000;
        },
        async getMinimumBalanceForRentExemption() {
          return 2_039_280;
        },
        async getLatestBlockhash() {
          return {
            blockhash: "5M8Qp6Hf6mCwNtt8wX8FzfdjU8aZfR4s2A9jNq6tFYfV",
            lastValidBlockHeight: 123,
          };
        },
        async getFeeForMessage() {
          return { value: 5_000 };
        },
      },
      owner,
      mint,
      1n,
      {
        decimals: 0,
        entries: [
          {
            recipient,
            recipientAta: PublicKey.unique().toBase58(),
            needsAta: true,
          },
        ],
      },
    );

    expect(estimate.passes).toBe(false);
    expect(estimate.requiredLamports).toBeGreaterThan(estimate.walletLamports);
  });

  it("runs preflight simulation across all recipients", async () => {
    const [owner, mint, recipientA, recipientB] = createAddresses(4);
    const seenInstructionCounts = [];
    const result = await runDistributionPreflight(
      {
        async getLatestBlockhash() {
          return {
            blockhash: "5M8Qp6Hf6mCwNtt8wX8FzfdjU8aZfR4s2A9jNq6tFYfV",
            lastValidBlockHeight: 123,
          };
        },
        async simulateTransaction(tx) {
          seenInstructionCounts.push(tx.instructions.length);
          return { value: { err: null } };
        },
      },
      owner,
      mint,
      1_000n,
      {
        decimals: 6,
        entries: [
          {
            recipient: recipientA,
            recipientAta: PublicKey.unique().toBase58(),
            needsAta: true,
          },
          {
            recipient: recipientB,
            recipientAta: PublicKey.unique().toBase58(),
            needsAta: false,
          },
        ],
      },
    );

    expect(result.passed).toBe(true);
    expect(result.scannedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.failures).toEqual([]);
    expect(seenInstructionCounts).toEqual([2, 1]);
  });

  it("returns preflight failures with recipient and error details", async () => {
    const [owner, mint, recipientA, recipientB] = createAddresses(4);
    let call = 0;
    const result = await runDistributionPreflight(
      {
        async getLatestBlockhash() {
          return {
            blockhash: "5M8Qp6Hf6mCwNtt8wX8FzfdjU8aZfR4s2A9jNq6tFYfV",
            lastValidBlockHeight: 123,
          };
        },
        async simulateTransaction() {
          call += 1;
          if (call === 1) {
            return {
              value: {
                err: { InstructionError: [0, "CustomError"] },
                logs: ["Program log: simulated failure"],
              },
            };
          }
          return { value: { err: null } };
        },
      },
      owner,
      mint,
      1_000n,
      {
        decimals: 6,
        entries: [
          {
            recipient: recipientA,
            recipientAta: PublicKey.unique().toBase58(),
            needsAta: true,
          },
          {
            recipient: recipientB,
            recipientAta: PublicKey.unique().toBase58(),
            needsAta: false,
          },
        ],
      },
    );

    expect(result.passed).toBe(false);
    expect(result.scannedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].recipient).toBe(recipientA);
    expect(result.failures[0].error).toMatch(/CustomError/);
  });
});
