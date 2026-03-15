import { ethers } from 'ethers';

const RPC_URL = process.env.GOAT_RPC_URL || 'https://rpc.testnet3.goat.network';
const CHAIN_ID = parseInt(process.env.GOAT_CHAIN_ID || '48816', 10);
const EXPLORER = process.env.GOAT_EXPLORER_URL || 'https://explorer.testnet3.goat.network';

export interface WalletInfo {
  address: string;
  privateKey: string;
}

export interface TxResult {
  txHash: string;
  explorerUrl: string;
}

function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(RPC_URL, {
    chainId: CHAIN_ID,
    name: 'goat-testnet3',
  });
}

export function createWallet(): WalletInfo {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

export async function fundWallet(
  toAddress: string,
  amountEther: string = '0.0002',
): Promise<TxResult> {
  const treasuryKey = process.env.GOAT_TREASURY_PRIVATE_KEY;
  if (!treasuryKey) throw new Error('GOAT_TREASURY_PRIVATE_KEY is not set');

  const provider = getProvider();
  const treasury = new ethers.Wallet(treasuryKey, provider);

  const tx = await treasury.sendTransaction({
    to: toAddress,
    value: ethers.parseEther(amountEther),
  });

  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction receipt is null');

  return {
    txHash: tx.hash,
    explorerUrl: `${EXPLORER}/tx/${tx.hash}`,
  };
}

export async function sendNativeTx(
  privateKey: string,
  recipient: string,
  amountEther: string,
): Promise<TxResult> {
  const provider = getProvider();
  const wallet = new ethers.Wallet(privateKey, provider);

  const tx = await wallet.sendTransaction({
    to: recipient,
    value: ethers.parseEther(amountEther),
  });

  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction receipt is null');

  return {
    txHash: tx.hash,
    explorerUrl: `${EXPLORER}/tx/${tx.hash}`,
  };
}

export async function getBalance(address: string): Promise<string> {
  const provider = getProvider();
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

export function getExplorerAddressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}
