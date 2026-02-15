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

- Networks + Wallet: `Partially Complete`
  - Cluster selection is active for `devnet`, `testnet`, and `mainnet-beta`.
  - Phantom provider detection and connect/disconnect flows are implemented.
  - Cluster connection context is maintained in app state.
  - Mint/distribution actions are still unimplemented, so end-to-end cluster-scoped token workflows are not complete yet.
- Recipient Management: `Partially Complete`
  - Generated wallet creation and CSV/JSON wallet export are implemented.
  - PRD-aligned generation cap (`1..100`) is implemented.
  - CSV recipient import, validation, and deduplication are not implemented yet.
- Token Minting (All 3 Clusters): `Not Started`
- Distribution: `Not Started`
- Mainnet Safety Guardrails: `Not Started`
- Reporting: `Not Started`
  - Run-level reporting/export for distribution outcomes is not implemented yet.

## Acceptance Criteria
1. User can mint their own classic SPL token into Phantom on Devnet/Testnet/Mainnet.
2. Mainnet minting is blocked until explicit mint-risk acknowledgement.
3. User can distribute selected classic SPL token equally to generated/imported recipients.
4. Distribution runs on all three clusters with correct isolation.
5. Results are visible in-app and exportable as CSV/JSON.
6. Private keys are not persisted unless explicitly exported.

## Assumptions
- “User need to have their own tokens” means users can either:
  - bring existing tokens in Phantom, or
  - mint a new token in-app on the selected cluster.
- Mainnet costs are paid by connected Phantom wallet.
