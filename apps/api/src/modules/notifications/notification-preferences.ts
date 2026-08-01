import { UserPreferencesEntity } from '../users/entities/user-preferences.entity';

/** DB / product defaults when no `user_preferences` row exists yet. */
export const DEFAULT_PUSH_PREFERENCES: Pick<
  UserPreferencesEntity,
  | 'pushNotificationsEnabled'
  | 'emailGroupAdded'
  | 'emailFriendAdded'
  | 'emailExpenseAdded'
  | 'emailExpenseEdited'
  | 'emailExpenseDue'
  | 'emailPaymentReceived'
> = {
  pushNotificationsEnabled: true,
  emailGroupAdded: true,
  emailFriendAdded: true,
  emailExpenseAdded: true,
  emailExpenseEdited: true,
  emailExpenseDue: true,
  emailPaymentReceived: true
};

export function resolvePushPreferences(
  prefs: UserPreferencesEntity | null | undefined
): Pick<
  UserPreferencesEntity,
  keyof typeof DEFAULT_PUSH_PREFERENCES
> {
  return { ...DEFAULT_PUSH_PREFERENCES, ...prefs };
}

function categoryEnabled(
  prefs: Pick<UserPreferencesEntity, keyof typeof DEFAULT_PUSH_PREFERENCES>,
  key: keyof typeof DEFAULT_PUSH_PREFERENCES
): boolean {
  return prefs[key] !== false;
}

/**
 * Returns whether a push notification of `type` should be delivered for the user's prefs.
 * In-app notification rows may still be created; this only gates push delivery.
 */
export function preferenceAllowsPushType(
  prefs: UserPreferencesEntity | null | undefined,
  type: string
): boolean {
  const effective = resolvePushPreferences(prefs);
  if (!categoryEnabled(effective, 'pushNotificationsEnabled')) {
    return false;
  }

  switch (type) {
    case 'expense_created':
      return categoryEnabled(effective, 'emailExpenseAdded');
    case 'expense_revised':
    case 'expense_voided':
      return categoryEnabled(effective, 'emailExpenseEdited');
    case 'settlement_confirmation_requested':
    case 'settlement_awaiting_confirmation':
    case 'settlement_confirmed':
    case 'settlement_received_confirmed':
    case 'settlement_rejected':
    case 'settlement_disputed':
      return categoryEnabled(effective, 'emailPaymentReceived');
    case 'participant_added':
    case 'membership_removed':
    case 'invite_claimed':
    case 'group_archived':
    case 'group_unarchived':
    case 'membership_role_changed':
    case 'membership_exit_locked':
    case 'membership_exit_unlocked':
      return categoryEnabled(effective, 'emailGroupAdded');
    case 'contact_joined':
      return categoryEnabled(effective, 'emailFriendAdded');
    case 'friend_payment_reminder':
    case 'reminder_settlement_day':
    case 'reminder_recurring_expense':
    case 'reminder_stale_proof':
      return categoryEnabled(effective, 'emailExpenseDue');
    default:
      return false;
  }
}
