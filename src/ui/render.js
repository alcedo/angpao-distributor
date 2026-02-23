import { formatRawWithDecimals } from "../domain/split.js";

export function setStatus(statusEl, message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

export function updateWalletControls(elements, walletCount) {
  const hasWallets = walletCount > 0;
  elements.clearBtn.disabled = !hasWallets;
  elements.toggleKeysBtn.disabled = !hasWallets;
  elements.downloadCsvBtn.disabled = !hasWallets;
  elements.downloadJsonBtn.disabled = !hasWallets;
  elements.countBadge.textContent = `${walletCount} wallet${walletCount === 1 ? "" : "s"}`;
}

export function renderWalletTable(tableBody, wallets, showPrivateKeys, escapeHtml) {
  if (!wallets.length) {
    tableBody.innerHTML =
      '<tr><td colspan="3" class="empty">No wallets generated yet.</td></tr>';
    return;
  }

  const rows = wallets
    .map((wallet) => {
      const privateKeyCell = showPrivateKeys
        ? renderCopyableValue(wallet.privateKeyBase64, 8, 6, escapeHtml)
        : escapeHtml("Click Reveal private keys to display");
      const privateKeyClass = showPrivateKeys ? "" : "masked";
      const publicAddressCell = renderCopyableValue(wallet.publicAddress, 4, 4, escapeHtml);

      return `<tr>
        <td class="table-mono">${wallet.index}</td>
        <td>${publicAddressCell}</td>
        <td class="${privateKeyClass} table-mono">${privateKeyCell}</td>
      </tr>`;
    })
    .join("");

  tableBody.innerHTML = rows;
}

export function setGeneratingState(elements, isGenerating, hasWeb3) {
  elements.generateBtn.disabled = isGenerating || !hasWeb3;
  elements.walletCountInput.disabled = isGenerating || !hasWeb3;
}

export function renderNetworkWalletState(optionalElements, model) {
  const { cluster, hasProvider, isConnected, publicKey } = model;

  if (optionalElements.clusterSelect) {
    optionalElements.clusterSelect.value = cluster;
    optionalElements.clusterSelect.disabled = false;
  }

  if (optionalElements.phantomConnectBtn) {
    optionalElements.phantomConnectBtn.disabled = !hasProvider;
    optionalElements.phantomConnectBtn.textContent = isConnected
      ? "Disconnect Phantom"
      : "Connect Phantom";
  }

  if (optionalElements.phantomStatus) {
    if (!hasProvider) {
      optionalElements.phantomStatus.textContent =
        `Phantom not detected. Install Phantom to connect on ${cluster}.`;
      return;
    }

    if (isConnected && publicKey) {
      optionalElements.phantomStatus.textContent =
        `Connected: ${formatPublicKey(publicKey)} on ${cluster}.`;
      return;
    }

    optionalElements.phantomStatus.textContent = `Phantom ready on ${cluster}.`;
  }
}

export function renderRecipientImportState(optionalElements, model) {
  const {
    generatedCount,
    importedCount,
    runReadyCount,
    runSetDuplicateCount,
    invalidRows,
    duplicateCount,
  } = model;

  if (optionalElements.recipientSummary) {
    const runSetSummary =
      `Run set: ${runReadyCount} unique recipient(s)` +
      ` (${generatedCount} generated + ${importedCount} imported` +
      `${runSetDuplicateCount ? `, ${runSetDuplicateCount} cross-source duplicate(s) skipped` : ""}).`;
    const csvSummary =
      ` CSV import: ${importedCount} valid, ${invalidRows.length} invalid row(s), ` +
      `${duplicateCount} duplicate row(s) skipped.`;
    optionalElements.recipientSummary.textContent = runSetSummary + csvSummary;
  }

  if (optionalElements.clearRecipientsBtn) {
    optionalElements.clearRecipientsBtn.disabled = importedCount === 0;
  }

  if (optionalElements.recipientDiagnostics) {
    if (!invalidRows.length) {
      optionalElements.recipientDiagnostics.innerHTML = "";
      return;
    }

    optionalElements.recipientDiagnostics.innerHTML = invalidRows
      .map(
        (row) =>
          `<li>Line ${row.line}: ${escapeHtml(row.reason)} ${row.value ? `(${escapeHtml(row.value)})` : ""}</li>`,
      )
      .join("");
  }
}

export function renderTokenInventoryState(optionalElements, model) {
  const { status, items, selectedMint, cluster, error } = model;

  if (optionalElements.tokenInventoryStatus) {
    optionalElements.tokenInventoryStatus.classList.toggle("error", status === "error");
    optionalElements.tokenInventoryStatus.textContent = buildTokenInventoryMessage({
      status,
      itemCount: items.length,
      cluster,
      error,
    });
  }

  if (!optionalElements.tokenMintSelect) {
    return;
  }

  const select = optionalElements.tokenMintSelect;
  const tokenPicker = optionalElements.tokenPicker;
  const tokenPickerLabel = optionalElements.tokenPickerLabel;
  const tokenPickerIcon = optionalElements.tokenPickerIcon;
  const tokenOptionList = optionalElements.tokenOptionList;
  select.disabled = true;
  if (tokenPicker) {
    setClassState(tokenPicker, "disabled", true);
    tokenPicker.open = false;
  }

  if (status === "loading") {
    select.innerHTML = '<option value="">Loading token balances...</option>';
    select.value = "";
    renderTokenPicker(tokenPickerLabel, tokenPickerIcon, tokenOptionList, {
      label: "Loading token balances...",
      logoUrl: TOKEN_LOGO_PLACEHOLDER_DATA_URL,
      options: [],
    });
    return;
  }

  if (status === "error") {
    select.innerHTML = '<option value="">Token load failed</option>';
    select.value = "";
    renderTokenPicker(tokenPickerLabel, tokenPickerIcon, tokenOptionList, {
      label: "Token load failed",
      logoUrl: TOKEN_LOGO_PLACEHOLDER_DATA_URL,
      options: [],
    });
    return;
  }

  if (status !== "ready") {
    select.innerHTML = '<option value="">Connect Phantom first</option>';
    select.value = "";
    renderTokenPicker(tokenPickerLabel, tokenPickerIcon, tokenOptionList, {
      label: "Connect Phantom first",
      logoUrl: TOKEN_LOGO_PLACEHOLDER_DATA_URL,
      options: [],
    });
    return;
  }

  if (!items.length) {
    select.innerHTML = '<option value="">No SPL tokens with balance found</option>';
    select.value = "";
    renderTokenPicker(tokenPickerLabel, tokenPickerIcon, tokenOptionList, {
      label: "No SPL tokens with balance found",
      logoUrl: TOKEN_LOGO_PLACEHOLDER_DATA_URL,
      options: [],
    });
    return;
  }

  select.disabled = false;
  if (tokenPicker) {
    setClassState(tokenPicker, "disabled", false);
  }
  const placeholder = selectedMint
    ? ""
    : '<option value="">Select token mint for distribution</option>';
  const options = items
    .map((item) => renderTokenOption(item.mint, buildTokenOptionLabel(item)))
    .join("");
  select.innerHTML = placeholder + options;
  select.value = selectedMint || "";

  const selectedItem = items.find((item) => item.mint === selectedMint) || null;
  renderTokenPicker(tokenPickerLabel, tokenPickerIcon, tokenOptionList, {
    label: selectedItem
      ? buildTokenOptionLabel(selectedItem)
      : "Select token mint for distribution",
    logoUrl: selectedItem?.logoUrl || TOKEN_LOGO_PLACEHOLDER_DATA_URL,
    options: items.map((item) => ({
      mint: item.mint,
      label: item.displayName || item.mint,
      balanceUi: item.balanceUi,
      logoUrl: item.logoUrl || TOKEN_LOGO_PLACEHOLDER_DATA_URL,
      selected: item.mint === selectedMint,
    })),
  });
}

export function renderMintWizardState(optionalElements, model) {
  const {
    isConnected,
    isMinting,
    cluster,
    error,
    lastMint,
  } = model;
  const isMainnet = cluster === "mainnet-beta";
  const controlsDisabled = !isConnected || isMinting;

  if (optionalElements.mintDecimalsInput) {
    optionalElements.mintDecimalsInput.disabled = controlsDisabled;
  }

  if (optionalElements.mintSupplyInput) {
    optionalElements.mintSupplyInput.disabled = controlsDisabled;
  }

  if (optionalElements.mintCreateBtn) {
    optionalElements.mintCreateBtn.disabled = controlsDisabled;
    optionalElements.mintCreateBtn.textContent = isMinting
      ? "Minting..."
      : "Create Mint + Mint Supply";
  }

  if (optionalElements.mintMainnetAcknowledge) {
    optionalElements.mintMainnetAcknowledge.disabled =
      controlsDisabled || !isMainnet;
    if (!isMainnet) {
      optionalElements.mintMainnetAcknowledge.checked = false;
    }
  }

  if (optionalElements.mintMainnetHint) {
    optionalElements.mintMainnetHint.textContent = isMainnet
      ? "Mainnet minting uses real SOL and is irreversible. Check the acknowledgement to continue."
      : "Mainnet mint-risk acknowledgement is only required on mainnet-beta.";
  }

  if (optionalElements.mintStatus) {
    optionalElements.mintStatus.classList.toggle("error", Boolean(error));
    optionalElements.mintStatus.textContent = buildMintStatusMessage({
      isConnected,
      isMinting,
      error,
      lastMint,
    });
  }
}

export function renderDistributionPlannerState(optionalElements, model) {
  const {
    cluster,
    selectedToken,
    totalUiAmount,
    plan,
    planError,
    checks,
    gate,
    feeEstimate,
    feeEstimateError,
    preflight,
    mainnetChecklist,
  } = model;
  const isMainnet = cluster === "mainnet-beta";
  const inputDisabled =
    !checks.walletConnected || !checks.tokenSelected || !checks.recipientsReady;
  const checklistDisabled =
    !isMainnet ||
    !checks.walletConnected ||
    !checks.tokenSelected ||
    !checks.tokenClassicSupported ||
    !checks.recipientsReady ||
    !checks.amountValid ||
    !checks.tokenBalanceSufficient ||
    !checks.feeHeadroomSufficient;

  if (optionalElements.distributionTotalAmountInput) {
    optionalElements.distributionTotalAmountInput.value = totalUiAmount || "";
    optionalElements.distributionTotalAmountInput.disabled = inputDisabled;
  }

  if (optionalElements.distributionMainnetChecklist) {
    optionalElements.distributionMainnetChecklist.hidden = !isMainnet;
  }

  if (optionalElements.distributionMainnetAckFees) {
    optionalElements.distributionMainnetAckFees.checked = Boolean(
      mainnetChecklist?.acknowledgeFees,
    );
    optionalElements.distributionMainnetAckFees.disabled = checklistDisabled;
  }

  if (optionalElements.distributionMainnetAckIrreversible) {
    optionalElements.distributionMainnetAckIrreversible.checked = Boolean(
      mainnetChecklist?.acknowledgeIrreversible,
    );
    optionalElements.distributionMainnetAckIrreversible.disabled = checklistDisabled;
  }

  if (optionalElements.distributionPlanStatus) {
    const statusModel = buildDistributionPlanStatusMessage({
      cluster,
      checks,
      selectedToken,
      planError,
      feeEstimateError,
      preflight,
    });
    optionalElements.distributionPlanStatus.classList.toggle("error", statusModel.isError);
    optionalElements.distributionPlanStatus.textContent = statusModel.message;
  }

  if (optionalElements.distributionPlanSummary) {
    optionalElements.distributionPlanSummary.textContent = buildDistributionPlanSummary({
      selectedToken,
      checks,
      plan,
      feeEstimate,
      feeEstimateError,
    });
  }

  if (optionalElements.distributionPreflightBtn) {
    optionalElements.distributionPreflightBtn.textContent =
      preflight?.status === "running" ? "Running Preflight..." : "Run Preflight";
    optionalElements.distributionPreflightBtn.disabled = !gate.canRunPreflight;
  }

  if (optionalElements.distributionStartBtn) {
    optionalElements.distributionStartBtn.textContent = "Start Distribution";
    optionalElements.distributionStartBtn.disabled = !gate.canStartDistribution;
  }

  if (optionalElements.distributionPreflightStatus) {
    const preflightStatusModel = buildDistributionPreflightStatusMessage(preflight);
    optionalElements.distributionPreflightStatus.classList.toggle(
      "error",
      preflightStatusModel.isError,
    );
    optionalElements.distributionPreflightStatus.textContent = preflightStatusModel.message;
  }

  if (optionalElements.distributionPreflightFailures) {
    const failures = Array.isArray(preflight?.failures) ? preflight.failures : [];
    optionalElements.distributionPreflightFailures.innerHTML = failures
      .map(
        (failure) =>
          `<li class="distribution-preflight-failure">${escapeHtml(failure.recipient)}: ${escapeHtml(failure.error)}</li>`,
      )
      .join("");
  }
}

function formatPublicKey(publicKey) {
  if (publicKey.length <= 12) {
    return publicKey;
  }
  return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
}

function buildMintStatusMessage(model) {
  const { isConnected, isMinting, error, lastMint } = model;

  if (isMinting) {
    return "Submitting mint transaction to Phantom...";
  }

  if (error) {
    return `Mint failed: ${error}`;
  }

  if (lastMint?.mint) {
    return `Last mint: ${middleTruncate(lastMint.mint, 4, 4)} (${lastMint.initialSupplyUi}, decimals ${lastMint.decimals}).`;
  }

  if (!isConnected) {
    return "Connect Phantom to create and mint a classic SPL token.";
  }

  return "Ready to create a classic SPL mint into your connected Phantom wallet.";
}

function buildTokenInventoryMessage(model) {
  const { status, itemCount, cluster, error } = model;

  if (status === "loading") {
    return `Loading SPL token balances on ${cluster}...`;
  }

  if (status === "error") {
    return `Unable to load SPL token balances: ${error || "unknown error"}`;
  }

  if (status === "ready" && itemCount === 0) {
    return `No SPL token balances were found for the connected wallet on ${cluster}.`;
  }

  if (status === "ready") {
    return `${itemCount} token mint(s) available for distribution on ${cluster}.`;
  }

  return "Connect Phantom to load SPL token balances for distribution.";
}

function buildDistributionPlanStatusMessage(model) {
  const { cluster, checks, selectedToken, planError, feeEstimateError, preflight } = model;

  if (!checks.walletConnected) {
    return {
      message: "Connect Phantom to plan a token distribution.",
      isError: false,
    };
  }

  if (!checks.tokenSelected) {
    return {
      message: "Select a token mint for distribution.",
      isError: false,
    };
  }

  if (!checks.tokenClassicSupported) {
    return {
      message:
        "Selected token uses Token-2022. Phase 4 distribution planning supports classic SPL tokens only.",
      isError: true,
    };
  }

  if (!checks.recipientsReady) {
    return {
      message: "Generate or import at least one recipient before planning distribution.",
      isError: true,
    };
  }

  if (!checks.amountValid) {
    return {
      message: planError || "Enter a valid total distribution amount greater than zero.",
      isError: true,
    };
  }

  if (!checks.tokenBalanceSufficient) {
    return {
      message: `Selected token balance (${selectedToken?.balanceUi || "0"}) is insufficient for the planned transfer.`,
      isError: true,
    };
  }

  if (feeEstimateError) {
    return {
      message: `Unable to estimate SOL headroom: ${feeEstimateError}`,
      isError: true,
    };
  }

  if (!checks.feeHeadroomSufficient) {
    return {
      message:
        "Insufficient SOL balance for transaction fees and ATA rent. Fund the source wallet and try again.",
      isError: true,
    };
  }

  if (cluster === "mainnet-beta" && !checks.mainnetChecklistAccepted) {
    return {
      message: "Complete both mainnet distribution acknowledgements before running preflight.",
      isError: true,
    };
  }

  if (preflight?.status === "running") {
    return {
      message: "Preflight simulation is running for all planned transfers.",
      isError: false,
    };
  }

  if (preflight?.status === "failed") {
    return {
      message: `Preflight failed for ${preflight.failedCount} recipient(s). Review failures before continuing.`,
      isError: true,
    };
  }

  if (preflight?.status === "passed") {
    return {
      message: "Preflight passed. Distribution is ready to start.",
      isError: false,
    };
  }

  return {
    message: "Static validations passed. Run preflight simulation to continue.",
    isError: false,
  };
}

function buildDistributionPlanSummary(model) {
  const { selectedToken, checks, plan, feeEstimate, feeEstimateError } = model;

  if (!checks.tokenSelected) {
    return "Distribution plan preview appears after selecting a token.";
  }

  if (!checks.amountValid || !plan) {
    return "Enter a total amount to compute an equal-split preview.";
  }

  const perRecipientUi = formatRawWithDecimals(plan.perRecipientRaw, plan.decimals);
  const plannedTransferUi = formatRawWithDecimals(plan.plannedTransferTotalRaw, plan.decimals);
  const remainderUi = formatRawWithDecimals(plan.remainderRaw, plan.decimals);
  let summary =
    `Token: ${selectedToken?.displayName || selectedToken?.mint || "Unknown"}. ` +
    `Recipients: ${plan.recipientCount}. Per recipient: ${perRecipientUi}. ` +
    `Planned transfer total: ${plannedTransferUi}. Remainder: ${remainderUi}. ` +
    "Remainder stays in source wallet.";

  if (feeEstimate) {
    summary +=
      ` Estimated SOL required: ${formatLamportsAsSol(feeEstimate.requiredLamports)} SOL` +
      ` (wallet: ${formatLamportsAsSol(feeEstimate.walletLamports)} SOL).`;
  } else if (checks.tokenBalanceSufficient && !feeEstimateError) {
    summary += " Estimating SOL fee headroom...";
  }

  return summary;
}

function buildDistributionPreflightStatusMessage(preflight) {
  if (preflight?.status === "running") {
    return {
      message: "Simulating distribution transactions...",
      isError: false,
    };
  }

  if (preflight?.status === "passed") {
    return {
      message: `Preflight passed for ${preflight.scannedCount} recipient(s).`,
      isError: false,
    };
  }

  if (preflight?.status === "failed") {
    return {
      message: `Preflight failed for ${preflight.failedCount} of ${preflight.scannedCount} recipient(s).`,
      isError: true,
    };
  }

  return {
    message: "Preflight not run yet.",
    isError: false,
  };
}

function formatLamportsAsSol(lamports) {
  let value = 0n;
  if (typeof lamports === "bigint") {
    value = lamports;
  } else if (typeof lamports === "number" && Number.isSafeInteger(lamports)) {
    value = BigInt(lamports);
  } else if (typeof lamports === "string" && /^\d+$/.test(lamports)) {
    value = BigInt(lamports);
  }

  const lamportsPerSol = 1_000_000_000n;
  const whole = value / lamportsPerSol;
  const fraction = value % lamportsPerSol;
  const fractionText = fraction.toString().padStart(9, "0").replace(/0+$/, "");
  if (!fractionText) {
    return whole.toString();
  }
  return `${whole.toString()}.${fractionText}`;
}

function renderTokenOption(value, label) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

function buildTokenOptionLabel(item) {
  const displayName =
    String(item?.displayName || item?.name || item?.symbol || item?.mint || "").trim();
  const balanceUi = String(item?.balanceUi || "").trim();
  return `${displayName} (${balanceUi})`;
}

function renderTokenPicker(labelEl, iconEl, optionListEl, model) {
  if (labelEl) {
    labelEl.textContent = model.label || "";
  }

  if (iconEl) {
    iconEl.onerror = () => {
      iconEl.onerror = null;
      iconEl.src = TOKEN_LOGO_PLACEHOLDER_DATA_URL;
    };
    iconEl.src = model.logoUrl || TOKEN_LOGO_PLACEHOLDER_DATA_URL;
    iconEl.alt = "";
  }

  if (!optionListEl) {
    return;
  }

  if (!Array.isArray(model.options) || model.options.length === 0) {
    optionListEl.innerHTML = "";
    return;
  }

  optionListEl.innerHTML = model.options
    .map((option) => {
      const selectedClass = option.selected ? " selected" : "";
      return `<li class="token-option-item">
        <button type="button" class="token-option-btn${selectedClass}" data-token-mint="${escapeHtml(option.mint)}">
          <img class="token-picker-icon" src="${escapeHtml(option.logoUrl || TOKEN_LOGO_PLACEHOLDER_DATA_URL)}" alt="" onerror="this.onerror=null;this.src='${escapeHtml(TOKEN_LOGO_PLACEHOLDER_DATA_URL)}'" />
          <span class="token-option-name">${escapeHtml(option.label)}</span>
          <span class="token-option-balance">${escapeHtml(option.balanceUi)}</span>
        </button>
      </li>`;
    })
    .join("");
}

function setClassState(element, className, enabled) {
  if (!element?.classList || !className) {
    return;
  }

  if (typeof element.classList.toggle === "function") {
    element.classList.toggle(className, enabled);
    return;
  }

  if (enabled && typeof element.classList.add === "function") {
    element.classList.add(className);
    return;
  }

  if (!enabled && typeof element.classList.remove === "function") {
    element.classList.remove(className);
  }
}

const TOKEN_LOGO_PLACEHOLDER_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSIxNiIgZmlsbD0iIzFmMjkzNyIvPjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjExIiBmaWxsPSIjMTRmMTk1IiBmaWxsLW9wYWNpdHk9IjAuMjMiLz48cGF0aCBkPSJNMTAgMTZoMTJNMTIuOCAxMS44aDYuNE0xMi44IDIwLjJoNi40IiBzdHJva2U9IiMxNGYxOTUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+";

function renderCopyableValue(value, leftChars, rightChars, escapeHtml) {
  const truncated = middleTruncate(value, leftChars, rightChars);
  return `<button type="button" class="copy-value" data-copy-value="${escapeHtml(value)}" title="Click to copy full value">${escapeHtml(truncated)}</button>`;
}

function escapeHtml(raw) {
  return String(raw)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function middleTruncate(value, leftChars, rightChars) {
  if (typeof value !== "string") {
    return "";
  }

  if (value.length <= leftChars + rightChars + 3) {
    return value;
  }

  return `${value.slice(0, leftChars)}...${value.slice(-rightChars)}`;
}
