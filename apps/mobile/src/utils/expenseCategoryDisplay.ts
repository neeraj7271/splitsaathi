import type { ComponentType } from "react";
import {
  Car,
  FilmSlate,
  ForkKnife,
  Lightning,
  Receipt,
  ShoppingBag,
  Storefront
} from "phosphor-react-native";

type CategoryIcon = ComponentType<{
  size?: number;
  color?: string;
  weight?: "duotone" | "bold" | "fill" | "regular";
}>;

export interface ExpenseCategoryDisplay {
  label: string;
  tint: string;
  Icon: CategoryIcon;
}

const CATEGORY_OPTIONS: Array<ExpenseCategoryDisplay & { match?: RegExp }> = [
  { label: "Groceries", tint: "#0D9488", Icon: ShoppingBag, match: /grocer/i },
  { label: "Food", tint: "#F97316", Icon: ForkKnife, match: /food|dining|restaurant/i },
  { label: "Transport", tint: "#3B82F6", Icon: Car, match: /transport|travel|cab|fuel|uber|ola/i },
  { label: "Utilities", tint: "#EAB308", Icon: Lightning, match: /util|electric|bill|rent|power/i },
  { label: "Entertainment", tint: "#EC4899", Icon: FilmSlate, match: /entertain|movie|game|cinema/i },
  { label: "Shopping", tint: "#8B5CF6", Icon: Storefront, match: /shop|store|mall/i }
];

const DEFAULT_CATEGORY: ExpenseCategoryDisplay = {
  label: "Expense",
  tint: "#64748B",
  Icon: Receipt
};

export function getExpenseCategoryDisplay(category?: string): ExpenseCategoryDisplay {
  const value = category?.trim();
  if (!value) {
    return DEFAULT_CATEGORY;
  }

  const exact = CATEGORY_OPTIONS.find((option) => option.label.toLowerCase() === value.toLowerCase());
  if (exact) {
    return exact;
  }

  const fuzzy = CATEGORY_OPTIONS.find((option) => option.match?.test(value));
  if (fuzzy) {
    return { ...fuzzy, label: value };
  }

  return { label: value, tint: DEFAULT_CATEGORY.tint, Icon: DEFAULT_CATEGORY.Icon };
}

export function formatExpenseListDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}
