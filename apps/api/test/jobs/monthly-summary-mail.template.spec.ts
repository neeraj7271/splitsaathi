import { GreedySettlementOptimizer } from '@splitsaathi/domain';
import {
  formatMonthlySummaryHtml,
  formatMonthlySummaryText,
  monthLabelForSummary,
  monthlySummarySubject
} from '../../src/modules/jobs/monthly-summary-mail.template';

const sampleGroup = {
  name: 'Flatmates',
  baseCurrencyCode: 'INR'
};

const sampleBalances = [
  { groupId: 'test-group', participantId: 'p1', currencyCode: 'INR', amountMinor: 125_000 },
  { groupId: 'test-group', participantId: 'p2', currencyCode: 'INR', amountMinor: -75_000 },
  { groupId: 'test-group', participantId: 'p3', currencyCode: 'INR', amountMinor: -50_000 },
  { groupId: 'test-group', participantId: 'p4', currencyCode: 'INR', amountMinor: 0 }
];

const sampleNames = new Map([
  ['p1', 'Neeraj'],
  ['p2', 'Alice'],
  ['p3', 'Bob'],
  ['p4', 'Charlie']
]);

describe('monthly-summary-mail.template', () => {
  const settlements = new GreedySettlementOptimizer().suggest(sampleBalances);

  it('builds a branded subject line', () => {
    expect(monthlySummarySubject('Flatmates')).toMatch(/^SplitSaathi monthly summary — Flatmates \(.+\)$/);
  });

  it('labels the previous calendar month in IST (cron runs on the 1st)', () => {
    expect(monthLabelForSummary(new Date('2026-08-01T02:30:00.000Z'))).toBe('July 2026');
    expect(monthLabelForSummary(new Date('2026-01-01T02:30:00.000Z'))).toBe('December 2025');
    expect(monthlySummarySubject('Flatmates', new Date('2026-08-01T02:30:00.000Z'))).toBe(
      'SplitSaathi monthly summary — Flatmates (July 2026)'
    );
  });

  it('renders detailed plain-text tables and settlement rows', () => {
    const text = formatMonthlySummaryText(
      sampleGroup,
      sampleBalances,
      sampleNames,
      settlements,
      { displayName: 'Neeraj', participantId: 'p1' }
    );

    expect(text).toContain('GROUP BALANCES');
    expect(text).toContain('SUGGESTED SETTLEMENTS');
    expect(text).toContain('Neeraj');
    expect(text).toContain('Alice');
    expect(text).toContain('Your balance:');
  });

  it('renders consolidated HTML with balance and settlement tables', () => {
    const html = formatMonthlySummaryHtml(
      sampleGroup,
      sampleBalances,
      sampleNames,
      settlements,
      { displayName: 'Neeraj', participantId: 'p1' }
    );

    expect(html).toContain('radial-gradient(circle at 50% 35%,#14151B 0%,#0A0A0D 72%)');
    expect(html).not.toContain('<img');
    expect(html).toContain('fonts.googleapis.com');
    expect(html).toContain('Space+Grotesk');
    expect(html).toContain('color:#1AA88A');
    expect(html).toContain('color:#5B4FCF');
    expect(html).not.toContain('JetBrains+Mono');
    expect(html).toContain('Overview');
    expect(html).toContain('Group balances');
    expect(html).toContain('Suggested settlements');
    expect(html).toContain('Gets back');
    expect(html).toContain('Owes');
    expect(html).toContain('You are owed');
    expect(html).toContain('Involves you');
    expect(html).toContain('Neeraj');
    expect(html).toContain('Alice');
    expect(html).toContain('→');
  });
});
