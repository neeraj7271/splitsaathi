export type AppRoute =
  | "home"
  | "groups"
  | "groupDetail"
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
  setSelectedGroupId: (groupId?: string) => void;
  setSelectedExpenseId: (expenseId?: string) => void;
  go: (route: AppRoute) => void;
  signOut: () => void;
}
