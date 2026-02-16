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
