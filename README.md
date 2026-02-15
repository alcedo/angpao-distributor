# Solana Wallet Batch Generator

Simple browser webapp to generate a chosen number of Solana wallets using
`@solana/web3.js`.

## Run

1. Open `index.html` in a browser.
2. Enter how many wallets you want.
3. Click **Generate Wallets**.
4. Optionally export results as CSV or JSON.

## Tests

Run the automated UI logic tests with:

```bash
node --test tests/app.test.js
```

## Notes

- Wallets are generated locally in the browser.
- Private keys are shown in Base64 format.
- Do not share private keys.
- The app requires internet access to load `@solana/web3.js` from UNPKG.
