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

  it("places mint test token workflow button in the topbar controls", () => {
    const testDir = dirname(fileURLToPath(import.meta.url));
    const workspaceRoot = resolve(testDir, "../..");
    const html = readFileSync(resolve(workspaceRoot, "index.html"), "utf8");

    const topbarControlsIndex = html.indexOf('class="topbar-controls"');
    const phantomConnectIndex = html.indexOf('id="phantom-connect-btn"');
    const mintWorkflowButtonIndex = html.indexOf('id="tool-tab-mint-test-token"');
    const oldWalletTabIndex = html.indexOf('id="tool-tab-wallet-generator"');

    expect(topbarControlsIndex).toBeGreaterThan(-1);
    expect(phantomConnectIndex).toBeGreaterThan(topbarControlsIndex);
    expect(mintWorkflowButtonIndex).toBeGreaterThan(phantomConnectIndex);
    expect(oldWalletTabIndex).toBe(-1);
  });
});
