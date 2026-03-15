import type { Policy, PolicyEvaluation } from "./types.js";

export function evaluateTransaction(
  policy: Policy,
  recipient: string,
  amount: number
): PolicyEvaluation {
  const lower = recipient.toLowerCase();
  const approved = policy.approvedRecipients.map((r) => r.toLowerCase());

  // Rule 1: recipient must be in approved list
  if (!approved.includes(lower)) {
    return {
      decision: "deny",
      reason: `Recipient ${recipient} is not in the approved list`,
    };
  }

  // Rule 2: hard cap
  if (amount > policy.maxTxAmount) {
    return {
      decision: "deny",
      reason: `Amount ${amount} exceeds max transaction limit of ${policy.maxTxAmount}`,
    };
  }

  // Rule 3: auto-approve for small amounts
  if (amount <= policy.autoApproveAmount) {
    return {
      decision: "allow",
      reason: `Approved recipient, amount ${amount} is within auto-approve threshold of ${policy.autoApproveAmount}`,
    };
  }

  // Rule 4: needs human approval for amounts between auto-approve and max
  return {
    decision: "ask_approval",
    reason: `Amount ${amount} exceeds auto-approve threshold of ${policy.autoApproveAmount} but is within max of ${policy.maxTxAmount}. Requires user approval.`,
  };
}
