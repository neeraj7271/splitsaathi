import type { QueryClient } from "@tanstack/react-query";

/** Invalidate ledger/settle caches when a push arrives so Settle/Home amounts refresh. */
export function invalidateQueriesForPush(
  queryClient: QueryClient,
  data: Record<string, unknown> | undefined
) {
  const type = typeof data?.type === "string" ? data.type : undefined;
  const groupId = typeof data?.groupId === "string" ? data.groupId : undefined;

  void queryClient.invalidateQueries({ queryKey: ["groups"] });
  void queryClient.invalidateQueries({ queryKey: ["settlementSuggestions"] });
  void queryClient.invalidateQueries({ queryKey: ["settlementHistory"] });
  void queryClient.invalidateQueries({ queryKey: ["balances"] });
  void queryClient.invalidateQueries({ queryKey: ["friends"] });

  if (groupId) {
    void queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    void queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
    void queryClient.invalidateQueries({ queryKey: ["settlementSuggestions", groupId] });
    void queryClient.invalidateQueries({ queryKey: ["settlementHistory", groupId] });
    void queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
    void queryClient.invalidateQueries({ queryKey: ["groupActivity", groupId] });
  }

  if (
    type === "participant_added" ||
    type === "invite_claimed" ||
    type === "contact_joined" ||
    type === "membership_removed"
  ) {
    void queryClient.invalidateQueries({ queryKey: ["groups"] });
    void queryClient.invalidateQueries({ queryKey: ["contacts"] });
  }
}
