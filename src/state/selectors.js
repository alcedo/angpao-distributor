export function isWalletConnected(state) {
  return Boolean(state?.phantom?.isConnected && state?.phantom?.publicKey);
}

export function canRunWalletRequiredActions(state) {
  return isWalletConnected(state);
}

export function getRunRecipients(state) {
  return getRunRecipientStats(state).recipients;
}

export function getRunRecipientStats(state) {
  const seenAddresses = new Set();
  const recipients = [];
  let duplicatesSkipped = 0;
  let generatedCount = 0;
  let importedCount = 0;

  const generatedWallets = Array.isArray(state?.generatedWallets) ? state.generatedWallets : [];
  for (const wallet of generatedWallets) {
    const address = String(wallet?.publicAddress || "").trim();
    if (!address) {
      continue;
    }

    generatedCount += 1;
    if (seenAddresses.has(address)) {
      duplicatesSkipped += 1;
      continue;
    }

    seenAddresses.add(address);
    recipients.push({
      id: `generated-${wallet?.index ?? generatedCount}`,
      publicAddress: address,
      source: "generated",
    });
  }

  const importedRecipients = Array.isArray(state?.importedRecipients) ? state.importedRecipients : [];
  for (let index = 0; index < importedRecipients.length; index += 1) {
    const recipient = importedRecipients[index];
    const address = String(recipient?.publicAddress || "").trim();
    if (!address) {
      continue;
    }

    importedCount += 1;
    if (seenAddresses.has(address)) {
      duplicatesSkipped += 1;
      continue;
    }

    seenAddresses.add(address);
    recipients.push({
      id: recipient?.id || `csv-${index + 1}`,
      publicAddress: address,
      source: "csv",
    });
  }

  return {
    recipients,
    generatedCount,
    importedCount,
    duplicatesSkipped,
  };
}
