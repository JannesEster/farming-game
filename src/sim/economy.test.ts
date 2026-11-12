import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import {
  baseLivePrice,
  conditionPriceFactor,
  monthlyOperatingCosts,
  monthlyOperatingTotalNad,
  quoteSale,
} from "./economy";
import { createGame } from "./simulation";

describe("livestock prices", () => {
  it("uses Jannes tolly wet and dry band ends", () => {
    const state = createGame(3300);
    state.date = { ...state.date, month: 2 };
    const wet = baseLivePrice("tolly", CONFIG, state);
    state.date = { ...state.date, month: 8 };
    const dry = baseLivePrice("tolly", CONFIG, state);
    expect(wet.baseNadPerKgLive).toBe(38);
    expect(dry.baseNadPerKgLive).toBe(32);
  });

  it("discounts thin herds at auction", () => {
    const state = createGame(3300);
    const fat = quoteSale(state, "tolly", 1, "auction");
    state.herd.condition = 20;
    const thin = quoteSale(state, "tolly", 1, "auction");
    if ("reason" in fat || "reason" in thin) throw new Error("expected sale");
    expect(thin.totalNad).toBeLessThan(fat.totalNad);
    expect(conditionPriceFactor(20)).toBe(0.7);
  });

  it("applies Meat Board levy from NAU sheet", () => {
    expect(CONFIG.economy.llpbnLevyRate).toBe(0.007);
    expect(CONFIG.economy.auctionCommissionRate).toBe(0.06);
  });
});

describe("operating cost scale", () => {
  it("matches Reuben anchor at 13,000 ha and 500 head", () => {
    const state = createGame(3300);
    state.farmMeta = {
      offerId: "reuben",
      regionKey: "otjozondjupa",
      regionLabel: "Otjozondjupa",
      hectares: 13000,
      rainfallMm: 446,
      campCount: 18,
      fenceCondition: "good",
      water: { boreholes: 6, windmills: 4, solar: 2 },
    };
    state.herd.headCount = 500;
    const total = monthlyOperatingTotalNad(state);
    expect(total).toBeGreaterThan(82_000);
    expect(total).toBeLessThan(98_000);
  });

  it("keeps a 3,300 ha starter ranch in a plausible monthly band", () => {
    const state = createGame(3300);
    state.farmMeta = { ...state.farmMeta!, hectares: 3300 };
    state.herd.headCount = 120;
    const costs = monthlyOperatingCosts(state);
    expect(costs.total).toBeGreaterThan(12_000);
    expect(costs.total).toBeLessThan(26_000);
    expect(costs.labour + costs.lick + costs.diesel + costs.repairs + costs.other).toBeCloseTo(
      costs.total,
      0,
    );
  });
});
