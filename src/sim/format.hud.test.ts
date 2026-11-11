import { describe, expect, it } from "vitest";
import { formatHudDate, formatHudMoney, formatHudRain, formatHerdSheetSummary } from "./format";

describe("compact HUD formats", () => {
  it("shortens the top bar labels", () => {
    expect(formatHudDate({ year: 2026, month: 8, day: 1, hour: 6 })).toBe("1 Aug");
    expect(formatHudMoney(250_000)).toBe("N$250k");
    expect(formatHudRain(0)).toBe("0 mm");
  });

  it("fits the herd sheet on one line", () => {
    expect(formatHerdSheetSummary(120, "Camp 4", 75)).toBe("Herd 120, Camp 4, grass 75%");
  });
});
