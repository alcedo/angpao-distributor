# Implementation Plan: Solana Wallet Generator + Phantom SPL Distributor

## 1) Scope and Delivery Objective
Deliver the MVP defined in `PRD.md` as a client-only web app that supports:
- wallet generation and export
- Phantom connect on `devnet`, `testnet`, `mainnet-beta`
- classic SPL token minting on all three clusters
- equal-split token distribution to generated + CSV-imported recipients
- mainnet guardrails
- on-screen + CSV/JSON run reporting

This plan is implementation-ready and includes test coverage requirements mapped to PRD requirements.

## Execution Status (Live)

### Phase Status
| Phase | Status |
| --- | --- |
| Phase 0: Bootstrap and Refactor Foundation | Complete |
| Phase 1: Cluster and Phantom Connectivity | Complete |
| Phase 2: Recipient Management (Generated + CSV) | Complete |
| Phase 3: Token Discovery and Mint Wizard | Partially Complete |
| Phase 4: Distribution Planning and Guardrails | Not Started |
| Phase 5: Sequential Distribution Execution + Manual Retry | Not Started |
| Phase 6: Reporting, Exports, and Final Hardening | Not Started |

### Phase 0 Task Checklist
- [x] Add `package.json` with Vite + Vitest + Playwright + Solana dependencies.
- [x] Convert app into module-based entrypoint under `src/`.
- [x] Preserve wallet generation behavior in modularized code path.
- [x] Wire `index.html` to Vite module entry.
- [x] Add minimal cluster + Phantom scaffold UI/state (disabled placeholders).
- [x] Migrate tests to `tests/unit` and `tests/integration` using Vitest.
- [x] Run and pass `npm test`.
- [x] Run and pass `npm run build`.

### Phase 1 Task Checklist
- [x] Implement cluster switching (`devnet`, `testnet`, `mainnet-beta`).
- [x] Implement Phantom provider detection and connect/disconnect flow.
- [x] Maintain cluster/connection metadata in app state.
- [x] Add wallet connection selectors (`isWalletConnected`, `canRunWalletRequiredActions`).
- [x] Replace legacy `globalThis.solanaWeb3` dependency with imported `Keypair`.
- [x] Add unit tests for connection/provider/selectors modules.
- [x] Add integration tests for cluster switch and Phantom connect/disconnect behavior.
- [x] Run and pass `npm test`.
- [x] Run and pass `npm run build`.

### Phase 2 Task Checklist
- [x] Keep generated wallets flow with cap `1..100`.
- [x] Add CSV import for recipients.
- [x] Validate addresses and deduplicate recipients.
- [x] Surface invalid row diagnostics in UI.
- [x] Combine generated + CSV recipients into one run-ready deduplicated set.
- [x] Add unit tests for CSV parsing and Solana address validation.
- [x] Add integration test for CSV import flow.
- [x] Add unit/integration coverage for mixed generated + CSV run-set dedupe.
- [x] Run and pass `npm test`.
- [x] Run and pass `npm run build`.

### Phase 3 Task Checklist
- [x] Add token inventory state (`idle | loading | ready | error`) and selected mint state.
- [x] On successful Phantom connect, fetch classic SPL token holdings for connected wallet on active cluster.
- [x] If Phantom is locked, show explicit unlock guidance and keep token actions blocked.
- [x] Render token selector states: loading, ready, empty, error.
- [x] Populate disbursement token selector from fetched holdings near Phantom connect controls.
- [x] Render token selector options with token name + balance.
- [x] Render token logo in selector options when available, with placeholder fallback on image load failure.
- [x] Add curated fallback metadata for legacy tokens without Metaplex metadata (e.g., USDC) so token name/logo still resolve.
- [x] Remove hard metadata URI logo-fetch cap; process all discovered eligible tokens with bounded concurrency.
- [x] Clear token inventory + selection on Phantom disconnect.
- [x] Refresh token inventory on cluster change while connected.
- [x] Refresh token inventory after successful mint.
- [ ] Move mint entrypoint from in-panel tabs to topbar `Mint Test Token` workflow button with toggle/back behavior and mutually exclusive panels.
- [x] Add unit tests for token inventory normalization/filtering.
- [x] Add integration tests for connect-triggered token loading and selector rendering.
- [x] Run and pass `npm test`.
- [x] Run and pass `npm run build`.

### Completed Artifacts
- `package.json`
- `vite.config.js`
- `src/app.js`
- `src/state/store.js`
- `src/state/selectors.js`
- `src/domain/csvRecipients.js`
- `src/domain/validation.js`
- `src/domain/exporters.js`
- `src/solana/connection.js`
- `src/solana/phantomProvider.js`
- `src/solana/tokenService.js`
- `src/solana/mintService.js`
- `src/ui/render.js`
- `src/ui/events.js`
- `index.html`
- `tests/unit/validation.test.js`
- `tests/unit/exporters.test.js`
- `tests/unit/encoding.test.js`
- `tests/unit/csvRecipients.test.js`
- `tests/unit/connection.test.js`
- `tests/unit/phantomProvider.test.js`
- `tests/unit/selectors.test.js`
- `tests/unit/tokenService.test.js`
- `tests/unit/mintService.test.js`
- `tests/integration/app.integration.test.js`
- `tests/e2e/smoke.spec.js`
- `README.md`

### Verification Evidence
| Date (UTC) | Command | Result |
| --- | --- | --- |
| 2026-02-15 | `npm install` | Passed (local project dependency install complete) |
| 2026-02-15 | `npm test` | Passed (33 tests across 8 test files) |
| 2026-02-15 | `npm run build` | Passed (Vite production build succeeded) |
| 2026-02-16 | `npm test` | Passed (43 tests across 10 test files, includes token inventory + mint wizard coverage) |
| 2026-02-16 | `npm run build` | Passed (Vite production build succeeded after Phase 3 completion) |
| 2026-02-16 | `npm test` | Passed (50 tests across 11 test files after token selector name/logo + fallback updates) |
| 2026-02-16 | `npm run build` | Passed (Vite production build succeeded after token selector metadata/icon updates) |
| 2026-02-16 | `npm test` | Passed (tokenService coverage includes USDC legacy fallback + >32-token logo-fetch scenario) |

## 2) Current State and Gap
Current repo capabilities:
- modular single-page wallet generator (`src/*`, `index.html`, `styles.css`)
- wallet generation + CSV/JSON export
- CSV recipient import with address validation, deduplication, and invalid-row diagnostics
- Phantom connect/disconnect with cluster-aware context (`devnet`, `testnet`, `mainnet-beta`)
- connected-wallet classic SPL token inventory loading with token selector display metadata
- classic SPL mint wizard (create mint + owner ATA + initial supply mint), including mainnet acknowledgement gating
- mint workflow separation scaffolding exists, but mint entrypoint UX is still panel-tab oriented instead of topbar workflow oriented
- Vitest unit/integration suites

Major gaps vs PRD:
- mint entrypoint must be moved from in-panel tab UX to topbar workflow button UX (`Mint Test Token` / `Back to Wallet Generator`)
- no distribution engine
- no mainnet guardrail workflows for distribution
- no transfer run reports

## 3) Technical Decisions (Locked)
- Architecture: client-only, no backend.
- Frontend stack: vanilla JS modules with Vite.
- Solana libs:
  - `@solana/web3.js`
  - `@solana/spl-token`
- Testing stack:
  - unit + integration: Vitest (`jsdom`)
  - e2e: Playwright
- Wallet adapter: direct Phantom provider (`window.phantom.solana`).
- State management: lightweight in-memory store.
- Persistence: in-memory only unless explicit export.
- Confirmation policy: `confirmed`.
- Distribution execution: sequential, manual retries only.
- UI workflow mode: single-page two-mode UX with default `wallet-disbursement`; topbar `Mint Test Token` button toggles to `mint-test-token` mode and back.
- Token inventory fetch triggers: Phantom connect success, cluster change (when connected), mint success.
- Token inventory scope: strict to `{cluster, connectedWalletPublicKey}`.
- Inventory display set: classic SPL holdings with `balanceRaw > 0`.
- Selector default: auto-select only when exactly one token exists; otherwise require explicit user selection.
- Metadata policy (MVP): derive token display metadata from on-chain token metadata accounts + metadata URI payload when available; fallback to curated known-token metadata (e.g., USDC) when Metaplex metadata is missing; otherwise fallback to shortened mint + placeholder icon.
- Metadata URI fetch policy: no hard token-count cap; fetch all discovered eligible token metadata URIs with bounded concurrency to avoid UI starvation on larger wallets.

## 4) Target Project Structure
```
src/
  app.js
  state/
    store.js
    selectors.js
  ui/
    render.js
    events.js
    sections/
      clusterPanel.js
      phantomPanel.js
      recipientsPanel.js
      mintPanel.js
      distributionPanel.js
      reportPanel.js
  domain/
    types.js
    validation.js
    split.js
    csvRecipients.js
    reportSerializer.js
  solana/
    connection.js
    phantomProvider.js
    tokenService.js
    mintService.js
    distributionService.js
    transactionStatus.js
tests/
  unit/
  integration/
  e2e/
```

## 5) Execution Plan by Phase

### Phase 0: Bootstrap and Refactor Foundation
Tasks:
1. Add toolchain and dependencies.
2. Convert legacy app to module entry under `src/`.
3. Preserve wallet generation/export behavior.
4. Add disabled cluster/Phantom scaffold UI.

Exit criteria:
- `npm test` and `npm run build` pass.
- parity behavior maintained for generation/export features.

### Phase 1: Cluster and Phantom Connectivity
Tasks:
1. Implement cluster switching (`devnet`, `testnet`, `mainnet-beta`).
2. Implement Phantom connect/disconnect.
3. Maintain connection metadata in app state.
4. Gate wallet-required actions based on connection state.

Exit criteria:
- user can connect/disconnect Phantom.
- cluster switch updates active connection context.

### Phase 2: Recipient Management (Generated + CSV)
Tasks:
1. Keep generated wallets flow with cap `1..100`.
2. Add CSV import for recipients.
3. Validate addresses and deduplicate recipients.
4. Surface invalid row diagnostics in UI.

Exit criteria:
- mixed generated + CSV recipient run set works.

### Phase 3: Token Discovery and Mint Wizard
Tasks:
1. Fetch classic SPL token holdings immediately after Phantom connect.
2. Store inventory in app state with loading/error semantics.
3. Render token selector for distribution from wallet holdings near Phantom connect controls.
4. Render each token option with token name + balance and logo/placeholder icon handling.
5. Implement mint wizard (create mint + ATA + mint supply).
6. Refresh token inventory on mint success and cluster change while connected.
7. Clear token inventory on disconnect.
8. Surface explicit Phantom unlock guidance when connect fails due locked wallet.
9. Add curated fallback token metadata for legacy mints lacking Metaplex metadata.
10. Ensure metadata URI logo enrichment runs across full discovered token set (no fixed 32-token cutoff).
11. Move `Mint Test Token` entrypoint to top header controls and treat minting as a separate workflow mode.
12. Implement topbar workflow toggle label behavior: `Mint Test Token` -> `Back to Wallet Generator`.
13. Keep wallet/disbursement and mint panels mutually exclusive while preserving in-memory mint form/state across toggles.

Exit criteria:
- Connecting Phantom populates token selector with existing SPL holdings for the selected cluster.
- Token selector updates correctly on cluster switch and after mint.
- Token selector shows token name + balance and icon fallback behavior for every option.
- Locked Phantom state is surfaced with clear unlock guidance.
- Legacy tokens without Metaplex metadata (USDC class) still show stable name/logo via fallback metadata.
- Wallets with >32 eligible tokens still get metadata URI logo enrichment across the full set.
- Disconnect clears token selection/inventory.
- Mint flow works on all clusters and refreshes selector.
- Topbar workflow toggle switches between wallet/disbursement and mint views with correct button label state.
- Workflow switch does not regress mint submission, mint acknowledgement, or token inventory behavior.

### Phase 4: Distribution Planning and Guardrails
Tasks:
1. Add equal-split planning in raw units.
2. Handle remainder in source wallet.
3. Validate source balance and fee headroom.
4. Add mainnet distribution checklist + preflight simulation.

Exit criteria:
- run start blocked until all validations and guardrails pass.

### Phase 5: Sequential Distribution Execution + Manual Retry
Tasks:
1. Sequential transfer executor with ATA creation when needed.
2. Record per-recipient success/failure/signature/error/timestamp.
3. Manual retry for failed recipients.

Exit criteria:
- partial failures handled without aborting entire run.

### Phase 6: Reporting, Exports, and Final Hardening
Tasks:
1. On-screen run summary totals.
2. CSV + JSON run report export.
3. Security hardening and UX warnings.
4. Accessibility pass.

Exit criteria:
- all PRD acceptance criteria met.

## 6) Data Contracts (Implementation-Level)

```js
export const CLUSTERS = ["devnet", "testnet", "mainnet-beta"];

export type Recipient = {
  id: string,
  publicKey: string,
  source: "generated" | "csv",
  privateKeyBase64?: string,
};

export type TokenAsset = {
  mint: string,
  decimals: number,
  balanceRaw: bigint,
  balanceUi: string,
  name?: string,
  symbol?: string,
  displayName: string,
  logoUrl?: string,
};

export type TokenInventoryState = {
  status: "idle" | "loading" | "ready" | "error",
  items: TokenAsset[],
  selectedMint: string | null,
  loadedFor: { cluster: "devnet" | "testnet" | "mainnet-beta", owner: string } | null,
  error?: string,
};

export type AppState = {
  // existing fields...
  activeWorkflow: "wallet-disbursement" | "mint-test-token",
  tokenInventory: TokenInventoryState,
};

export type DistributionPlan = {
  cluster: "devnet" | "testnet" | "mainnet-beta",
  mint: string,
  totalRaw: bigint,
  recipientCount: number,
  perRecipientRaw: bigint,
  remainderRaw: bigint,
};

export type TransferResult = {
  recipient: string,
  amountRaw: bigint,
  status: "success" | "failed",
  signature?: string,
  error?: string,
  confirmedAt?: string,
};

export async function listWalletTokenAssets(connection, ownerPublicKey) {
  // Contract: returns Promise<TokenAsset[]> in deterministic order for stable UI/tests.
}
```

UI workflow contracts:
- `tool-tab-mint-test-token`: topbar workflow toggle button (not a panel-local tab).
- `tool-panel-wallet-generator` and `tool-panel-mint-test-token`: mutually exclusive content panels controlled by `activeWorkflow`.

## 7) Test Strategy

### Coverage Targets
- Unit: >= 90% statements on `src/domain/*`.
- Integration: >= 80% on `src/solana/*` and `src/ui/*`.
- E2E: happy paths + high-risk failure/guardrail paths.

### Mandatory Test Categories
- Unit: validation, split logic, CSV/report serialization.
- Integration: cluster switching, Phantom connect/disconnect, connect-triggered SPL inventory fetch, selector render states, cluster-scoped refresh.
- E2E: generate -> connect -> mint -> distribute -> export flow.
- Manual QA: real Phantom verification on devnet/mainnet guardrails.
- Integration: connect success -> `loading` -> `ready` inventory state transition.
- Integration: token selector shows fetched tokens after connect.
- Integration: token selector option rows show token name + balance and icon/placeholder rendering.
- Unit: legacy-token fallback metadata path returns expected name/logo for USDC-style mints without Metaplex metadata.
- Unit: metadata URI fetch path covers >32 discovered tokens (no hard cap regression).
- Integration: connect with no token holdings shows empty-state guidance.
- Integration: cluster switch while connected reloads inventory for new cluster.
- Integration: disconnect clears inventory and disables token selector.
- Integration: locked Phantom connect error shows unlock guidance.
- Integration: initial workflow defaults to wallet/disbursement panel with mint panel hidden.
- Integration: topbar button toggles view and button label (`Mint Test Token` <-> `Back to Wallet Generator`).
- Integration: switching workflows preserves mint form values and mint status content.
- Integration: token selector behavior and availability in wallet/disbursement workflow remains unchanged after workflow toggles.
- Unit: token inventory normalization (group/filter/sort) returns deterministic selector data.

## 8) Definition of Done
Implementation is complete only when:
1. PRD acceptance criteria pass.
2. mandatory automated tests pass in CI.
3. manual QA checks are signed off.
4. no P0/P1 defects remain.
5. setup/test/security docs are updated.
6. On Phantom connect, existing SPL tokens are shown and selectable for disbursement (cluster-scoped), with name + balance labels and icon placeholder fallback near Phantom controls, including legacy-token fallback metadata and >32-token logo-enrichment coverage.
7. Mint and wallet/disbursement workflows are visually distinct and navigated by topbar workflow control (`Mint Test Token` / `Back to Wallet Generator`).
