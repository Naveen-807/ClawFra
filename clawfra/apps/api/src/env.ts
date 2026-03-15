import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const env = {
  // GOAT Network
  goatRpcUrl: optional('GOAT_RPC_URL', 'https://rpc.testnet3.goat.network'),
  goatChainId: optional('GOAT_CHAIN_ID', '48816'),
  goatExplorerUrl: optional('GOAT_EXPLORER_URL', 'https://explorer.testnet3.goat.network'),
  goatTreasuryPrivateKey: optional('GOAT_TREASURY_PRIVATE_KEY', ''),
  treasuryFundAmount: optional('TREASURY_FUND_AMOUNT', '0.0002'),

  // Encryption
  appEncryptionKey: optional('APP_ENCRYPTION_KEY', ''),

  // Google
  googleClientEmail: optional('GOOGLE_CLIENT_EMAIL', ''),
  googlePrivateKey: optional('GOOGLE_PRIVATE_KEY', ''),
  googleDriveFolderId: optional('GOOGLE_DRIVE_FOLDER_ID', ''),

  // Server
  port: parseInt(optional('PORT', '3000'), 10),
  dbPath: optional('DB_PATH', './data/db.json'),
};

export function validateEnv() {
  const warnings: string[] = [];
  if (!env.goatTreasuryPrivateKey) warnings.push('GOAT_TREASURY_PRIVATE_KEY not set — wallet funding disabled');
  if (!env.appEncryptionKey) warnings.push('APP_ENCRYPTION_KEY not set — private key encryption disabled');
  if (!env.googleClientEmail) warnings.push('GOOGLE_CLIENT_EMAIL not set — Sheets disabled');
  if (!env.googlePrivateKey) warnings.push('GOOGLE_PRIVATE_KEY not set — Sheets disabled');
  if (warnings.length) {
    console.warn('[env] Warnings:');
    warnings.forEach(w => console.warn(`  ⚠  ${w}`));
  }
}
