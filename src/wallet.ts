import { ethers } from "ethers";
import crypto from "crypto";

const RPC_URL = process.env.GOAT_RPC_URL || "https://rpc.testnet3.goat.network";
const CHAIN_ID = Number(process.env.GOAT_CHAIN_ID || 48816);
const TREASURY_KEY = process.env.GOAT_TREASURY_PRIVATE_KEY || "";
const ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY || "default-hackathon-key-change-me!!";
const EXPLORER = "https://explorer.testnet3.goat.network";

const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);

// --- Encryption (hackathon-grade, not production) ---
const ALGO = "aes-256-cbc";

function deriveKey(secret: string): Buffer {
  return crypto.scryptSync(secret, "clawfra-salt", 32);
}

export function encrypt(text: string): string {
  const key = deriveKey(ENCRYPTION_KEY);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(data: string): string {
  const key = deriveKey(ENCRYPTION_KEY);
  const [ivHex, encHex] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

// --- Wallet operations ---
export function createWallet(): { address: string; privateKey: string } {
  const wallet = ethers.Wallet.createRandom();
  return { address: wallet.address, privateKey: wallet.privateKey };
}

export async function fundWallet(
  toAddress: string,
  amount: string = "0.0002"
): Promise<string> {
  if (!TREASURY_KEY) throw new Error("GOAT_TREASURY_PRIVATE_KEY not set");
  const treasury = new ethers.Wallet(TREASURY_KEY, provider);
  const tx = await treasury.sendTransaction({
    to: toAddress,
    value: ethers.parseEther(amount),
  });
  const receipt = await tx.wait();
  return receipt!.hash;
}

export async function sendTx(
  encryptedKey: string,
  recipient: string,
  amount: string
): Promise<{ txHash: string; explorerUrl: string }> {
  const privateKey = decrypt(encryptedKey);
  const wallet = new ethers.Wallet(privateKey, provider);
  const tx = await wallet.sendTransaction({
    to: recipient,
    value: ethers.parseEther(amount),
  });
  const receipt = await tx.wait();
  return {
    txHash: receipt!.hash,
    explorerUrl: `${EXPLORER}/tx/${receipt!.hash}`,
  };
}

export async function sendAgentFee(
  encryptedKey: string
): Promise<{ txHash: string; explorerUrl: string }> {
  const receiveWallet =
    process.env.GOATX402_RECEIVE_WALLET ||
    "0x06775Da6b393B1cD99c6f9CF710f4b0fBf341b87";
  return sendTx(encryptedKey, receiveWallet, "0.0001");
}

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}
