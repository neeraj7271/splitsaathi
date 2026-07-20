import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type ReportDateRange = { from: string; to: string; fromExclusive: string; toExclusive: string };

@Injectable()
export class ReportsService {
  constructor(@Optional() @InjectDataSource() private readonly dataSource?: DataSource) {}

  dateRange(from?: string, to?: string): ReportDateRange {
    const end = to ? this.parseDate(to, 'to') : new Date();
    const start = from ? this.parseDate(from, 'from') : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1));
    if (start > end) {
      throw new Error('"from" must not be after "to".');
    }
    const endExclusive = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1));
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      fromExclusive: start.toISOString(),
      toExclusive: endExclusive.toISOString()
    };
  }

  async groupTypeBreakdown(userId: string, range: ReportDateRange) {
    return this.query(
      `WITH latest_expenses AS (
         SELECT DISTINCT ON (event.aggregate_id)
           event.aggregate_id, event.group_id, event.event_type, event.payload
         FROM event_store event
         JOIN group_memberships membership ON membership.group_id = event.group_id
         WHERE membership.user_id = $1
           AND membership.status IN ('active', 'locked_for_exit')
           AND event.aggregate_type = 'expense'
           AND event.event_type IN ('ExpenseCreated', 'ExpenseAdjusted', 'ExpenseVoided')
         ORDER BY event.aggregate_id, event.version DESC
       )
       SELECT group_row.group_type AS "groupType",
              COALESCE(SUM((latest_expenses.payload->>'totalAmountMinor')::bigint), 0)::text AS "amountMinor",
              COUNT(*)::int AS "expenseCount"
       FROM latest_expenses
       JOIN groups group_row ON group_row.id = latest_expenses.group_id
       WHERE latest_expenses.event_type <> 'ExpenseVoided'
         AND (latest_expenses.payload->>'expenseDate')::date >= $2::date
         AND (latest_expenses.payload->>'expenseDate')::date < $3::date
       GROUP BY group_row.group_type
       ORDER BY 2 DESC`,
      [userId, range.from, range.toExclusive.slice(0, 10)]
    );
  }

  async monthlyComparison(groupId: string, range: ReportDateRange) {
    return this.query(
      `WITH latest_expenses AS (
         SELECT DISTINCT ON (event.aggregate_id) event.aggregate_id, event.event_type, event.payload
         FROM event_store event
         WHERE event.group_id = $1
           AND event.aggregate_type = 'expense'
           AND event.event_type IN ('ExpenseCreated', 'ExpenseAdjusted', 'ExpenseVoided')
         ORDER BY event.aggregate_id, event.version DESC
       )
       SELECT to_char(date_trunc('month', (payload->>'expenseDate')::date), 'YYYY-MM') AS month,
              COALESCE(SUM((payload->>'totalAmountMinor')::bigint), 0)::text AS "amountMinor",
              COUNT(*)::int AS "expenseCount"
       FROM latest_expenses
       WHERE event_type <> 'ExpenseVoided'
         AND (payload->>'expenseDate')::date >= $2::date
         AND (payload->>'expenseDate')::date < $3::date
       GROUP BY month
       ORDER BY month`,
      [groupId, range.from, range.toExclusive.slice(0, 10)]
    );
  }

  async memberContributions(groupId: string, range: ReportDateRange) {
    return this.query(
      `WITH latest_expenses AS (
         SELECT DISTINCT ON (event.aggregate_id) event.aggregate_id, event.event_type, event.payload
         FROM event_store event
         WHERE event.group_id = $1
           AND event.aggregate_type = 'expense'
           AND event.event_type IN ('ExpenseCreated', 'ExpenseAdjusted', 'ExpenseVoided')
         ORDER BY event.aggregate_id, event.version DESC
       )
       SELECT participant.id AS "participantId", participant.display_name AS "displayName",
              COALESCE(SUM((payer.value->>'amountMinor')::bigint), 0)::text AS "amountMinor"
       FROM latest_expenses
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(payload->'payers', '[]'::jsonb)) payer(value)
       JOIN participants participant ON participant.id = (payer.value->>'participantId')::uuid
       WHERE event_type <> 'ExpenseVoided'
         AND (payload->>'expenseDate')::date >= $2::date
         AND (payload->>'expenseDate')::date < $3::date
       GROUP BY participant.id, participant.display_name
       ORDER BY 3 DESC`,
      [groupId, range.from, range.toExclusive.slice(0, 10)]
    );
  }

  async settlementMethodBreakdown(groupId: string, range: ReportDateRange) {
    return this.query(
      `WITH intents AS (
         SELECT DISTINCT ON (event.aggregate_id) event.aggregate_id, event.group_id, event.payload, event.occurred_at
         FROM event_store event
         WHERE event.group_id = $1
           AND event.aggregate_type = 'settlement_intent'
           AND event.event_type = 'SettlementIntentCreated'
         ORDER BY event.aggregate_id, event.version ASC
       )
       SELECT COALESCE(payload->>'paymentMethod', 'upi') AS method,
              COALESCE(SUM((payload->>'amountMinor')::bigint), 0)::text AS "amountMinor",
              COUNT(*)::int AS count
       FROM intents
       WHERE occurred_at >= $2::timestamptz AND occurred_at < $3::timestamptz
       GROUP BY method
       ORDER BY 2 DESC`,
      [groupId, range.fromExclusive, range.toExclusive]
    );
  }

  async netPosition(groupId: string, range: ReportDateRange) {
    return this.query(
      `SELECT posting.participant_id AS "participantId", participant.display_name AS "displayName",
              posting.currency_code AS "currencyCode",
              COALESCE(SUM(posting.signed_amount_minor), 0)::text AS "amountMinor"
       FROM ledger_postings posting
       JOIN event_store event ON event.id = posting.event_id
       JOIN participants participant ON participant.id = posting.participant_id
       WHERE posting.group_id = $1
         AND event.occurred_at >= $2::timestamptz AND event.occurred_at < $3::timestamptz
       GROUP BY posting.participant_id, participant.display_name, posting.currency_code
       HAVING SUM(posting.signed_amount_minor) <> 0
       ORDER BY 4 DESC`,
      [groupId, range.fromExclusive, range.toExclusive]
    );
  }

  private async query(sql: string, values: unknown[]) {
    if (!this.dataSource) {
      throw new ServiceUnavailableException('Postgres-backed reporting is unavailable in this environment.');
    }
    return this.dataSource.query(sql, values);
  }

  private parseDate(value: string, field: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`"${field}" must use YYYY-MM-DD.`);
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new Error(`"${field}" must be a valid date.`);
    }
    return parsed;
  }
}
