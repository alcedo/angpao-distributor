import { Keypair } from "@solana/web3.js";
import { createStore } from "./state/store.js";
import {
  canRunWalletRequiredActions,
  getRunRecipientStats,
  isWalletConnected,
} from "./state/selectors.js";
import { parseRecipientsCsv } from "./domain/csvRecipients.js";
import { serializeWalletsCsv, serializeWalletsJson } from "./domain/exporters.js";
import { validateWalletCount } from "./domain/validation.js";
import { createConnectionContext } from "./solana/connection.js";
import {
  classifyPhantomConnectError,
  connectPhantom,
  disconnectPhantom,
  getPhantomProvider,
} from "./solana/phantomProvider.js";
import {
  mintClassicSplTokenToOwner,
  normalizeMintDecimals,
} from "./solana/mintService.js";
import { fetchClassicSplTokenHoldings } from "./solana/tokenService.js";
import {
  bindMintEvents,
  bindNetworkWalletEvents,
  bindRecipientEvents,
  bindTabEvents,
  bindTokenEvents,
  bindWalletEvents,
} from "./ui/events.js";
import {
  renderMintWizardState,
  renderNetworkWalletState,
  renderRecipientImportState,
  renderTokenInventoryState,
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
  recipientsCsvInput: "recipients-csv-input",
  importRecipientsBtn: "import-recipients-btn",
  clearRecipientsBtn: "clear-recipients-btn",
  recipientSummary: "recipient-summary",
  recipientDiagnostics: "recipient-diagnostics",
  tokenMintSelect: "token-mint-select",
  tokenPicker: "token-picker",
  tokenPickerSummary: "token-picker-summary",
  tokenPickerLabel: "token-picker-label",
  tokenPickerIcon: "token-picker-icon",
  tokenOptionList: "token-option-list",
  tokenInventoryStatus: "token-inventory-status",
  mintDecimalsInput: "mint-decimals",
  mintSupplyInput: "mint-initial-supply",
  mintCreateBtn: "mint-create-btn",
  mintMainnetAcknowledge: "mint-mainnet-ack",
  mintMainnetHint: "mint-mainnet-hint",
  mintStatus: "mint-status",
  toolTabMintTestToken: "tool-tab-mint-test-token",
  toolPanelWalletGenerator: "tool-panel-wallet-generator",
  toolPanelMintTestToken: "tool-panel-mint-test-token",
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
  const fetchTokenInventoryRef =
    options.fetchTokenInventory ||
    ((connection, ownerPublicKey) => fetchClassicSplTokenHoldings(connection, ownerPublicKey));
  const mintClassicSplTokenRef =
    options.mintClassicSplToken ||
    ((params) => mintClassicSplTokenToOwner(params));
  let tokenInventoryLoadRequestId = 0;

  const store = createStore({
    cluster,
    generatedWallets: [],
    showPrivateKeys: false,
    phantom: {
      isConnected: false,
      publicKey: null,
    },
    connection: connectionContext,
    importedRecipients: [],
    recipientImport: {
      invalidRows: [],
      duplicateCount: 0,
      totalRows: 0,
    },
    tokenInventory: createIdleTokenInventory(),
    mintWizard: createIdleMintWizardState(),
    activeWorkflow: "wallet-disbursement",
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

  function refreshRecipientImportView() {
    const state = getState();
    const runRecipientStats = getRunRecipientStats(state);
    renderRecipientImportState(optionalElements, {
      generatedCount: runRecipientStats.generatedCount,
      importedCount: runRecipientStats.importedCount,
      runReadyCount: runRecipientStats.recipients.length,
      runSetDuplicateCount: runRecipientStats.duplicatesSkipped,
      invalidRows: state.recipientImport.invalidRows,
      duplicateCount: state.recipientImport.duplicateCount,
    });
  }

  function refreshTokenInventoryView() {
    const state = getState();
    renderTokenInventoryState(optionalElements, {
      status: state.tokenInventory.status,
      items: state.tokenInventory.items,
      selectedMint: state.tokenInventory.selectedMint,
      cluster: state.cluster,
      error: state.tokenInventory.error,
    });
  }

  function refreshMintWizardView() {
    const state = getState();
    renderMintWizardState(optionalElements, {
      isConnected: isWalletConnected(state),
      isMinting: state.mintWizard.isMinting,
      cluster: state.cluster,
      error: state.mintWizard.error,
      lastMint: state.mintWizard.lastMint,
    });
  }

  function renderActiveWorkflowView() {
    const state = getState();
    const isWalletWorkflow = state.activeWorkflow !== "mint-test-token";
    const mintToggleButton = optionalElements.toolTabMintTestToken;
    const walletPanel = optionalElements.toolPanelWalletGenerator;
    const mintPanel = optionalElements.toolPanelMintTestToken;

    if (mintToggleButton) {
      mintToggleButton.textContent = isWalletWorkflow
        ? "Mint Test Token"
        : "Back to Wallet Generator";
      mintToggleButton.ariaPressed = String(!isWalletWorkflow);
    }

    if (walletPanel) {
      walletPanel.hidden = !isWalletWorkflow;
    }

    if (mintPanel) {
      mintPanel.hidden = isWalletWorkflow;
    }
  }

  function onToggleMintWorkflow() {
    const state = getState();
    const nextWorkflow =
      state.activeWorkflow === "mint-test-token"
        ? "wallet-disbursement"
        : "mint-test-token";
    setState({
      ...state,
      activeWorkflow: nextWorkflow,
    });
    renderActiveWorkflowView();
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
      refreshRecipientImportView();
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
    setState({
      ...getState(),
      generatedWallets: [],
      importedRecipients: [],
      recipientImport: {
        invalidRows: [],
        duplicateCount: 0,
        totalRows: 0,
      },
      showPrivateKeys: false,
    });
    elements.walletCountInput.value = "10";
    elements.toggleKeysBtn.textContent = "Reveal private keys";
    if (optionalElements.recipientsCsvInput) {
      optionalElements.recipientsCsvInput.value = "";
    }
    refreshWalletView();
    refreshRecipientImportView();
    setStatus(elements.statusEl, "Cleared generated wallets and imported recipients.");
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

  function clearTokenInventoryState() {
    tokenInventoryLoadRequestId += 1;
    setState({
      ...getState(),
      tokenInventory: createIdleTokenInventory(),
    });
    refreshTokenInventoryView();
  }

  function resetMintWizardState() {
    setState({
      ...getState(),
      mintWizard: createIdleMintWizardState(),
    });
    refreshMintWizardView();
  }

  async function refreshTokenInventory(options = {}) {
    const state = getState();
    if (!isWalletConnected(state)) {
      clearTokenInventoryState();
      return {
        status: "idle",
        count: 0,
      };
    }

    const ownerPublicKey = state.phantom.publicKey;
    const loadedFor = {
      cluster: state.cluster,
      owner: ownerPublicKey,
    };
    const requestId = ++tokenInventoryLoadRequestId;

    setState({
      ...state,
      tokenInventory: {
        ...state.tokenInventory,
        status: "loading",
        items: [],
        selectedMint: null,
        loadedFor,
        error: null,
      },
    });
    refreshTokenInventoryView();

    try {
      const inventory = await fetchTokenInventoryRef(state.connection.connection, ownerPublicKey);
      if (requestId !== tokenInventoryLoadRequestId) {
        return {
          status: "stale",
          count: 0,
        };
      }

      const nextSelectedMint = pickSelectedMint(
        inventory,
        options.preferredSelectedMint || state.tokenInventory.selectedMint,
      );

      setState({
        ...getState(),
        tokenInventory: {
          status: "ready",
          items: inventory,
          selectedMint: nextSelectedMint,
          loadedFor,
          error: null,
        },
      });
      refreshTokenInventoryView();

      return {
        status: "ready",
        count: inventory.length,
      };
    } catch (error) {
      if (requestId !== tokenInventoryLoadRequestId) {
        return {
          status: "stale",
          count: 0,
        };
      }

      setState({
        ...getState(),
        tokenInventory: {
          status: "error",
          items: [],
          selectedMint: null,
          loadedFor,
          error: formatTokenInventoryError(error),
        },
      });
      refreshTokenInventoryView();
      throw error;
    }
  }

  async function onClusterChange(event) {
    const nextCluster = event.target.value;
    try {
      const nextConnection = createConnectionContextRef(nextCluster);
      const state = getState();
      setState({
        ...state,
        cluster: nextCluster,
        connection: nextConnection,
        mintWizard: {
          ...state.mintWizard,
          error: null,
          lastMint: null,
        },
      });
      refreshNetworkWalletView();
      refreshMintWizardView();

      if (!isWalletConnected(getState())) {
        clearTokenInventoryState();
        setStatus(elements.statusEl, `Active cluster set to ${nextCluster}.`);
        return;
      }

      try {
        const inventoryResult = await refreshTokenInventory();
        if (inventoryResult.status === "ready") {
          setStatus(
            elements.statusEl,
            `Active cluster set to ${nextCluster}. Loaded ${inventoryResult.count} token mint(s).`,
          );
        }
      } catch (inventoryError) {
        console.error(inventoryError);
        setStatus(
          elements.statusEl,
          `Active cluster set to ${nextCluster}, but token inventory failed to load.`,
          true,
        );
      }
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
        const currentState = getState();
        setState({
          ...currentState,
          phantom: {
            isConnected: true,
            publicKey,
          },
          mintWizard: {
            ...currentState.mintWizard,
            error: null,
          },
        });
        refreshNetworkWalletView();
        refreshMintWizardView();

        try {
          const inventoryResult = await refreshTokenInventory();
          if (inventoryResult.status === "ready") {
            setStatus(
              elements.statusEl,
              `Connected to Phantom wallet. Loaded ${inventoryResult.count} token mint(s).`,
            );
          }
        } catch (inventoryError) {
          console.error(inventoryError);
          setStatus(
            elements.statusEl,
            `Connected to Phantom wallet, but token inventory failed to load.`,
            true,
          );
        }
      } catch (error) {
        console.error(error);
        clearTokenInventoryState();
        resetMintWizardState();
        setState({
          ...getState(),
          phantom: {
            isConnected: false,
            publicKey: null,
          },
        });
        setStatus(
          elements.statusEl,
          getPhantomConnectFailureMessage(error),
          true,
        );
      }

      refreshNetworkWalletView();
      refreshMintWizardView();
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
      clearTokenInventoryState();
      resetMintWizardState();
      setStatus(elements.statusEl, "Disconnected from Phantom wallet.");
    } catch (error) {
      console.error(error);
      setStatus(elements.statusEl, `Phantom disconnect failed: ${error.message}`, true);
    }

    refreshNetworkWalletView();
    refreshMintWizardView();
  }

  function onTokenSelectionChange(event) {
    const selectedMint = event?.target?.value || null;
    const state = getState();
    setState({
      ...state,
      tokenInventory: {
        ...state.tokenInventory,
        selectedMint,
      },
    });
    refreshTokenInventoryView();
  }

  function onTokenOptionPick(event) {
    const selectedMint = getTokenMintFromEvent(event);
    if (!selectedMint) {
      return;
    }

    if (optionalElements.tokenMintSelect) {
      optionalElements.tokenMintSelect.value = selectedMint;
    }
    onTokenSelectionChange({
      target: {
        value: selectedMint,
      },
    });

    if (optionalElements.tokenPicker) {
      optionalElements.tokenPicker.open = false;
    }
  }

  async function onMintCreate() {
    const state = getState();
    if (state.mintWizard.isMinting) {
      return;
    }
    if (!isWalletConnected(state)) {
      setStatus(elements.statusEl, "Connect Phantom before minting a token.", true);
      setState({
        ...state,
        mintWizard: {
          ...state.mintWizard,
          error: "Phantom wallet is not connected.",
        },
      });
      refreshMintWizardView();
      return;
    }

    const decimalsInput = optionalElements.mintDecimalsInput?.value || "";
    const initialSupplyUi = optionalElements.mintSupplyInput?.value || "";

    let decimals;
    try {
      decimals = normalizeMintDecimals(decimalsInput);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(elements.statusEl, message, true);
      setState({
        ...state,
        mintWizard: {
          ...state.mintWizard,
          error: message,
        },
      });
      refreshMintWizardView();
      return;
    }

    if (
      state.cluster === "mainnet-beta" &&
      optionalElements.mintMainnetAcknowledge &&
      !optionalElements.mintMainnetAcknowledge.checked
    ) {
      const message =
        "Mainnet mint acknowledgement is required before minting on mainnet-beta.";
      setStatus(elements.statusEl, message, true);
      setState({
        ...state,
        mintWizard: {
          ...state.mintWizard,
          error: message,
        },
      });
      refreshMintWizardView();
      return;
    }

    setState({
      ...state,
      mintWizard: {
        ...state.mintWizard,
        isMinting: true,
        error: null,
      },
    });
    refreshMintWizardView();
    setStatus(elements.statusEl, "Submitting mint transaction to Phantom...");

    try {
      const mintResult = await mintClassicSplTokenRef({
        connection: state.connection.connection,
        provider: phantomProvider,
        ownerPublicKey: state.phantom.publicKey,
        decimals,
        initialSupplyUi,
      });

      setState({
        ...getState(),
        mintWizard: {
          isMinting: false,
          error: null,
          lastMint: {
            ...mintResult,
            cluster: state.cluster,
          },
        },
      });
      refreshMintWizardView();

      const inventoryResult = await refreshTokenInventory({
        preferredSelectedMint: mintResult.mint,
      });
      if (optionalElements.mintMainnetAcknowledge) {
        optionalElements.mintMainnetAcknowledge.checked = false;
      }

      setStatus(
        elements.statusEl,
        `Mint created ${formatShortAddress(mintResult.mint)}. Loaded ${inventoryResult.count} token mint(s).`,
      );
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      const currentState = getState();
      setState({
        ...currentState,
        mintWizard: {
          ...currentState.mintWizard,
          isMinting: false,
          error: message,
        },
      });
      refreshMintWizardView();
      setStatus(elements.statusEl, `Mint flow failed: ${message}`, true);
    }
  }

  async function onImportRecipients() {
    const fileInput = optionalElements.recipientsCsvInput;
    const file = fileInput?.files?.[0];
    if (!file) {
      setStatus(elements.statusEl, "Choose a CSV file before importing recipients.", true);
      return;
    }

    try {
      const csvText = await readTextFile(file);
      const parsed = parseRecipientsCsv(csvText);
      const nextState = {
        ...getState(),
        importedRecipients: parsed.recipients,
        recipientImport: {
          invalidRows: parsed.invalidRows,
          duplicateCount: parsed.duplicateCount,
          totalRows: parsed.totalRows,
        },
      };
      setState(nextState);
      const runRecipientStats = getRunRecipientStats(nextState);

      refreshRecipientImportView();
      setStatus(
        elements.statusEl,
        `Recipient import complete: ${parsed.recipients.length} valid, ` +
          `${parsed.invalidRows.length} invalid, ${parsed.duplicateCount} duplicates skipped. ` +
          `Run set now has ${runRecipientStats.recipients.length} unique recipient(s).`,
      );
    } catch (error) {
      console.error(error);
      setStatus(elements.statusEl, `Failed to import recipients CSV: ${error.message}`, true);
    }
  }

  function onClearRecipients() {
    const nextState = {
      ...getState(),
      importedRecipients: [],
      recipientImport: {
        invalidRows: [],
        duplicateCount: 0,
        totalRows: 0,
      },
    };
    setState(nextState);
    const runRecipientStats = getRunRecipientStats(nextState);

    if (optionalElements.recipientsCsvInput) {
      optionalElements.recipientsCsvInput.value = "";
    }

    refreshRecipientImportView();
    setStatus(
      elements.statusEl,
      `Cleared imported recipients. Run set now has ${runRecipientStats.recipients.length} unique recipient(s).`,
    );
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

  bindRecipientEvents(optionalElements, {
    onImportRecipients,
    onClearRecipients,
  });

  bindTokenEvents(optionalElements, {
    onTokenSelectionChange,
    onTokenOptionPick,
  });

  bindMintEvents(optionalElements, {
    onMintCreate,
  });

  bindTabEvents(optionalElements, {
    onToggleMintWorkflow,
  });

  refreshWalletView();
  refreshNetworkWalletView();
  refreshRecipientImportView();
  refreshTokenInventoryView();
  refreshMintWizardView();
  renderActiveWorkflowView();
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
    refreshTokenInventory,
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

function createIdleTokenInventory() {
  return {
    status: "idle",
    items: [],
    selectedMint: null,
    loadedFor: null,
    error: null,
  };
}

function createIdleMintWizardState() {
  return {
    isMinting: false,
    error: null,
    lastMint: null,
  };
}

function pickSelectedMint(items, previousSelectedMint) {
  if (
    previousSelectedMint &&
    items.some((item) => item.mint === previousSelectedMint)
  ) {
    return previousSelectedMint;
  }

  if (items.length === 1) {
    return items[0].mint;
  }

  return null;
}

function formatShortAddress(value) {
  const text = String(value || "");
  if (text.length <= 12) {
    return text;
  }
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function getTokenMintFromEvent(event) {
  const target = event?.target;
  if (!target) {
    return "";
  }

  if (typeof target.closest === "function") {
    const button = target.closest("[data-token-mint]");
    if (button?.dataset?.tokenMint) {
      return button.dataset.tokenMint;
    }
  }

  return target?.dataset?.tokenMint || "";
}

function getPhantomConnectFailureMessage(error) {
  const classification = classifyPhantomConnectError(error);

  if (classification === "locked") {
    return "Phantom wallet is locked. Unlock Phantom and try connecting again.";
  }

  if (classification === "rejected") {
    return "Phantom connect request was not approved. If Phantom is locked, unlock it and try again.";
  }

  const baseMessage = error instanceof Error ? error.message : String(error || "");
  return `Phantom connect failed: ${baseMessage || "unknown error"}. If Phantom is locked, unlock it and try again.`;
}

function formatTokenInventoryError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  if (normalized.includes("403") && normalized.includes("forbidden")) {
    return "RPC endpoint denied token-balance lookup (403 Access Forbidden). Try again later or switch RPC endpoint.";
  }
  return message || "Unknown token inventory error.";
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

function readTextFile(fileRef) {
  if (!fileRef) {
    return Promise.resolve("");
  }

  if (typeof fileRef.text === "function") {
    return fileRef.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read file contents."));
    reader.readAsText(fileRef);
  });
}
