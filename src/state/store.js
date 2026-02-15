/**
 * AppState shape for Phase 0
 * {
 *   cluster: "devnet" | "testnet" | "mainnet-beta",
 *   generatedWallets: Array<{index:number, publicAddress:string, privateKeyBase64:string}>,
 *   showPrivateKeys: boolean,
 *   phantom: { isConnected: boolean, publicKey: string | null }
 * }
 */
export function createStore(initialState) {
  let state = { ...initialState };

  return {
    getState() {
      return state;
    },
    setState(patch) {
      state = { ...state, ...patch };
      return state;
    },
    reset(nextState) {
      state = { ...nextState };
      return state;
    },
  };
}
