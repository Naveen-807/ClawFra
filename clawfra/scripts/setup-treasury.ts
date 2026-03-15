/**
 * setup-treasury.ts
 *
 * Generates a new treasury wallet and prints the details.
 * Run once, then:
 *  1. Add GOAT_TREASURY_PRIVATE_KEY to your .env
 *  2. Fund the address at https://bridge.testnet3.goat.network/faucet
 *  3. Verify the balance on https://explorer.testnet3.goat.network
 */

import { ethers } from 'ethers';

const wallet = ethers.Wallet.createRandom();

console.log('');
console.log('Treasury Wallet Generated');
console.log('─────────────────────────────────────────────');
console.log(`Address:     ${wallet.address}`);
console.log(`Private Key: ${wallet.privateKey}`);
console.log('');
console.log('Next steps:');
console.log('  1. Add to .env:');
console.log(`     GOAT_TREASURY_PRIVATE_KEY=${wallet.privateKey}`);
console.log('');
console.log('  2. Fund from faucet:');
console.log(`     https://bridge.testnet3.goat.network/faucet`);
console.log('');
console.log('  3. Verify on explorer:');
console.log(`     https://explorer.testnet3.goat.network/address/${wallet.address}`);
console.log('');
console.log('  4. Test a manual tx:');
console.log(`     node scripts/test-goat-tx.ts`);
console.log('');
