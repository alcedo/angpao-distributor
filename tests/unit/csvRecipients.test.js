import { describe, expect, it } from "vitest";
import { parseRecipientsCsv } from "../../src/domain/csvRecipients.js";

describe("parseRecipientsCsv", () => {
  it("parses header-based address column and deduplicates valid rows", () => {
    const csv = [
      "name,address",
      "alice,11111111111111111111111111111111",
      "bob,11111111111111111111111111111111",
      "carol,So11111111111111111111111111111111111111112",
    ].join("\n");

    const result = parseRecipientsCsv(csv);

    expect(result.recipients).toHaveLength(2);
    expect(result.duplicateCount).toBe(1);
    expect(result.invalidRows).toHaveLength(0);
  });

  it("collects invalid row diagnostics", () => {
    const csv = [
      "publicKey",
      "invalid-key",
      "",
      "So11111111111111111111111111111111111111112",
      ",",
    ].join("\n");

    const result = parseRecipientsCsv(csv);

    expect(result.recipients).toHaveLength(1);
    expect(result.invalidRows).toHaveLength(2);
    expect(result.invalidRows[0].line).toBe(2);
    expect(result.invalidRows[1].line).toBe(5);
  });

  it("supports files without a header by using the first column", () => {
    const csv = [
      "11111111111111111111111111111111,foo",
      "So11111111111111111111111111111111111111112,bar",
    ].join("\n");

    const result = parseRecipientsCsv(csv);

    expect(result.recipients).toHaveLength(2);
    expect(result.invalidRows).toHaveLength(0);
  });
});
