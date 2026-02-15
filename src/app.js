import { Keypair } from "@solana/web3.js";
import { createStore } from "./state/store.js";
import { canRunWalletRequiredActions, isWalletConnected } from "./state/selectors.js";
import { serializeWalletsCsv, serializeWalletsJson } from "./domain/exporters.js";
import { validateWalletCount } from "./domain/validation.js";
import { createConnectionContext } from "./solana/connection.js";
import {
  connectPhantom,
  disconnectPhantom,
  getPhantomProvider,
} from "./solana/phantomProvider.js";
import { bindNetworkWalletEvents, bindWalletEvents } from "./ui/events.js";
import {
  renderNetworkWalletState,
  renderWalletTable,
  setGeneratingState,
  setStatus,
  updateWalletControls,
} from "./ui/render.js";

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

const OPTIONAL_ELEMENT_IDS = {
  clusterSelect: "cluster-select",
  phantomConnectBtn: "phantom-connect-btn",
  phantomStatus: "phantom-status",
};

const INITIAL_CLUSTER = "devnet";

export function createWalletGeneratorApp(options = {}) {
  const globalRef = options.globalRef || globalThis;
  const documentRef = options.document || globalRef.document;
  if (!documentRef) {
    throw new Error("Missing document object.");
  }

  const elements = getRequiredElements(documentRef);
  const optionalElements = getOptionalElements(documentRef);

  const keypairRef = options.keypair || Keypair;
  const now =
    options.now ||
    (() => {
      const perf = options.performance || globalRef.performance;
      return typeof perf?.now === "function" ? perf.now() : Date.now();
    });
  const requestFrame =
    options.requestAnimationFrame ||
    globalRef.requestAnimationFrame ||
    ((callback) => setTimeout(callback, 0));
  const browserUrl = options.URL || globalRef.URL;
  const browserBlob = options.Blob || globalRef.Blob;
  const hasWeb3 = Boolean(keypairRef?.generate);

  const base64Encode =
    options.base64Encode ||
    ((binary) => {
      if (typeof globalRef.btoa === "function") {
        return globalRef.btoa(binary);
      }
      if (typeof Buffer !== "undefined") {
        return Buffer.from(binary, "binary").toString("base64");
      }
      throw new Error("No Base64 encoder available.");
    });

  const cluster = options.initialCluster || INITIAL_CLUSTER;
  const createConnectionContextRef =
    options.createConnectionContext ||
    ((clusterValue) =>
      createConnectionContext(clusterValue, {
        connectionFactory: options.connectionFactory,
      }));

  let connectionContext;
  let connectionSetupError = null;
  try {
    connectionContext = createConnectionContextRef(cluster);
  } catch (error) {
    connectionSetupError = error;
    connectionContext = {
      cluster,
      endpoint: null,
      connection: null,
    };
  }

  const phantomProvider =
    options.phantomProvider !== undefined
      ? options.phantomProvider
      : getPhantomProvider(globalRef);

  const store = createStore({
    cluster,
    generatedWallets: [],
    showPrivateKeys: false,
    phantom: {
      isConnected: false,
      publicKey: null,
    },
    connection: connectionContext,
  });

  function getState() {
    return store.getState();
  }

  function setState(nextPatch) {
    return store.setState(nextPatch);
  }

  function refreshWalletView() {
    const state = getState();
    renderWalletTable(
      elements.tableBody,
      state.generatedWallets,
      state.showPrivateKeys,
      escapeHtml,
    );
    updateWalletControls(elements, state.generatedWallets.length);
  }

  function refreshNetworkWalletView() {
    const state = getState();
    renderNetworkWalletState(optionalElements, {
      cluster: state.cluster,
      hasProvider: Boolean(phantomProvider),
      isConnected: isWalletConnected(state),
      publicKey: state.phantom.publicKey,
      canRunWalletRequiredActions: canRunWalletRequiredActions(state),
    });
  }

  async function generateWallets(count) {
    const wallets = [];
    for (let index = 1; index <= count; index += 1) {
      const keypair = keypairRef.generate();
      wallets.push({
        index,
        publicAddress: keypair.publicKey.toBase58(),
        privateKeyBase64: uint8ToBase64(keypair.secretKey, base64Encode),
      });

      if (index % 250 === 0) {
        setStatus(elements.statusEl, `Generating ${count} wallet(s)... ${index}/${count}`);
        await nextFrame(requestFrame);
      }
    }
    return wallets;
  }

  async function onGenerateSubmit(event) {
    event.preventDefault();

    if (!hasWeb3) {
      setStatus(
        elements.statusEl,
        "Unable to load Solana Web3 library. Check your network and refresh.",
        true,
      );
      return;
    }

    const validation = validateWalletCount(elements.walletCountInput.value);
    if (!validation.ok) {
      setStatus(elements.statusEl, validation.error, true);
      return;
    }

    setGeneratingState(elements, true, hasWeb3);
    const state = getState();
    setState({ ...state, showPrivateKeys: false });
    elements.toggleKeysBtn.textContent = "Reveal private keys";
    setStatus(elements.statusEl, `Generating ${validation.count} wallet(s)...`);

    try {
      const start = now();
      const generatedWallets = await generateWallets(validation.count);
      const elapsedMs = Math.round(now() - start);
      setState({ ...getState(), generatedWallets });
      refreshWalletView();
      setStatus(
        elements.statusEl,
        `Generated ${validation.count} wallet(s) in ${elapsedMs}ms.`,
      );
    } catch (error) {
      console.error(error);
      setStatus(elements.statusEl, "Wallet generation failed. See console for details.", true);
    } finally {
      setGeneratingState(elements, false, hasWeb3);
    }
  }

  function onClear() {
    setState({ ...getState(), generatedWallets: [], showPrivateKeys: false });
    elements.walletCountInput.value = "10";
    elements.toggleKeysBtn.textContent = "Reveal private keys";
    refreshWalletView();
    setStatus(elements.statusEl, "Cleared generated wallets.");
  }

  function onToggleKeys() {
    const state = getState();
    if (!state.generatedWallets.length) {
      return;
    }
    const showPrivateKeys = !state.showPrivateKeys;
    setState({ ...state, showPrivateKeys });
    elements.toggleKeysBtn.textContent = showPrivateKeys
      ? "Hide private keys"
      : "Reveal private keys";
    refreshWalletView();
  }

  function onDownloadCsv() {
    const state = getState();
    if (!state.generatedWallets.length) {
      return;
    }

    downloadFile(
      "solana-wallets.csv",
      serializeWalletsCsv(state.generatedWallets),
      "text/csv;charset=utf-8",
      documentRef,
      browserUrl,
      browserBlob,
    );
  }

  function onDownloadJson() {
    const state = getState();
    if (!state.generatedWallets.length) {
      return;
    }

    downloadFile(
      "solana-wallets.json",
      serializeWalletsJson(state.generatedWallets),
      "application/json;charset=utf-8",
      documentRef,
      browserUrl,
      browserBlob,
    );
  }

  async function onCopyValueClick(event) {
    const copyTarget = getCopyTarget(event?.target);
    if (!copyTarget) {
      return;
    }

    const value = getCopyValue(copyTarget);
    if (!value) {
      return;
    }

    try {
      await copyToClipboard(value, globalRef.navigator, documentRef);
      setStatus(elements.statusEl, "Copied full value to clipboard.");
    } catch (error) {
      console.error(error);
      setStatus(
        elements.statusEl,
        "Copy failed. Browser clipboard permissions may be blocked.",
        true,
      );
    }
  }

  function onClusterChange(event) {
    const nextCluster = event.target.value;
    try {
      const nextConnection = createConnectionContextRef(nextCluster);
      setState({
        ...getState(),
        cluster: nextCluster,
        connection: nextConnection,
      });
      refreshNetworkWalletView();
      setStatus(elements.statusEl, `Active cluster set to ${nextCluster}.`);
    } catch (error) {
      console.error(error);
      setStatus(elements.statusEl, `Failed to set cluster: ${error.message}`, true);
      refreshNetworkWalletView();
    }
  }

  async function onPhantomConnectToggle() {
    if (!phantomProvider) {
      setStatus(elements.statusEl, "Phantom provider not found in this browser.", true);
      refreshNetworkWalletView();
      return;
    }

    const state = getState();

    if (!isWalletConnected(state)) {
      try {
        const { publicKey } = await connectPhantom(phantomProvider);
        setState({
          ...getState(),
          phantom: {
            isConnected: true,
            publicKey,
          },
        });
        setStatus(elements.statusEl, "Connected to Phantom wallet.");
      } catch (error) {
        console.error(error);
        setState({
          ...getState(),
          phantom: {
            isConnected: false,
            publicKey: null,
          },
        });
        setStatus(elements.statusEl, `Phantom connect failed: ${error.message}`, true);
      }

      refreshNetworkWalletView();
      return;
    }

    try {
      await disconnectPhantom(phantomProvider);
      setState({
        ...getState(),
        phantom: {
          isConnected: false,
          publicKey: null,
        },
      });
      setStatus(elements.statusEl, "Disconnected from Phantom wallet.");
    } catch (error) {
      console.error(error);
      setStatus(elements.statusEl, `Phantom disconnect failed: ${error.message}`, true);
    }

    refreshNetworkWalletView();
  }

  bindWalletEvents(elements, {
    onGenerateSubmit,
    onClear,
    onToggleKeys,
    onDownloadCsv,
    onDownloadJson,
    onCopyValueClick,
  });

  bindNetworkWalletEvents(optionalElements, {
    onClusterChange,
    onPhantomConnectToggle,
  });

  refreshWalletView();
  refreshNetworkWalletView();
  setGeneratingState(elements, false, hasWeb3);

  if (!hasWeb3) {
    setStatus(
      elements.statusEl,
      "Unable to load Solana Web3 library. Check your network and refresh.",
      true,
    );
  } else if (connectionSetupError) {
    setStatus(
      elements.statusEl,
      `Unable to configure Solana connection: ${connectionSetupError.message}`,
      true,
    );
  } else {
    setStatus(elements.statusEl, "Ready.");
  }

  return {
    elements,
    optionalElements,
    getState,
  };
}

export function initApp() {
  if (typeof document === "undefined") {
    return null;
  }
  return createWalletGeneratorApp();
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

function getOptionalElements(documentRef) {
  const elements = {};
  for (const [key, id] of Object.entries(OPTIONAL_ELEMENT_IDS)) {
    elements[key] = documentRef.getElementById(id);
  }
  return elements;
}

export function uint8ToBase64(bytes, base64Encode) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64Encode(binary);
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

function getCopyTarget(eventTarget) {
  if (!eventTarget) {
    return null;
  }

  if (typeof eventTarget.closest === "function") {
    return eventTarget.closest("[data-copy-value]");
  }

  if (eventTarget.dataset?.copyValue) {
    return eventTarget;
  }

  return null;
}

function getCopyValue(target) {
  if (!target) {
    return "";
  }

  if (typeof target.getAttribute === "function") {
    const value = target.getAttribute("data-copy-value");
    if (value) {
      return value;
    }
  }

  return target.dataset?.copyValue || "";
}

function copyToClipboard(value, navigatorRef, documentRef) {
  if (navigatorRef?.clipboard?.writeText) {
    return navigatorRef.clipboard.writeText(value);
  }

  return legacyCopyToClipboard(value, documentRef);
}

function legacyCopyToClipboard(value, documentRef) {
  return new Promise((resolve, reject) => {
    if (!documentRef?.body || typeof documentRef.createElement !== "function") {
      reject(new Error("No document copy fallback available."));
      return;
    }

    const textarea = documentRef.createElement("textarea");
    textarea.value = value;
    if (typeof textarea.setAttribute === "function") {
      textarea.setAttribute("readonly", "readonly");
    }

    if (textarea.style) {
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
    }

    documentRef.body.appendChild(textarea);

    if (typeof textarea.select === "function") {
      textarea.select();
    }

    const didCopy =
      typeof documentRef.execCommand === "function" &&
      documentRef.execCommand("copy");

    documentRef.body.removeChild(textarea);

    if (didCopy) {
      resolve();
      return;
    }

    reject(new Error("Clipboard API unavailable."));
  });
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
