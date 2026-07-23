export type AppRoute =
  | "home"
  | "groups"
  | "groupDetail"
  | "friends"
  | "friendDetail"
  | "expense"
  | "balances"
  | "settlement"
  | "audit"
  | "recurring"
  | "importExport"
  | "offline"
  | "profile"
  | "settings"
  | "securitySettings"
  | "notificationSettings"
  | "appearanceSettings"
  | "contactsSettings";

export interface AppNavigation {
  route: AppRoute;
  selectedGroupId?: string;
  selectedExpenseId?: string;
  selectedFriendUserId?: string;
  canGoBack: boolean;
  setSelectedGroupId: (groupId?: string) => void;
  setSelectedExpenseId: (expenseId?: string) => void;
  setSelectedFriendUserId: (userId?: string) => void;
  go: (route: AppRoute) => void;
  back: () => boolean;
  signOut: () => void;
}
