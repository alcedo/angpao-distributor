import { PublicKey } from "@solana/web3.js";

export const CLUSTERS = ["devnet", "testnet", "mainnet-beta"];

export function validateWalletCount(rawCount) {
  const count = Number(rawCount);
  if (!Number.isFinite(count) || count < 1 || count > 100) {
    return {
      ok: false,
      error: "Please enter a number between 1 and 100.",
    };
  }
  if (!Number.isInteger(count)) {
    return {
      ok: false,
      error: "Please enter a number between 1 and 100.",
    };
  }

  return {
    ok: true,
    count,
  };
}

export function isValidSolanaAddress(rawAddress) {
  const address = String(rawAddress || "").trim();
  if (!address) {
    return false;
  }

  try {
    const parsed = new PublicKey(address);
    return parsed.toBase58() === address;
  } catch (_error) {
    return false;
  }
}
