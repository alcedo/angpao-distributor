import {
  ACCOUNT_SIZE,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";
import { ed25519 } from "@noble/curves/ed25519";
import { Buffer } from "buffer/";

const COMMITMENT = "confirmed";
const ATA_LOOKUP_CHUNK_SIZE = 100;
const SAFETY_BUFFER_LAMPORTS = 2_000_000;
const FALLBACK_FEE_LAMPORTS = 5_000;
const textEncoder = new TextEncoder();

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

export async function inspectRecipientAtas(connection, mint, recipients) {
  if (!connection || typeof connection.getMultipleAccountsInfo !== "function") {
    throw new Error("Missing Solana connection for ATA inspection.");
  }

  const mintPublicKey = toPublicKey(mint);
  const normalizedRecipients = normalizeRecipients(recipients);
  const entries = normalizedRecipients.map((recipient) => {
    const recipientPublicKey = toPublicKey(recipient);
    const recipientAta = deriveAssociatedTokenAddress(mintPublicKey, recipientPublicKey);

    return {
      recipient: recipientPublicKey.toBase58(),
      recipientAta: recipientAta.toBase58(),
      needsAta: true,
    };
  });

  for (let index = 0; index < entries.length; index += ATA_LOOKUP_CHUNK_SIZE) {
    const chunk = entries.slice(index, index + ATA_LOOKUP_CHUNK_SIZE);
    const accountInfos = await connection.getMultipleAccountsInfo(
      chunk.map((entry) => new PublicKey(entry.recipientAta)),
    );

    for (let offset = 0; offset < chunk.length; offset += 1) {
      chunk[offset].needsAta = !accountInfos?.[offset];
    }
  }

  const missingAtaCount = entries.filter((entry) => entry.needsAta).length;
  const existingAtaCount = entries.length - missingAtaCount;

  return {
    mint: mintPublicKey.toBase58(),
    entries,
    missingAtaCount,
    existingAtaCount,
  };
}

export async function estimateDistributionHeadroom(
  connection,
  owner,
  mint,
  perRecipientRaw,
  ataInspection,
) {
  if (!connection) {
    throw new Error("Missing Solana connection for fee headroom estimation.");
  }
  if (typeof connection.getBalance !== "function") {
    throw new Error("Connection does not support balance lookup.");
  }
  if (typeof connection.getMinimumBalanceForRentExemption !== "function") {
    throw new Error("Connection does not support rent lookup.");
  }

  const ownerPublicKey = toPublicKey(owner);
  const mintPublicKey = toPublicKey(mint);
  const amountRaw = normalizeRawAmount(perRecipientRaw);
  if (amountRaw <= 0n) {
    throw new Error("Per-recipient amount must be greater than zero.");
  }

  const inspection = normalizeAtaInspection(ataInspection);
  const decimals = normalizeDecimals(inspection.decimals);
  const sourceAta = deriveAssociatedTokenAddress(mintPublicKey, ownerPublicKey);

  const fallbackEntry = inspection.entries[0];
  const existingEntry =
    inspection.entries.find((entry) => !entry.needsAta) || fallbackEntry;
  const missingEntry = inspection.entries.find((entry) => entry.needsAta) || fallbackEntry;

  const transferOnlyTx = buildDistributionTransaction({
    ownerPublicKey,
    mintPublicKey,
    sourceAta,
    recipientPublicKey: toPublicKey(existingEntry.recipient),
    recipientAta: toPublicKey(existingEntry.recipientAta),
    amountRaw,
    decimals,
    includeCreateAta: false,
  });
  const ataAndTransferTx = buildDistributionTransaction({
    ownerPublicKey,
    mintPublicKey,
    sourceAta,
    recipientPublicKey: toPublicKey(missingEntry.recipient),
    recipientAta: toPublicKey(missingEntry.recipientAta),
    amountRaw,
    decimals,
    includeCreateAta: true,
  });

  const [
    walletLamports,
    ataRentLamportsEach,
    feeExistingAtaLamports,
    feeMissingAtaLamports,
  ] = await Promise.all([
    connection.getBalance(ownerPublicKey, COMMITMENT),
    connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE, COMMITMENT),
    estimateTransactionFeeLamports(connection, transferOnlyTx, ownerPublicKey),
    estimateTransactionFeeLamports(connection, ataAndTransferTx, ownerPublicKey),
  ]);

  const requiredLamports =
    feeExistingAtaLamports * inspection.existingAtaCount +
    feeMissingAtaLamports * inspection.missingAtaCount +
    ataRentLamportsEach * inspection.missingAtaCount +
    SAFETY_BUFFER_LAMPORTS;
  const passes = walletLamports >= requiredLamports;

  return {
    walletLamports,
    requiredLamports,
    feeExistingAtaLamports,
    feeMissingAtaLamports,
    ataRentLamportsEach,
    missingAtaCount: inspection.missingAtaCount,
    safetyBufferLamports: SAFETY_BUFFER_LAMPORTS,
    passes,
  };
}

export async function runDistributionPreflight(
  connection,
  owner,
  mint,
  perRecipientRaw,
  ataInspection,
) {
  if (!connection || typeof connection.simulateTransaction !== "function") {
    throw new Error("Connection does not support transaction simulation.");
  }

  const ownerPublicKey = toPublicKey(owner);
  const mintPublicKey = toPublicKey(mint);
  const amountRaw = normalizeRawAmount(perRecipientRaw);
  const inspection = normalizeAtaInspection(ataInspection);
  const decimals = normalizeDecimals(inspection.decimals);
  const sourceAta = deriveAssociatedTokenAddress(mintPublicKey, ownerPublicKey);

  const failures = [];

  for (const entry of inspection.entries) {
    try {
      const tx = buildDistributionTransaction({
        ownerPublicKey,
        mintPublicKey,
        sourceAta,
        recipientPublicKey: toPublicKey(entry.recipient),
        recipientAta: toPublicKey(entry.recipientAta),
        amountRaw,
        decimals,
        includeCreateAta: entry.needsAta,
      });
      await assignRecentBlockhash(connection, tx);

      const simulationResult = await connection.simulateTransaction(tx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
        commitment: COMMITMENT,
      });
      const simulationError = simulationResult?.value?.err;

      if (simulationError) {
        failures.push({
          recipient: entry.recipient,
          error: formatSimulationError(simulationError, simulationResult?.value?.logs),
        });
      }
    } catch (error) {
      failures.push({
        recipient: entry.recipient,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const scannedCount = inspection.entries.length;
  const failedCount = failures.length;

  return {
    passed: failedCount === 0,
    scannedCount,
    failedCount,
    failures,
  };
}

function buildDistributionTransaction(params) {
  const {
    ownerPublicKey,
    mintPublicKey,
    sourceAta,
    recipientPublicKey,
    recipientAta,
    amountRaw,
    decimals,
    includeCreateAta,
  } = params;

  const tx = new Transaction({
    feePayer: ownerPublicKey,
  });

  if (includeCreateAta) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        ownerPublicKey,
        recipientAta,
        recipientPublicKey,
        mintPublicKey,
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  tx.add(
    createTransferCheckedInstructionCompat(
      sourceAta,
      mintPublicKey,
      recipientAta,
      ownerPublicKey,
      amountRaw,
      decimals,
    ),
  );

  return tx;
}

async function estimateTransactionFeeLamports(connection, tx, ownerPublicKey) {
  await assignRecentBlockhash(connection, tx);

  if (typeof connection.getFeeForMessage !== "function") {
    return FALLBACK_FEE_LAMPORTS;
  }

  try {
    const feeResult = await connection.getFeeForMessage(tx.compileMessage(), COMMITMENT);
    const feeValue = Number(feeResult?.value);
    if (Number.isSafeInteger(feeValue) && feeValue >= 0) {
      return feeValue;
    }
  } catch (_error) {
    // fall through to fallback estimate
  }

  if (!tx.feePayer) {
    tx.feePayer = ownerPublicKey;
  }
  return FALLBACK_FEE_LAMPORTS;
}

async function assignRecentBlockhash(connection, tx) {
  if (typeof connection.getLatestBlockhash !== "function") {
    return;
  }

  const latestBlockhash = await connection.getLatestBlockhash(COMMITMENT);
  tx.recentBlockhash = latestBlockhash.blockhash;
}

function formatSimulationError(error, logs) {
  const errorText = typeof error === "string" ? error : JSON.stringify(error);
  const firstLog = Array.isArray(logs) && logs.length > 0 ? logs[0] : "";
  if (firstLog) {
    return `${errorText} (${firstLog})`;
  }
  return errorText;
}

function normalizeAtaInspection(rawInspection) {
  const entries = Array.isArray(rawInspection?.entries) ? rawInspection.entries : [];
  if (!entries.length) {
    throw new Error("ATA inspection has no recipients.");
  }

  const normalizedEntries = entries.map((entry) => ({
    recipient: toPublicKey(entry?.recipient).toBase58(),
    recipientAta: toPublicKey(entry?.recipientAta).toBase58(),
    needsAta: Boolean(entry?.needsAta),
  }));
  const missingAtaCount = normalizedEntries.filter((entry) => entry.needsAta).length;

  return {
    ...rawInspection,
    entries: normalizedEntries,
    missingAtaCount,
    existingAtaCount: normalizedEntries.length - missingAtaCount,
  };
}

function normalizeRecipients(recipients) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error("No recipients provided for ATA inspection.");
  }

  return recipients.map((recipient) => {
    if (typeof recipient === "string") {
      return recipient;
    }
    return String(recipient?.publicAddress || "").trim();
  });
}

function normalizeRawAmount(value) {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return BigInt(value);
  }
  throw new Error("Amount must be a valid integer.");
}

function normalizeDecimals(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 18) {
    throw new Error("Token decimals are invalid for distribution planning.");
  }
  return parsed;
}

function toPublicKey(value) {
  if (value instanceof PublicKey) {
    return value;
  }
  return new PublicKey(value);
}

function deriveAssociatedTokenAddress(mintPublicKey, ownerPublicKey) {
  try {
    return getAssociatedTokenAddressSync(
      mintPublicKey,
      ownerPublicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
  } catch {
    const [derivedAta] = findProgramAddressSync(
      [ownerPublicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintPublicKey.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    return derivedAta;
  }
}

function findProgramAddressSync(seeds, programId) {
  let nonce = 255;

  while (nonce !== 0) {
    try {
      const address = createProgramAddressSync([...seeds, Uint8Array.of(nonce)], programId);
      return [address, nonce];
    } catch (error) {
      if (error instanceof TypeError) {
        throw error;
      }
      nonce -= 1;
    }
  }

  throw new Error("Unable to find a viable program address nonce");
}

function createProgramAddressSync(seeds, programId) {
  const preparedSeeds = [];
  for (const seed of seeds) {
    if (!(seed instanceof Uint8Array) && !ArrayBuffer.isView(seed) && !(seed instanceof ArrayBuffer)) {
      throw new TypeError("Invalid seed type");
    }
    const bytes = toUint8Array(seed);
    if (!bytes || bytes.length > 32) {
      throw new TypeError("Max seed length exceeded");
    }
    preparedSeeds.push(bytes);
  }

  const programAddressBuffer = concatByteArrays([
    ...preparedSeeds,
    programId.toBytes(),
    textEncoder.encode("ProgramDerivedAddress"),
  ]);
  const publicKeyBytes = sha256(programAddressBuffer);

  if (isOnCurve(publicKeyBytes)) {
    throw new Error("Invalid seeds, address must fall off the curve");
  }

  return new PublicKey(publicKeyBytes);
}

function concatByteArrays(parts) {
  const arrays = parts.map((part) => toUint8Array(part)).filter(Boolean);
  const totalLength = arrays.reduce((sum, bytes) => sum + bytes.length, 0);
  const out = new Uint8Array(totalLength);

  let offset = 0;
  for (const bytes of arrays) {
    out.set(bytes, offset);
    offset += bytes.length;
  }

  return out;
}

function toUint8Array(data) {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  return null;
}

function isOnCurve(publicKeyBytes) {
  try {
    ed25519.ExtendedPoint.fromHex(publicKeyBytes);
    return true;
  } catch {
    return false;
  }
}

function createTransferCheckedInstructionCompat(
  source,
  mint,
  destination,
  owner,
  amountRaw,
  decimals,
) {
  const data = new Uint8Array(10);
  data[0] = 12;
  writeU64LE(data, 1, amountRaw);
  data[9] = Number(decimals) & 0xff;

  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

function writeU64LE(buffer, offset, value) {
  const amount = normalizeRawAmount(value);
  const maxU64 = (1n << 64n) - 1n;
  if (amount < 0n || amount > maxU64) {
    throw new Error("Amount exceeds u64 range.");
  }

  let remaining = amount;
  for (let index = 0; index < 8; index += 1) {
    buffer[offset + index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
}
