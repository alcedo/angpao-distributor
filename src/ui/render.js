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
        ? wallet.privateKeyBase64
        : "Click Reveal private keys to display";
      const privateKeyClass = showPrivateKeys ? "" : "masked";

      return `<tr>
        <td>${wallet.index}</td>
        <td>${escapeHtml(wallet.publicAddress)}</td>
        <td class="${privateKeyClass}">${escapeHtml(privateKeyCell)}</td>
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

function formatPublicKey(publicKey) {
  if (publicKey.length <= 12) {
    return publicKey;
  }
  return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
}
