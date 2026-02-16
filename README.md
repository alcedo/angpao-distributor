# Solana Wallet Batch Generator

Client-only web app for Solana wallet generation with cluster-aware Phantom
connectivity, recipient import, and SPL token inventory discovery.

## Features (Current)

- Generate Solana wallets locally in the browser.
- Reveal/hide private keys in the UI.
- Export generated wallets as CSV or JSON.
- Select cluster (`devnet`, `testnet`, `mainnet-beta`).
- Detect Phantom and connect/disconnect wallet.
- Load connected wallet classic SPL token balances into a disbursement selector.
- Mint a classic SPL token (create mint + ATA + initial supply) from the connected wallet.

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Open the Vite URL (typically `http://localhost:5173`).

## Test

```bash
npm test
```

## Build

```bash
npm run build
```

Build output is generated in `dist/`.

## GitHub Pages Deployment (Static)

This is a static frontend app and can be deployed via GitHub Pages.

1. Push repository to GitHub.
2. Open `Settings -> Pages`.
3. Set:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
4. Save and wait for publish.

Published URL pattern:

- User/org site: `https://<username>.github.io/`
- Project site: `https://<username>.github.io/<repo-name>/`

## Security Notes

- Generated private keys are sensitive. Do not share them.
- Keys are generated on the client side.
- Mainnet actions require caution because they use real SOL.

## Roadmap Context

- Current completion: Phase 0 through Phase 3 token discovery + mint wizard.
- Next phases: distribution planning/execution and reporting.
