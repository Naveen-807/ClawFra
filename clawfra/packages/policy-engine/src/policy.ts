import type { Policy, TxDecision } from '../../shared-types/src/types.js';

export interface EvaluationResult {
  decision: TxDecision;
  reason: string;
}

/**
 * Evaluate whether a transaction should be allowed, require approval, or be denied.
 *
 * Rules (in priority order):
 *  1. Recipient not in approved list → deny
 *  2. Amount > maxTxAmount → deny
 *  3. Amount <= autoApproveAmount AND recipient approved → allow
 *  4. Amount > autoApproveAmount AND amount <= maxTxAmount → ask_approval
 */
export function evaluateTransaction(
  policy: Policy,
  recipient: string,
  amount: string,
): EvaluationResult {
  const amountNum = parseFloat(amount);
  const maxTx = parseFloat(policy.maxTxAmount);
  const autoApprove = parseFloat(policy.autoApproveAmount);

  const normalizedRecipient = recipient.toLowerCase();
  const isApproved = policy.approvedRecipients
    .map(r => r.toLowerCase())
    .includes(normalizedRecipient);

  if (!isApproved) {
    return {
      decision: 'deny',
      reason: `Recipient ${recipient} is not in the approved list`,
    };
  }

  if (amountNum > maxTx) {
    return {
      decision: 'deny',
      reason: `Amount ${amount} exceeds the maximum transaction limit of ${policy.maxTxAmount}`,
    };
  }

  if (amountNum <= autoApprove) {
    return {
      decision: 'allow',
      reason: `Approved recipient and amount ${amount} is within the auto-approve threshold of ${policy.autoApproveAmount}`,
    };
  }

  return {
    decision: 'ask_approval',
    reason: `Amount ${amount} exceeds auto-approve threshold (${policy.autoApproveAmount}) but is within max limit (${policy.maxTxAmount}). User approval required.`,
  };
}

export function createDefaultPolicy(subAgentId: string): Omit<Policy, 'id' | 'createdAt'> {
  return {
    subAgentId,
    maxTxAmount: '0.0002',
    autoApproveAmount: '0.0001',
    approvedRecipients: [],
    requireApprovalAbove: '0.0001',
  };
}
