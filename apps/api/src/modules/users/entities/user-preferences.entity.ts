import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type UserAppearancePreference = 'system' | 'light' | 'dark';

@Entity({ name: 'user_preferences' })
export class UserPreferencesEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'biometric_auth_enabled', type: 'boolean', default: false })
  biometricAuthEnabled!: boolean;

  @Column({ name: 'session_timeout_seconds', type: 'integer', default: 5 })
  sessionTimeoutSeconds!: number;

  @Column({ type: 'varchar', length: 16, default: 'system' })
  appearance!: UserAppearancePreference;

  @Column({ name: 'push_notifications_enabled', type: 'boolean', default: true })
  pushNotificationsEnabled!: boolean;

  @Column({ name: 'email_group_added', type: 'boolean', default: true })
  emailGroupAdded!: boolean;

  @Column({ name: 'email_friend_added', type: 'boolean', default: true })
  emailFriendAdded!: boolean;

  @Column({ name: 'email_expense_added', type: 'boolean', default: false })
  emailExpenseAdded!: boolean;

  @Column({ name: 'email_expense_edited', type: 'boolean', default: false })
  emailExpenseEdited!: boolean;

  @Column({ name: 'email_expense_comment', type: 'boolean', default: false })
  emailExpenseComment!: boolean;

  @Column({ name: 'email_expense_due', type: 'boolean', default: true })
  emailExpenseDue!: boolean;

  @Column({ name: 'email_payment_received', type: 'boolean', default: true })
  emailPaymentReceived!: boolean;

  @Column({ name: 'email_monthly_summary', type: 'boolean', default: true })
  emailMonthlySummary!: boolean;

  @Column({ name: 'email_news_updates', type: 'boolean', default: true })
  emailNewsUpdates!: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
