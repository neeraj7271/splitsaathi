import { GreedySettlementOptimizer } from '@splitsaathi/domain';
import { buildMonthlySummaryExcel } from '../../src/modules/jobs/monthly-summary-mail.excel';
import {
  consolidatedMonthlySummarySubject,
  formatConsolidatedMonthlySummaryHtml,
  formatConsolidatedMonthlySummaryTextInbox,
  type GroupSummarySlice
} from '../../src/modules/jobs/monthly-summary-mail.template';

const sampleBalances = [
  { groupId: 'g1', participantId: 'p1', currencyCode: 'INR', amountMinor: 125_000 },
  { groupId: 'g1', participantId: 'p2', currencyCode: 'INR', amountMinor: -125_000 }
];

describe('monthly-summary-mail consolidated', () => {
  const settlements = new GreedySettlementOptimizer().suggest(sampleBalances);
  const slices: GroupSummarySlice[] = [
    {
      group: { id: 'g1', name: 'Flatmates', baseCurrencyCode: 'INR' },
      balanceRows: sampleBalances,
      settlements,
      nameByParticipantId: new Map([
        ['p1', 'Neeraj'],
        ['p2', 'Alice']
      ]),
      recipient: { displayName: 'Neeraj', participantId: 'p1' }
    },
    {
      group: { id: 'g2', name: 'Office', baseCurrencyCode: 'INR' },
      balanceRows: [],
      settlements: [],
      nameByParticipantId: new Map(),
      recipient: { displayName: 'Neeraj', participantId: 'p9' }
    }
  ];

  it('builds a consolidated subject for multiple groups', () => {
    expect(consolidatedMonthlySummarySubject(2)).toMatch(/2 groups/);
  });

  it('mentions excel attachment in consolidated plain text', () => {
    const text = formatConsolidatedMonthlySummaryTextInbox(slices);
    expect(text).toContain('2 groups');
    expect(text).toContain('Flatmates');
    expect(text).toContain('attached Excel');
  });

  it('renders consolidated HTML with both group sections', () => {
    const html = formatConsolidatedMonthlySummaryHtml(slices);
    expect(html).toContain('Flatmates');
    expect(html).toContain('Office');
    expect(html).toContain('Excel workbook is attached');
  });

  it('builds an excel workbook for multiple groups', () => {
    const file = buildMonthlySummaryExcel(slices);
    expect(file.filename).toMatch(/\.xls$/);
    expect(file.content.toString('utf8')).toContain('<Worksheet ss:Name="Overview">');
    expect(file.content.toString('utf8')).toContain('Flatmates');
    expect(file.content.toString('utf8')).toContain('Office');
  });
});
