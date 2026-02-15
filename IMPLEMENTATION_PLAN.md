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
| Phase 2: Recipient Management (Generated + CSV) | Not Started |
| Phase 3: Token Discovery and Mint Wizard | Not Started |
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

### Completed Artifacts
- `package.json`
- `vite.config.js`
- `src/app.js`
- `src/state/store.js`
- `src/state/selectors.js`
- `src/domain/validation.js`
- `src/domain/exporters.js`
- `src/solana/connection.js`
- `src/solana/phantomProvider.js`
- `src/ui/render.js`
- `src/ui/events.js`
- `index.html`
- `tests/unit/validation.test.js`
- `tests/unit/exporters.test.js`
- `tests/unit/encoding.test.js`
- `tests/unit/connection.test.js`
- `tests/unit/phantomProvider.test.js`
- `tests/unit/selectors.test.js`
- `tests/integration/app.integration.test.js`
- `tests/e2e/smoke.spec.js`
- `README.md`

### Verification Evidence
| Date (UTC) | Command | Result |
| --- | --- | --- |
| 2026-02-15 | `npm install` | Passed (local project dependency install complete) |
| 2026-02-15 | `npm test` | Passed (24 tests across 7 test files) |
| 2026-02-15 | `npm run build` | Passed (Vite production build succeeded) |

## 2) Current State and Gap
Current repo capabilities:
- modular single-page wallet generator (`src/*`, `index.html`, `styles.css`)
- wallet generation + CSV/JSON export
- Vitest unit/integration suites

Major gaps vs PRD:
- no cluster-bound token listing
- no token minting flow
- no distribution engine
- no CSV recipient import
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
1. Load classic SPL token accounts for connected wallet.
2. Implement mint wizard (create mint + ATA + mint supply).
3. Add mainnet mint-risk acknowledgement.
4. Refresh token inventory after mint.

Exit criteria:
- mint flow works on all clusters and refreshes selector.

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
  symbol?: string,
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
```

## 7) Test Strategy

### Coverage Targets
- Unit: >= 90% statements on `src/domain/*`.
- Integration: >= 80% on `src/solana/*` and `src/ui/*`.
- E2E: happy paths + high-risk failure/guardrail paths.

### Mandatory Test Categories
- Unit: validation, split logic, CSV/report serialization.
- Integration: cluster switching, Phantom connect/disconnect, UI state gating.
- E2E: generate -> connect -> mint -> distribute -> export flow.
- Manual QA: real Phantom verification on devnet/mainnet guardrails.

## 8) Definition of Done
Implementation is complete only when:
1. PRD acceptance criteria pass.
2. mandatory automated tests pass in CI.
3. manual QA checks are signed off.
4. no P0/P1 defects remain.
5. setup/test/security docs are updated.
