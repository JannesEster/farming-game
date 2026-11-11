import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { baseLivePrice, conditionPriceFactor, quoteSale } from "./economy";
import { createGame } from "./simulation";

describe("livestock prices", () => {
  it("uses sourced weaner auction average", () => {
    const q = baseLivePrice("weaner");
    expect(q.source).toBe("sourced");
    expect(q.baseNadPerKgLive).toBe(31.47);
  });

  it("discounts thin herds at auction", () => {
    const state = createGame(3300);
    const fat = quoteSale(state, "weaner", 1, "auction");
    state.herd.condition = 20;
    const thin = quoteSale(state, "weaner", 1, "auction");
    if ("reason" in fat || "reason" in thin) throw new Error("expected sale");
    expect(thin.totalNad).toBeLessThan(fat.totalNad);
    expect(conditionPriceFactor(20)).toBe(0.7);
  });

  it("applies LLPBN levy from config", () => {
    expect(CONFIG.economy.llpbnLevyRate).toBe(0.006);
  });
});
