import { getStatusPillPresentation } from "../src/components/statusPillPresentation";
import { darkColors, semanticColors } from "../src/theme/colors";

describe("StatusPill", () => {
  it("uses neutral, explicit settlement status copy", () => {
    expect(getStatusPillPresentation("awaiting_receiver_confirmation", darkColors)).toMatchObject({
      label: "Awaiting confirmation",
      color: semanticColors.info
    });
  });

  it("uses the disputed semantic color for rejected payment evidence", () => {
    expect(getStatusPillPresentation("rejected", darkColors)).toMatchObject({
      label: "Rejected",
      color: semanticColors.disputed
    });
  });
});
