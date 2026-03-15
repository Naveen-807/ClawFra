import "dotenv/config";
import express from "express";
import {
  getOrCreateUser,
  getSubAgent,
  createSubAgent,
  getOrCreatePolicy,
  setMaxTxAmount,
  addApprovedRecipient,
  createTransaction,
  getLastTransaction,
} from "./db.js";
import {
  createWallet,
  encrypt,
  fundWallet,
  sendTx,
  sendAgentFee,
  explorerAddressUrl,
} from "./wallet.js";
import { evaluateTransaction } from "./policy.js";

const app = express();
app.use(express.json());

const AGENT_8004_ID = "#202";
const AGENT_8004_LINK = "https://www.8004scan.io/";
const EXPLORER = "https://explorer.testnet3.goat.network";

// --- POST /start ---
app.post("/start", async (req, res) => {
  try {
    const { telegramUserId, username } = req.body;
    if (!telegramUserId) {
      return res.status(400).json({ error: "telegramUserId required" });
    }

    const user = getOrCreateUser(String(telegramUserId), username);
    let subAgent = getSubAgent(user.id);
    let isNew = false;

    if (!subAgent) {
      isNew = true;
      const wallet = createWallet();
      const encryptedKey = encrypt(wallet.privateKey);
      subAgent = createSubAgent(user.id, wallet.address, encryptedKey);

      // Create default policy
      getOrCreatePolicy(subAgent.id);

      // Fund wallet from treasury
      try {
        await fundWallet(wallet.address);
      } catch (e: any) {
        console.error("Failed to fund wallet:", e.message);
      }
    }

    const policy = getOrCreatePolicy(subAgent.id);

    res.json({
      message: isNew
        ? "Welcome to ClawFra. Your agent has been created."
        : "Welcome back. Your agent is ready.",
      subAgentId: subAgent.id,
      walletAddress: subAgent.walletAddress,
      walletExplorer: explorerAddressUrl(subAgent.walletAddress),
      policy: {
        maxTxAmount: policy.maxTxAmount,
        autoApproveAmount: policy.autoApproveAmount,
        approvedRecipients: policy.approvedRecipients,
      },
      identity: {
        agentId: AGENT_8004_ID,
        standard: "ERC-8004",
        explorer: AGENT_8004_LINK,
        note: "This wallet is registered as an on-chain agent identity",
      },
      isNew,
    });
  } catch (e: any) {
    console.error("/start error:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- POST /policy ---
app.post("/policy", async (req, res) => {
  try {
    const { telegramUserId, action, value } = req.body;
    if (!telegramUserId || !action) {
      return res
        .status(400)
        .json({ error: "telegramUserId, action required" });
    }

    const user = getOrCreateUser(String(telegramUserId));
    const subAgent = getSubAgent(user.id);
    if (!subAgent) {
      return res
        .status(404)
        .json({ error: "No agent found. Send /start first." });
    }

    if (action === "setMax") {
      const amount = parseFloat(value);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }
      setMaxTxAmount(subAgent.id, amount);
      const policy = getOrCreatePolicy(subAgent.id);
      return res.json({
        message: `Max transaction amount set to ${amount}`,
        policy: {
          maxTxAmount: policy.maxTxAmount,
          autoApproveAmount: policy.autoApproveAmount,
          approvedRecipients: policy.approvedRecipients,
        },
      });
    }

    if (action === "setAutoApprove") {
      const amount = parseFloat(value);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }
      const { setAutoApproveAmount } = await import("./db.js");
      setAutoApproveAmount(subAgent.id, amount);
      const policy = getOrCreatePolicy(subAgent.id);
      return res.json({
        message: `Auto-approve threshold set to ${amount}`,
        policy: {
          maxTxAmount: policy.maxTxAmount,
          autoApproveAmount: policy.autoApproveAmount,
          approvedRecipients: policy.approvedRecipients,
        },
      });
    }

    if (action === "allow") {
      if (!value || !value.startsWith("0x")) {
        return res.status(400).json({ error: "Invalid address" });
      }
      const recipients = addApprovedRecipient(subAgent.id, value);
      return res.json({
        message: `Address ${value} added to approved recipients`,
        approvedRecipients: recipients,
      });
    }

    return res.status(400).json({ error: "Unknown action. Use: setMax, setAutoApprove, allow" });
  } catch (e: any) {
    console.error("/policy error:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- POST /pay ---
app.post("/pay", async (req, res) => {
  try {
    const { telegramUserId, amount, recipientAddress } = req.body;
    if (!telegramUserId || !amount || !recipientAddress) {
      return res
        .status(400)
        .json({ error: "telegramUserId, amount, recipientAddress required" });
    }

    const user = getOrCreateUser(String(telegramUserId));
    const subAgent = getSubAgent(user.id);
    if (!subAgent) {
      return res
        .status(404)
        .json({ error: "No agent found. Send /start first." });
    }

    const policy = getOrCreatePolicy(subAgent.id);
    const numAmount = parseFloat(amount);
    const evaluation = evaluateTransaction(policy, recipientAddress, numAmount);

    // DENY
    if (evaluation.decision === "deny") {
      createTransaction(
        subAgent.id,
        recipientAddress,
        numAmount,
        "deny",
        evaluation.reason,
        "blocked"
      );
      return res.json({
        allowed: false,
        decision: "deny",
        reason: evaluation.reason,
      });
    }

    // ASK APPROVAL
    if (evaluation.decision === "ask_approval") {
      createTransaction(
        subAgent.id,
        recipientAddress,
        numAmount,
        "ask_approval",
        evaluation.reason,
        "pending_approval"
      );
      return res.json({
        allowed: false,
        decision: "ask_approval",
        reason: evaluation.reason,
      });
    }

    // ALLOW — execute both transactions
    let userTx: { txHash: string; explorerUrl: string };
    let feeTx: { txHash: string; explorerUrl: string } | null = null;

    // 1. User payment
    userTx = await sendTx(
      subAgent.encryptedPrivateKey,
      recipientAddress,
      String(numAmount)
    );

    // 2. Agent fee (x402)
    try {
      feeTx = await sendAgentFee(subAgent.encryptedPrivateKey);
    } catch (e: any) {
      console.error("Agent fee tx failed (continuing):", e.message);
    }

    createTransaction(
      subAgent.id,
      recipientAddress,
      numAmount,
      "allow",
      evaluation.reason,
      "completed",
      userTx.txHash,
      feeTx?.txHash ?? null
    );

    res.json({
      allowed: true,
      decision: "allow",
      reason: evaluation.reason,
      userPayment: {
        txHash: userTx.txHash,
        explorer: userTx.explorerUrl,
      },
      agentFee: feeTx
        ? {
            txHash: feeTx.txHash,
            explorer: feeTx.explorerUrl,
            note: "x402 agent fee — the agent charged for this action",
          }
        : { note: "Agent fee tx failed — see logs" },
    });
  } catch (e: any) {
    console.error("/pay error:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- POST /status ---
app.post("/status", async (req, res) => {
  try {
    const { telegramUserId } = req.body;
    if (!telegramUserId) {
      return res.status(400).json({ error: "telegramUserId required" });
    }

    const user = getOrCreateUser(String(telegramUserId));
    const subAgent = getSubAgent(user.id);
    if (!subAgent) {
      return res
        .status(404)
        .json({ error: "No agent found. Send /start first." });
    }

    const policy = getOrCreatePolicy(subAgent.id);
    const lastTx = getLastTransaction(subAgent.id);

    res.json({
      subAgentId: subAgent.id,
      walletAddress: subAgent.walletAddress,
      walletExplorer: explorerAddressUrl(subAgent.walletAddress),
      policy: {
        maxTxAmount: policy.maxTxAmount,
        autoApproveAmount: policy.autoApproveAmount,
        approvedRecipients: policy.approvedRecipients,
      },
      lastTransaction: lastTx
        ? {
            amount: lastTx.amount,
            recipient: lastTx.recipient,
            decision: lastTx.decision,
            txHash: lastTx.txHash,
            explorer: lastTx.txHash
              ? `${EXPLORER}/tx/${lastTx.txHash}`
              : null,
          }
        : null,
      identity: {
        agentId: AGENT_8004_ID,
        standard: "ERC-8004",
        explorer: AGENT_8004_LINK,
        statement:
          "This wallet is an agent with on-chain identity (ERC-8004 #202)",
      },
    });
  } catch (e: any) {
    console.error("/status error:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- Health check ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok", agent: "ClawFra", erc8004: AGENT_8004_ID });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`ClawFra API running on port ${PORT}`);
  console.log(`ERC-8004 Agent ID: ${AGENT_8004_ID}`);
  console.log(`Endpoints: POST /start, /policy, /pay, /status`);
});
