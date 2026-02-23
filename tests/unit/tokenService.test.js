import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  fetchClassicSplTokenHoldings,
  normalizeClassicSplTokenAccounts,
  parseTokenMetadataAccount,
  resolveTokenDisplayName,
} from "../../src/solana/tokenService.js";

describe("tokenService", () => {
  it("normalizes balances, filters invalid/zero entries, and merges duplicate mints", () => {
    const items = normalizeClassicSplTokenAccounts([
      {
        account: {
          data: {
            parsed: {
              info: {
                mint: "MintB",
                tokenAmount: {
                  amount: "0",
                  decimals: 6,
                },
              },
            },
          },
        },
      },
      {
        account: {
          data: {
            parsed: {
              info: {
                mint: "MintA",
                tokenAmount: {
                  amount: "1000",
                  decimals: 2,
                },
              },
            },
          },
        },
      },
      {
        account: {
          data: {
            parsed: {
              info: {
                mint: "MintA",
                tokenAmount: {
                  amount: "250",
                  decimals: 2,
                },
              },
            },
          },
        },
      },
      {
        account: {
          data: {
            parsed: {
              info: {
                mint: "MintC",
                tokenAmount: {
                  amount: "NaN",
                  decimals: 6,
                },
              },
            },
          },
        },
      },
      {
        account: {
          data: {
            parsed: {
              info: {
                mint: "",
                tokenAmount: {
                  amount: "10",
                  decimals: 6,
                },
              },
            },
          },
        },
      },
    ]);

    expect(items).toEqual([
      {
        mint: "MintA",
        decimals: 2,
        balanceRaw: 1250n,
        balanceUi: "12.5",
      },
    ]);
  });

  it("fetches parsed token accounts and returns distribution-ready balances", async () => {
    const calls = [];
    const mint = "So11111111111111111111111111111111111111112";
    const connection = {
      async getParsedTokenAccountsByOwner(owner, filter) {
        calls.push({ fn: "parsed", owner, filter });
        if (String(filter?.programId) !== TOKEN_PROGRAM_ID.toBase58()) {
          return { value: [] };
        }
        return {
          value: [
            {
              account: {
                data: {
                  parsed: {
                    info: {
                      mint,
                      tokenAmount: {
                        amount: "42",
                        decimals: 0,
                      },
                    },
                  },
                },
              },
            },
          ],
        };
      },
      async getMultipleAccountsInfo(publicKeys) {
        calls.push({ fn: "metadata", publicKeys });
        return [
          {
            data: buildMetadataAccountData(
              "Wrapped SOL",
              "WSOL",
              "https://example.com/wsol-meta.json",
            ),
          },
        ];
      },
    };

    const items = await fetchClassicSplTokenHoldings(
      connection,
      "11111111111111111111111111111111",
      {
        fetch: async () => ({
          ok: true,
          async json() {
            return {
              image: "https://cdn.example.com/wsol.png",
            };
          },
        }),
      },
    );

    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].fn).toBe("parsed");
    expect(
      calls
        .filter((call) => call.fn === "parsed")
        .map((call) => String(call.filter?.programId)),
    ).toEqual(expect.arrayContaining([TOKEN_PROGRAM_ID.toBase58(), TOKEN_2022_PROGRAM_ID.toBase58()]));
    expect(calls.some((call) => call.fn === "metadata")).toBe(true);
    expect(items).toHaveLength(1);
    expect(items[0].mint).toBe(mint);
    expect(items[0].decimals).toBe(0);
    expect(items[0].balanceRaw).toBe(42n);
    expect(items[0].balanceUi).toBe("42");
    expect(items[0].displayName).toBe("Wrapped SOL");
    expect(items[0].logoUrl).toBe("https://cdn.example.com/wsol.png");
  });

  it("applies known-token fallback metadata when metaplex metadata is missing", async () => {
    const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const connection = {
      async getParsedTokenAccountsByOwner(_, filter) {
        if (String(filter?.programId) !== TOKEN_PROGRAM_ID.toBase58()) {
          return { value: [] };
        }
        return {
          value: [
            {
              account: {
                data: {
                  parsed: {
                    info: {
                      mint,
                      tokenAmount: {
                        amount: "2500000",
                        decimals: 6,
                      },
                    },
                  },
                },
              },
            },
          ],
        };
      },
      async getMultipleAccountsInfo() {
        return [];
      },
    };

    const items = await fetchClassicSplTokenHoldings(
      connection,
      "11111111111111111111111111111111",
      {
        fetch: async () => {
          throw new Error("metadata URI fetch should not be required in this case");
        },
      },
    );

    expect(items).toHaveLength(1);
    expect(items[0].mint).toBe(mint);
    expect(items[0].displayName).toBe("USD Coin");
    expect(items[0].symbol).toBe("USDC");
    expect(items[0].logoUrl).toContain("/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png");
  });

  it("fetches metadata URI logos for all discovered tokens without a hard 32-token cap", async () => {
    const mintCount = 33;
    const mints = Array.from({ length: mintCount }, () => PublicKey.unique().toBase58());
    const connection = {
      async getParsedTokenAccountsByOwner(_, filter) {
        if (String(filter?.programId) !== TOKEN_PROGRAM_ID.toBase58()) {
          return { value: [] };
        }
        return {
          value: mints.map((mint) => ({
            account: {
              data: {
                parsed: {
                  info: {
                    mint,
                    tokenAmount: {
                      amount: "1",
                      decimals: 0,
                    },
                  },
                },
              },
            },
          })),
        };
      },
      async getMultipleAccountsInfo(publicKeys) {
        return publicKeys.map((_, index) => ({
          data: buildMetadataAccountData(
            `Token ${index}`,
            `TK${index}`,
            `https://example.com/meta-${index}.json`,
          ),
        }));
      },
    };

    const fetchCalls = [];
    const items = await fetchClassicSplTokenHoldings(
      connection,
      "11111111111111111111111111111111",
      {
        metadataUriFetchConcurrency: 4,
        fetch: async (uri) => {
          fetchCalls.push(uri);
          const suffix = uri.split("meta-").at(-1)?.replace(".json", "") || "0";
          return {
            ok: true,
            async json() {
              return {
                image: `https://example.com/logo-${suffix}.png`,
              };
            },
          };
        },
      },
    );

    expect(fetchCalls).toHaveLength(mintCount);
    expect(items).toHaveLength(mintCount);
    expect(items.every((item) => String(item.logoUrl || "").startsWith("https://example.com/logo-"))).toBe(true);
  });

  it("retries token inventory lookup against fallback RPC endpoint on 403", async () => {
    const ownerPublicKey = "11111111111111111111111111111111";
    const mint = "So11111111111111111111111111111111111111112";
    const initialConnection = {
      rpcEndpoint: "https://api.mainnet-beta.solana.com",
      async getParsedTokenAccountsByOwner() {
        throw new Error(
          '403 : [{"jsonrpc":"2.0","error":{"code":403,"message":"Access forbidden"}}]',
        );
      },
      async getMultipleAccountsInfo() {
        return [];
      },
    };

    const seenEndpoints = [];
    const items = await fetchClassicSplTokenHoldings(initialConnection, ownerPublicKey, {
      connectionFactory(endpoint) {
        seenEndpoints.push(endpoint);
        return {
          rpcEndpoint: endpoint,
          async getParsedTokenAccountsByOwner(_, filter) {
            if (String(filter?.programId) !== TOKEN_PROGRAM_ID.toBase58()) {
              return { value: [] };
            }
            return {
              value: [
                {
                  account: {
                    data: {
                      parsed: {
                        info: {
                          mint,
                          tokenAmount: {
                            amount: "42",
                            decimals: 0,
                          },
                        },
                      },
                    },
                  },
                },
              ],
            };
          },
          async getMultipleAccountsInfo() {
            return [];
          },
        };
      },
    });

    expect(seenEndpoints.length).toBeGreaterThan(0);
    expect(items).toHaveLength(1);
    expect(items[0].mint).toBe(mint);
    expect(items[0].balanceUi).toBe("42");
  });

  it("includes token holdings from both classic SPL and token-2022 programs", async () => {
    const classicMint = PublicKey.unique().toBase58();
    const token2022Mint = PublicKey.unique().toBase58();
    const seenProgramIds = [];
    const connection = {
      async getParsedTokenAccountsByOwner(_, filter) {
        const programId = String(filter?.programId || "");
        seenProgramIds.push(programId);
        if (programId === TOKEN_PROGRAM_ID.toBase58()) {
          return {
            value: [
              {
                account: {
                  data: {
                    parsed: {
                      info: {
                        mint: classicMint,
                        tokenAmount: {
                          amount: "100",
                          decimals: 2,
                        },
                      },
                    },
                  },
                },
              },
            ],
          };
        }
        if (programId === TOKEN_2022_PROGRAM_ID.toBase58()) {
          return {
            value: [
              {
                account: {
                  data: {
                    parsed: {
                      info: {
                        mint: token2022Mint,
                        tokenAmount: {
                          amount: "9000",
                          decimals: 3,
                        },
                      },
                    },
                  },
                },
              },
            ],
          };
        }
        return { value: [] };
      },
      async getMultipleAccountsInfo() {
        return [];
      },
    };

    const items = await fetchClassicSplTokenHoldings(connection, "11111111111111111111111111111111");

    expect(seenProgramIds).toEqual(
      expect.arrayContaining([TOKEN_PROGRAM_ID.toBase58(), TOKEN_2022_PROGRAM_ID.toBase58()]),
    );
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.mint)).toEqual([classicMint, token2022Mint].sort());
    expect(items.find((item) => item.mint === classicMint)?.balanceUi).toBe("1");
    expect(items.find((item) => item.mint === token2022Mint)?.balanceUi).toBe("9");
  });

  it("parses metadata account data and resolves display-name fallbacks", () => {
    const parsed = parseTokenMetadataAccount(
      buildMetadataAccountData("USD Coin", "USDC", "https://example.com/usdc.json"),
    );
    expect(parsed).toEqual({
      name: "USD Coin",
      symbol: "USDC",
      uri: "https://example.com/usdc.json",
    });

    expect(resolveTokenDisplayName({ mint: "Mint1234567890", name: "TokenName" })).toBe(
      "TokenName",
    );
    expect(resolveTokenDisplayName({ mint: "Mint1234567890", symbol: "TKN" })).toBe("TKN");
    expect(resolveTokenDisplayName({ mint: "So11111111111111111111111111111111111111112" })).toBe(
      "So11...1112",
    );
  });
});

function buildMetadataAccountData(name, symbol, uri = "") {
  const bytes = [];
  const pushBytes = (values) => {
    for (const value of values) {
      bytes.push(value);
    }
  };
  const pushU32 = (value) => {
    bytes.push(value & 0xff);
    bytes.push((value >> 8) & 0xff);
    bytes.push((value >> 16) & 0xff);
    bytes.push((value >> 24) & 0xff);
  };
  const encodeText = (value) => new TextEncoder().encode(value);

  bytes.push(4);
  pushBytes(new Array(32).fill(0));
  pushBytes(new Array(32).fill(0));

  const encodedName = encodeText(name);
  pushU32(encodedName.length);
  pushBytes(encodedName);

  const encodedSymbol = encodeText(symbol);
  pushU32(encodedSymbol.length);
  pushBytes(encodedSymbol);

  const encodedUri = encodeText(uri);
  pushU32(encodedUri.length);
  pushBytes(encodedUri);

  return new Uint8Array(bytes);
}
