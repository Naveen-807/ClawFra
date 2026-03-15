# Clawfra

Clawfra is a chat-native commerce system built on OpenClaw.

The product idea is:

- `ClawBot` is the main agent
- every user gets a persistent `user sub-agent`
- the sub-agent has a wallet context, subscription state, and finance history
- `Telegram` is the command surface
- `Google Sheets` is the finance planner and transaction history

The user talks in Telegram.
ClawBot routes the request.
The user sub-agent handles state.
Every transaction is written into that user's Google Sheet.

## What Is Real In This README

This README is intentionally strict about what is real and what is product logic you will implement yourself.

### Real platform pieces

- OpenClaw can run local agents, channels, plugins, hooks, and sub-agents
- Telegram bots are officially supported by Telegram Bot API
- Google Sheets and Google Drive APIs can create spreadsheets and append rows
- ClawUp can be used later for deployment and app distribution

### Important constraint

In this project, `user sub-agent` means a `persistent application-level agent record managed by ClawBot`.

That is different from OpenClaw's built-in `sub-agents` feature, which is designed for background work and auto-archives after inactivity. For the hackathon MVP, do not depend on stock OpenClaw sub-agents to represent persistent per-user wallets.

## One-Line Pitch

Clawfra creates a persistent wallet-backed user sub-agent for each Telegram user, then uses Google Sheets as that sub-agent's live finance planner and transaction ledger.

## Demo Story

1. A user opens Telegram and messages ClawBot
2. ClawBot checks whether that Telegram user already has a sub-agent
3. If not, ClawBot creates:
   - a user record
   - a sub-agent record
   - a wallet record
   - a dedicated Google Sheet
4. The user sends `/subscribe weekly-research 3`
5. The sub-agent stores the subscription
6. The user sends `/pay 1 provider-demo`
7. The wallet service executes or simulates the transaction
8. Clawfra appends a new row to the user's finance sheet
9. `/status` returns:
   - sub-agent id
   - wallet/account id
   - active subscriptions
   - last transaction
   - Google Sheet link

That is the correct MVP. Do not overbuild.

## Architecture

```text
Telegram
  -> ClawBot (OpenClaw main agent)
      -> User Registry
      -> Sub-Agent Registry
      -> Wallet Service
      -> Subscription Store
      -> Google Sheets Sync
      -> Transaction Log
  -> Dashboard or Status View
```

## Recommended Tech Stack

- `OpenClaw` for the main agent runtime and Telegram channel binding
- `Node.js` for the app services and OpenClaw plugin tools
- `SQLite` or `JSON` file for local persistence
- `Google Sheets API` for finance planner rows
- `Google Drive API` for spreadsheet creation in a shared folder
- `Telegram Bot API` for the user interface

## Why Google Sheets Fits This Project

Google Sheets should not be an extra gimmick.
It should be the visible memory of each user's sub-agent.

Use one sheet per user sub-agent.
Do not create one new spreadsheet for every transaction.

### Correct model

- first `/start` creates one sheet
- every `/pay` appends a row
- every `/subscribe` can append a row or update a subscriptions tab
- `/status` returns the same sheet URL every time

That makes the sub-agent feel persistent and real.

## Google Sheet Structure

Create one spreadsheet per user with at least these tabs:

### `Transactions`

Columns:

- `timestamp`
- `telegram_user_id`
- `sub_agent_id`
- `wallet_id`
- `command`
- `transaction_type`
- `counterparty`
- `amount`
- `currency`
- `network`
- `status`
- `tx_id`
- `note`

### `Subscriptions`

Columns:

- `created_at`
- `telegram_user_id`
- `sub_agent_id`
- `plan_name`
- `cadence`
- `max_amount`
- `currency`
- `status`
- `next_run_at`

## Project Scope

### Must have

- one OpenClaw main agent named `ClawBot`
- one Telegram bot
- persistent user records
- persistent sub-agent records
- wallet record per user sub-agent
- one Google Sheet per user sub-agent
- `/start`
- `/subscribe`
- `/pay`
- `/status`

### Nice to have

- dashboard page
- recurring renewal simulation
- transaction success and failure rows
- optional GOAT payment rail later

### Cut completely if time gets tight

- multiple chat platforms
- multiple network integrations
- fancy frontend
- autonomous provider marketplace
- real recurring scheduler

## Build Strategy

Build the app in two layers:

### Layer 1: OpenClaw orchestration

Use OpenClaw to:

- run the main agent
- bind Telegram to the main agent
- give the agent access to custom tools

### Layer 2: Clawfra application logic

Your app code must implement:

- user lookup
- sub-agent creation
- wallet creation or assignment
- Google Sheet creation
- row append after transactions
- subscription state
- status lookup

## Step 1: Install OpenClaw

OpenClaw's official quickstart supports installation via shell installer or npm.

### Option A

```bash
curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw/main/install.sh | bash
```

### Option B

```bash
npm install -g openclaw@latest
```

Then onboard:

```bash
openclaw onboard --install-daemon
```

Useful commands:

```bash
openclaw dashboard
openclaw gateway --port 18789
openclaw status
```

## Step 2: Create The Telegram Bot

Use Telegram's official bot flow:

1. Open `@BotFather`
2. Run `/newbot`
3. Set bot name and username
4. Copy the bot token

Store the token as:

```bash
TELEGRAM_BOT_TOKEN=...
```

## Step 3: Bind Telegram To OpenClaw

Add the Telegram channel in OpenClaw:

```bash
openclaw channels add --channel telegram --token "$TELEGRAM_BOT_TOKEN"
```

Then create the main agent:

```bash
openclaw agents add clawbot
```

Set the identity:

```bash
openclaw agents set-identity --agent clawbot --name "ClawBot"
```

At this point, keep the agent simple.
One agent only.
Do not try to dynamically create OpenClaw agents per user during the hackathon MVP.

## Step 4: Decide How To Represent User Sub-Agents

For this project, implement user sub-agents as persistent records in your own app database.

Use a table or JSON object like this:

```json
{
  "telegramUserId": "123456789",
  "subAgentId": "sa_001",
  "walletId": "wallet_001",
  "sheetId": "1AbC...",
  "sheetUrl": "https://docs.google.com/spreadsheets/d/...",
  "subscriptions": [],
  "lastTransactionId": null,
  "createdAt": "2026-03-14T00:00:00Z"
}
```

This is the most honest and finishable way to get persistent sub-agents in 4 hours.

## Step 5: Create The Google Cloud Project

Use Google Cloud for Sheets and Drive access.

Do this:

1. Create a Google Cloud project
2. Enable:
   - `Google Sheets API`
   - `Google Drive API`
3. Create a `service account`
4. Download the service account JSON key

Use these environment variables:

```bash
GOOGLE_PROJECT_ID=...
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=...
```

## Step 6: Make Sheets Visible In Your Own Drive

This part matters.

If you use a service account, spreadsheets created by that service account will belong to that service account unless you place them in a folder you can access.

Fastest hackathon setup:

1. Create a folder in your Google Drive named `Clawfra`
2. Share that folder with the service account email as `Editor`
3. Save the folder id as `GOOGLE_DRIVE_FOLDER_ID`

Then create each user sheet inside that folder.

That way, the files show up in your normal Google Drive and are easy to demo live.

## Step 7: Build The Google Sheets Service

Implement two things:

### A. Spreadsheet creation

On first `/start`, create a Google spreadsheet for that user sub-agent.

Recommended naming:

```text
Clawfra - tg_<telegramUserId> - <subAgentId>
```

Then initialize:

- `Transactions` sheet
- `Subscriptions` sheet
- header rows

### B. Append transaction rows

After every `/pay`, append a row to `Transactions`.

After every `/subscribe`, append a row to `Subscriptions` or update that tab.

## Step 8: Build The Clawfra Data Model

You need four persistent models.

### User

- `id`
- `telegramUserId`
- `displayName`
- `createdAt`

### SubAgent

- `id`
- `userId`
- `walletId`
- `sheetId`
- `sheetUrl`
- `status`

### Subscription

- `id`
- `subAgentId`
- `planName`
- `cadence`
- `maxAmount`
- `currency`
- `status`

### Transaction

- `id`
- `subAgentId`
- `type`
- `counterparty`
- `amount`
- `currency`
- `status`
- `txId`
- `createdAt`

## Step 9: Build The Commands

Keep the command set minimal.

### `/start`

Flow:

1. read Telegram user id
2. look up user record
3. if missing:
   - create user
   - create sub-agent
   - create wallet record
   - create Google Sheet
4. return:
   - sub-agent id
   - wallet id
   - sheet link

### `/subscribe weekly-research 3`

Flow:

1. resolve the user's sub-agent
2. create subscription record
3. append to `Subscriptions` tab
4. return confirmation

### `/pay 1 provider-demo`

Flow:

1. resolve the user's sub-agent
2. create transaction intent
3. execute or simulate payment
4. store transaction result
5. append to `Transactions` tab
6. return tx status and tx id

### `/status`

Flow:

1. resolve the user's sub-agent
2. load wallet id
3. load active subscriptions
4. load last transaction
5. return sheet link

## Step 10: Expose These Capabilities To ClawBot

Use OpenClaw `plugin agent tools` for the app logic.

Create tools such as:

- `ensure_user_subagent`
- `create_user_sheet`
- `create_subscription`
- `execute_payment`
- `append_transaction_row`
- `get_user_status`

Then allowlist those tools for the `clawbot` agent.

This is the right pattern because:

- OpenClaw remains the orchestration layer
- your project code owns the business logic
- ClawBot can call real functions instead of hallucinating state

## Step 11: Suggested Folder Structure

```text
clawfra/
  apps/
    api/
    dashboard/
  packages/
    subagent-store/
    wallet-service/
    sheets-sync/
    shared-types/
  plugins/
    clawfra-tools/
  docs/
    architecture.md
    demo-script.md
  README.md
  CLAWFRA_IMPLEMENTATION_PLAN.md
```

## Step 12: Environment Variables

Use a local `.env` like this:

```bash
TELEGRAM_BOT_TOKEN=
DATABASE_URL=file:./clawfra.db
GOOGLE_PROJECT_ID=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_DRIVE_FOLDER_ID=
OPENCLAW_GATEWAY_URL=http://localhost:18789
APP_BASE_URL=http://localhost:3000
```

If you later add a real settlement rail, add:

```bash
WALLET_NETWORK=
WALLET_PRIVATE_KEY=
PAYMENT_RPC_URL=
```

## Step 13: What To Ship In 4 Hours

This is the correct solo-hacker path.

### Hour 0 to 0:30

- install OpenClaw
- create Telegram bot
- bind Telegram channel
- create `clawbot`

### Hour 0:30 to 1:15

- implement user store
- implement sub-agent store
- implement wallet record
- implement `/start`

### Hour 1:15 to 2:00

- enable Google Sheets and Drive APIs
- create service account
- create Drive folder
- implement sheet creation
- return sheet URL after `/start`

### Hour 2:00 to 2:45

- implement `/subscribe`
- implement `/pay`
- append rows to Sheets

### Hour 2:45 to 3:30

- implement `/status`
- polish response formatting
- verify the same Telegram user always maps to the same sub-agent and sheet

### Hour 3:30 to 4:00

- rehearse demo
- record a backup screen capture
- clean README and setup notes

## How To Demo It

Do not explain too much.
Show persistence.

### Demo sequence

1. Send `/start` from Telegram
2. Show the response with:
   - sub-agent id
   - wallet id
   - Google Sheet link
3. Open the sheet
4. Run `/subscribe weekly-research 3`
5. Show the new subscription row
6. Run `/pay 1 provider-demo`
7. Refresh the sheet
8. Show the new transaction row
9. Run `/status`
10. Prove the same user still has the same sub-agent and same sheet

## What To Say To Judges

Use this wording:

`Clawfra uses OpenClaw to run a main agent called ClawBot. ClawBot provisions a persistent sub-agent for each Telegram user. That sub-agent holds wallet context, subscription state, and a dedicated Google Sheet that acts as its finance planner and transaction history. Telegram is the command surface. Google Sheets is the transparent ledger.`

## What Not To Claim

Do not say:

- OpenClaw natively gives each Telegram user a persistent wallet agent
- Google Sheets is the transaction engine
- the project already supports every chat platform

Do say:

- OpenClaw is the orchestration layer
- ClawBot is the main agent
- persistent user sub-agents are implemented in Clawfra app state
- Google Sheets is the finance planner and transaction display layer

## Stretch Path: GOAT Track

Only do this after the base app works.

Good stretch additions:

- add ERC-8004 identity for the sub-agent
- replace simulated payment execution with a real agent-native payment action
- keep the same Google Sheet append flow

Bad stretch additions:

- changing the whole architecture late
- spending most of the hackathon on testnet setup

## Sources

- OpenClaw Quickstart: https://docs.openclaw.ai/quickstart/
- OpenClaw Channels CLI: https://docs.openclaw.ai/cli/channels
- OpenClaw Agents CLI: https://docs.openclaw.ai/cli/agents
- OpenClaw Sub-Agents: https://docs.openclaw.ai/sub-agents/
- OpenClaw Plugin Agent Tools: https://docs.openclaw.ai/plugins/agent-tools/
- ClawUp Overview: https://docs.clawup.org/overview
- Telegram Bot Tutorial: https://core.telegram.org/bots/tutorial
- Telegram Bot API: https://core.telegram.org/bots/api
- Google Sheets API Node.js Quickstart: https://developers.google.com/sheets/api/quickstart/nodejs
- Google Sheets Values Append: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append
- Google Drive Create Files: https://developers.google.com/workspace/drive/api/guides/create-file
- Google Drive Manage Sharing: https://developers.google.com/workspace/drive/api/guides/manage-sharing
- Google Service Accounts: https://developers.google.com/identity/protocols/oauth2/service-account
