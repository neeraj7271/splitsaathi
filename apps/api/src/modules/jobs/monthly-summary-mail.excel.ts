import type { SettlementSuggestion } from '@splitsaathi/domain';
import {
  balanceStatusLabel,
  formatAmount,
  formatSignedAmount,
  monthLabelForSummary,
  sortBalanceRows,
  type GroupSummarySlice
} from './monthly-summary-mail.template';

export interface MonthlySummaryExcelAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

/** Excel 2003 XML (.xls) — opens in Excel/Sheets without extra npm deps. */
export function buildMonthlySummaryExcel(slices: GroupSummarySlice[]): MonthlySummaryExcelAttachment {
  const monthSlug = monthLabelForSummary().toLowerCase().replace(/\s+/g, '-');
  const worksheets = [
    renderOverviewSheet(slices),
    renderBalancesSheet(slices),
    renderSettlementsSheet(slices)
  ].join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${worksheets}
</Workbook>`;

  return {
    filename: `splitsaathi-monthly-summary-${monthSlug}.xls`,
    content: Buffer.from(xml, 'utf8'),
    contentType: 'application/vnd.ms-excel'
  };
}

function renderOverviewSheet(slices: GroupSummarySlice[]): string {
  const rows = slices
    .map((slice) => {
      const recipientId = slice.recipient?.participantId ?? null;
      const recipientRow = recipientId
        ? slice.balanceRows.find((row) => row.participantId === recipientId)
        : undefined;
      const outstanding = slice.balanceRows
        .filter((row) => row.amountMinor < 0)
        .reduce((sum, row) => sum + Math.abs(row.amountMinor), 0);
      const openCount = slice.balanceRows.filter((row) => row.amountMinor !== 0).length;
      const yourBalance =
        recipientRow && recipientRow.amountMinor !== 0
          ? formatSignedAmount(recipientRow.amountMinor, slice.group.baseCurrencyCode)
          : 'Settled';

      return tableRow([
        slice.group.name,
        slice.group.baseCurrencyCode,
        yourBalance,
        String(openCount),
        formatAmount(outstanding, slice.group.baseCurrencyCode)
      ]);
    })
    .join('');

  return worksheet(
    'Overview',
    tableRow(['Group', 'Currency', 'Your balance', 'Open balances', 'Outstanding']) + rows
  );
}

function renderBalancesSheet(slices: GroupSummarySlice[]): string {
  const rows = slices
    .flatMap((slice) =>
      sortBalanceRows(slice.balanceRows).map((row) => {
        const name = slice.nameByParticipantId.get(row.participantId) ?? row.participantId;
        const isYou = row.participantId === slice.recipient?.participantId;
        return tableRow([
          slice.group.name,
          isYou ? `${name} (You)` : name,
          balanceStatusLabel(row.amountMinor),
          formatSignedAmount(row.amountMinor, row.currencyCode)
        ]);
      })
    )
    .join('');

  return worksheet('Balances', tableRow(['Group', 'Member', 'Status', 'Net balance']) + rows);
}

function renderSettlementsSheet(slices: GroupSummarySlice[]): string {
  const rows = slices
    .flatMap((slice) => {
      if (slice.settlements.length === 0) {
        return tableRow([slice.group.name, '—', '—', 'Everyone is settled up']);
      }

      return slice.settlements.map((row: SettlementSuggestion) => {
        const payer = slice.nameByParticipantId.get(row.payerParticipantId) ?? row.payerParticipantId;
        const payee = slice.nameByParticipantId.get(row.payeeParticipantId) ?? row.payeeParticipantId;
        return tableRow([
          slice.group.name,
          payer,
          payee,
          formatAmount(row.amountMinor, row.currencyCode)
        ]);
      });
    })
    .join('');

  return worksheet('Settlements', tableRow(['Group', 'Pays', 'Receives', 'Amount']) + rows);
}

function worksheet(name: string, tableRows: string): string {
  return `<Worksheet ss:Name="${escapeXml(name)}">
  <Table>
${tableRows}
  </Table>
</Worksheet>`;
}

function tableRow(cells: string[]): string {
  return `    <Row>
${cells.map((cell) => `      <Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join('\n')}
    </Row>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
