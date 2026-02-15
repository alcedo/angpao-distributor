# Solana Wallet Batch Generator

Simple browser webapp to generate a chosen number of Solana wallets using
`@solana/web3.js`.

## Run Locally

1. Open `index.html` in a browser.
2. Enter how many wallets you want.
3. Click **Generate Wallets**.
4. Optionally export results as CSV or JSON.

## Tests

Run the automated UI logic tests with:

```bash
node --test tests/app.test.js
```

## Run in Docker (Nginx)

Build the container:

```bash
docker build -t solana-wallet-generator:local .
```

Run it on port `8080`:

```bash
docker run --rm -p 8080:8080 solana-wallet-generator:local
```

Open `http://localhost:8080`.

## Deploy to Google Cloud Run (Manual CLI)

### Service defaults

- Service name: `solana-wallet-generator`
- Region: `us-central1`
- Public access: enabled (`--allow-unauthenticated`)
- Scale to zero: enabled (`--min-instances=0`)
- Max instances: `5`

### Prerequisites

- Google Cloud project with billing enabled
- `gcloud` CLI installed and authenticated
- Docker installed locally (only needed for local container smoke testing)

### 1) Configure project and enable APIs

```bash
gcloud config set project <PROJECT_ID>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

### 2) Create Artifact Registry repo (one-time)

```bash
gcloud artifacts repositories create web \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker images for static web apps"
```

If the `web` repository already exists, this command can be skipped.

### 3) Build and push image

```bash
IMAGE_TAG="$(git rev-parse --short HEAD)"
gcloud builds submit --tag "us-central1-docker.pkg.dev/<PROJECT_ID>/web/solana-wallet-generator:${IMAGE_TAG}"
```

### 4) Deploy to Cloud Run

```bash
IMAGE_TAG="$(git rev-parse --short HEAD)"
gcloud run deploy solana-wallet-generator \
  --image "us-central1-docker.pkg.dev/<PROJECT_ID>/web/solana-wallet-generator:${IMAGE_TAG}" \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=5 \
  --port=8080
```

Cloud Run prints the service URL at the end of deployment.

### 5) Rollback to a previous image tag

```bash
gcloud run deploy solana-wallet-generator \
  --image "us-central1-docker.pkg.dev/<PROJECT_ID>/web/solana-wallet-generator:<PREVIOUS_TAG>" \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=5 \
  --port=8080
```

## Phase 2 (deferred): Custom domain

Phase 1 is deployed on the Cloud Run URL. Custom domain setup can be added later:

1. Map domain to the Cloud Run service.
2. Provision managed TLS certificate.
3. Add DNS records at your domain registrar.

## Color Scheme

The UI uses a **Warm Neutral + Ocean Teal** palette:

- `Background base`: `#F6EFE1` (soft parchment)
- `Background gradient stop`: `#EFE3D2` (warm sand)
- `Card surface`: `rgba(255, 253, 250, 0.88)` (frosted ivory)
- `Primary text`: `#1F2A33` (ink blue-gray)
- `Secondary text`: `#5A6773` (muted slate)
- `Primary action/button`: `#0D5C63` (deep ocean teal)
- `Button hover`: `#0A4B51` (darker teal)
- `Button focus ring`: `#57A8B0` (cool aqua)
- `Danger/error`: `#B42318` (brick red)

## Notes

- Wallets are generated locally in the browser.
- Private keys are shown in Base64 format.
- Do not share private keys.
- The app requires internet access to load `@solana/web3.js` from UNPKG.
