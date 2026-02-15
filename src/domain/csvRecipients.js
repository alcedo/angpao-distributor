import { isValidSolanaAddress } from "./validation.js";

const ADDRESS_HEADERS = new Set(["address", "publicaddress", "publickey", "wallet", "recipient"]);

export function parseRecipientsCsv(rawCsv, options = {}) {
  const validateAddress = options.validateAddress || isValidSolanaAddress;
  const input = String(rawCsv || "").trim();

  if (!input) {
    return {
      recipients: [],
      invalidRows: [],
      duplicateCount: 0,
      totalRows: 0,
    };
  }

  const lines = input.split(/\r?\n/);
  const firstCells = parseCsvLine(lines[0]).map((cell) => normalizeHeader(cell));
  const addressColumnIndex = firstCells.findIndex((cell) => ADDRESS_HEADERS.has(cell));
  const hasHeader = addressColumnIndex >= 0;
  const targetColumn = hasHeader ? addressColumnIndex : 0;
  const startLineIndex = hasHeader ? 1 : 0;

  const recipients = [];
  const invalidRows = [];
  const dedupe = new Set();
  let duplicateCount = 0;

  for (let index = startLineIndex; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (!rawLine.trim()) {
      continue;
    }

    const cells = parseCsvLine(rawLine);
    const value = (cells[targetColumn] || "").trim();
    const line = index + 1;

    if (!value) {
      invalidRows.push({ line, value: "", reason: "Missing recipient address." });
      continue;
    }

    if (!validateAddress(value)) {
      invalidRows.push({ line, value, reason: "Invalid Solana address." });
      continue;
    }

    if (dedupe.has(value)) {
      duplicateCount += 1;
      continue;
    }

    dedupe.add(value);
    recipients.push({
      id: `csv-${recipients.length + 1}`,
      publicAddress: value,
      source: "csv",
    });
  }

  return {
    recipients,
    invalidRows,
    duplicateCount,
    totalRows: lines.length - (hasHeader ? 1 : 0),
  };
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z]/g, "");
}

function parseCsvLine(rawLine) {
  const result = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < rawLine.length; index += 1) {
    const char = rawLine[index];
    const next = rawLine[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(cell);
      cell = "";
      continue;
    }

    cell += char;
  }

  result.push(cell);
  return result;
}
