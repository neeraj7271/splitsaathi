import type { SettlementSuggestion } from '@splitsaathi/domain';
import type { GroupEntity } from '../groups/entities/group.entity';
import type { BalanceProjector } from '../ledger/balance.projector';

/** SplitSaathi brand palette — matches `splitsaathi-splash-preview.html`. */
const BRAND = {
  teal: '#1AA88A',
  purple: '#5B4FCF',
  stageBg: '#0A0A0D',
  stageRadial: '#14151B',
  textOnDark: '#CFCFE0',
  white: '#FFFFFF',
  bg: '#F6F7FB',
  card: '#FFFFFF',
  text: '#171922',
  muted: '#5B6273',
  border: '#E4E7EF',
  tealSoft: '#E6F7F3',
  purpleSoft: '#EEEBFA',
  tealRow: '#F0FAF7',
  purpleRow: '#F5F3FC',
  surfaceSoft: '#F8FAFC'
} as const;

/** Display font for the header wordmark only — matches app `typography.display`. */
const WORDMARK_FONT = "'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export interface MonthlySummaryRecipientContext {
  displayName: string;
  participantId: string | null;
}

type BalanceRow = ReturnType<BalanceProjector['listGroupBalances']>[number];

export function monthlySummarySubject(groupName: string, referenceDate?: Date): string {
  return `SplitSaathi monthly summary — ${groupName} (${monthLabelForSummary(referenceDate)})`;
}

export function formatMonthlySummaryText(
  group: Pick<GroupEntity, 'name' | 'baseCurrencyCode'>,
  balanceRows: BalanceRow[],
  nameByParticipantId: Map<string, string>,
  settlements: SettlementSuggestion[],
  recipient?: MonthlySummaryRecipientContext
): string {
  const monthLabel = monthLabelForSummary();
  const stats = computeSummaryStats(balanceRows, recipient?.participantId ?? null);
  const lines = [
    `SplitSaathi — ${monthLabel}`,
    `Group: ${group.name}`,
    `Base currency: ${group.baseCurrencyCode}`,
    ''
  ];

  if (recipient?.displayName) {
    lines.push(`Hi ${recipient.displayName},`);
    lines.push('');
    if (stats.recipientBalanceMinor !== null && stats.recipientBalanceMinor !== 0) {
      lines.push(`Your balance: ${formatSignedAmount(stats.recipientBalanceMinor, group.baseCurrencyCode)}`);
      lines.push('');
    }
  }

  lines.push(
    `Overview: ${stats.membersWithBalance} member(s) with open balances · ${formatAmount(stats.totalOutstandingMinor, group.baseCurrencyCode)} outstanding`
  );
  lines.push('');

  if (balanceRows.length === 0) {
    lines.push('No projected balances yet for this group.');
  } else {
    lines.push('GROUP BALANCES');
    lines.push('Member'.padEnd(24) + 'Status'.padEnd(16) + 'Amount');
    lines.push('-'.repeat(56));
    for (const row of sortBalanceRows(balanceRows)) {
      const name = (nameByParticipantId.get(row.participantId) ?? row.participantId).slice(0, 22);
      const status = balanceStatusLabel(row.amountMinor);
      const amount = formatSignedAmount(row.amountMinor, row.currencyCode);
      lines.push(name.padEnd(24) + status.padEnd(16) + amount);
    }
    lines.push('');
  }

  if (settlements.length > 0) {
    lines.push('SUGGESTED SETTLEMENTS');
    lines.push('Pays'.padEnd(20) + 'To'.padEnd(20) + 'Amount');
    lines.push('-'.repeat(56));
    for (const row of settlements) {
      const payer = (nameByParticipantId.get(row.payerParticipantId) ?? row.payerParticipantId).slice(0, 18);
      const payee = (nameByParticipantId.get(row.payeeParticipantId) ?? row.payeeParticipantId).slice(0, 18);
      lines.push(
        payer.padEnd(20) +
          payee.padEnd(20) +
          formatAmount(row.amountMinor, row.currencyCode)
      );
    }
    lines.push('');
  } else if (balanceRows.some((row) => row.amountMinor !== 0)) {
    lines.push('All balances are already settled — no payments needed.');
    lines.push('');
  }

  lines.push('Open SplitSaathi to record a payment or review details.');
  lines.push('Manage this email in SplitSaathi notification settings.');
  return lines.join('\n');
}

/** Short plain-text part so Gmail does not collapse the HTML body as quoted duplicate content. */
export function formatMonthlySummaryTextInbox(
  group: Pick<GroupEntity, 'name' | 'baseCurrencyCode'>,
  balanceRows: BalanceRow[],
  recipient?: MonthlySummaryRecipientContext
): string {
  const monthLabel = monthLabelForSummary();
  const stats = computeSummaryStats(balanceRows, recipient?.participantId ?? null);
  const lines = [`SplitSaathi monthly summary for ${group.name} (${monthLabel}).`];

  if (recipient?.displayName) {
    lines.push(`Hi ${recipient.displayName},`);
  }

  if (stats.recipientBalanceMinor !== null && stats.recipientBalanceMinor !== 0) {
    lines.push(`Your balance: ${formatSignedAmount(stats.recipientBalanceMinor, group.baseCurrencyCode)}`);
  }

  lines.push(
    `Overview: ${stats.membersWithBalance} member(s) with open balances, ${formatAmount(stats.totalOutstandingMinor, group.baseCurrencyCode)} outstanding.`
  );
  lines.push('The full balance and settlement tables are in the HTML version of this email.');
  lines.push('Open SplitSaathi to record a payment or review live balances.');

  return lines.join('\n\n');
}

export function formatMonthlySummaryHtml(
  group: Pick<GroupEntity, 'name' | 'baseCurrencyCode'>,
  balanceRows: BalanceRow[],
  nameByParticipantId: Map<string, string>,
  settlements: SettlementSuggestion[],
  recipient?: MonthlySummaryRecipientContext
): string {
  const monthLabel = monthLabelForSummary();
  const stats = computeSummaryStats(balanceRows, recipient?.participantId ?? null);
  const greeting = recipient?.displayName
    ? `<p style="margin:0 0 24px;font-size:16px;line-height:1.55;color:${BRAND.text};">Hi <strong>${escapeHtml(recipient.displayName)}</strong>, here is your monthly settlement snapshot for <strong>${escapeHtml(group.name)}</strong>.</p>`
    : `<p style="margin:0 0 24px;font-size:16px;line-height:1.55;color:${BRAND.text};">Your monthly settlement snapshot for <strong>${escapeHtml(group.name)}</strong>.</p>`;

  const recipientBanner = renderRecipientBanner(stats, group.baseCurrencyCode, recipient?.participantId ?? null);
  const statsCards = renderStatsCards(stats, group.baseCurrencyCode, balanceRows.length);
  const balanceTable = renderBalanceTable(balanceRows, nameByParticipantId, recipient?.participantId ?? null);
  const settlementTable = renderSettlementTable(settlements, nameByParticipantId, recipient?.participantId ?? null);
  const headerBrand = renderEmailHeader(monthLabel, group.name);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(monthlySummarySubject(group.name))}</title>
    ${wordmarkFontLinks()}
    ${emailStyles()}
  </head>
  <body style="margin:0;padding:0;width:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;color:${BRAND.text};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${BRAND.bg};">
      <tr>
        <td class="outer-pad" align="center" style="padding:32px 20px;">
          <table role="presentation" class="email-shell" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;margin:0 auto;border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;">
            ${headerBrand}
            <tr>
              <td class="body-cell" style="background:${BRAND.card};padding:32px 32px 24px;">
                ${greeting}
                ${recipientBanner}
                <h2 style="margin:0 0 12px;font-size:17px;line-height:1.35;font-weight:700;color:${BRAND.text};">Overview</h2>
                ${statsCards}
                <h2 style="margin:0 0 8px;font-size:17px;line-height:1.35;font-weight:700;color:${BRAND.text};">Group balances</h2>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:${BRAND.muted};">Every member's net position in ${escapeHtml(group.baseCurrencyCode)}. Positive means they are owed; negative means they owe.</p>
                ${balanceTable}
                <h2 style="margin:32px 0 8px;font-size:17px;line-height:1.35;font-weight:700;color:${BRAND.text};">Suggested settlements</h2>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:${BRAND.muted};">The fewest payments needed to bring everyone back to zero.</p>
                ${settlementTable}
              </td>
            </tr>
            <tr>
              <td class="footer-cell" style="background:${BRAND.card};padding:8px 32px 32px;border-top:1px solid ${BRAND.border};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" style="padding:12px 0 24px;">
                      <a href="https://thesplitsaathi.com" class="cta-btn" style="display:inline-block;background-color:${BRAND.purple};background-image:linear-gradient(135deg,${BRAND.teal} 0%,${BRAND.purple} 100%);color:${BRAND.white} !important;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:12px;">Open SplitSaathi</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:12px;line-height:1.65;color:${BRAND.muted};text-align:center;">You are receiving this because monthly settlement summaries are enabled.<br />Manage preferences in SplitSaathi notification settings.</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:${BRAND.muted};text-align:center;">© ${new Date().getFullYear()} SplitSaathi · Fair splits, clear balances</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderEmailHeader(monthLabel: string, groupName: string): string {
  return `<tr>
              <td class="header-cell" style="background-color:${BRAND.stageBg};background-image:radial-gradient(circle at 50% 35%,${BRAND.stageRadial} 0%,${BRAND.stageBg} 72%);padding:32px 32px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center">
                      <p style="margin:0 0 8px;font-family:${WORDMARK_FONT};font-size:24px;line-height:1.15;font-weight:700;letter-spacing:-0.02em;">
                        <span style="color:${BRAND.teal};">Split</span><span style="color:${BRAND.purple};">Saathi</span>
                      </p>
                      <p style="margin:0 0 10px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.textOnDark};">Monthly settlement summary</p>
                      <p style="margin:0;font-size:15px;line-height:1.45;color:rgba(207,207,224,0.95);">${escapeHtml(monthLabel)} · ${escapeHtml(groupName)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
}

function wordmarkFontLinks(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&amp;display=swap" rel="stylesheet" />`;
}

function emailStyles(): string {
  return `<style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    @media only screen and (max-width: 620px) {
      .outer-pad { padding: 16px 10px !important; }
      .header-cell { padding: 24px 20px 22px !important; }
      .body-cell { padding: 24px 18px 20px !important; }
      .footer-cell { padding: 8px 18px 24px !important; }
      .stat-col { display: block !important; width: 100% !important; padding: 0 0 10px 0 !important; }
      .stat-col-last { padding-bottom: 0 !important; }
      .cta-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>`;
}

function renderRecipientBanner(
  stats: SummaryStats,
  currencyCode: string,
  recipientParticipantId: string | null
): string {
  if (!recipientParticipantId || stats.recipientBalanceMinor === null || stats.recipientBalanceMinor === 0) {
    return '';
  }

  const isCreditor = stats.recipientBalanceMinor > 0;
  const bg = isCreditor ? BRAND.tealSoft : BRAND.purpleSoft;
  const color = isCreditor ? BRAND.teal : BRAND.purple;
  const label = isCreditor ? 'You are owed' : 'You owe';
  const action = isCreditor
    ? 'Ask for settlement or record a payment when someone pays you back.'
    : 'Settle up in the app to keep balances clear for everyone.';

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 28px;">
    <tr>
      <td style="background:${bg};border:1px solid ${color};border-radius:14px;padding:18px 20px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${color};">${label}</p>
        <p style="margin:0 0 8px;font-size:26px;line-height:1.2;font-weight:700;color:${color};">${escapeHtml(formatAmount(Math.abs(stats.recipientBalanceMinor), currencyCode))}</p>
        <p style="margin:0;font-size:13px;line-height:1.5;color:${BRAND.muted};">${action}</p>
      </td>
    </tr>
  </table>`;
}

function renderStatsCards(stats: SummaryStats, currencyCode: string, memberCount: number): string {
  const cards = [
    {
      label: 'Members',
      value: String(memberCount),
      hint: 'in this group',
      accent: BRAND.teal
    },
    {
      label: 'Open balances',
      value: String(stats.membersWithBalance),
      hint: 'not yet settled',
      accent: BRAND.purple
    },
    {
      label: 'Outstanding',
      value: formatAmount(stats.totalOutstandingMinor, currencyCode),
      hint: 'total to settle',
      accent: BRAND.teal
    }
  ];

  const cells = cards
    .map(
      (card, index) => `<td class="stat-col${index === cards.length - 1 ? ' stat-col-last' : ''}" width="33.33%" valign="top" style="width:33.33%;padding:${index === 0 ? '0 8px 0 0' : index === cards.length - 1 ? '0 0 0 8px' : '0 4px'};vertical-align:top;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${BRAND.card};border:1px solid ${BRAND.border};border-top:3px solid ${card.accent};border-radius:14px;">
          <tr>
            <td style="padding:18px 12px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.muted};">${card.label}</p>
              <p style="margin:0 0 4px;font-size:22px;line-height:1.2;font-weight:700;color:${BRAND.text};">${escapeHtml(card.value)}</p>
              <p style="margin:0;font-size:11px;line-height:1.4;color:${BRAND.muted};">${card.hint}</p>
            </td>
          </tr>
        </table>
      </td>`
    )
    .join('');

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 32px;"><tr>${cells}</tr></table>`;
}

function renderBalanceTable(
  balanceRows: BalanceRow[],
  nameByParticipantId: Map<string, string>,
  recipientParticipantId: string | null
): string {
  if (balanceRows.length === 0) {
    return emptyState('No projected balances yet for this group.');
  }

  const rows = sortBalanceRows(balanceRows)
    .map((row) => {
      const isRecipient = row.participantId === recipientParticipantId;
      const name = nameByParticipantId.get(row.participantId) ?? row.participantId;
      const badge = statusBadgeHtml(row.amountMinor);
      const rowBg = isRecipient ? BRAND.tealRow : BRAND.card;
      const nameWeight = isRecipient ? '700' : '600';
      const youTag = isRecipient
        ? ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:${BRAND.tealSoft};color:${BRAND.teal};font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">You</span>`
        : '';

      return `<tr style="background:${rowBg};">
        <td style="padding:15px 18px;border-bottom:1px solid ${BRAND.border};font-size:14px;font-weight:${nameWeight};color:${BRAND.text};">${escapeHtml(name)}${youTag}</td>
        <td style="padding:15px 14px;border-bottom:1px solid ${BRAND.border};">${badge}</td>
        <td align="right" style="padding:15px 18px;border-bottom:1px solid ${BRAND.border};font-size:14px;font-weight:700;color:${amountColor(row.amountMinor)};white-space:nowrap;">${escapeHtml(formatSignedAmount(row.amountMinor, row.currencyCode))}</td>
      </tr>`;
    })
    .join('');

  return tableShell(['Member', 'Status', 'Net balance'], rows);
}

function renderSettlementTable(
  settlements: SettlementSuggestion[],
  nameByParticipantId: Map<string, string>,
  recipientParticipantId: string | null
): string {
  if (settlements.length === 0) {
    return emptyState('Everyone is settled up — no payments are needed right now.');
  }

  const rows = settlements
    .map((row) => {
      const payer = nameByParticipantId.get(row.payerParticipantId) ?? row.payerParticipantId;
      const payee = nameByParticipantId.get(row.payeeParticipantId) ?? row.payeeParticipantId;
      const involvesRecipient =
        recipientParticipantId &&
        (row.payerParticipantId === recipientParticipantId || row.payeeParticipantId === recipientParticipantId);
      const rowBg = involvesRecipient ? BRAND.purpleRow : BRAND.card;
      const highlight = involvesRecipient
        ? ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:${BRAND.purpleSoft};color:${BRAND.purple};font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Involves you</span>`
        : '';

      return `<tr style="background:${rowBg};">
        <td style="padding:15px 18px;border-bottom:1px solid ${BRAND.border};font-size:14px;font-weight:600;color:${BRAND.text};">${escapeHtml(payer)}</td>
        <td style="padding:15px 10px;border-bottom:1px solid ${BRAND.border};font-size:16px;color:${BRAND.muted};text-align:center;width:36px;">→</td>
        <td style="padding:15px 18px;border-bottom:1px solid ${BRAND.border};font-size:14px;font-weight:600;color:${BRAND.text};">${escapeHtml(payee)}${highlight}</td>
        <td align="right" style="padding:15px 18px;border-bottom:1px solid ${BRAND.border};font-size:14px;font-weight:700;color:${BRAND.purple};white-space:nowrap;">${escapeHtml(formatAmount(row.amountMinor, row.currencyCode))}</td>
      </tr>`;
    })
    .join('');

  return tableShell(['Pays', '', 'Receives', 'Amount'], rows);
}

function tableShell(headers: string[], bodyRows: string): string {
  const headCells = headers
    .map((header, index) => {
      const align = index === headers.length - 1 ? 'right' : index === 1 && header === '' ? 'center' : 'left';
      return `<th style="padding:13px 18px;background:${BRAND.surfaceSoft};border-bottom:1px solid ${BRAND.border};font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.muted};text-align:${align};">${escapeHtml(header)}</th>`;
    })
    .join('');

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid ${BRAND.border};border-radius:14px;border-collapse:separate;">
    <thead><tr>${headCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>`;
}

function emptyState(message: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px dashed ${BRAND.border};border-radius:14px;">
    <tr>
      <td style="padding:22px 18px;text-align:center;font-size:14px;line-height:1.5;color:${BRAND.muted};">${escapeHtml(message)}</td>
    </tr>
  </table>`;
}

interface SummaryStats {
  membersWithBalance: number;
  totalOutstandingMinor: number;
  recipientBalanceMinor: number | null;
}

function computeSummaryStats(balanceRows: BalanceRow[], recipientParticipantId: string | null): SummaryStats {
  const membersWithBalance = balanceRows.filter((row) => row.amountMinor !== 0).length;
  const totalOutstandingMinor = balanceRows
    .filter((row) => row.amountMinor < 0)
    .reduce((sum, row) => sum + Math.abs(row.amountMinor), 0);
  const recipientRow = recipientParticipantId
    ? balanceRows.find((row) => row.participantId === recipientParticipantId)
    : undefined;

  return {
    membersWithBalance,
    totalOutstandingMinor,
    recipientBalanceMinor: recipientRow?.amountMinor ?? null
  };
}

function sortBalanceRows(balanceRows: BalanceRow[]): BalanceRow[] {
  return [...balanceRows].sort((left, right) => {
    if (left.amountMinor === 0 && right.amountMinor !== 0) return 1;
    if (right.amountMinor === 0 && left.amountMinor !== 0) return -1;
    return Math.abs(right.amountMinor) - Math.abs(left.amountMinor);
  });
}

function balanceStatusLabel(amountMinor: number): string {
  if (amountMinor > 0) return 'Gets back';
  if (amountMinor < 0) return 'Owes';
  return 'Settled';
}

function statusBadgeHtml(amountMinor: number): string {
  if (amountMinor > 0) {
    return badge('Gets back', BRAND.tealSoft, BRAND.teal);
  }
  if (amountMinor < 0) {
    return badge('Owes', BRAND.purpleSoft, BRAND.purple);
  }
  return badge('Settled', BRAND.surfaceSoft, BRAND.muted);
}

function badge(label: string, bg: string, color: string): string {
  return `<span style="display:inline-block;padding:5px 10px;border-radius:999px;background:${bg};color:${color};font-size:11px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;">${escapeHtml(label)}</span>`;
}

function amountColor(amountMinor: number): string {
  if (amountMinor > 0) return BRAND.teal;
  if (amountMinor < 0) return BRAND.purple;
  return BRAND.muted;
}

function formatAmount(amountMinor: number, currencyCode: string): string {
  const value = Math.abs(amountMinor) / 100;
  const formatted = value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${currencyCode} ${formatted}`;
}

function formatSignedAmount(amountMinor: number, currencyCode: string): string {
  if (amountMinor === 0) {
    return `${currencyCode} 0.00`;
  }
  const sign = amountMinor > 0 ? '+' : '−';
  return `${sign} ${formatAmount(amountMinor, currencyCode)}`;
}

/** Month covered by the summary — previous calendar month in IST (cron runs on the 1st). */
export function monthLabelForSummary(referenceDate: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric'
  }).formatToParts(referenceDate);
  const year = Number(parts.find((part) => part.type === 'year')!.value);
  const month = Number(parts.find((part) => part.type === 'month')!.value);
  const previousMonth = new Date(Date.UTC(year, month - 2, 1));
  return previousMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
