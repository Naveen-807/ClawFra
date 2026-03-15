/**
 * ClawFra Tools — registered in ClawUp
 *
 * Each exported function is a ClawUp tool. ClawFra calls these tools
 * when it receives Telegram commands.
 *
 * Tool naming follows the guide:
 *   ensure_user_subagent   → /start
 *   get_wallet_status      → /wallet
 *   set_max_policy         → /policy set max <amount>
 *   allow_recipient        → /policy allow <address>
 *   evaluate_and_send_payment → /pay <amount> <recipient>
 *   approve_pending_payment   → /approve <txId>
 *   get_user_status        → /status
 *   add_subscription       → /subscribe <name> <cadence> <amount> <recipient>
 */

import * as store from '../../packages/db/src/store.js';
import type { TxStatus } from '../../packages/shared-types/src/types.js';
import { createWallet, fundWallet, sendNativeTx, getExplorerAddressUrl } from '../../packages/wallet-service/src/goat.js';
import { encrypt, decrypt } from '../../packages/wallet-service/src/crypto.js';
import { evaluateTransaction, createDefaultPolicy } from '../../packages/policy-engine/src/policy.js';
import {
  createUserSpreadsheet,
  appendTransactionRow,
  appendPolicyRow,
  appendSubscriptionRow,
} from '../../packages/sheets-service/src/sheets.js';

const EXPLORER = process.env.GOAT_EXPLORER_URL || 'https://explorer.testnet3.goat.network';
const FUND_AMOUNT = process.env.TREASURY_FUND_AMOUNT || '0.0002';

// ── Tool: ensure_user_subagent (/start) ────────────────────────────────────

export async function ensure_user_subagent(params: {
  telegramUserId: string;
  username: string;
}): Promise<object> {
  const { telegramUserId, username } = params;

  const user = store.findOrCreateUser(telegramUserId, username);
  let subAgent = store.getSubAgentByUserId(user.id);
  let isNew = false;

  if (!subAgent) {
    isNew = true;

    // Create wallet
    const wallet = createWallet();
    const encryptedKey = encrypt(wallet.privateKey);

    // Create Google Sheet
    let sheetId = '';
    let sheetUrl = '';
    try {
      const sheet = await createUserSpreadsheet(username || telegramUserId);
      sheetId = sheet.sheetId;
      sheetUrl = sheet.sheetUrl;
    } catch (err) {
      console.warn('[sheets] Could not create spreadsheet:', (err as Error).message);
      sheetUrl = 'Sheet creation failed — check GOOGLE credentials';
    }

    // Persist sub-agent
    subAgent = store.createSubAgent(user.id, wallet.address, encryptedKey, sheetId, sheetUrl);

    // Default policy
    const defaultPolicy = createDefaultPolicy(subAgent.id);
    const policy = store.savePolicy(defaultPolicy);

    // Append policy row to sheet
    if (sheetId) {
      try {
        await appendPolicyRow(sheetId, policy);
      } catch { /* non-fatal */ }
    }

    // Fund from treasury
    try {
      await fundWallet(wallet.address, FUND_AMOUNT);
    } catch (err) {
      console.warn('[treasury] Funding failed:', (err as Error).message);
    }
  }

  const policy = store.getPolicyBySubAgentId(subAgent.id);

  return {
    isNew,
    subAgentId: subAgent.id,
    walletAddress: subAgent.walletAddress,
    walletExplorer: getExplorerAddressUrl(subAgent.walletAddress),
    sheetUrl: subAgent.sheetUrl,
    maxTxAmount: policy?.maxTxAmount ?? '0.0002',
    message: isNew
      ? `Welcome to Clawfra.\nSub-agent: ${subAgent.id}\nWallet: ${subAgent.walletAddress}\nSheet: ${subAgent.sheetUrl}\nMax tx: ${policy?.maxTxAmount ?? '0.0002'}`
      : `Welcome back.\nSub-agent: ${subAgent.id}\nWallet: ${subAgent.walletAddress}\nSheet: ${subAgent.sheetUrl}\nMax tx: ${policy?.maxTxAmount ?? '0.0002'}`,
  };
}

// ── Tool: get_wallet_status (/wallet) ──────────────────────────────────────

export async function get_wallet_status(params: {
  telegramUserId: string;
}): Promise<object> {
  const user = store.getUserByTelegramId(params.telegramUserId);
  if (!user) return { error: 'No account found. Send /start first.' };

  const subAgent = store.getSubAgentByUserId(user.id);
  if (!subAgent) return { error: 'No sub-agent found. Send /start first.' };

  return {
    subAgentId: subAgent.id,
    walletAddress: subAgent.walletAddress,
    explorerUrl: getExplorerAddressUrl(subAgent.walletAddress),
    message: `Sub-agent: ${subAgent.id}\nWallet: ${subAgent.walletAddress}\nExplorer: ${getExplorerAddressUrl(subAgent.walletAddress)}`,
  };
}

// ── Tool: set_max_policy (/policy set max <amount>) ────────────────────────

export async function set_max_policy(params: {
  telegramUserId: string;
  amount: string;
}): Promise<object> {
  const { telegramUserId, amount } = params;
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return { error: `Invalid amount: ${amount}` };
  }

  const user = store.getUserByTelegramId(telegramUserId);
  if (!user) return { error: 'No account found. Send /start first.' };

  const subAgent = store.getSubAgentByUserId(user.id);
  if (!subAgent) return { error: 'No sub-agent found. Send /start first.' };

  const existing = store.getPolicyBySubAgentId(subAgent.id);
  const updated = store.savePolicy({
    ...(existing ?? createDefaultPolicy(subAgent.id)),
    maxTxAmount: amount,
  });

  if (subAgent.sheetId) {
    try {
      await appendPolicyRow(subAgent.sheetId, updated);
    } catch { /* non-fatal */ }
  }

  return {
    subAgentId: subAgent.id,
    maxTxAmount: updated.maxTxAmount,
    message: `Policy updated.\nMax tx amount: ${updated.maxTxAmount} GOAT`,
  };
}

// ── Tool: allow_recipient (/policy allow <address>) ────────────────────────

export async function allow_recipient(params: {
  telegramUserId: string;
  address: string;
}): Promise<object> {
  const { telegramUserId, address } = params;

  const user = store.getUserByTelegramId(telegramUserId);
  if (!user) return { error: 'No account found. Send /start first.' };

  const subAgent = store.getSubAgentByUserId(user.id);
  if (!subAgent) return { error: 'No sub-agent found. Send /start first.' };

  const existing = store.getPolicyBySubAgentId(subAgent.id);
  const currentPolicy = existing ?? createDefaultPolicy(subAgent.id);

  const normalizedAddress = address.toLowerCase();
  const alreadyApproved = currentPolicy.approvedRecipients
    .map(r => r.toLowerCase())
    .includes(normalizedAddress);

  if (alreadyApproved) {
    return {
      subAgentId: subAgent.id,
      address,
      message: `${address} is already in the approved list.`,
    };
  }

  const updated = store.savePolicy({
    ...currentPolicy,
    approvedRecipients: [...currentPolicy.approvedRecipients, address],
  });

  if (subAgent.sheetId) {
    try {
      await appendPolicyRow(subAgent.sheetId, updated);
    } catch { /* non-fatal */ }
  }

  return {
    subAgentId: subAgent.id,
    approvedRecipients: updated.approvedRecipients,
    message: `Recipient approved.\n${address} added to allowed list.\nTotal approved: ${updated.approvedRecipients.length}`,
  };
}

// ── Tool: evaluate_and_send_payment (/pay <amount> <recipient>) ────────────

export async function evaluate_and_send_payment(params: {
  telegramUserId: string;
  amount: string;
  recipient: string;
}): Promise<object> {
  const { telegramUserId, amount, recipient } = params;

  const user = store.getUserByTelegramId(telegramUserId);
  if (!user) return { error: 'No account found. Send /start first.' };

  const subAgent = store.getSubAgentByUserId(user.id);
  if (!subAgent) return { error: 'No sub-agent found. Send /start first.' };

  const policy = store.getPolicyBySubAgentId(subAgent.id);
  if (!policy) return { error: 'No policy found. Send /start first.' };

  const { decision, reason } = evaluateTransaction(policy, recipient, amount);

  if (decision === 'deny') {
    const tx = store.createTransaction(subAgent.id, recipient, amount, 'deny', reason, 'denied');
    if (subAgent.sheetId) {
      try {
        await appendTransactionRow(subAgent.sheetId, tx, '');
      } catch { /* non-fatal */ }
    }
    return {
      decision: 'deny',
      reason,
      txId: tx.id,
      message: `Payment blocked.\nDecision: deny\nReason: ${reason}`,
    };
  }

  if (decision === 'ask_approval') {
    const tx = store.createTransaction(subAgent.id, recipient, amount, 'ask_approval', reason, 'pending');
    if (subAgent.sheetId) {
      try {
        await appendTransactionRow(subAgent.sheetId, tx, '');
      } catch { /* non-fatal */ }
    }
    return {
      decision: 'ask_approval',
      reason,
      txId: tx.id,
      message: `Approval required.\nDecision: ask_approval\nReason: ${reason}\n\nTo approve, send: /approve ${tx.id}`,
    };
  }

  // decision === 'allow'
  let txHash = '';
  let explorerUrl = '';
  let txStatus: TxStatus = 'executed';
  let errorMsg = '';

  try {
    const privateKey = decrypt(subAgent.encryptedPrivateKey);
    const result = await sendNativeTx(privateKey, recipient, amount);
    txHash = result.txHash;
    explorerUrl = result.explorerUrl;
  } catch (err) {
    txStatus = 'failed';
    errorMsg = (err as Error).message;
  }

  const tx = store.createTransaction(subAgent.id, recipient, amount, 'allow', reason, txStatus);
  store.updateTransaction(tx.id, { txHash, status: txStatus });

  if (subAgent.sheetId) {
    try {
      const finalTx = { ...tx, txHash, status: txStatus };
      await appendTransactionRow(subAgent.sheetId, finalTx, explorerUrl);
    } catch { /* non-fatal */ }
  }

  if (txStatus === 'failed') {
    return {
      decision: 'allow',
      reason,
      txId: tx.id,
      error: errorMsg,
      message: `Payment approved but transaction failed.\nReason: ${reason}\nError: ${errorMsg}`,
    };
  }

  return {
    decision: 'allow',
    reason,
    txId: tx.id,
    txHash,
    explorerUrl,
    message: `Payment sent.\nDecision: allow\nReason: ${reason}\nTx: ${txHash}\nExplorer: ${explorerUrl}`,
  };
}

// ── Tool: approve_pending_payment (/approve <txId>) ────────────────────────

export async function approve_pending_payment(params: {
  telegramUserId: string;
  txId: string;
}): Promise<object> {
  const { telegramUserId, txId } = params;

  const user = store.getUserByTelegramId(telegramUserId);
  if (!user) return { error: 'No account found. Send /start first.' };

  const subAgent = store.getSubAgentByUserId(user.id);
  if (!subAgent) return { error: 'No sub-agent found. Send /start first.' };

  const tx = store.getTransaction(txId);
  if (!tx) return { error: `Transaction ${txId} not found.` };
  if (tx.subAgentId !== subAgent.id) return { error: 'Transaction does not belong to your sub-agent.' };
  if (tx.status !== 'pending') return { error: `Transaction ${txId} is not pending (status: ${tx.status}).` };

  let txHash = '';
  let explorerUrl = '';
    let txStatus: TxStatus = 'executed';
    let errorMsg = '';

  try {
    const privateKey = decrypt(subAgent.encryptedPrivateKey);
    const result = await sendNativeTx(privateKey, tx.recipient, tx.amount);
    txHash = result.txHash;
    explorerUrl = result.explorerUrl;
  } catch (err) {
    txStatus = 'failed';
    errorMsg = (err as Error).message;
  }

  store.updateTransaction(txId, { txHash, status: txStatus });

  if (subAgent.sheetId) {
    try {
      const updated = { ...tx, txHash, status: txStatus };
      await appendTransactionRow(subAgent.sheetId, updated, explorerUrl);
    } catch { /* non-fatal */ }
  }

  if (txStatus === 'failed') {
    return {
      txId,
      error: errorMsg,
      message: `Approval accepted but transaction failed.\nError: ${errorMsg}`,
    };
  }

  return {
    txId,
    txHash,
    explorerUrl,
    message: `Payment approved and sent.\nTx: ${txHash}\nExplorer: ${explorerUrl}`,
  };
}

// ── Tool: get_user_status (/status) ───────────────────────────────────────

export async function get_user_status(params: {
  telegramUserId: string;
}): Promise<object> {
  const user = store.getUserByTelegramId(params.telegramUserId);
  if (!user) return { error: 'No account found. Send /start first.' };

  const subAgent = store.getSubAgentByUserId(user.id);
  if (!subAgent) return { error: 'No sub-agent found. Send /start first.' };

  const policy = store.getPolicyBySubAgentId(subAgent.id);
  const lastTx = store.getLatestTransaction(subAgent.id);

  const lines = [
    `Sub-agent: ${subAgent.id}`,
    `Wallet: ${subAgent.walletAddress}`,
    `Policy max: ${policy?.maxTxAmount ?? 'not set'}`,
    `Approved recipients: ${policy?.approvedRecipients.length ?? 0}`,
    `Last tx: ${lastTx?.txHash || 'none'}`,
    `Sheet: ${subAgent.sheetUrl}`,
  ];

  return {
    subAgentId: subAgent.id,
    walletAddress: subAgent.walletAddress,
    sheetUrl: subAgent.sheetUrl,
    maxTxAmount: policy?.maxTxAmount,
    approvedRecipientsCount: policy?.approvedRecipients.length ?? 0,
    lastTxHash: lastTx?.txHash || null,
    lastTxStatus: lastTx?.status || null,
    message: lines.join('\n'),
  };
}

// ── Tool: add_subscription (/subscribe) ───────────────────────────────────

export async function add_subscription(params: {
  telegramUserId: string;
  name: string;
  cadence: string;
  maxAmount: string;
  recipient: string;
}): Promise<object> {
  const { telegramUserId, name, cadence, maxAmount, recipient } = params;

  const user = store.getUserByTelegramId(telegramUserId);
  if (!user) return { error: 'No account found. Send /start first.' };

  const subAgent = store.getSubAgentByUserId(user.id);
  if (!subAgent) return { error: 'No sub-agent found. Send /start first.' };

  const sub = store.createSubscription(subAgent.id, name, cadence, maxAmount, recipient);

  if (subAgent.sheetId) {
    try {
      await appendSubscriptionRow(subAgent.sheetId, sub);
    } catch { /* non-fatal */ }
  }

  return {
    subscriptionId: sub.id,
    name: sub.name,
    cadence: sub.cadence,
    maxAmount: sub.maxAmount,
    recipient: sub.recipient,
    message: `Subscription created.\nName: ${name}\nCadence: ${cadence}\nMax: ${maxAmount} GOAT\nRecipient: ${recipient}`,
  };
}
