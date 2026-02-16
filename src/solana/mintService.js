import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

export async function mintClassicSplTokenToOwner(params) {
  const {
    connection,
    provider,
    ownerPublicKey,
    decimals,
    initialSupplyUi,
    commitment = "confirmed",
  } = params || {};

  if (!connection) {
    throw new Error("Missing Solana connection for mint transaction.");
  }
  if (!provider || typeof provider.signAndSendTransaction !== "function") {
    throw new Error("Phantom wallet is not ready to sign mint transactions.");
  }
  if (!ownerPublicKey) {
    throw new Error("Missing Phantom wallet public key for mint transaction.");
  }

  const mintDecimals = normalizeMintDecimals(decimals);
  const amountRaw = parseUiTokenAmount(initialSupplyUi, mintDecimals);
  const owner = toPublicKey(ownerPublicKey);
  const mintKeypair = Keypair.generate();
  const ownerAta = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    owner,
    false,
    TOKEN_PROGRAM_ID,
  );

  const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  const latestBlockhash = await connection.getLatestBlockhash(commitment);

  const tx = new Transaction({
    feePayer: owner,
    recentBlockhash: latestBlockhash.blockhash,
  });
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: owner,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      mintDecimals,
      owner,
      owner,
      TOKEN_PROGRAM_ID,
    ),
    createAssociatedTokenAccountInstruction(
      owner,
      ownerAta,
      owner,
      mintKeypair.publicKey,
      TOKEN_PROGRAM_ID,
    ),
    createMintToInstruction(
      mintKeypair.publicKey,
      ownerAta,
      owner,
      amountRaw,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );
  tx.partialSign(mintKeypair);

  const signature = extractSignature(
    await provider.signAndSendTransaction(tx, {
      preflightCommitment: commitment,
    }),
  );
  if (!signature) {
    throw new Error("Phantom did not return a mint transaction signature.");
  }

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    commitment,
  );

  return {
    mint: mintKeypair.publicKey.toBase58(),
    ownerAta: ownerAta.toBase58(),
    signature,
    decimals: mintDecimals,
    amountRaw,
    initialSupplyUi: String(initialSupplyUi || "").trim(),
  };
}

export function normalizeMintDecimals(rawDecimals) {
  const decimals = Number(rawDecimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
    throw new Error("Token decimals must be an integer between 0 and 9.");
  }
  return decimals;
}

export function parseUiTokenAmount(rawAmount, decimals) {
  const normalizedDecimals = normalizeMintDecimals(decimals);
  const value = String(rawAmount || "").trim();
  if (!value) {
    throw new Error("Initial supply is required.");
  }
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error("Initial supply must be a positive numeric value.");
  }

  const [wholeText, fractionTextRaw = ""] = value.split(".");
  if (fractionTextRaw.length > normalizedDecimals) {
    throw new Error(
      `Initial supply exceeds ${normalizedDecimals} decimal place(s).`,
    );
  }
  if (normalizedDecimals === 0 && fractionTextRaw.length > 0) {
    throw new Error("Initial supply cannot include decimals when token decimals is 0.");
  }

  const scale = 10n ** BigInt(normalizedDecimals);
  const whole = BigInt(wholeText || "0");
  const fraction = BigInt(
    (fractionTextRaw || "").padEnd(normalizedDecimals, "0") || "0",
  );
  const amountRaw = whole * scale + fraction;
  if (amountRaw <= 0n) {
    throw new Error("Initial supply must be greater than zero.");
  }

  return amountRaw;
}

function toPublicKey(value) {
  if (value instanceof PublicKey) {
    return value;
  }
  return new PublicKey(value);
}

function extractSignature(result) {
  if (typeof result === "string") {
    return result;
  }
  if (typeof result?.signature === "string") {
    return result.signature;
  }
  if (typeof result?.signature?.toString === "function") {
    return result.signature.toString();
  }
  return "";
}
