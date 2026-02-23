export function isWalletConnected(state) {
  return Boolean(state?.phantom?.isConnected && state?.phantom?.publicKey);
}

export function canRunWalletRequiredActions(state) {
  return isWalletConnected(state);
}

export function getSelectedTokenAsset(state) {
  const selectedMint = String(state?.tokenInventory?.selectedMint || "").trim();
  if (!selectedMint) {
    return null;
  }

  const items = Array.isArray(state?.tokenInventory?.items) ? state.tokenInventory.items : [];
  return items.find((item) => item?.mint === selectedMint) || null;
}

export function getDistributionGateModel(state) {
  const checks = {
    walletConnected: Boolean(state?.distribution?.checks?.walletConnected),
    tokenSelected: Boolean(state?.distribution?.checks?.tokenSelected),
    tokenClassicSupported: Boolean(state?.distribution?.checks?.tokenClassicSupported),
    recipientsReady: Boolean(state?.distribution?.checks?.recipientsReady),
    amountValid: Boolean(state?.distribution?.checks?.amountValid),
    tokenBalanceSufficient: Boolean(state?.distribution?.checks?.tokenBalanceSufficient),
    feeHeadroomSufficient: Boolean(state?.distribution?.checks?.feeHeadroomSufficient),
    mainnetChecklistAccepted: Boolean(state?.distribution?.checks?.mainnetChecklistAccepted),
    preflightPassed: Boolean(state?.distribution?.checks?.preflightPassed),
  };
  const staticCheckKeys = [
    "walletConnected",
    "tokenSelected",
    "tokenClassicSupported",
    "recipientsReady",
    "amountValid",
    "tokenBalanceSufficient",
    "feeHeadroomSufficient",
    "mainnetChecklistAccepted",
  ];
  const allStaticChecksPass = staticCheckKeys.every((key) => checks[key]);
  const preflightStatus = String(state?.distribution?.preflight?.status || "idle");
  const preflightRunning = preflightStatus === "running";

  return {
    checks,
    allStaticChecksPass,
    canRunPreflight: allStaticChecksPass && !preflightRunning,
    canStartDistribution: allStaticChecksPass && checks.preflightPassed && !preflightRunning,
    preflightRunning,
  };
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
