const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';
const LAMPORTS_PER_SOL = 1_000_000_000;

const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton');
const copyAddressButton = document.getElementById('copyAddressButton');
const walletAddress = document.getElementById('walletAddress');
const balanceValue = document.getElementById('balanceValue');
const statusMessage = document.getElementById('statusMessage');

let currentPublicAddress = '';

const getProvider = () => {
  const provider = window.phantom?.solana ?? window.solana;
  return provider?.isPhantom ? provider : null;
};

const setStatus = (message) => {
  statusMessage.textContent = message;
};

const setConnectedUI = (isConnected) => {
  connectButton.disabled = isConnected;
  disconnectButton.disabled = !isConnected;
  copyAddressButton.disabled = !isConnected;
};

const formatAddress = (address) => {
  if (!address || address.length < 12) {
    return address;
  }
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

const fetchBalance = async (address) => {
  const response = await fetch(RPC_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address, { commitment: 'confirmed' }]
    })
  });

  if (!response.ok) {
    throw new Error('Could not reach Solana RPC endpoint.');
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message || 'Failed to fetch balance.');
  }

  return payload.result.value / LAMPORTS_PER_SOL;
};

const displayAddress = async (publicKey) => {
  const publicAddress = publicKey.toString();
  currentPublicAddress = publicAddress;
  walletAddress.textContent = `${publicAddress} (${formatAddress(publicAddress)})`;
  setConnectedUI(true);
  setStatus('Wallet connected. Fetching balance...');

  try {
    const balance = await fetchBalance(publicAddress);
    balanceValue.textContent = `${balance.toFixed(4)} SOL`;
    setStatus('Wallet connected successfully.');
  } catch (error) {
    balanceValue.textContent = '--';
    setStatus(`Wallet connected, but balance fetch failed: ${error.message}`);
  }
};

const clearWalletState = () => {
  currentPublicAddress = '';
  walletAddress.textContent = 'Not connected';
  balanceValue.textContent = '--';
  setConnectedUI(false);
};

const connectWallet = async () => {
  const provider = getProvider();

  if (!provider) {
    setStatus('Phantom wallet not found. Install Phantom to continue.');
    window.open('https://phantom.app/', '_blank');
    return;
  }

  try {
    const response = await provider.connect();
    await displayAddress(response.publicKey);
  } catch {
    setStatus('Connection request was rejected or failed.');
  }
};

const disconnectWallet = async () => {
  const provider = getProvider();
  if (!provider) {
    clearWalletState();
    setStatus('Wallet provider unavailable.');
    return;
  }

  try {
    await provider.disconnect();
  } finally {
    clearWalletState();
    setStatus('Wallet disconnected.');
  }
};

const copyAddress = async () => {
  if (!currentPublicAddress) {
    return;
  }

  try {
    await navigator.clipboard.writeText(currentPublicAddress);
    setStatus('Wallet address copied to clipboard.');
  } catch {
    setStatus('Unable to copy address. Please copy manually.');
  }
};

const initializeWalletState = async () => {
  const provider = getProvider();

  if (!provider) {
    setStatus('Waiting for Phantom wallet connection.');
    clearWalletState();
    return;
  }

  try {
    const response = await provider.connect({ onlyIfTrusted: true });
    await displayAddress(response.publicKey);
  } catch {
    clearWalletState();
    setStatus('Click “Connect Phantom Wallet” to continue.');
  }

  provider.on('accountChanged', async (publicKey) => {
    if (publicKey) {
      await displayAddress(publicKey);
      return;
    }

    clearWalletState();
    setStatus('Wallet disconnected. Connect again to continue.');
  });
};

connectButton.addEventListener('click', connectWallet);
disconnectButton.addEventListener('click', disconnectWallet);
copyAddressButton.addEventListener('click', copyAddress);
window.addEventListener('DOMContentLoaded', initializeWalletState);
