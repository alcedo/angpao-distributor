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

function formatPublicKey(publicKey) {
  if (publicKey.length <= 12) {
    return publicKey;
  }
  return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
}

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
