import { describe, expect, it } from "vitest";
import {
  connectPhantom,
  disconnectPhantom,
  getPhantomProvider,
} from "../../src/solana/phantomProvider.js";

describe("phantom provider helpers", () => {
  it("returns null when provider is absent", () => {
    expect(getPhantomProvider({})).toBeNull();
  });

  it("returns provider when phantom is present", () => {
    const provider = { isPhantom: true };
    expect(getPhantomProvider({ phantom: { solana: provider } })).toBe(provider);
  });

  it("connectPhantom returns the connected public key", async () => {
    const provider = {
      isPhantom: true,
      async connect() {
        return { publicKey: { toString: () => "mock-public-key" } };
      },
    };

    await expect(connectPhantom(provider)).resolves.toEqual({
      publicKey: "mock-public-key",
    });
  });

  it("disconnectPhantom calls provider disconnect when available", async () => {
    let called = false;
    const provider = {
      async disconnect() {
        called = true;
      },
    };

    await disconnectPhantom(provider);
    expect(called).toBe(true);
  });
});
