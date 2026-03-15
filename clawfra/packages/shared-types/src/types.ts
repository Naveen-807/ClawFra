export interface User {
  id: string;
  telegramUserId: string;
  username: string;
  createdAt: string;
}

export interface SubAgent {
  id: string;
  userId: string;
  walletAddress: string;
  encryptedPrivateKey: string;
  sheetId: string;
  sheetUrl: string;
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface Policy {
  id: string;
  subAgentId: string;
  maxTxAmount: string;
  autoApproveAmount: string;
  approvedRecipients: string[];
  requireApprovalAbove: string;
  createdAt: string;
}

export type TxStatus = 'pending' | 'approved' | 'executed' | 'denied' | 'failed';
export type TxDecision = 'allow' | 'ask_approval' | 'deny';

export interface Transaction {
  id: string;
  subAgentId: string;
  recipient: string;
  amount: string;
  status: TxStatus;
  decision: TxDecision;
  decisionReason: string;
  txHash: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  subAgentId: string;
  name: string;
  cadence: string;
  maxAmount: string;
  recipient: string;
  status: 'active' | 'paused' | 'cancelled';
}

export interface DB {
  users: User[];
  subAgents: SubAgent[];
  policies: Policy[];
  transactions: Transaction[];
  subscriptions: Subscription[];
}
