import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import type { User, SubAgent, Policy, Transaction } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "clawfra.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// --- Schema ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegramUserId TEXT UNIQUE NOT NULL,
    username TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sub_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER UNIQUE NOT NULL,
    walletAddress TEXT NOT NULL,
    encryptedPrivateKey TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subAgentId INTEGER UNIQUE NOT NULL,
    maxTxAmount REAL DEFAULT 0.0005,
    autoApproveAmount REAL DEFAULT 0.0002,
    approvedRecipients TEXT DEFAULT '[]',
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (subAgentId) REFERENCES sub_agents(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subAgentId INTEGER NOT NULL,
    recipient TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    decision TEXT NOT NULL,
    decisionReason TEXT NOT NULL,
    txHash TEXT,
    agentFeeTxHash TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (subAgentId) REFERENCES sub_agents(id)
  );
`);

// --- User ---
const stmtGetUser = db.prepare("SELECT * FROM users WHERE telegramUserId = ?");
const stmtCreateUser = db.prepare(
  "INSERT INTO users (telegramUserId, username) VALUES (?, ?) RETURNING *"
);

export function getOrCreateUser(
  telegramUserId: string,
  username?: string
): User {
  const existing = stmtGetUser.get(telegramUserId) as User | undefined;
  if (existing) return existing;
  return stmtCreateUser.get(telegramUserId, username ?? null) as User;
}

// --- SubAgent ---
const stmtGetSubAgent = db.prepare(
  "SELECT * FROM sub_agents WHERE userId = ?"
);
const stmtCreateSubAgent = db.prepare(
  "INSERT INTO sub_agents (userId, walletAddress, encryptedPrivateKey) VALUES (?, ?, ?) RETURNING *"
);

export function getSubAgent(userId: number): SubAgent | undefined {
  return stmtGetSubAgent.get(userId) as SubAgent | undefined;
}

export function createSubAgent(
  userId: number,
  walletAddress: string,
  encryptedPrivateKey: string
): SubAgent {
  return stmtCreateSubAgent.get(
    userId,
    walletAddress,
    encryptedPrivateKey
  ) as SubAgent;
}

// --- Policy ---
const stmtGetPolicy = db.prepare(
  "SELECT * FROM policies WHERE subAgentId = ?"
);
const stmtCreatePolicy = db.prepare(
  "INSERT INTO policies (subAgentId) VALUES (?) RETURNING *"
);
const stmtUpdateMaxTx = db.prepare(
  "UPDATE policies SET maxTxAmount = ? WHERE subAgentId = ?"
);
const stmtUpdateAutoApprove = db.prepare(
  "UPDATE policies SET autoApproveAmount = ? WHERE subAgentId = ?"
);
const stmtUpdateRecipients = db.prepare(
  "UPDATE policies SET approvedRecipients = ? WHERE subAgentId = ?"
);

export function getOrCreatePolicy(subAgentId: number): Policy {
  let row = stmtGetPolicy.get(subAgentId) as any;
  if (!row) {
    row = stmtCreatePolicy.get(subAgentId) as any;
  }
  return {
    ...row,
    approvedRecipients: JSON.parse(row.approvedRecipients),
  };
}

export function setMaxTxAmount(subAgentId: number, amount: number): void {
  stmtUpdateMaxTx.run(amount, subAgentId);
}

export function setAutoApproveAmount(
  subAgentId: number,
  amount: number
): void {
  stmtUpdateAutoApprove.run(amount, subAgentId);
}

export function addApprovedRecipient(
  subAgentId: number,
  address: string
): string[] {
  const policy = getOrCreatePolicy(subAgentId);
  const lower = address.toLowerCase();
  if (!policy.approvedRecipients.includes(lower)) {
    policy.approvedRecipients.push(lower);
  }
  stmtUpdateRecipients.run(
    JSON.stringify(policy.approvedRecipients),
    subAgentId
  );
  return policy.approvedRecipients;
}

// --- Transactions ---
const stmtCreateTx = db.prepare(`
  INSERT INTO transactions (subAgentId, recipient, amount, status, decision, decisionReason, txHash, agentFeeTxHash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
`);
const stmtGetLastTx = db.prepare(
  "SELECT * FROM transactions WHERE subAgentId = ? ORDER BY id DESC LIMIT 1"
);

export function createTransaction(
  subAgentId: number,
  recipient: string,
  amount: number,
  decision: string,
  decisionReason: string,
  status: string,
  txHash: string | null = null,
  agentFeeTxHash: string | null = null
): Transaction {
  return stmtCreateTx.get(
    subAgentId,
    recipient,
    amount,
    status,
    decision,
    decisionReason,
    txHash,
    agentFeeTxHash
  ) as Transaction;
}

export function getLastTransaction(
  subAgentId: number
): Transaction | undefined {
  return stmtGetLastTx.get(subAgentId) as Transaction | undefined;
}

