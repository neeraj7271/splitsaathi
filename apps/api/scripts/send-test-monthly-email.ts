import { resolve } from 'node:path';
import { BrevoClient } from '@getbrevo/brevo';
import { GreedySettlementOptimizer } from '@splitsaathi/domain';
import { loadEnvFile } from '../src/config/load-env-file';
import { resolveBrevoSender } from '../src/modules/auth/providers/email-sender.util';
import {
  formatMonthlySummaryHtml,
  formatMonthlySummaryText,
  formatMonthlySummaryTextInbox,
  monthlySummarySubject
} from '../src/modules/jobs/monthly-summary-mail.template';

const sampleGroup = {
  id: 'test-group',
  name: 'Flatmates',
  baseCurrencyCode: 'INR',
  state: 'active' as const
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

async function main() {
  loadEnvFile(resolve(__dirname, '../.env'));
  const to = process.argv[2]?.trim() || 'neerajsuman766@gmail.com';
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is missing. Add it to apps/api/.env first.');
  }

  const sender = resolveBrevoSender({
    BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL,
    BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME,
    EMAIL_FROM: process.env.EMAIL_FROM
  });
  if (!sender.email) {
    throw new Error('Brevo sender email is missing. Set BREVO_SENDER_EMAIL in apps/api/.env.');
  }

  const settlements = new GreedySettlementOptimizer().suggest(sampleBalances);
  const recipient = { displayName: 'Neeraj', participantId: 'p1' };
  const subject = monthlySummarySubject(sampleGroup.name);
  const text = formatMonthlySummaryTextInbox(sampleGroup, sampleBalances, recipient);
  const html = formatMonthlySummaryHtml(
    sampleGroup,
    sampleBalances,
    sampleNames,
    settlements,
    recipient
  );

  const brevo = new BrevoClient({ apiKey });
  await brevo.transactionalEmails.sendTransacEmail({
    sender,
    to: [{ email: to, name: 'Neeraj' }],
    subject,
    textContent: text,
    htmlContent: html
  });

  console.log(`Test monthly summary email sent to ${to} from ${sender.email}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
