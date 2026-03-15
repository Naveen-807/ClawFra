# ClawFra

Autonomous sub-agent system for GOAT Testnet3.

Every Telegram user gets a persistent AI sub-agent with their own wallet, policy rules, and Google Sheet.

Built on ClawUp + GOAT Network.

---

## What It Does

- **ClawFra** (in ClawUp) receives Telegram commands and calls tools
- Each user gets one **sub-agent** with a GOAT Testnet3 wallet
- The **policy engine** decides: `allow`, `ask_approval`, or `deny`
- Every action is logged to the user's **Google Sheet**

---

## Commands

| Command | What it does |
|---|---|
| `/start` | Create sub-agent, wallet, sheet, fund from treasury |
| `/wallet` | Show wallet address and explorer link |
| `/policy set max 0.0002` | Set max transaction amount |
| `/policy allow 0xAddress` | Add an approved recipient |
| `/pay 0.0001 0xAddress` | Send a payment (policy evaluated first) |
| `/approve tx_001` | Approve a pending transaction |
| `/status` | Show sub-agent status, policy, last tx |
| `/subscribe research weekly 0.0002 0xAddress` | Create a standing subscription |

---

## Setup

### 1. Install dependencies

```bash
cd clawfra
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in:
- `GOAT_TREASURY_PRIVATE_KEY` — generate with `npm run setup:wallet`
- `APP_ENCRYPTION_KEY` — any random string
- `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` — from Google Cloud service account
- `GOOGLE_DRIVE_FOLDER_ID` — ID of your shared "Clawfra" Drive folder

### 3. Generate treasury wallet

```bash
npm run setup:wallet
```

Fund the printed address at: https://bridge.testnet3.goat.network/faucet

### 4. Test GOAT tx

```bash
node --loader ts-node/esm scripts/test-goat-tx.ts
```

### 5. Enable Google APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project
3. Enable **Google Sheets API** and **Google Drive API**
4. Create a service account, download the JSON key
5. Copy `client_email` and `private_key` to `.env`
6. Create a folder in Google Drive called "Clawfra"
7. Share it with the service account as **Editor**
8. Copy the folder ID to `GOOGLE_DRIVE_FOLDER_ID`

### 6. Start the API

```bash
npm run dev
```

API runs at `http://localhost:3000`

### 7. Configure ClawFra in ClawUp

1. Open ClawUp → your ClawFra agent
2. Set the system prompt from `docs/CLAWUP_SYSTEM_PROMPT.md`
3. Register the tool endpoint: `http://your-server:3000/tools/{toolName}`
4. Test with `/start` in Telegram

---

## Architecture

```
Telegram
  → ClawFra (ClawUp)
      → POST /tools/ensure_user_subagent
      → POST /tools/evaluate_and_send_payment
      → POST /tools/get_user_status
      → ...

ClawFra API (this repo)
  → packages/db          — JSON store
  → packages/wallet-service — GOAT wallet + encryption
  → packages/policy-engine  — allow/ask_approval/deny
  → packages/sheets-service — Google Sheets
```

---

## GOAT Network

| | |
|---|---|
| Chain | GOAT Testnet3 |
| Chain ID | 48816 |
| RPC | https://rpc.testnet3.goat.network |
| Explorer | https://explorer.testnet3.goat.network |
| Faucet | https://bridge.testnet3.goat.network/faucet |

---

## Policy Engine

```
If recipient not approved → deny
If amount > maxTxAmount → deny
If amount ≤ autoApproveAmount AND approved → allow
If autoApproveAmount < amount ≤ maxTxAmount → ask_approval
```

Default policy (on `/start`):
- Max tx: `0.0002 GOAT`
- Auto-approve: `0.0001 GOAT`
- Approved recipients: `[]` (empty — add with `/policy allow`)

---

## Demo Flow

1. `/start` → sub-agent + wallet + sheet created and funded
2. `/policy allow 0xRecipient`
3. `/policy set max 0.0002`
4. `/pay 0.0001 0xRecipient` → **allow** → real GOAT tx → row in sheet
5. `/status` → same sub-agent, wallet, sheet
6. `/pay 0.001 0xRecipient` → **deny** → bot explains why
