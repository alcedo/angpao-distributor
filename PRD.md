# PRD: Solana Wallet Generator + Phantom SPL Distributor (MVP)

## Summary
Build a client-only web app that lets a user:
1. Generate Solana wallets in-browser.
2. Connect Phantom.
3. Create and mint their own classic SPL token to Phantom on Devnet, Testnet, and Mainnet.
4. Select a token in Phantom and distribute it equally to recipients.
5. Run safely across all clusters with explicit mainnet guardrails.

## Feasibility (Client-Only)
This is feasible in a client-only web app, including minting SPL tokens, because:
- SPL mint creation and token minting are standard on-chain transactions that can be built in frontend JS.
- Phantom can sign and send those transactions from the browser.
- Cluster support exists for Devnet/Testnet/Mainnet.
- Mainnet is possible with real SOL fees/rent paid by the connected wallet.

Implication:
- No backend is required for core minting/distribution workflows.
- User approval/signature remains mandatory for all writes.

## Product Goals
- Enable fast, testable distribution workflows across Solana clusters.
- Keep custody with the user (no backend key handling).
- Make bulk transfer outcomes auditable with downloadable reports.

## Non-Goals (MVP)
- Token-2022 support.
- Server-managed wallets or backend orchestration.
- Advanced allocation strategies beyond equal split.
- Automatic retries.

## Scope Decisions (Locked)
- Architecture: client-only.
- Token standard: classic SPL only.
- Distribution model: equal split.
- Recipient sources: generated wallets + CSV import.
- Max recipients per run: 100.
- Transfer status success level: confirmed.
- Retry policy: manual only.
- Data persistence: session-only unless explicit export.
- Equal-split remainder: stays in source Phantom wallet.
- Run outputs: on-screen summary + CSV report + JSON report.

## Functional Requirements

### 1) Networks + Wallet
- Clusters: `devnet`, `testnet`, `mainnet-beta`.
- Phantom connect/disconnect required for minting/distribution actions.
- All data/actions are cluster-scoped.
- Upon successful Phantom connect, app loads existing classic SPL token holdings for the connected wallet on the selected cluster.
- If Phantom is installed but locked, app must show explicit unlock guidance and block token-dependent actions until unlocked.

### 2) Recipient Management
- Generate wallets client-side and export CSV/JSON.
- Import recipients from CSV.
- Validate addresses and deduplicate recipients before run.

### 3) Token Minting (All 3 Clusters)
- Built-in mint wizard creates a classic SPL mint and mints initial supply to connected Phantom.
- Mint authority remains connected Phantom wallet.
- Mainnet minting requires explicit additional acknowledgement:
  - Real SOL cost.
  - Irreversible on-chain action.

### 4) Distribution
- User selects token from Phantom holdings.
- Token selector is populated from connected wallet SPL holdings and becomes available immediately after Phantom connect.
- Token selector is positioned near Phantom connect controls and shows token display name + balance for each option.
- Token selector attempts to render token logo for each option; if logo cannot be resolved or loaded, app shows a placeholder icon.
- For legacy SPL mints without Metaplex metadata (for example USDC), app must fallback to curated known-token metadata so name/logo still render.
- Token-logo metadata URI fetch must process all discovered eligible tokens (no hard cap that drops tokens from logo resolution).
- User enters total amount; app computes equal split in base units.
- Sequential execution (recipient by recipient).
- Create recipient ATA when missing.
- Mark success at `confirmed`.
- Manual retry supported for failed recipients.

### 5) Mainnet Safety Guardrails
- Distribution requires:
  1. Explicit checklist acknowledgement.
  2. Preflight simulation pass.
- Minting requires dedicated mint-risk acknowledgement (separate from distribution checklist).

### 6) Reporting
- On-screen run summary required.
- Downloadable CSV and JSON required.
- Each result row includes:
  - recipient
  - requested/sent amount
  - status
  - signature (if present)
  - error reason (if failed)
  - timestamp
  - cluster
  - mint

## Public Interfaces / Types
- `Cluster = "devnet" | "testnet" | "mainnet-beta"`
- `GeneratedWallet { id, publicKey, privateKeyBase64, source: "generated" }`
- `ImportedRecipient { id, publicKey, source: "csv" }`
- `Recipient = GeneratedWallet | ImportedRecipient`
- `TokenMintRequest { decimals, initialSupplyUi, name?, symbol? }`
- `DistributionPlan { cluster, mint, totalUiAmount, recipientCount, perRecipientRaw, remainderRaw }`
- `TransferResult { recipient, amountRaw, status, signature?, error?, confirmedAt? }`
- `RunReport { runId, cluster, mint, startedAt, finishedAt, totals, results[] }`

## Validation Rules
- Generated wallet count: 1..100.
- Distribution requires at least 1 valid recipient.
- Distribution amount must be > 0.
- Source balance must cover transfer total plus fees.
- Invalid CSV rows are rejected and shown to user.
- Duplicate recipients are merged by default.

## Test Cases

### Unit
- Equal split math with decimals and remainder.
- CSV parse/validation + dedupe behavior.
- Guardrail gating logic (mainnet checklist + simulation + mint warning).
- Report schema and serialization (CSV/JSON).

### Integration
- Phantom connect/disconnect state changes.
- SPL token inventory is fetched on Phantom connect and rendered in token selector.
- Locked Phantom connect attempts surface unlock guidance.
- Token selector options render token display name + balance and icon fallback behavior.
- Legacy token fallback path (e.g., USDC without Metaplex metadata) renders expected token name/logo.
- Wallets with more than 32 eligible SPL tokens still run metadata URI logo resolution across all discovered tokens.
- Mint wizard flow per cluster.
- Token inventory refresh after mint.
- Sequential transfer flow with mixed outcomes.
- Manual retry for failures.

### End-to-End
- Devnet: generate -> mint -> distribute -> export report.
- Testnet: import CSV recipients -> distribute -> manual retry failure.
- Mainnet: mint and distribution both blocked until required acknowledgements complete.

## Implementation Progress
Legend: `Not Started` | `Scaffolded` | `Partially Complete` | `Complete`

- Networks + Wallet: `Complete`
  - Cluster selection is active for `devnet`, `testnet`, and `mainnet-beta`.
  - Phantom provider detection and connect/disconnect flows are implemented.
  - Cluster connection context is maintained in app state.
  - Connected-wallet SPL holdings load on connect and refresh on cluster change.
  - Locked Phantom connect attempts surface explicit unlock guidance.
- Recipient Management: `Complete`
  - Generated wallet creation and CSV/JSON wallet export are implemented.
  - PRD-aligned generation cap (`1..100`) is implemented.
  - CSV recipient import is implemented with address/publicKey header detection and first-column fallback.
  - Solana address validation and duplicate-recipient merging are implemented for CSV imports.
  - Invalid CSV rows are rejected and shown to user with per-line diagnostics.
  - Unified mixed generated + CSV recipient run-set wiring is implemented with cross-source deduplication.
- Token Minting (All 3 Clusters): `Complete`
  - Mint wizard now creates classic SPL mint + ATA and mints initial supply via connected Phantom.
  - Mainnet minting requires explicit acknowledgement before submission.
- Distribution: `Partially Complete`
  - Distribution token selection from connected-wallet SPL holdings is implemented.
  - Token options render display name + balance with logo/placeholder behavior.
  - Legacy metadata fallback (for example USDC) and full-set metadata URI enrichment are implemented.
  - Equal-split planning, transfer execution, ATA-on-send, and retry flows are not implemented yet.
- Mainnet Safety Guardrails: `Partially Complete`
  - Mainnet mint-risk acknowledgement is implemented for minting.
  - Distribution checklist and preflight simulation gating are not implemented yet.
- Reporting: `Not Started`
  - Run-level reporting/export for distribution outcomes is not implemented yet.

## Acceptance Criteria
1. User can mint their own classic SPL token into Phantom on Devnet/Testnet/Mainnet.
2. Mainnet minting is blocked until explicit mint-risk acknowledgement.
3. User can distribute selected classic SPL token equally to generated/imported recipients.
4. Distribution runs on all three clusters with correct isolation.
5. Results are visible in-app and exportable as CSV/JSON.
6. Private keys are not persisted unless explicitly exported.
7. After Phantom connect, existing wallet SPL tokens are shown near Phantom connect controls and selectable for disbursement to generated/imported recipients.
8. After the user selects an SPL token, that selected token becomes the run’s distribution token and is used for all recipients in the unified run set (both generated wallets and CSV-imported wallets).
9. Token selector options display token name and balance, and each option uses token logo when available or a placeholder icon when logo loading fails.
10. If Phantom is locked, the app clearly instructs the user to unlock Phantom before continuing.
11. Legacy tokens that do not expose Metaplex metadata (such as USDC) still display correct token name/logo via curated metadata fallback.
12. Token-logo metadata URI fetch does not stop at 32 tokens; it processes the full discovered token set for the connected wallet.

## Assumptions
- “User need to have their own tokens” means users can either:
  - bring existing tokens in Phantom, or
  - mint a new token in-app on the selected cluster.
- Mainnet costs are paid by connected Phantom wallet.
