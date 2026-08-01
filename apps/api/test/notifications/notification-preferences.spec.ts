import {
  preferenceAllowsPushType,
  resolvePushPreferences
} from '../../src/modules/notifications/notification-preferences';
import { UserPreferencesEntity } from '../../src/modules/users/entities/user-preferences.entity';

function prefs(overrides: Partial<UserPreferencesEntity> = {}): UserPreferencesEntity {
  return {
    userId: 'u1',
    biometricAuthEnabled: false,
    sessionTimeoutSeconds: 5,
    appearance: 'system',
    pushNotificationsEnabled: true,
    emailGroupAdded: true,
    emailFriendAdded: true,
    emailExpenseAdded: true,
    emailExpenseEdited: true,
    emailExpenseComment: false,
    emailExpenseDue: true,
    emailPaymentReceived: true,
    emailMonthlySummary: true,
    emailNewsUpdates: true,
    updatedAt: new Date(),
    ...overrides
  };
}

describe('notification-preferences', () => {
  it('uses product defaults when prefs row is missing', () => {
    expect(resolvePushPreferences(null)).toEqual(
      expect.objectContaining({ pushNotificationsEnabled: true, emailExpenseAdded: true })
    );
    expect(preferenceAllowsPushType(null, 'expense_created')).toBe(true);
  });

  it('blocks all push when master switch is off', () => {
    const disabled = prefs({ pushNotificationsEnabled: false });
    expect(preferenceAllowsPushType(disabled, 'expense_created')).toBe(false);
    expect(preferenceAllowsPushType(disabled, 'participant_added')).toBe(false);
  });

  const cases: Array<{
    pref: keyof UserPreferencesEntity;
    allowedType: string;
    blockedType?: string;
  }> = [
    { pref: 'emailGroupAdded', allowedType: 'participant_added', blockedType: 'contact_joined' },
    { pref: 'emailGroupAdded', allowedType: 'membership_removed', blockedType: 'expense_created' },
    { pref: 'emailGroupAdded', allowedType: 'invite_claimed' },
    { pref: 'emailFriendAdded', allowedType: 'contact_joined', blockedType: 'participant_added' },
    { pref: 'emailExpenseAdded', allowedType: 'expense_created', blockedType: 'expense_revised' },
    { pref: 'emailExpenseEdited', allowedType: 'expense_revised', blockedType: 'expense_created' },
    { pref: 'emailExpenseEdited', allowedType: 'expense_voided' },
    { pref: 'emailExpenseDue', allowedType: 'friend_payment_reminder', blockedType: 'expense_created' },
    { pref: 'emailExpenseDue', allowedType: 'reminder_settlement_day' },
    { pref: 'emailExpenseDue', allowedType: 'reminder_recurring_expense' },
    { pref: 'emailExpenseDue', allowedType: 'reminder_stale_proof' },
    { pref: 'emailPaymentReceived', allowedType: 'settlement_confirmation_requested' },
    { pref: 'emailPaymentReceived', allowedType: 'settlement_rejected' }
  ];

  it.each(cases)('respects $pref for $allowedType', ({ pref, allowedType, blockedType }) => {
    const enabled = prefs();
    expect(preferenceAllowsPushType(enabled, allowedType)).toBe(true);

    const disabled = prefs({ [pref]: false });
    expect(preferenceAllowsPushType(disabled, allowedType)).toBe(false);

    if (blockedType) {
      expect(preferenceAllowsPushType(disabled, blockedType)).toBe(true);
    }
  });

  it('blocks unknown notification types', () => {
    expect(preferenceAllowsPushType(prefs(), 'settlement_reminder')).toBe(false);
  });
});
