import { GroupDetail, Membership, Participant } from "../types/domain";

const ACTIVE_MEMBERSHIP_STATUSES = new Set(["active", "locked_for_exit"]);

export function activeGroupMemberships(group: Pick<GroupDetail, "participants" | "memberships">): Membership[] {
  const participantById = new Map(group.participants.map((participant) => [participant.id, participant]));
  const linkedPhones = new Set(
    group.participants
      .filter((participant) => participant.linkedUserId && participant.phoneE164)
      .map((participant) => participant.phoneE164 as string)
  );
  const linkedNames = new Set(
    group.participants
      .filter((participant) => participant.linkedUserId)
      .map((participant) => participant.displayName.trim().toLowerCase())
  );

  return group.memberships.filter((membership) => {
    if (!ACTIVE_MEMBERSHIP_STATUSES.has(membership.status)) {
      return false;
    }
    if (!membership.participantId) {
      return false;
    }
    const participant = participantById.get(membership.participantId);
    if (!participant?.displayName?.trim()) {
      return false;
    }
    // Hide superseded guest shells after someone claimed/joined as a linked user.
    if (!participant.linkedUserId && !membership.userId) {
      if (participant.phoneE164 && linkedPhones.has(participant.phoneE164)) {
        return false;
      }
      if (linkedNames.has(participant.displayName.trim().toLowerCase())) {
        return false;
      }
    }
    return true;
  });
}

export function activeGroupParticipants(group: Pick<GroupDetail, "participants" | "memberships">): Participant[] {
  const activeIds = new Set(
    activeGroupMemberships(group)
      .map((membership) => membership.participantId)
      .filter((id): id is string => Boolean(id))
  );
  return group.participants.filter((participant) => activeIds.has(participant.id));
}
