export function isWalletConnected(state) {
  return Boolean(state?.phantom?.isConnected && state?.phantom?.publicKey);
}

export function canRunWalletRequiredActions(state) {
  return isWalletConnected(state);
}
