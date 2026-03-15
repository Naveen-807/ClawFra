import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  DB, User, SubAgent, Policy, Transaction, Subscription, TxDecision, TxStatus,
} from '../../shared-types/src/types.js';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'db.json');

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readDB(): DB {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) {
    return { users: [], subAgents: [], policies: [], transactions: [], subscriptions: [] };
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) as DB;
}

function writeDB(db: DB): void {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ── Users ──────────────────────────────────────────────────────────────────

export function getUserByTelegramId(telegramUserId: string): User | undefined {
  return readDB().users.find(u => u.telegramUserId === telegramUserId);
}

export function createUser(telegramUserId: string, username: string): User {
  const db = readDB();
  const user: User = {
    id: `u_${randomUUID().slice(0, 8)}`,
    telegramUserId,
    username,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  writeDB(db);
  return user;
}

export function findOrCreateUser(telegramUserId: string, username: string): User {
  return getUserByTelegramId(telegramUserId) ?? createUser(telegramUserId, username);
}

// ── SubAgents ──────────────────────────────────────────────────────────────

export function getSubAgentByUserId(userId: string): SubAgent | undefined {
  return readDB().subAgents.find(sa => sa.userId === userId);
}

export function createSubAgent(
  userId: string,
  walletAddress: string,
  encryptedPrivateKey: string,
  sheetId: string,
  sheetUrl: string,
): SubAgent {
  const db = readDB();
  const sa: SubAgent = {
    id: `sa_${randomUUID().slice(0, 8)}`,
    userId,
    walletAddress,
    encryptedPrivateKey,
    sheetId,
    sheetUrl,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  db.subAgents.push(sa);
  writeDB(db);
  return sa;
}

export function updateSubAgent(id: string, patch: Partial<SubAgent>): void {
  const db = readDB();
  const idx = db.subAgents.findIndex(sa => sa.id === id);
  if (idx !== -1) {
    db.subAgents[idx] = { ...db.subAgents[idx], ...patch };
    writeDB(db);
  }
}

// ── Policies ───────────────────────────────────────────────────────────────

export function getPolicyBySubAgentId(subAgentId: string): Policy | undefined {
  return readDB().policies.find(p => p.subAgentId === subAgentId);
}

export function savePolicy(policy: Omit<Policy, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Policy {
  const db = readDB();
  const existing = db.policies.findIndex(p => p.subAgentId === policy.subAgentId);
  const full: Policy = {
    id: policy.id ?? `pol_${randomUUID().slice(0, 8)}`,
    createdAt: policy.createdAt ?? new Date().toISOString(),
    ...policy,
  };
  if (existing !== -1) {
    db.policies[existing] = full;
  } else {
    db.policies.push(full);
  }
  writeDB(db);
  return full;
}

// ── Transactions ───────────────────────────────────────────────────────────

export function createTransaction(
  subAgentId: string,
  recipient: string,
  amount: string,
  decision: TxDecision,
  decisionReason: string,
  status: TxStatus = 'pending',
): Transaction {
  const db = readDB();
  const tx: Transaction = {
    id: `tx_${randomUUID().slice(0, 8)}`,
    subAgentId,
    recipient,
    amount,
    status,
    decision,
    decisionReason,
    txHash: '',
    createdAt: new Date().toISOString(),
  };
  db.transactions.push(tx);
  writeDB(db);
  return tx;
}

export function updateTransaction(id: string, patch: Partial<Transaction>): void {
  const db = readDB();
  const idx = db.transactions.findIndex(t => t.id === id);
  if (idx !== -1) {
    db.transactions[idx] = { ...db.transactions[idx], ...patch };
    writeDB(db);
  }
}

export function getTransaction(id: string): Transaction | undefined {
  return readDB().transactions.find(t => t.id === id);
}

export function getLatestTransaction(subAgentId: string): Transaction | undefined {
  const txs = readDB().transactions.filter(t => t.subAgentId === subAgentId);
  return txs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function getPendingTransactions(subAgentId: string): Transaction[] {
  return readDB().transactions.filter(t => t.subAgentId === subAgentId && t.status === 'pending');
}

// ── Subscriptions ──────────────────────────────────────────────────────────

export function createSubscription(
  subAgentId: string,
  name: string,
  cadence: string,
  maxAmount: string,
  recipient: string,
): Subscription {
  const db = readDB();
  const sub: Subscription = {
    id: `sub_${randomUUID().slice(0, 8)}`,
    subAgentId,
    name,
    cadence,
    maxAmount,
    recipient,
    status: 'active',
  };
  db.subscriptions.push(sub);
  writeDB(db);
  return sub;
}

export function getSubscriptionsBySubAgentId(subAgentId: string): Subscription[] {
  return readDB().subscriptions.filter(s => s.subAgentId === subAgentId);
}
