import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import type { JsonObject, RecurringFrequency, RecurringOccurrenceState, RecurringScheduleState } from './types';

@Entity({ name: 'recurring_expense_schedules' })
@Index('idx_recurring_expense_schedules_group_state_next', ['groupId', 'state', 'nextRunAt'])
export class RecurringExpenseScheduleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ type: 'text' })
  state!: RecurringScheduleState;

  @Column({ type: 'jsonb' })
  template!: JsonObject;

  @Column({ type: 'text' })
  frequency!: RecurringFrequency;

  @Column({ type: 'text', nullable: true })
  rrule!: string | null;

  @Column({ name: 'next_run_at', type: 'timestamptz' })
  nextRunAt!: Date;

  @Column({ name: 'reminder_days_before', type: 'integer', default: 2 })
  reminderDaysBefore!: number;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'recurring_occurrences' })
@Index('uq_recurring_occurrences_schedule_date', ['scheduleId', 'scheduledFor'], { unique: true })
export class RecurringOccurrenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'schedule_id', type: 'uuid' })
  scheduleId!: string;

  @Column({ name: 'expense_id', type: 'uuid', nullable: true })
  expenseId!: string | null;

  @Column({ name: 'scheduled_for', type: 'date' })
  scheduledFor!: string;

  @Column({ type: 'text' })
  state!: RecurringOccurrenceState;
}

@Entity({ name: 'currencies' })
export class CurrencyEntity {
  @PrimaryColumn({ type: 'char', length: 3 })
  code!: string;

  @Column({ name: 'minor_unit', type: 'integer' })
  minorUnit!: number;

  @Column({ type: 'text' })
  symbol!: string;

  @Column({ name: 'display_locale', type: 'text' })
  displayLocale!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;
}

@Entity({ name: 'fx_rate_snapshots' })
@Index('uq_fx_rate_snapshots_pair_provider_as_of', ['baseCurrencyCode', 'quoteCurrencyCode', 'provider', 'asOf'], {
  unique: true
})
export class FxRateSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'base_currency_code', type: 'char', length: 3 })
  baseCurrencyCode!: string;

  @Column({ name: 'quote_currency_code', type: 'char', length: 3 })
  quoteCurrencyCode!: string;

  @Column({ name: 'rate_numerator', type: 'bigint' })
  rateNumerator!: string;

  @Column({ name: 'rate_denominator', type: 'bigint' })
  rateDenominator!: string;

  @Column({ type: 'text' })
  provider!: string;

  @Column({ name: 'as_of', type: 'timestamptz' })
  asOf!: Date;

  @Column({ name: 'source_metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  sourceMetadata!: JsonObject;
}
