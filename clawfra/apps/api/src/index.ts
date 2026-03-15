/**
 * ClawFra API
 *
 * Exposes ClawFra tools as HTTP endpoints so ClawUp can call them.
 * Each POST /tools/<toolName> accepts JSON params and returns JSON.
 *
 * ClawUp wires Telegram commands → this API → tool response → Telegram reply.
 */

import express from 'express';
import { validateEnv } from './env.js';
import * as tools from '../../../plugins/clawfra-tools/index.js';

validateEnv();

const app = express();
app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    service: 'ClawFra API',
    version: '1.0.0',
    tools: Object.keys(tools),
    status: 'running',
  });
});

// ── Generic tool dispatcher ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toolMap: Record<string, (params: any) => Promise<object>> = {
  ensure_user_subagent: tools.ensure_user_subagent,
  get_wallet_status: tools.get_wallet_status,
  set_max_policy: tools.set_max_policy,
  allow_recipient: tools.allow_recipient,
  evaluate_and_send_payment: tools.evaluate_and_send_payment,
  approve_pending_payment: tools.approve_pending_payment,
  get_user_status: tools.get_user_status,
  add_subscription: tools.add_subscription,
};

app.post('/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const fn = toolMap[toolName];
  if (!fn) {
    return res.status(404).json({ error: `Unknown tool: ${toolName}` });
  }
  try {
    const result = await fn(req.body);
    return res.json(result);
  } catch (err) {
    console.error(`[tool:${toolName}]`, err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`ClawFra API running on port ${PORT}`);
  console.log(`Tools: ${Object.keys(toolMap).join(', ')}`);
});
