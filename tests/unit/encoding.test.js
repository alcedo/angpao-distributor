import { describe, expect, it } from "vitest";
import { uint8ToBase64 } from "../../src/app.js";

describe("uint8ToBase64", () => {
  it("encodes bytes using the supplied encoder", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const encoded = uint8ToBase64(bytes, (binary) =>
      Buffer.from(binary, "binary").toString("base64"),
    );

    expect(encoded).toBe("AQID");
  });
});
