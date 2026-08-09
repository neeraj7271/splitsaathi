import type { GroupSummary } from "../types/domain";

/** Active groups in selector order: unsettled first, then settled by recency. */
export function activeGroupsByOutstandingBalance(groups: GroupSummary[]): GroupSummary[] {
  return sortGroupsByOutstandingBalance(groups.filter((group) => group.state === "active"));
}

/** Unsettled groups first (highest absolute balance first), then settled groups by recency. */
export function sortGroupsByOutstandingBalance(groups: GroupSummary[]): GroupSummary[] {
  return [...groups].sort((a, b) => {
    const balA = Math.abs(a.netBalanceMinor ?? 0);
    const balB = Math.abs(b.netBalanceMinor ?? 0);
    const hasBalA = balA > 0 ? 1 : 0;
    const hasBalB = balB > 0 ? 1 : 0;

    if (hasBalA !== hasBalB) {
      return hasBalB - hasBalA;
    }
    if (hasBalA && hasBalB) {
      return balB - balA;
    }

    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return timeB - timeA;
  });
}
