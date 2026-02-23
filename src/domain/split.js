export function buildEqualSplitPlan(totalUiAmount, decimals, recipientCount) {
  const normalizedDecimals = normalizeDecimals(decimals);
  const normalizedRecipientCount = normalizeRecipientCount(recipientCount);
  const totalRaw = parseUiAmountToRaw(totalUiAmount, normalizedDecimals);
  const divisor = BigInt(normalizedRecipientCount);
  const perRecipientRaw = totalRaw / divisor;

  if (perRecipientRaw <= 0n) {
    throw new Error(
      "Total amount is too small for the recipient count at the selected token decimals.",
    );
  }

  const remainderRaw = totalRaw % divisor;
  const plannedTransferTotalRaw = perRecipientRaw * divisor;

  return {
    totalUiAmount: String(totalUiAmount || "").trim(),
    decimals: normalizedDecimals,
    recipientCount: normalizedRecipientCount,
    totalRaw,
    perRecipientRaw,
    remainderRaw,
    plannedTransferTotalRaw,
  };
}

export function formatRawWithDecimals(amountRaw, decimals) {
  const normalizedDecimals = normalizeDecimals(decimals);
  const raw = normalizeRawAmount(amountRaw);

  if (normalizedDecimals === 0) {
    return raw.toString();
  }

  const base = 10n ** BigInt(normalizedDecimals);
  const whole = raw / base;
  const fraction = raw % base;
  const fractionText = fraction.toString().padStart(normalizedDecimals, "0").replace(/0+$/, "");

  if (!fractionText) {
    return whole.toString();
  }

  return `${whole.toString()}.${fractionText}`;
}

function parseUiAmountToRaw(rawAmount, decimals) {
  const value = String(rawAmount || "").trim();
  if (!value) {
    throw new Error("Distribution amount is required.");
  }
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error("Distribution amount must be a positive numeric value.");
  }

  const [wholeText, fractionTextRaw = ""] = value.split(".");
  if (fractionTextRaw.length > decimals) {
    throw new Error(`Distribution amount exceeds ${decimals} decimal place(s).`);
  }
  if (decimals === 0 && fractionTextRaw.length > 0) {
    throw new Error(
      "Distribution amount cannot include decimals when token decimals is 0.",
    );
  }

  const scale = 10n ** BigInt(decimals);
  const whole = BigInt(wholeText || "0");
  const fraction = BigInt((fractionTextRaw || "").padEnd(decimals, "0") || "0");
  const totalRaw = whole * scale + fraction;

  if (totalRaw <= 0n) {
    throw new Error("Distribution amount must be greater than zero.");
  }

  return totalRaw;
}

function normalizeDecimals(rawDecimals) {
  const value = Number(rawDecimals);
  if (!Number.isInteger(value) || value < 0 || value > 18) {
    throw new Error("Token decimals must be an integer between 0 and 18.");
  }
  return value;
}

function normalizeRecipientCount(rawCount) {
  const count = Number(rawCount);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Recipient count must be at least 1.");
  }
  return count;
}

function normalizeRawAmount(value) {
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new Error("Raw amount cannot be negative.");
    }
    return value;
  }

  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return BigInt(value);
  }

  throw new Error("Raw amount must be a non-negative integer.");
}
