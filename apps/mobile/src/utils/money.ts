export function formatMoney(amountMinor: number | undefined, currencyCode = "INR") {
  const safeAmount = (typeof amountMinor === "number" && Number.isFinite(amountMinor)) ? amountMinor : 0;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safeAmount / 100);
}

export function formatSignedMoney(amountMinor: number | undefined, currencyCode = "INR") {
  const safeAmount = (typeof amountMinor === "number" && Number.isFinite(amountMinor)) ? amountMinor : 0;
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

const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen"
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function underThousand(value: number): string {
  if (value === 0) {
    return "";
  }
  if (value < 20) {
    return ONES[value];
  }
  if (value < 100) {
    const ten = Math.floor(value / 10);
    const one = value % 10;
    return one ? `${TENS[ten]} ${ONES[one]}` : TENS[ten];
  }
  const hundred = Math.floor(value / 100);
  const rest = value % 100;
  return rest ? `${ONES[hundred]} hundred ${underThousand(rest)}` : `${ONES[hundred]} hundred`;
}

/** Speaks rupees only (paise ignored), e.g. 76000 minor → "Seven hundred sixty rupees." */
export function amountToRupeeWords(amountMinor: number | undefined): string {
  const rupees = Math.floor(Math.abs(amountMinor ?? 0) / 100);
  if (rupees === 0) {
    return "Zero rupees.";
  }
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rem = rupees % 1000;
  const parts: string[] = [];
  if (crore) {
    parts.push(`${underThousand(crore)} crore`);
  }
  if (lakh) {
    parts.push(`${underThousand(lakh)} lakh`);
  }
  if (thousand) {
    parts.push(`${underThousand(thousand)} thousand`);
  }
  if (rem) {
    parts.push(underThousand(rem));
  }
  const body = parts.join(" ").replace(/\s+/g, " ").trim();
  return `${body.charAt(0).toUpperCase()}${body.slice(1)} rupees.`;
}
