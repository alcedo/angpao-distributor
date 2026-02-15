import { describe, expect, it } from "vitest";
import {
  createConnectionContext,
  createSolanaConnection,
  resolveClusterEndpoint,
} from "../../src/solana/connection.js";

describe("solana connection helpers", () => {
  it("resolves endpoints for supported clusters", () => {
    expect(resolveClusterEndpoint("devnet")).toContain("devnet");
    expect(resolveClusterEndpoint("testnet")).toContain("testnet");
    expect(resolveClusterEndpoint("mainnet-beta")).toContain("mainnet");
  });

  it("throws for unsupported clusters", () => {
    expect(() => resolveClusterEndpoint("localnet")).toThrow(/Unsupported Solana cluster/);
  });

  it("creates connection using injected factory", () => {
    const connection = createSolanaConnection("devnet", {
      connectionFactory(endpoint, commitment) {
        return { endpoint, commitment };
      },
    });

    expect(connection.endpoint).toContain("devnet");
    expect(connection.commitment).toBe("confirmed");
  });

  it("builds connection context metadata", () => {
    const context = createConnectionContext("testnet", {
      connectionFactory(endpoint, commitment) {
        return { endpoint, commitment };
      },
    });

    expect(context.cluster).toBe("testnet");
    expect(context.endpoint).toContain("testnet");
    expect(context.connection.commitment).toBe("confirmed");
  });
});
