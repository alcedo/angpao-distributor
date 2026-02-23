import { test, expect } from "@playwright/test";

test.describe("Smoke test – wallet generation happy path", () => {
  test("page loads, generates 2 wallets, and populates the table", async ({ page }) => {
    await page.goto("/");

    // Page loads with expected title and ready state
    await expect(page).toHaveTitle("Solana Wallet Batch Generator");
    await expect(page.locator("#status")).toHaveText("Ready.");

    // Default UI state: empty table, controls disabled
    await expect(page.locator("#wallet-table-body")).toContainText("No wallets generated yet.");
    await expect(page.locator("#count-badge")).toHaveText("0 wallets");
    await expect(page.locator("#clear-btn")).toBeDisabled();
    await expect(page.locator("#toggle-keys-btn")).toBeDisabled();
    await expect(page.locator("#download-csv-btn")).toBeDisabled();
    await expect(page.locator("#download-json-btn")).toBeDisabled();

    // Default cluster is devnet
    await expect(page.locator("#cluster-select")).toHaveValue("devnet");

    // Mint panel is hidden, wallet panel is visible
    await expect(page.locator("#tool-panel-wallet-generator")).not.toBeHidden();
    await expect(page.locator("#tool-panel-mint-test-token")).toBeHidden();

    // Set wallet count to 2 and generate
    const walletCountInput = page.locator("#wallet-count");
    await walletCountInput.fill("2");
    await page.locator("#generate-btn").click();

    // Table populates with 2 rows (not counting header)
    const rows = page.locator("#wallet-table-body tr");
    await expect(rows).toHaveCount(2);

    // Each row has 3 cells: index, public address, private key
    const firstRowCells = rows.nth(0).locator("td");
    await expect(firstRowCells).toHaveCount(3);
    await expect(firstRowCells.nth(0)).toHaveText("1");

    const secondRowCells = rows.nth(1).locator("td");
    await expect(secondRowCells).toHaveCount(3);
    await expect(secondRowCells.nth(0)).toHaveText("2");

    // Badge updates
    await expect(page.locator("#count-badge")).toHaveText("2 wallets");

    // Controls become enabled after generation
    await expect(page.locator("#clear-btn")).toBeEnabled();
    await expect(page.locator("#toggle-keys-btn")).toBeEnabled();
    await expect(page.locator("#download-csv-btn")).toBeEnabled();
    await expect(page.locator("#download-json-btn")).toBeEnabled();

    // Private keys are masked by default
    const privateKeyCells = page.locator("#wallet-table-body td:nth-child(3)");
    await expect(privateKeyCells.nth(0)).toHaveClass(/masked/);

    // Reveal private keys
    await page.locator("#toggle-keys-btn").click();
    await expect(privateKeyCells.nth(0)).not.toHaveClass(/masked/);
    await expect(page.locator("#toggle-keys-btn")).toHaveText("Hide private keys");

    // Hide them again
    await page.locator("#toggle-keys-btn").click();
    await expect(privateKeyCells.nth(0)).toHaveClass(/masked/);
    await expect(page.locator("#toggle-keys-btn")).toHaveText("Reveal private keys");

    // Clear resets everything
    await page.locator("#clear-btn").click();
    await expect(page.locator("#wallet-table-body")).toContainText("No wallets generated yet.");
    await expect(page.locator("#count-badge")).toHaveText("0 wallets");
    await expect(page.locator("#clear-btn")).toBeDisabled();

    // Status reflects clear action
    await expect(page.locator("#status")).toContainText("Cleared");
  });

  test("workflow toggle switches between wallet and mint panels", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#status")).toHaveText("Ready.");

    const toggleBtn = page.locator("#tool-tab-mint-test-token");

    // Initial state: wallet panel visible, mint hidden
    await expect(page.locator("#tool-panel-wallet-generator")).not.toBeHidden();
    await expect(page.locator("#tool-panel-mint-test-token")).toBeHidden();
    await expect(toggleBtn).toHaveText("Mint Test Token");

    // Toggle to mint workflow
    await toggleBtn.click();
    await expect(page.locator("#tool-panel-wallet-generator")).toBeHidden();
    await expect(page.locator("#tool-panel-mint-test-token")).not.toBeHidden();
    await expect(toggleBtn).toHaveText("Back to Wallet Generator");

    // Toggle back
    await toggleBtn.click();
    await expect(page.locator("#tool-panel-wallet-generator")).not.toBeHidden();
    await expect(page.locator("#tool-panel-mint-test-token")).toBeHidden();
    await expect(toggleBtn).toHaveText("Mint Test Token");
  });

  test("cluster selector changes active cluster", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#status")).toHaveText("Ready.");

    // Default is devnet
    await expect(page.locator("#cluster-select")).toHaveValue("devnet");

    // Switch to testnet
    await page.locator("#cluster-select").selectOption("testnet");
    await expect(page.locator("#cluster-select")).toHaveValue("testnet");
    await expect(page.locator("#status")).toContainText("testnet");

    // Switch to mainnet-beta
    await page.locator("#cluster-select").selectOption("mainnet-beta");
    await expect(page.locator("#cluster-select")).toHaveValue("mainnet-beta");
    await expect(page.locator("#status")).toContainText("mainnet-beta");
  });

  test("distribution planner controls are present and guarded before prerequisites", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator("#distribution-total-amount")).toBeVisible();
    await expect(page.locator("#distribution-plan-status")).toContainText("Connect Phantom");
    await expect(page.locator("#distribution-preflight-btn")).toBeDisabled();
    await expect(page.locator("#distribution-start-btn")).toBeDisabled();

    await page.locator("#cluster-select").selectOption("mainnet-beta");
    await expect(page.locator("#distribution-mainnet-checklist")).not.toBeHidden();
    await expect(page.locator("#distribution-mainnet-ack-fees")).toBeDisabled();
    await expect(page.locator("#distribution-mainnet-ack-irreversible")).toBeDisabled();

    await page.locator("#cluster-select").selectOption("devnet");
    await expect(page.locator("#distribution-mainnet-checklist")).toBeHidden();
  });
});
