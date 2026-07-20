import { ActivityRowDto, AuditEntry, BalanceRow, GroupDetail, Participant, SettlementSuggestion } from "../types/domain";
import { formatMoney } from "./money";

export type GroupDisplayLookups = {
  participantById: Map<string, Participant>;
  userIdToDisplayName: Map<string, string>;
};

export function buildGroupDisplayLookups(group: Pick<GroupDetail, "participants" | "memberships">): GroupDisplayLookups {
  const participantById = new Map(group.participants.map((participant) => [participant.id, participant]));
  const userIdToDisplayName = new Map<string, string>();

  for (const participant of group.participants) {
    if (participant.linkedUserId) {
      userIdToDisplayName.set(participant.linkedUserId, participant.displayName);
    }
  }

  for (const membership of group.memberships) {
    if (!membership.userId) {
      continue;
    }
    const participant = membership.participantId ? participantById.get(membership.participantId) : undefined;
    if (participant) {
      userIdToDisplayName.set(membership.userId, participant.displayName);
    }
  }

  return { participantById, userIdToDisplayName };
}

export function resolveParticipantDisplayName(participantId: string | undefined, lookups: GroupDisplayLookups): string | undefined {
  if (!participantId) {
    return undefined;
  }
  return lookups.participantById.get(participantId)?.displayName;
}

export function resolveActorDisplayName(actorId: string | undefined, lookups: GroupDisplayLookups): string | undefined {
  if (!actorId) {
    return undefined;
  }
  if (actorId === "system") {
    return "System";
  }
  if (actorId.startsWith("payment-gateway:")) {
    return "Payment gateway";
  }

  const byUser = lookups.userIdToDisplayName.get(actorId);
  if (byUser) {
    return byUser;
  }

  const byParticipant = lookups.participantById.get(actorId);
  if (byParticipant) {
    return byParticipant.displayName;
  }

  return undefined;
}

export function humanizeEventType(eventType: string): string {
  const spaced = eventType
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
  if (!spaced) {
    return "Update";
  }
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function formatActivityTitle(title: string): string {
  const colonIndex = title.indexOf(": ");
  if (colonIndex === -1) {
    return humanizeEventType(title);
  }

  const eventPart = title.slice(0, colonIndex);
  const detailPart = title.slice(colonIndex + 2);
  const looksLikeId = /^[0-9a-f-]{20,}$/i.test(detailPart) || /^[a-z]+-[a-z0-9-]+$/i.test(detailPart);
  if (looksLikeId) {
    return humanizeEventType(eventPart);
  }
  return detailPart;
}

export function formatSettlementHistoryLabel(
  intent: { payerParticipantId: string; payeeParticipantId: string; clientReference?: string },
  lookups: GroupDisplayLookups
): string {
  const payer = resolveParticipantDisplayName(intent.payerParticipantId, lookups);
  const payee = resolveParticipantDisplayName(intent.payeeParticipantId, lookups);
  if (payer && payee) {
    return `${payer} → ${payee}`;
  }
  return intent.clientReference ?? "Settlement";
}

export function enrichAuditEntries(entries: AuditEntry[], lookups: GroupDisplayLookups): AuditEntry[] {
  return entries.map((entry) => ({
    ...entry,
    actorName: entry.actorId ? resolveActorDisplayName(entry.actorId, lookups) ?? entry.actorName : entry.actorName,
    summary: entry.summary ? humanizeEventType(entry.summary) : entry.summary,
    reason: entry.reason ? replaceParticipantIds(entry.reason, lookups) : entry.reason,
    changes: entry.changes?.map((change) => ({
      ...change,
      detail: replaceParticipantIds(change.detail, lookups)
    }))
  }));
}

export function enrichBalanceRows(balances: BalanceRow[], lookups: GroupDisplayLookups): BalanceRow[] {
  return balances.map((row) => ({
    ...row,
    displayName: resolveParticipantDisplayName(row.participantId, lookups) ?? row.displayName ?? "Unknown participant"
  }));
}

function participantLabel(participantId: string | undefined, lookups: GroupDisplayLookups, fallback = "someone"): string {
  return resolveParticipantDisplayName(participantId, lookups) ?? fallback;
}

export function participantList(ids: string[], lookups: GroupDisplayLookups): string {
  const names = ids.map((id) => participantLabel(id, lookups)).filter(Boolean);
  if (!names.length) {
    return "participants";
  }
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function replaceParticipantIds(text: string, lookups: GroupDisplayLookups): string {
  let next = text;
  for (const [participantId, participant] of lookups.participantById) {
    next = next.split(participantId).join(participant.displayName);
  }
  return next;
}

function activityAmount(amountMinor?: number, currencyCode?: string): string {
  return typeof amountMinor === "number" ? formatMoney(amountMinor, currencyCode) : "";
}

export function enrichActivityRows(
  rows: ActivityRowDto[],
  lookups: GroupDisplayLookups,
  groupName?: string
): ActivityRowDto[] {
  return rows.map((row) => {
    const context = row.context ?? {};
    const actor = resolveActorDisplayName(row.actorId, lookups);
    const description = typeof context.description === "string" ? context.description : row.title.replace(/ (added|updated|voided)$/i, "");
    const payerIds = Array.isArray(context.payerParticipantIds)
      ? context.payerParticipantIds.filter((id): id is string => typeof id === "string")
      : typeof context.payerParticipantId === "string"
        ? [context.payerParticipantId]
        : [];
    const shareIds = Array.isArray(context.shareParticipantIds)
      ? context.shareParticipantIds.filter((id): id is string => typeof id === "string")
      : [];
    const payerId = payerIds[0] ?? (typeof context.payerParticipantId === "string" ? context.payerParticipantId : undefined);
    const payeeId = typeof context.payeeParticipantId === "string" ? context.payeeParticipantId : undefined;
    const payer = participantLabel(payerId, lookups);
    const payee = participantLabel(payeeId, lookups);
    const amount = activityAmount(row.amountMinor, row.currencyCode);
    const groupSuffix = groupName ? ` in ${groupName}` : "";
    const splitTypes = Array.isArray(context.splitTypes) ? context.splitTypes.filter((type): type is string => typeof type === "string") : [];
    const splitLabel = splitTypes.length === 1 && splitTypes[0] === "equal" ? "equally" : splitTypes.length ? `via ${splitTypes.join("/")} split` : "between participants";
    const reason = typeof context.reason === "string" ? context.reason : undefined;
    const paymentMethod = typeof context.paymentMethod === "string" ? context.paymentMethod : undefined;

    let title = row.title;
    let body = row.body ?? "";

    switch (row.activityType) {
      case "ExpenseCreated":
        title = `${description} added`;
        body = `${actor ?? payer} added ${amount} for "${description}"${groupSuffix}, split ${splitLabel} between ${participantList(shareIds.length ? shareIds : payerIds, lookups)}.`;
        break;
      case "ExpenseAdjusted":
        title = `${description} updated`;
        body = `${actor ?? payer} edited "${description}"${reason ? ` — ${reason}` : ""}${amount ? ` (${amount})` : ""}.`;
        break;
      case "ExpenseVoided":
        title = `${description} voided`;
        body = `${actor ?? payer} voided "${description}"${reason ? ` — ${reason}` : ""}.`;
        break;
      case "CashSettlementRecorded":
        title = "Cash payment recorded";
        body = `${payer} marked ${amount} as paid in cash to ${payee}${groupSuffix}.`;
        break;
      case "SettlementLedgerPosted":
        title = paymentMethod === "cash" ? "Cash payment posted" : paymentMethod === "upi" ? "UPI payment posted" : "Settlement posted";
        body =
          paymentMethod === "cash"
            ? `${payer} marked ${amount} as paid in cash to ${payee}${groupSuffix}.`
            : paymentMethod === "upi"
              ? `${payer} paid ${amount} to ${payee} via UPI${groupSuffix}.`
              : `${payer} settled ${amount} with ${payee}${groupSuffix}.`;
        break;
      case "UpiIntentGenerated":
        title = "UPI payment ready";
        body = `${payer} initiated a UPI payment of ${amount} to ${payee}${groupSuffix}.`;
        break;
      case "SettlementIntentCreated":
        title = "Settlement requested";
        body = `${payer} requested to pay ${amount} to ${payee}${paymentMethod ? ` via ${paymentMethod.toUpperCase()}` : ""}${groupSuffix}.`;
        break;
      default:
        title = replaceParticipantIds(title, lookups);
        body = replaceParticipantIds(body, lookups);
        break;
    }

    return { ...row, title, body };
  });
}

export function enrichSettlementSuggestions(suggestions: SettlementSuggestion[], lookups: GroupDisplayLookups): SettlementSuggestion[] {
  return suggestions.map((suggestion) => {
    const payerName = resolveParticipantDisplayName(suggestion.payerParticipantId, lookups) ?? suggestion.payerName ?? "Unknown payer";
    const payeeName = resolveParticipantDisplayName(suggestion.payeeParticipantId, lookups) ?? suggestion.payeeName ?? "Unknown payee";
    const explanation = suggestion.explanation
      .split(suggestion.payerParticipantId)
      .join(payerName)
      .split(suggestion.payeeParticipantId)
      .join(payeeName)
      .replace(/because one owes the group and the other is owed\.?/gi, "to settle shared group expenses.");

    return {
      ...suggestion,
      payerName,
      payeeName,
      explanation
    };
  });
}
