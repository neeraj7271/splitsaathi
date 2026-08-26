import type { FriendSummary } from "../types/domain";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRegisteredFriendUser(otherUserId: string) {
  if (otherUserId.startsWith("phone:") || otherUserId.startsWith("name:")) {
    return false;
  }
  return UUID_PATTERN.test(otherUserId);
}

export function friendRemindBlockedMessage(friend: Pick<FriendSummary, "displayName">) {
  return `${friend.displayName} has not joined SplitSaathi yet. They were added to your group by phone number only, so push reminders cannot be delivered. Invite them to download the app and create an account.`;
}
