import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { sha256 } from "@noble/hashes/sha256";
import { ed25519 } from "@noble/curves/ed25519";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);
const MAX_MULTIPLE_ACCOUNTS = 100;
const DEFAULT_METADATA_URI_FETCH_CONCURRENCY = 10;
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();
const METADATA_SEED = textEncoder.encode("metadata");
const WELL_KNOWN_TOKEN_METADATA_BY_MINT = new Map([
  [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    {
      name: "USD Coin",
      symbol: "USDC",
      logoUrl:
        "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    },
  ],
]);

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

export async function fetchClassicSplTokenHoldings(connection, ownerPublicKey, options = {}) {
  if (!connection || typeof connection.getParsedTokenAccountsByOwner !== "function") {
    throw new Error("Missing Solana connection for token inventory fetch.");
  }
  if (!ownerPublicKey) {
    throw new Error("Missing owner public key for token inventory fetch.");
  }

  const owner =
    typeof ownerPublicKey === "string" ? new PublicKey(ownerPublicKey) : ownerPublicKey;

  const { response, sourceConnection } = await getParsedTokenAccountsByOwnerWithFallback(
    connection,
    owner,
    options,
  );

  const normalizedAssets = normalizeClassicSplTokenAccounts(response?.value || []);
  const mintedAssets = normalizedAssets.map((asset) => asset.mint);
  const metadataByMint = await fetchTokenMetadataByMint(
    [sourceConnection, connection],
    mintedAssets,
  );
  const metadataJsonByMint = await fetchTokenMetadataJsonByMint(metadataByMint, options);
  const knownTokenMetadataByMint = buildKnownTokenMetadataByMint(options);

  return normalizedAssets.map((asset) => {
    const onChainMetadata = metadataByMint.get(asset.mint);
    const metadataJson = metadataJsonByMint.get(asset.mint);
    const knownTokenMetadata = knownTokenMetadataByMint.get(asset.mint);
    const name =
      sanitizeTokenText(onChainMetadata?.name) ||
      sanitizeTokenText(metadataJson?.name) ||
      sanitizeTokenText(knownTokenMetadata?.name);
    const symbol =
      sanitizeTokenText(onChainMetadata?.symbol) ||
      sanitizeTokenText(metadataJson?.symbol) ||
      sanitizeTokenText(knownTokenMetadata?.symbol);
    const logoUrl =
      sanitizeTokenText(metadataJson?.logoUrl) ||
      sanitizeTokenText(knownTokenMetadata?.logoUrl);

    return {
      ...asset,
      name: name || undefined,
      symbol: symbol || undefined,
      logoUrl: logoUrl || undefined,
      displayName: resolveTokenDisplayName({
        mint: asset.mint,
        name,
        symbol,
      }),
    };
  });
}

export function normalizeClassicSplTokenAccounts(accounts) {
  const balancesByMint = new Map();

  for (const account of accounts) {
    const info = account?.account?.data?.parsed?.info;
    const mint = String(info?.mint || "").trim();
    const tokenAmount = info?.tokenAmount;
    const decimals = Number(tokenAmount?.decimals);
    const amountRawString = String(tokenAmount?.amount || "").trim();

    if (!mint || !Number.isInteger(decimals) || decimals < 0 || !amountRawString) {
      continue;
    }

    let amountRaw;
    try {
      amountRaw = BigInt(amountRawString);
    } catch {
      continue;
    }

    if (amountRaw <= 0n) {
      continue;
    }

    const existing = balancesByMint.get(mint);
    if (!existing) {
      balancesByMint.set(mint, { mint, decimals, balanceRaw: amountRaw });
      continue;
    }

    if (existing.decimals !== decimals) {
      continue;
    }

    existing.balanceRaw += amountRaw;
  }

  return [...balancesByMint.values()]
    .sort((a, b) => a.mint.localeCompare(b.mint))
    .map((asset) => ({
      ...asset,
      balanceUi: formatTokenBalance(asset.balanceRaw, asset.decimals),
    }));
}

export function resolveTokenDisplayName(asset) {
  const name = sanitizeTokenText(asset?.name);
  if (name) {
    return name;
  }

  const symbol = sanitizeTokenText(asset?.symbol);
  if (symbol) {
    return symbol;
  }

  return shortMint(asset?.mint);
}

export function parseTokenMetadataAccount(data) {
  const bytes = toUint8Array(data);
  if (!bytes || bytes.length < 1 + 32 + 32 + 4) {
    return null;
  }

  let offset = 1 + 32 + 32;
  const nameLength = readUint32LE(bytes, offset);
  if (nameLength === null) {
    return null;
  }
  offset += 4;
  if (offset + nameLength > bytes.length) {
    return null;
  }
  const name = textDecoder.decode(bytes.slice(offset, offset + nameLength));
  offset += nameLength;

  const symbolLength = readUint32LE(bytes, offset);
  if (symbolLength === null) {
    return null;
  }
  offset += 4;
  if (offset + symbolLength > bytes.length) {
    return null;
  }
  const symbol = textDecoder.decode(bytes.slice(offset, offset + symbolLength));
  offset += symbolLength;

  const uriLength = readUint32LE(bytes, offset);
  if (uriLength === null) {
    return null;
  }
  offset += 4;
  if (offset + uriLength > bytes.length) {
    return null;
  }
  const uri = textDecoder.decode(bytes.slice(offset, offset + uriLength));

  return {
    name: sanitizeTokenText(name),
    symbol: sanitizeTokenText(symbol),
    uri: sanitizeTokenText(uri),
  };
}

async function fetchTokenMetadataByMint(connections, mints) {
  if (!Array.isArray(mints) || !mints.length) {
    return new Map();
  }
  const availableConnections = normalizeConnections(connections);
  if (!availableConnections.length) {
    return new Map();
  }

  const mintAndMetadataPda = mints
    .map((mint) => ({ mint, metadataPda: deriveMetadataPda(mint) }))
    .filter((entry) => Boolean(entry.metadataPda));
  if (!mintAndMetadataPda.length) {
    return new Map();
  }

  const metadataByMint = new Map();
  let unresolved = mintAndMetadataPda;

  for (const connection of availableConnections) {
    if (!unresolved.length) {
      break;
    }

    unresolved = await fetchMetadataChunkBatch(connection, unresolved, metadataByMint);
  }

  return metadataByMint;
}

async function fetchMetadataChunkBatch(connection, mintAndMetadataPda, metadataByMint) {
  const unresolved = [];

  for (let index = 0; index < mintAndMetadataPda.length; index += MAX_MULTIPLE_ACCOUNTS) {
    const chunk = mintAndMetadataPda.slice(index, index + MAX_MULTIPLE_ACCOUNTS);
    const pdas = chunk.map((entry) => entry.metadataPda);
    let accounts;

    try {
      accounts = await connection.getMultipleAccountsInfo(pdas);
    } catch {
      unresolved.push(...chunk);
      continue;
    }

    for (let accountIndex = 0; accountIndex < chunk.length; accountIndex += 1) {
      const entry = chunk[accountIndex];
      const accountInfo = accounts?.[accountIndex];
      const parsedMetadata = accountInfo?.data
        ? parseTokenMetadataAccount(accountInfo.data)
        : null;

      if (!parsedMetadata) {
        unresolved.push(entry);
        continue;
      }

      metadataByMint.set(entry.mint, parsedMetadata);
    }
  }

  return unresolved;
}

function deriveMetadataPda(mintAddress) {
  try {
    const mint = new PublicKey(mintAddress);
    const [metadataPda] = findProgramAddressSync(
      [METADATA_SEED, TOKEN_METADATA_PROGRAM_ID.toBytes(), mint.toBytes()],
      TOKEN_METADATA_PROGRAM_ID,
    );
    return metadataPda;
  } catch {
    return null;
  }
}

function findProgramAddressSync(seeds, programId) {
  let nonce = 255;

  while (nonce !== 0) {
    try {
      const address = createProgramAddressSync(
        [...seeds, Uint8Array.of(nonce)],
        programId,
      );
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

function isOnCurve(publicKeyBytes) {
  try {
    ed25519.ExtendedPoint.fromHex(publicKeyBytes);
    return true;
  } catch {
    return false;
  }
}

function readUint32LE(bytes, offset) {
  if (offset + 4 > bytes.length) {
    return null;
  }

  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function formatTokenBalance(balanceRaw, decimals) {
  if (decimals === 0) {
    return balanceRaw.toString();
  }

  const base = 10n ** BigInt(decimals);
  const whole = balanceRaw / base;
  const fraction = balanceRaw % base;
  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");

  if (!fractionText) {
    return whole.toString();
  }

  return `${whole.toString()}.${fractionText}`;
}

function sanitizeTokenText(value) {
  return String(value || "").replace(/\u0000/g, "").trim();
}

function shortMint(mint) {
  const value = String(mint || "");
  if (!value) {
    return "";
  }
  if (value.length <= 12) {
    return value;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
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

async function getParsedTokenAccountsByOwnerWithFallback(connection, owner, options) {
  try {
    const response = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    });
    return {
      response,
      sourceConnection: connection,
    };
  } catch (primaryError) {
    if (!isRpcAccessForbiddenError(primaryError)) {
      throw primaryError;
    }

    const fallback = await tryFallbackRpcEndpoints(connection, owner, options);
    if (fallback) {
      return fallback;
    }

    throw new Error(
      "RPC endpoint denied token-balance lookup (403 Access Forbidden). Try again later or switch RPC endpoint.",
    );
  }
}

async function tryFallbackRpcEndpoints(connection, owner, options) {
  const fallbackEndpoints = getFallbackRpcEndpoints(connection?.rpcEndpoint);
  if (!fallbackEndpoints.length) {
    return null;
  }

  const connectionFactory =
    options?.connectionFactory ||
    ((endpoint) => new Connection(endpoint, "confirmed"));

  for (const endpoint of fallbackEndpoints) {
    try {
      const fallbackConnection = connectionFactory(endpoint);
      if (
        !fallbackConnection ||
        typeof fallbackConnection.getParsedTokenAccountsByOwner !== "function"
      ) {
        continue;
      }

      const response = await fallbackConnection.getParsedTokenAccountsByOwner(owner, {
        programId: TOKEN_PROGRAM_ID,
      });
      return {
        response,
        sourceConnection: fallbackConnection,
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchTokenMetadataJsonByMint(metadataByMint, options = {}) {
  if (!metadataByMint?.size) {
    return new Map();
  }

  const fetchRef = options.fetch || globalThis.fetch;
  if (typeof fetchRef !== "function") {
    return new Map();
  }

  const metadataJsonByMint = new Map();
  const queue = [...metadataByMint.entries()];
  const workerCount = Math.min(
    queue.length,
    normalizePositiveInt(
      options.metadataUriFetchConcurrency,
      DEFAULT_METADATA_URI_FETCH_CONCURRENCY,
    ),
  );

  const workers = Array.from({ length: workerCount }, () =>
    consumeMetadataQueue(queue, metadataJsonByMint, fetchRef),
  );
  await Promise.all(workers);

  return metadataJsonByMint;
}

async function consumeMetadataQueue(queue, metadataJsonByMint, fetchRef) {
  while (queue.length > 0) {
    const next = queue.pop();
    if (!next) {
      return;
    }

    const [mint, metadata] = next;
    const metadataUri = normalizeTokenMetadataUri(metadata?.uri);
    if (!metadataUri) {
      continue;
    }

    try {
      const response = await fetchRef(metadataUri);
      if (!response?.ok) {
        continue;
      }

      const payload = await response.json();
      metadataJsonByMint.set(mint, {
        name: sanitizeTokenText(payload?.name),
        symbol: sanitizeTokenText(payload?.symbol),
        logoUrl: normalizeTokenMetadataUri(payload?.image || payload?.logoURI),
      });
    } catch {
      // Ignore metadata image fetch failures; UI falls back to placeholder icon.
    }
  }
}

function buildKnownTokenMetadataByMint(options = {}) {
  const fallbackMap = new Map(WELL_KNOWN_TOKEN_METADATA_BY_MINT);
  if (!options.tokenMetadataByMint || typeof options.tokenMetadataByMint !== "object") {
    return fallbackMap;
  }

  for (const [mint, metadata] of Object.entries(options.tokenMetadataByMint)) {
    if (!mint) {
      continue;
    }
    fallbackMap.set(mint, {
      name: sanitizeTokenText(metadata?.name),
      symbol: sanitizeTokenText(metadata?.symbol),
      logoUrl: normalizeTokenMetadataUri(metadata?.logoUrl),
    });
  }

  return fallbackMap;
}

function normalizeConnections(connections) {
  const list = Array.isArray(connections) ? connections : [connections];
  const seenConnections = new Set();
  const uniqueByEndpoint = new Set();
  const result = [];

  for (const connection of list) {
    if (!connection || typeof connection.getMultipleAccountsInfo !== "function") {
      continue;
    }
    if (seenConnections.has(connection)) {
      continue;
    }

    const endpointKey = normalizeEndpoint(connection.rpcEndpoint);
    if (endpointKey && uniqueByEndpoint.has(endpointKey)) {
      seenConnections.add(connection);
      continue;
    }

    seenConnections.add(connection);
    if (endpointKey) {
      uniqueByEndpoint.add(endpointKey);
    }
    result.push(connection);
  }

  return result;
}

function getFallbackRpcEndpoints(currentEndpoint) {
  const normalizedCurrent = normalizeEndpoint(currentEndpoint);
  const endpointText = String(currentEndpoint || "").toLowerCase();

  let candidates = [];
  if (endpointText.includes("mainnet")) {
    candidates = [
      "https://api.mainnet-beta.solana.com",
      "https://solana-rpc.publicnode.com",
      "https://rpc.ankr.com/solana",
    ];
  } else if (endpointText.includes("devnet")) {
    candidates = ["https://api.devnet.solana.com"];
  } else if (endpointText.includes("testnet")) {
    candidates = ["https://api.testnet.solana.com"];
  }

  return candidates.filter((endpoint) => normalizeEndpoint(endpoint) !== normalizedCurrent);
}

function normalizeEndpoint(endpoint) {
  return String(endpoint || "").replace(/\/+$/, "").toLowerCase();
}

function isRpcAccessForbiddenError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("403") && message.includes("forbidden");
}

function normalizeTokenMetadataUri(uri) {
  const value = String(uri || "").trim();
  if (!value) {
    return "";
  }
  if (value.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${value.slice("ipfs://".length)}`;
  }
  return value;
}

function normalizePositiveInt(rawValue, fallback) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
}
