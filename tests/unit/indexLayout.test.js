import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("index layout", () => {
  it("places disbursement token selector near Phantom connect controls", () => {
    const testDir = dirname(fileURLToPath(import.meta.url));
    const workspaceRoot = resolve(testDir, "../..");
    const html = readFileSync(resolve(workspaceRoot, "index.html"), "utf8");

    const phantomConnectIndex = html.indexOf('id="phantom-connect-btn"');
    const tokenSelectIndex = html.indexOf('id="token-mint-select"');
    const recipientsIndex = html.indexOf('id="recipients-csv-input"');

    expect(phantomConnectIndex).toBeGreaterThan(-1);
    expect(tokenSelectIndex).toBeGreaterThan(phantomConnectIndex);
    expect(tokenSelectIndex).toBeLessThan(recipientsIndex);
  });
});
