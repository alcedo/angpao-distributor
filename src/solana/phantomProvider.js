export function getPhantomProvider(globalRef = globalThis) {
  const provider = globalRef?.phantom?.solana;
  if (!provider || !provider.isPhantom) {
    return null;
  }
  return provider;
}

export async function connectPhantom(provider) {
  if (!provider) {
    throw new Error("Phantom provider not available.");
  }

  const response = await provider.connect();
  const publicKey =
    response?.publicKey?.toString?.() || provider.publicKey?.toString?.() || null;

  if (!publicKey) {
    throw new Error("Phantom connection did not return a public key.");
  }

  return { publicKey };
}

export async function disconnectPhantom(provider) {
  if (!provider) {
    return;
  }
  if (typeof provider.disconnect === "function") {
    await provider.disconnect();
  }
}

export function classifyPhantomConnectError(error) {
  const code = Number(error?.code);
  const message = String(error?.message || error || "").toLowerCase();

  if (
    message.includes("locked") ||
    message.includes("unlock phantom") ||
    message.includes("wallet is locked")
  ) {
    return "locked";
  }

  if (
    code === 4001 ||
    message.includes("user rejected") ||
    message.includes("rejected the request") ||
    message.includes("denied")
  ) {
    return "rejected";
  }

  if (message.includes("phantom provider not available")) {
    return "unavailable";
  }

  return "unknown";
}
