# Phantom DeFi Dashboard

A lightweight DeFi-style web app that lets users:
- connect a Phantom wallet
- view the connected Solana public address
- fetch and display the wallet's SOL balance on Mainnet Beta
- copy the connected address to clipboard

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173` in a browser with Phantom installed.

## Deploy with GitHub Pages

This repo includes `.github/workflows/deploy.yml` that deploys the static app when code is pushed to the `main` branch.

1. Push this repository to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually).
4. Your app will be live at `https://<your-github-username>.github.io/<repo-name>/`.
