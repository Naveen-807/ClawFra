/**
 * test-goat-tx.ts
 *
 * Sends one native GOAT tx from the treasury to a test address.
 * Run this to verify your treasury wallet and RPC are working.
 *
 * Usage:
 *   node --loader ts-node/esm scripts/test-goat-tx.ts
 */

import 'dotenv/config';
import { ethers } from 'ethers';

const RPC_URL = process.env.GOAT_RPC_URL || 'https://rpc.testnet3.goat.network';
const CHAIN_ID = parseInt(process.env.GOAT_CHAIN_ID || '48816', 10);
const EXPLORER = process.env.GOAT_EXPLORER_URL || 'https://explorer.testnet3.goat.network';
const TREASURY_KEY = process.env.GOAT_TREASURY_PRIVATE_KEY;

if (!TREASURY_KEY) {
  console.error('GOAT_TREASURY_PRIVATE_KEY not set in .env');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: CHAIN_ID, name: 'goat-testnet3' });
const treasury = new ethers.Wallet(TREASURY_KEY, provider);

// Generate a throwaway recipient
const recipient = ethers.Wallet.createRandom();
const amount = '0.00001';

console.log('');
console.log('GOAT Testnet3 — Manual TX Test');
console.log('─────────────────────────────────────────────');
console.log(`Treasury:  ${treasury.address}`);
console.log(`Recipient: ${recipient.address} (throwaway)`);
console.log(`Amount:    ${amount} GOAT`);
console.log('');

const balance = await provider.getBalance(treasury.address);
console.log(`Treasury balance: ${ethers.formatEther(balance)} GOAT`);

if (balance === 0n) {
  console.error('Treasury wallet has no balance. Fund it at:');
  console.error('  https://bridge.testnet3.goat.network/faucet');
  process.exit(1);
}

console.log('Sending tx...');
const tx = await treasury.sendTransaction({
  to: recipient.address,
  value: ethers.parseEther(amount),
});

console.log(`TX Hash: ${tx.hash}`);
console.log('Waiting for confirmation...');

const receipt = await tx.wait();
console.log(`Confirmed in block ${receipt?.blockNumber}`);
console.log(`Explorer: ${EXPLORER}/tx/${tx.hash}`);
console.log('');
console.log('GOAT tx test passed!');
