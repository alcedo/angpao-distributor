const test = require("node:test");
const assert = require("node:assert/strict");

const { createWalletGeneratorApp } = require("../app.js");

function createEvent(type) {
  return {
    type,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
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
    createElement(tagName) {
      if (tagName === "a") {
        return createMockElement();
      }
      return createMockElement();
    },
  };

  return { documentRef, elements };
}

function createMockWeb3() {
  let counter = 0;
  return {
    Keypair: {
      generate() {
        counter += 1;
        return {
          publicKey: {
            toBase58() {
              return `pub-${counter}`;
            },
          },
          secretKey: new Uint8Array([counter, counter + 1, counter + 2]),
        };
      },
    },
  };
}

test("submit generates wallets and enables controls", async () => {
  const { documentRef, elements } = createMockDocument();
  const web3 = createMockWeb3();
  let tick = 0;

  createWalletGeneratorApp({
    document: documentRef,
    web3,
    now: () => {
      tick += 1;
      return tick === 1 ? 100 : 132;
    },
    requestAnimationFrame: (callback) => callback(),
    base64Encode: (binary) => Buffer.from(binary, "binary").toString("base64"),
  });

  elements["wallet-count"].value = "3";
  await elements["generator-form"].dispatchEvent(createEvent("submit"));

  assert.equal(elements["count-badge"].textContent, "3 wallets");
  assert.match(elements["wallet-table-body"].innerHTML, /pub-1/);
  assert.equal(elements["clear-btn"].disabled, false);
  assert.equal(elements["toggle-keys-btn"].disabled, false);
  assert.equal(elements["download-csv-btn"].disabled, false);
  assert.equal(elements["download-json-btn"].disabled, false);
  assert.equal(elements["generate-btn"].disabled, false);
  assert.match(elements.status.textContent, /Generated 3 wallet\(s\) in 32ms\./);
});

test("invalid count shows error status", async () => {
  const { documentRef, elements } = createMockDocument();

  createWalletGeneratorApp({
    document: documentRef,
    web3: createMockWeb3(),
    requestAnimationFrame: (callback) => callback(),
    base64Encode: (binary) => Buffer.from(binary, "binary").toString("base64"),
  });

  elements["wallet-count"].value = "0";
  await elements["generator-form"].dispatchEvent(createEvent("submit"));

  assert.equal(elements.status.textContent, "Please enter a number between 1 and 5000.");
  assert.equal(elements.status.classList.contains("error"), true);
});

test("missing web3 disables generate controls on init", () => {
  const { documentRef, elements } = createMockDocument();

  createWalletGeneratorApp({
    document: documentRef,
  });

  assert.equal(elements["generate-btn"].disabled, true);
  assert.equal(elements["wallet-count"].disabled, true);
  assert.match(elements.status.textContent, /Unable to load Solana Web3 library/);
  assert.equal(elements.status.classList.contains("error"), true);
});

test("toggle and clear keep UI state consistent", async () => {
  const { documentRef, elements } = createMockDocument();

  createWalletGeneratorApp({
    document: documentRef,
    web3: createMockWeb3(),
    requestAnimationFrame: (callback) => callback(),
    base64Encode: (binary) => Buffer.from(binary, "binary").toString("base64"),
  });

  elements["wallet-count"].value = "1";
  await elements["generator-form"].dispatchEvent(createEvent("submit"));

  await elements["toggle-keys-btn"].dispatchEvent(createEvent("click"));
  assert.equal(elements["toggle-keys-btn"].textContent, "Hide private keys");

  await elements["clear-btn"].dispatchEvent(createEvent("click"));
  assert.equal(elements["count-badge"].textContent, "0 wallets");
  assert.equal(elements["clear-btn"].disabled, true);
  assert.equal(elements["wallet-count"].value, "10");
  assert.match(elements["wallet-table-body"].innerHTML, /No wallets generated yet/);
});
