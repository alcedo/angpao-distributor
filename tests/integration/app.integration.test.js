import { describe, expect, it } from "vitest";
import { createWalletGeneratorApp } from "../../src/app.js";

function createEvent(type, extra = {}) {
  return {
    type,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...extra,
  };
}

function createMockElement(initial = {}) {
  const listeners = {};
  const classes = new Set(initial.classNames || []);

  return {
    value: initial.value || "",
    textContent: initial.textContent || "",
    innerHTML: initial.innerHTML || "",
    disabled: Boolean(initial.disabled),
    checked: Boolean(initial.checked),
    open: Boolean(initial.open),
    src: initial.src || "",
    files: initial.files || [],
    href: "",
    download: "",
    classList: {
      toggle(token, force) {
        if (force === true) {
          classes.add(token);
          return true;
        }
        if (force === false) {
          classes.delete(token);
          return false;
        }
        if (classes.has(token)) {
          classes.delete(token);
          return false;
        }
        classes.add(token);
        return true;
      },
      contains(token) {
        return classes.has(token);
      },
    },
    addEventListener(type, callback) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(callback);
    },
    async dispatchEvent(event) {
      const callbacks = listeners[event.type] || [];
      for (const callback of callbacks) {
        await callback(event);
      }
      return !event.defaultPrevented;
    },
    click() {
      return this.dispatchEvent(createEvent("click"));
    },
  };
}

function createMockDocument() {
  const elements = {
    "generator-form": createMockElement(),
    "wallet-count": createMockElement({ value: "10" }),
    status: createMockElement({ textContent: "Ready." }),
    "wallet-table-body": createMockElement({
      innerHTML: '<tr><td colspan="3" class="empty">No wallets generated yet.</td></tr>',
    }),
    "count-badge": createMockElement({ textContent: "0 wallets" }),
    "generate-btn": createMockElement(),
    "clear-btn": createMockElement({ disabled: true }),
    "toggle-keys-btn": createMockElement({
      textContent: "Reveal private keys",
      disabled: true,
    }),
    "download-csv-btn": createMockElement({ disabled: true }),
    "download-json-btn": createMockElement({ disabled: true }),
    "cluster-select": createMockElement({ value: "devnet" }),
    "phantom-connect-btn": createMockElement({ disabled: true }),
    "phantom-status": createMockElement(),
    "recipients-csv-input": createMockElement(),
    "import-recipients-btn": createMockElement(),
    "clear-recipients-btn": createMockElement({ disabled: true }),
    "recipient-summary": createMockElement({ textContent: "No CSV recipients imported." }),
    "recipient-diagnostics": createMockElement(),
    "token-mint-select": createMockElement({ disabled: true }),
    "token-picker": createMockElement(),
    "token-picker-summary": createMockElement(),
    "token-picker-label": createMockElement({ textContent: "Connect Phantom first" }),
    "token-picker-icon": createMockElement(),
    "token-option-list": createMockElement(),
    "token-inventory-status": createMockElement({
      textContent: "Connect Phantom to load SPL token balances for distribution.",
    }),
    "mint-decimals": createMockElement({ value: "9", disabled: true }),
    "mint-initial-supply": createMockElement({ value: "1000", disabled: true }),
    "mint-create-btn": createMockElement({
      disabled: true,
      textContent: "Create Mint + Mint Supply",
    }),
    "mint-mainnet-ack": createMockElement({ checked: false, disabled: true }),
    "mint-mainnet-hint": createMockElement(),
    "mint-status": createMockElement({
      textContent: "Connect Phantom to create and mint a classic SPL token.",
    }),
  };

  const bodyChildren = [];
  const documentRef = {
    body: {
      appendChild(node) {
        bodyChildren.push(node);
      },
      removeChild(node) {
        const index = bodyChildren.indexOf(node);
        if (index >= 0) {
          bodyChildren.splice(index, 1);
        }
      },
    },
    getElementById(id) {
      return elements[id] || null;
    },
    createElement() {
      return createMockElement();
    },
  };

  return { documentRef, elements };
}

function createMockKeypairGenerator(publicKeys = []) {
  let counter = 0;
  return {
    generate() {
      counter += 1;
      return {
        publicKey: {
          toBase58() {
            return publicKeys[counter - 1] || `pub-${counter}`;
          },
        },
        secretKey: new Uint8Array([counter, counter + 1, counter + 2]),
      };
    },
  };
}

function createConnectionContext(cluster) {
  return {
    cluster,
    endpoint: `https://${cluster}.example.invalid`,
    connection: {
      cluster,
      async getParsedTokenAccountsByOwner() {
        return { value: [] };
      },
    },
  };
}

function createMockPhantomProvider(options = {}) {
  let connected = false;
  let publicKeyValue = null;

  return {
    isPhantom: true,
    async connect() {
      if (options.connectError) {
        throw options.connectError;
      }
      connected = true;
      publicKeyValue =
        options.publicKey || "11111111111111111111111111111111";
      return {
        publicKey: {
          toString() {
            return publicKeyValue;
          },
        },
      };
    },
    async disconnect() {
      connected = false;
      publicKeyValue = null;
    },
    get publicKey() {
      if (!connected || !publicKeyValue) {
        return null;
      }
      return {
        toString() {
          return publicKeyValue;
        },
      };
    },
  };
}

describe("createWalletGeneratorApp", () => {
  it("submit generates wallets and enables controls", async () => {
    const { documentRef, elements } = createMockDocument();
    let tick = 0;

    createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider(),
      createConnectionContext,
      now: () => {
        tick += 1;
        return tick === 1 ? 100 : 132;
      },
      requestAnimationFrame: (callback) => callback(),
      base64Encode: (binary) => Buffer.from(binary, "binary").toString("base64"),
    });

    elements["wallet-count"].value = "3";
    await elements["generator-form"].dispatchEvent(createEvent("submit"));

    expect(elements["count-badge"].textContent).toBe("3 wallets");
    expect(elements["wallet-table-body"].innerHTML).toMatch(/pub-1/);
    expect(elements["clear-btn"].disabled).toBe(false);
    expect(elements["toggle-keys-btn"].disabled).toBe(false);
    expect(elements["download-csv-btn"].disabled).toBe(false);
    expect(elements["download-json-btn"].disabled).toBe(false);
    expect(elements["generate-btn"].disabled).toBe(false);
    expect(elements.status.textContent).toMatch(/Generated 3 wallet\(s\) in 32ms\./);
  });

  it("cluster selector updates state and status", async () => {
    const { documentRef, elements } = createMockDocument();

    const app = createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider(),
      createConnectionContext,
    });

    elements["cluster-select"].value = "testnet";
    await elements["cluster-select"].dispatchEvent(
      createEvent("change", { target: elements["cluster-select"] }),
    );

    expect(app.getState().cluster).toBe("testnet");
    expect(app.getState().connection.endpoint).toContain("testnet");
    expect(elements.status.textContent).toBe("Active cluster set to testnet.");
  });

  it("connect button is disabled when provider is missing", () => {
    const { documentRef, elements } = createMockDocument();

    createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: null,
      createConnectionContext,
    });

    expect(elements["phantom-connect-btn"].disabled).toBe(true);
    expect(elements["phantom-status"].textContent).toMatch(/Phantom not detected/);
  });

  it("connect and disconnect update wallet state", async () => {
    const { documentRef, elements } = createMockDocument();
    const app = createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider({
        publicKey: "So11111111111111111111111111111111111111112",
      }),
      createConnectionContext,
    });

    await elements["phantom-connect-btn"].dispatchEvent(createEvent("click"));
    expect(app.getState().phantom.isConnected).toBe(true);
    expect(app.getState().phantom.publicKey).toBe(
      "So11111111111111111111111111111111111111112",
    );
    expect(app.getState().tokenInventory.status).toBe("ready");
    expect(app.getState().tokenInventory.items).toHaveLength(0);
    expect(elements["phantom-connect-btn"].textContent).toBe("Disconnect Phantom");
    expect(elements["phantom-status"].textContent).toMatch(/Connected:/);

    await elements["phantom-connect-btn"].dispatchEvent(createEvent("click"));
    expect(app.getState().phantom.isConnected).toBe(false);
    expect(app.getState().phantom.publicKey).toBeNull();
    expect(app.getState().tokenInventory.status).toBe("idle");
    expect(elements["phantom-connect-btn"].textContent).toBe("Connect Phantom");
    expect(elements.status.textContent).toBe("Disconnected from Phantom wallet.");
  });

  it("loads token inventory on connect and renders selector", async () => {
    const { documentRef, elements } = createMockDocument();
    const app = createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider({ publicKey: "PkInventory123456" }),
      createConnectionContext,
      fetchTokenInventory: async () => [
        {
          mint: "So11111111111111111111111111111111111111112",
          decimals: 9,
          balanceRaw: 1250000000n,
          balanceUi: "1.25",
          name: "Wrapped SOL",
          displayName: "Wrapped SOL",
          logoUrl: "https://example.com/wsol.png",
        },
      ],
    });

    await elements["phantom-connect-btn"].dispatchEvent(createEvent("click"));

    expect(app.getState().tokenInventory.status).toBe("ready");
    expect(app.getState().tokenInventory.items).toHaveLength(1);
    expect(app.getState().tokenInventory.selectedMint).toBe(
      "So11111111111111111111111111111111111111112",
    );
    expect(elements["token-mint-select"].disabled).toBe(false);
    expect(elements["token-mint-select"].value).toBe(
      "So11111111111111111111111111111111111111112",
    );
    expect(elements["token-mint-select"].innerHTML).toMatch(/Wrapped SOL \(1.25\)/);
    expect(elements["token-picker-label"].textContent).toBe("Wrapped SOL (1.25)");
    expect(elements["token-picker-icon"].src).toBe("https://example.com/wsol.png");
    expect(elements["token-option-list"].innerHTML).toMatch(/token-option-btn/);
    expect(elements["token-option-list"].innerHTML).toMatch(/Wrapped SOL/);
    expect(elements["token-inventory-status"].textContent).toMatch(
      /1 token mint\(s\) available for distribution/,
    );
  });

  it("clicking token option row updates selected mint and closes picker", async () => {
    const { documentRef, elements } = createMockDocument();
    const app = createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider({ publicKey: "PkSelect123456" }),
      createConnectionContext,
      fetchTokenInventory: async () => [
        {
          mint: "MintAAA",
          decimals: 6,
          balanceRaw: 1000000n,
          balanceUi: "1",
          displayName: "Token AAA",
          logoUrl: "https://example.com/a.png",
        },
        {
          mint: "MintBBB",
          decimals: 6,
          balanceRaw: 2500000n,
          balanceUi: "2.5",
          displayName: "Token BBB",
        },
      ],
    });

    await elements["phantom-connect-btn"].dispatchEvent(createEvent("click"));
    elements["token-picker"].open = true;
    await elements["token-option-list"].dispatchEvent(
      createEvent("click", { target: { dataset: { tokenMint: "MintBBB" } } }),
    );

    expect(app.getState().tokenInventory.selectedMint).toBe("MintBBB");
    expect(elements["token-picker"].open).toBe(false);
    expect(elements["token-picker-label"].textContent).toBe("Token BBB (2.5)");
    expect(elements["token-picker-icon"].src).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("refreshes token inventory when cluster changes while connected", async () => {
    const { documentRef, elements } = createMockDocument();
    const seenClusters = [];
    const app = createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider({ publicKey: "PkCluster123456" }),
      createConnectionContext,
      fetchTokenInventory: async (connection) => {
        seenClusters.push(connection.cluster);
        if (connection.cluster === "testnet") {
          return [
            {
              mint: "So11111111111111111111111111111111111111112",
              decimals: 9,
              balanceRaw: 500000000n,
              balanceUi: "0.5",
            },
          ];
        }
        return [];
      },
    });

    await elements["phantom-connect-btn"].dispatchEvent(createEvent("click"));
    elements["cluster-select"].value = "testnet";
    await elements["cluster-select"].dispatchEvent(
      createEvent("change", { target: elements["cluster-select"] }),
    );

    expect(seenClusters).toEqual(["devnet", "testnet"]);
    expect(app.getState().tokenInventory.loadedFor.cluster).toBe("testnet");
    expect(app.getState().tokenInventory.selectedMint).toBe(
      "So11111111111111111111111111111111111111112",
    );
    expect(elements.status.textContent).toMatch(/Active cluster set to testnet. Loaded 1 token mint/);
  });

  it("selector change updates selected mint state", async () => {
    const { documentRef, elements } = createMockDocument();
    const app = createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider({ publicKey: "PkSelect123456" }),
      createConnectionContext,
      fetchTokenInventory: async () => [
        {
          mint: "MintAAA",
          decimals: 6,
          balanceRaw: 1000000n,
          balanceUi: "1",
        },
        {
          mint: "MintBBB",
          decimals: 6,
          balanceRaw: 2500000n,
          balanceUi: "2.5",
        },
      ],
    });

    await elements["phantom-connect-btn"].dispatchEvent(createEvent("click"));

    expect(app.getState().tokenInventory.selectedMint).toBeNull();
    elements["token-mint-select"].value = "MintBBB";
    await elements["token-mint-select"].dispatchEvent(
      createEvent("change", { target: elements["token-mint-select"] }),
    );
    expect(app.getState().tokenInventory.selectedMint).toBe("MintBBB");
  });

  it("runs mint wizard and refreshes token inventory with new mint selected", async () => {
    const { documentRef, elements } = createMockDocument();
    let hasMinted = false;
    const mintCalls = [];
    const app = createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider({
        publicKey: "So11111111111111111111111111111111111111112",
      }),
      createConnectionContext,
      fetchTokenInventory: async () => {
        if (!hasMinted) {
          return [];
        }
        return [
          {
            mint: "MintNew111111111111111111111111111111111111",
            decimals: 9,
            balanceRaw: 1000000000000n,
            balanceUi: "1000",
          },
        ];
      },
      mintClassicSplToken: async (params) => {
        mintCalls.push(params);
        hasMinted = true;
        return {
          mint: "MintNew111111111111111111111111111111111111",
          ownerAta: "Ata111111111111111111111111111111111111111",
          signature: "MintSig111",
          decimals: params.decimals,
          amountRaw: 1000000000000n,
          initialSupplyUi: params.initialSupplyUi,
        };
      },
    });

    await elements["phantom-connect-btn"].dispatchEvent(createEvent("click"));
    elements["mint-decimals"].value = "9";
    elements["mint-initial-supply"].value = "1000";
    await elements["mint-create-btn"].dispatchEvent(createEvent("click"));

    expect(mintCalls).toHaveLength(1);
    expect(mintCalls[0].ownerPublicKey).toBe(
      "So11111111111111111111111111111111111111112",
    );
    expect(mintCalls[0].decimals).toBe(9);
    expect(mintCalls[0].initialSupplyUi).toBe("1000");
    expect(app.getState().mintWizard.lastMint.mint).toBe(
      "MintNew111111111111111111111111111111111111",
    );
    expect(app.getState().tokenInventory.selectedMint).toBe(
      "MintNew111111111111111111111111111111111111",
    );
    expect(elements["mint-status"].textContent).toMatch(/Last mint:/);
    expect(elements.status.textContent).toMatch(/Mint created/);
  });

  it("requires explicit mainnet acknowledgement before minting on mainnet-beta", async () => {
    const { documentRef, elements } = createMockDocument();
    const mintSpy = [];
    createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider({
        publicKey: "So11111111111111111111111111111111111111112",
      }),
      createConnectionContext,
      fetchTokenInventory: async () => [],
      mintClassicSplToken: async (params) => {
        mintSpy.push(params);
        return {
          mint: "MintGuard11111111111111111111111111111111111",
          ownerAta: "Ata111111111111111111111111111111111111111",
          signature: "sig",
          decimals: params.decimals,
          amountRaw: 1000n,
          initialSupplyUi: params.initialSupplyUi,
        };
      },
    });

    await elements["phantom-connect-btn"].dispatchEvent(createEvent("click"));
    elements["cluster-select"].value = "mainnet-beta";
    await elements["cluster-select"].dispatchEvent(
      createEvent("change", { target: elements["cluster-select"] }),
    );
    elements["mint-mainnet-ack"].checked = false;
    await elements["mint-create-btn"].dispatchEvent(createEvent("click"));

    expect(mintSpy).toHaveLength(0);
    expect(elements.status.textContent).toMatch(/Mainnet mint acknowledgement is required/);
    expect(elements.status.classList.contains("error")).toBe(true);
  });

  it("connect failure shows error and leaves state disconnected", async () => {
    const { documentRef, elements } = createMockDocument();
    const app = createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider({ connectError: new Error("User rejected") }),
      createConnectionContext,
    });

    await elements["phantom-connect-btn"].dispatchEvent(createEvent("click"));

    expect(app.getState().phantom.isConnected).toBe(false);
    expect(app.getState().phantom.publicKey).toBeNull();
    expect(elements.status.textContent).toMatch(/not approved/i);
    expect(elements.status.textContent).toMatch(/unlock/i);
    expect(elements.status.classList.contains("error")).toBe(true);
  });

  it("locked Phantom connect error surfaces unlock guidance", async () => {
    const { documentRef, elements } = createMockDocument();
    createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider({
        connectError: new Error("Wallet is locked"),
      }),
      createConnectionContext,
    });

    await elements["phantom-connect-btn"].dispatchEvent(createEvent("click"));

    expect(elements.status.textContent).toBe(
      "Phantom wallet is locked. Unlock Phantom and try connecting again.",
    );
    expect(elements.status.classList.contains("error")).toBe(true);
  });

  it("shows clean RPC access-forbidden error message for token inventory failures", async () => {
    const { documentRef, elements } = createMockDocument();
    createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider({
        publicKey: "So11111111111111111111111111111111111111112",
      }),
      createConnectionContext,
      fetchTokenInventory: async () => {
        throw new Error(
          '403 : [{"jsonrpc":"2.0","error":{"code":403,"message":"Access forbidden"}}]',
        );
      },
    });

    await elements["phantom-connect-btn"].dispatchEvent(createEvent("click"));

    expect(elements["token-inventory-status"].textContent).toBe(
      "Unable to load SPL token balances: RPC endpoint denied token-balance lookup (403 Access Forbidden). Try again later or switch RPC endpoint.",
    );
    expect(elements["token-mint-select"].innerHTML).toMatch(/Token load failed/);
    expect(elements.status.classList.contains("error")).toBe(true);
  });

  it("invalid count shows error status", async () => {
    const { documentRef, elements } = createMockDocument();

    createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider(),
      createConnectionContext,
      requestAnimationFrame: (callback) => callback(),
      base64Encode: (binary) => Buffer.from(binary, "binary").toString("base64"),
    });

    elements["wallet-count"].value = "101";
    await elements["generator-form"].dispatchEvent(createEvent("submit"));

    expect(elements.status.textContent).toBe("Please enter a number between 1 and 100.");
    expect(elements.status.classList.contains("error")).toBe(true);
  });

  it("missing keypair disables generate controls on init", () => {
    const { documentRef, elements } = createMockDocument();

    createWalletGeneratorApp({
      document: documentRef,
      keypair: {},
      phantomProvider: createMockPhantomProvider(),
      createConnectionContext,
    });

    expect(elements["generate-btn"].disabled).toBe(true);
    expect(elements["wallet-count"].disabled).toBe(true);
    expect(elements.status.textContent).toMatch(/Unable to load Solana Web3 library/);
    expect(elements.status.classList.contains("error")).toBe(true);
  });

  it("toggle and clear keep UI state consistent", async () => {
    const { documentRef, elements } = createMockDocument();

    createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider(),
      createConnectionContext,
      requestAnimationFrame: (callback) => callback(),
      base64Encode: (binary) => Buffer.from(binary, "binary").toString("base64"),
    });

    elements["wallet-count"].value = "1";
    await elements["generator-form"].dispatchEvent(createEvent("submit"));

    await elements["toggle-keys-btn"].dispatchEvent(createEvent("click"));
    expect(elements["toggle-keys-btn"].textContent).toBe("Hide private keys");

    await elements["clear-btn"].dispatchEvent(createEvent("click"));
    expect(elements["count-badge"].textContent).toBe("0 wallets");
    expect(elements["clear-btn"].disabled).toBe(true);
    expect(elements["wallet-count"].value).toBe("10");
    expect(elements["wallet-table-body"].innerHTML).toMatch(/No wallets generated yet/);
  });

  it("imports CSV recipients and shows diagnostics", async () => {
    const { documentRef, elements } = createMockDocument();
    const app = createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator(),
      phantomProvider: createMockPhantomProvider(),
      createConnectionContext,
    });

    elements["recipients-csv-input"].files = [
      {
        async text() {
          return [
            "address",
            "11111111111111111111111111111111",
            "invalid-key",
            "11111111111111111111111111111111",
          ].join("\n");
        },
      },
    ];

    await elements["import-recipients-btn"].dispatchEvent(createEvent("click"));

    expect(app.getState().importedRecipients).toHaveLength(1);
    expect(app.getState().recipientImport.invalidRows).toHaveLength(1);
    expect(app.getState().recipientImport.duplicateCount).toBe(1);
    expect(elements["recipient-summary"].textContent).toMatch(/Run set: 1 unique recipient/);
    expect(elements["clear-recipients-btn"].disabled).toBe(false);
    expect(elements.status.textContent).toMatch(
      /Recipient import complete: 1 valid, 1 invalid, 1 duplicates skipped. Run set now has 1 unique recipient\(s\)\./,
    );
  });

  it("builds a mixed generated and csv run set with cross-source dedupe", async () => {
    const { documentRef, elements } = createMockDocument();
    createWalletGeneratorApp({
      document: documentRef,
      keypair: createMockKeypairGenerator([
        "11111111111111111111111111111111",
      ]),
      phantomProvider: createMockPhantomProvider(),
      createConnectionContext,
      requestAnimationFrame: (callback) => callback(),
      base64Encode: (binary) => Buffer.from(binary, "binary").toString("base64"),
    });

    elements["wallet-count"].value = "1";
    await elements["generator-form"].dispatchEvent(createEvent("submit"));

    elements["recipients-csv-input"].files = [
      {
        async text() {
          return [
            "address",
            "11111111111111111111111111111111",
            "So11111111111111111111111111111111111111112",
          ].join("\n");
        },
      },
    ];

    await elements["import-recipients-btn"].dispatchEvent(createEvent("click"));

    expect(elements["recipient-summary"].textContent).toMatch(/Run set: 2 unique recipient/);
    expect(elements["recipient-summary"].textContent).toMatch(
      /1 cross-source duplicate\(s\) skipped/,
    );
    expect(elements.status.textContent).toMatch(/Run set now has 2 unique recipient\(s\)\./);
  });
});
