import { describe, expect, it } from "vitest";
import { formatHudMoney, formatMoney, formatNad } from "./format";

describe("money formatting", () => {
  it("formats HUD cash without a space after N$", () => {
    expect(formatHudMoney(250_000)).toBe("N$250k");
    expect(formatHudMoney(-250_000)).toBe("-N$250k");
  });

  it("formats full amounts with sign before N$", () => {
    expect(formatNad(5730)).toBe("N$5,730");
    expect(formatNad(-19917)).toBe("-N$19,917");
    expect(formatMoney(5730)).toBe("N$5,730");
  });
});
