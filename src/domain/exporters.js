export function csvEscape(value) {
  const escaped = String(value).replaceAll('"', '""');
  return `"${escaped}"`;
}

export function serializeWalletsCsv(wallets) {
  return [
    "index,publicAddress,privateKeyBase64",
    ...wallets.map((wallet) =>
      [
        wallet.index,
        csvEscape(wallet.publicAddress),
        csvEscape(wallet.privateKeyBase64),
      ].join(","),
    ),
  ].join("\n");
}

export function serializeWalletsJson(wallets) {
  const payload = wallets.map((wallet) => ({
    index: wallet.index,
    publicAddress: wallet.publicAddress,
    privateKeyBase64: wallet.privateKeyBase64,
  }));
  return JSON.stringify(payload, null, 2);
}
