export function formatMoney(amountMinor: number | undefined, currencyCode = "INR") {
  const safeAmount = amountMinor ?? 0;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safeAmount / 100);
}

export function formatSignedMoney(amountMinor: number | undefined, currencyCode = "INR") {
  const safeAmount = amountMinor ?? 0;
  const sign = safeAmount > 0 ? "+" : safeAmount < 0 ? "-" : "";

  return `${sign}${formatMoney(Math.abs(safeAmount), currencyCode)}`;
}

export function parseAmountToMinor(input: string) {
  const normalized = input.replace(/[^0-9.]/g, "");
  if (!normalized) {
    return 0;
  }

  const [rupees, paise = ""] = normalized.split(".");
  const paddedPaise = `${paise}00`.slice(0, 2);

  return Number.parseInt(rupees || "0", 10) * 100 + Number.parseInt(paddedPaise || "0", 10);
}

export function minorToDecimal(amountMinor: number) {
  return (amountMinor / 100).toFixed(2);
}
