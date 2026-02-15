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
