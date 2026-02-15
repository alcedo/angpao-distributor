(function bootstrap(global) {
  const ELEMENT_IDS = {
    form: "generator-form",
    walletCountInput: "wallet-count",
    statusEl: "status",
    tableBody: "wallet-table-body",
    countBadge: "count-badge",
    generateBtn: "generate-btn",
    clearBtn: "clear-btn",
    toggleKeysBtn: "toggle-keys-btn",
    downloadCsvBtn: "download-csv-btn",
    downloadJsonBtn: "download-json-btn",
  };

  function createWalletGeneratorApp(options = {}) {
    const documentRef = options.document || global.document;
    if (!documentRef) {
      throw new Error("Missing document object.");
    }

    const elements = getRequiredElements(documentRef);
    const web3 = options.web3 || global.solanaWeb3;
    const now =
      options.now ||
      (() => {
        const perf = options.performance || global.performance;
        return typeof perf?.now === "function" ? perf.now() : Date.now();
      });
    const base64Encode =
      options.base64Encode ||
      ((binary) => {
        if (typeof global.btoa === "function") {
          return global.btoa(binary);
        }
        if (typeof Buffer !== "undefined") {
          return Buffer.from(binary, "binary").toString("base64");
        }
        throw new Error("No Base64 encoder available.");
      });
    const requestFrame =
      options.requestAnimationFrame ||
      global.requestAnimationFrame ||
      ((callback) => setTimeout(callback, 0));
    const browserUrl = options.URL || global.URL;
    const browserBlob = options.Blob || global.Blob;
    const hasWeb3 = Boolean(web3?.Keypair?.generate);

    let generatedWallets = [];
    let showPrivateKeys = false;

    function setStatus(message, isError = false) {
      elements.statusEl.textContent = message;
      elements.statusEl.classList.toggle("error", isError);
    }

    function setGeneratingState(isGenerating) {
      elements.generateBtn.disabled = isGenerating || !hasWeb3;
      elements.walletCountInput.disabled = isGenerating || !hasWeb3;
    }

    function updateControls() {
      const hasWallets = generatedWallets.length > 0;
      elements.clearBtn.disabled = !hasWallets;
      elements.toggleKeysBtn.disabled = !hasWallets;
      elements.downloadCsvBtn.disabled = !hasWallets;
      elements.downloadJsonBtn.disabled = !hasWallets;
      elements.countBadge.textContent = `${generatedWallets.length} wallet${
        generatedWallets.length === 1 ? "" : "s"
      }`;
    }

    function renderTable() {
      if (!generatedWallets.length) {
        elements.tableBody.innerHTML =
          '<tr><td colspan="3" class="empty">No wallets generated yet.</td></tr>';
        elements.countBadge.textContent = "0 wallets";
        return;
      }

      const rows = generatedWallets
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

      elements.tableBody.innerHTML = rows;
    }

    async function generateWallets(count) {
      const wallets = [];
      for (let index = 1; index <= count; index += 1) {
        const keypair = web3.Keypair.generate();
        wallets.push({
          index,
          publicAddress: keypair.publicKey.toBase58(),
          privateKeyBase64: uint8ToBase64(keypair.secretKey, base64Encode),
        });

        if (index % 250 === 0) {
          setStatus(`Generating ${count} wallet(s)... ${index}/${count}`);
          await nextFrame(requestFrame);
        }
      }
      return wallets;
    }

    async function onGenerateSubmit(event) {
      event.preventDefault();

      if (!hasWeb3) {
        setStatus(
          "Unable to load Solana Web3 library. Check your network and refresh.",
          true,
        );
        return;
      }

      const requestedCount = Number.parseInt(elements.walletCountInput.value, 10);
      if (
        !Number.isFinite(requestedCount) ||
        requestedCount < 1 ||
        requestedCount > 5000
      ) {
        setStatus("Please enter a number between 1 and 5000.", true);
        return;
      }

      setGeneratingState(true);
      showPrivateKeys = false;
      elements.toggleKeysBtn.textContent = "Reveal private keys";
      setStatus(`Generating ${requestedCount} wallet(s)...`);

      try {
        const start = now();
        generatedWallets = await generateWallets(requestedCount);
        const elapsedMs = Math.round(now() - start);
        renderTable();
        updateControls();
        setStatus(`Generated ${requestedCount} wallet(s) in ${elapsedMs}ms.`);
      } catch (error) {
        console.error(error);
        setStatus("Wallet generation failed. See console for details.", true);
      } finally {
        setGeneratingState(false);
      }
    }

    function onClear() {
      generatedWallets = [];
      showPrivateKeys = false;
      elements.walletCountInput.value = "10";
      elements.toggleKeysBtn.textContent = "Reveal private keys";
      renderTable();
      updateControls();
      setStatus("Cleared generated wallets.");
    }

    function onToggleKeys() {
      if (!generatedWallets.length) {
        return;
      }
      showPrivateKeys = !showPrivateKeys;
      elements.toggleKeysBtn.textContent = showPrivateKeys
        ? "Hide private keys"
        : "Reveal private keys";
      renderTable();
    }

    function onDownloadCsv() {
      if (!generatedWallets.length) {
        return;
      }
      const csv = [
        "index,publicAddress,privateKeyBase64",
        ...generatedWallets.map((wallet) =>
          [
            wallet.index,
            csvEscape(wallet.publicAddress),
            csvEscape(wallet.privateKeyBase64),
          ].join(","),
        ),
      ].join("\n");

      downloadFile(
        "solana-wallets.csv",
        csv,
        "text/csv;charset=utf-8",
        documentRef,
        browserUrl,
        browserBlob,
      );
    }

    function onDownloadJson() {
      if (!generatedWallets.length) {
        return;
      }
      const payload = generatedWallets.map((wallet) => ({
        index: wallet.index,
        publicAddress: wallet.publicAddress,
        privateKeyBase64: wallet.privateKeyBase64,
      }));
      downloadFile(
        "solana-wallets.json",
        JSON.stringify(payload, null, 2),
        "application/json;charset=utf-8",
        documentRef,
        browserUrl,
        browserBlob,
      );
    }

    elements.form.addEventListener("submit", onGenerateSubmit);
    elements.clearBtn.addEventListener("click", onClear);
    elements.toggleKeysBtn.addEventListener("click", onToggleKeys);
    elements.downloadCsvBtn.addEventListener("click", onDownloadCsv);
    elements.downloadJsonBtn.addEventListener("click", onDownloadJson);

    renderTable();
    updateControls();
    setGeneratingState(false);
    if (!hasWeb3) {
      setStatus(
        "Unable to load Solana Web3 library. Check your network and refresh.",
        true,
      );
    } else {
      setStatus("Ready.");
    }

    return {
      elements,
      getState() {
        return {
          generatedWallets: [...generatedWallets],
          showPrivateKeys,
        };
      },
    };
  }

  function getRequiredElements(documentRef) {
    const elements = {};
    for (const [key, id] of Object.entries(ELEMENT_IDS)) {
      elements[key] = documentRef.getElementById(id);
      if (!elements[key]) {
        throw new Error(`Missing required element: #${id}`);
      }
    }
    return elements;
  }

  function uint8ToBase64(bytes, base64Encode) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return base64Encode(binary);
  }

  function csvEscape(value) {
    const escaped = String(value).replaceAll('"', '""');
    return `"${escaped}"`;
  }

  function downloadFile(filename, contents, mimeType, documentRef, UrlRef, BlobRef) {
    const blob = new BlobRef([contents], { type: mimeType });
    const url = UrlRef.createObjectURL(blob);
    const anchor = documentRef.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    documentRef.body.appendChild(anchor);
    anchor.click();
    documentRef.body.removeChild(anchor);
    UrlRef.revokeObjectURL(url);
  }

  function escapeHtml(raw) {
    return String(raw)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function nextFrame(requestFrame) {
    return new Promise((resolve) => {
      requestFrame(() => resolve());
    });
  }

  const exportsObject = {
    createWalletGeneratorApp,
    csvEscape,
    escapeHtml,
    uint8ToBase64,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportsObject;
  }

  if (typeof global.document !== "undefined") {
    createWalletGeneratorApp();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
