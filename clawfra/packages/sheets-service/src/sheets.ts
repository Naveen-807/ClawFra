import { google } from 'googleapis';
import type { Transaction, Policy, Subscription } from '../../shared-types/src/types.js';

function getAuth() {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY must be set');
  return new google.auth.JWT(email, undefined, key, [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ]);
}

export interface SpreadsheetInfo {
  sheetId: string;
  sheetUrl: string;
}

export async function createUserSpreadsheet(username: string): Promise<SpreadsheetInfo> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `Clawfra — ${username}` },
      sheets: [
        { properties: { title: 'Transactions' } },
        { properties: { title: 'Policies' } },
        { properties: { title: 'Subscriptions' } },
      ],
    },
  });

  const spreadsheetId = res.data.spreadsheetId!;
  const spreadsheetUrl = res.data.spreadsheetUrl!;

  // Add headers to each tab
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        {
          range: 'Transactions!A1:I1',
          values: [['ID', 'Recipient', 'Amount', 'Decision', 'Reason', 'Status', 'TxHash', 'Explorer', 'CreatedAt']],
        },
        {
          range: 'Policies!A1:F1',
          values: [['SubAgentId', 'MaxTxAmount', 'AutoApproveAmount', 'RequireApprovalAbove', 'ApprovedRecipients', 'CreatedAt']],
        },
        {
          range: 'Subscriptions!A1:F1',
          values: [['ID', 'Name', 'Cadence', 'MaxAmount', 'Recipient', 'Status']],
        },
      ],
    },
  });

  // Move to the shared Drive folder if configured
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (folderId) {
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: folderId,
      requestBody: {},
    });
  }

  return { sheetId: spreadsheetId, sheetUrl: spreadsheetUrl };
}

export async function appendTransactionRow(
  spreadsheetId: string,
  tx: Transaction,
  explorerUrl: string,
): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Transactions!A:I',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        tx.id,
        tx.recipient,
        tx.amount,
        tx.decision,
        tx.decisionReason,
        tx.status,
        tx.txHash || '',
        explorerUrl || '',
        tx.createdAt,
      ]],
    },
  });
}

export async function appendPolicyRow(
  spreadsheetId: string,
  policy: Policy,
): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Policies!A:F',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        policy.subAgentId,
        policy.maxTxAmount,
        policy.autoApproveAmount,
        policy.requireApprovalAbove,
        policy.approvedRecipients.join(', '),
        policy.createdAt,
      ]],
    },
  });
}

export async function appendSubscriptionRow(
  spreadsheetId: string,
  sub: Subscription,
): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Subscriptions!A:F',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        sub.id,
        sub.name,
        sub.cadence,
        sub.maxAmount,
        sub.recipient,
        sub.status,
      ]],
    },
  });
}
