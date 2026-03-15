export interface User {
  id: number;
  telegramUserId: string;
  username: string | null;
  createdAt: string;
}

export interface SubAgent {
  id: number;
  userId: number;
  walletAddress: string;
  encryptedPrivateKey: string;
  status: string;
  createdAt: string;
}

export interface Policy {
  id: number;
  subAgentId: number;
  maxTxAmount: number;
  autoApproveAmount: number;
  approvedRecipients: string[];
  createdAt: string;
}

export interface Transaction {
  id: number;
  subAgentId: number;
  recipient: string;
  amount: number;
  status: string;
  decision: "allow" | "deny" | "ask_approval";
  decisionReason: string;
  txHash: string | null;
  agentFeeTxHash: string | null;
  createdAt: string;
}

export type PolicyDecision = "allow" | "deny" | "ask_approval";

export interface PolicyEvaluation {
  decision: PolicyDecision;
  reason: string;
}
