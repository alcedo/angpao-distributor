import { describe, expect, it } from "vitest";
import {
  csvEscape,
  serializeWalletsCsv,
  serializeWalletsJson,
} from "../../src/domain/exporters.js";

describe("exporters", () => {
  it("escapes CSV values with quotes", () => {
    expect(csvEscape('a"b')).toBe('"a""b"');
  });

  it("serializes wallets to CSV", () => {
    const csv = serializeWalletsCsv([
      { index: 1, publicAddress: "pub-1", privateKeyBase64: "pri-1" },
    ]);

    expect(csv).toContain("index,publicAddress,privateKeyBase64");
    expect(csv).toContain('1,"pub-1","pri-1"');
  });

  it("serializes wallets to JSON", () => {
    const json = serializeWalletsJson([
      { index: 1, publicAddress: "pub-1", privateKeyBase64: "pri-1" },
    ]);
    const parsed = JSON.parse(json);

    expect(parsed).toEqual([
      { index: 1, publicAddress: "pub-1", privateKeyBase64: "pri-1" },
    ]);
  });
});
