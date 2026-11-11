import { describe, expect, it } from "vitest";
import { buildGameConfig } from "./buildGameConfig";
import { PURCHASE_BUDGET_NAD } from "./budget";
import { generateFarmOffers, budgetRemaining } from "./generateOffers";
import { validateOfferCard } from "./validateOffer";
import { campGateBetween, planHerdPath } from "../sim/path";
import { REGIONS } from "./regionData";

describe("farm picker offers", () => {
  const offers = generateFarmOffers(42);

  it("returns four regional cards", () => {
    expect(offers).toHaveLength(4);
    const keys = offers.map((o) => o.regionKey);
    expect(keys).toEqual(["karas", "khomas", "otjozondjupa", "omaheke"]);
  });

  it("locks sheep/mixed cards and keeps two cattle farms playable", () => {
    const playable = offers.filter((o) => o.playable);
    expect(playable).toHaveLength(2);
    expect(playable.map((o) => o.id)).toEqual(["otjozondjupa-ranch", "omaheke-weaners"]);
    expect(offers.find((o) => o.id === "karas-sheep")?.lockedReason).toMatch(/coming soon/i);
    expect(offers.find((o) => o.id === "khomas-mixed")?.lockedReason).toMatch(/coming soon/i);
  });

  it("keeps playable asking prices within the starter purse", () => {
    for (const offer of offers.filter((o) => o.playable)) {
      expect(offer.askingPriceNad).toBeLessThanOrEqual(PURCHASE_BUDGET_NAD);
      expect(budgetRemaining(offer.askingPriceNad)).toBeGreaterThan(0);
    }
  });

  it("validates each offer map against its card stats", () => {
    for (const offer of offers) {
      const config = buildGameConfig({
        region: REGIONS[offer.regionKey],
        hectares: offer.hectares,
        campCount: offer.campCount,
        water: offer.water,
        fenceCondition: offer.fenceCondition,
        herdHead: offer.livestock.head,
        herdName: offer.livestock.classLabel,
        mapSeed: offer.seed,
      });
      const check = validateOfferCard(offer, config);
      expect(check.errors, `${offer.id}: ${check.errors.join("; ")}`).toEqual([]);
    }
  });

  it("connects camps through gates and reachable paths", () => {
    for (const offer of offers) {
      const state = offer.previewState;
      let gates = 0;
      for (let i = 0; i < state.camps.length; i += 1) {
        for (let j = i + 1; j < state.camps.length; j += 1) {
          if (campGateBetween(state.camps[i], state.camps[j])) gates += 1;
        }
      }
      expect(gates).toBeGreaterThan(0);
      const a = state.camps[0];
      const b = state.camps[state.camps.length - 1];
      const path = planHerdPath(state, a.id, b.id);
      expect(path.length).toBeGreaterThan(2);
    }
  });

  it("builds different maps per cattle offer", () => {
    const otjo = offers.find((o) => o.id === "otjozondjupa-ranch")!;
    const oma = offers.find((o) => o.id === "omaheke-weaners")!;
    expect(otjo.previewState.camps.length).not.toBe(oma.previewState.camps.length);
    expect(otjo.seed).toBe(3300);
  });

  it("starts Otjozondjupa herd in the camp beside the yard", () => {
    const otjo = offers.find((o) => o.id === "otjozondjupa-ranch")!;
    const state = otjo.previewState;
    const width = state.width;
    const grid = state.campIds;
    const herdCamp = state.camps.find((c) => c.id === state.herd.campId)!;
    let touchesYard = false;
    for (const tile of herdCamp.tiles) {
      const neighbors = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const;
      for (const [dx, dy] of neighbors) {
        const id = grid[(tile.y + dy) * width + (tile.x + dx)];
        if (id === -1) touchesYard = true;
      }
    }
    expect(touchesYard).toBe(true);
  });
});
