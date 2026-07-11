import { formatMoney, formatSignedMoney, minorToDecimal, parseAmountToMinor } from "../src/utils/money";

describe("money utilities", () => {
  it("parses decimal input to integer minor units", () => {
    expect(parseAmountToMinor("123.45")).toBe(12345);
    expect(parseAmountToMinor("INR 1,299.5")).toBe(129950);
    expect(parseAmountToMinor("")).toBe(0);
  });

  it("formats INR amounts with stable signs", () => {
    expect(formatSignedMoney(12345, "INR")).toContain("+");
    expect(formatSignedMoney(-12345, "INR")).toContain("-");
    expect(formatMoney(0, "INR")).toContain("0.00");
  });

  it("keeps decimal conversion fixed to two places", () => {
    expect(minorToDecimal(1)).toBe("0.01");
    expect(minorToDecimal(123400)).toBe("1234.00");
  });
});
