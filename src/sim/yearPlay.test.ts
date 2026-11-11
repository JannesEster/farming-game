import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { stateFromOfferCard } from "../integration/pickerAdapter";
import { generateFarmOffers } from "../picker/generateOffers";
import { grazeableFraction, grazingDaysLeft } from "./pasture";
import { findCamp, stepDay } from "./simulation";
import type { GameState } from "./types";

function otjozondu(): GameState {
  const card = generateFarmOffers(88001).find((offer) => offer.id === "otjozondjupa-ranch");
  if (!card) throw new Error("missing otjozondjupa offer");
  return stateFromOfferCard(card);
}

function rotateToBetterGrass(state: GameState): void {
  const camp = findCamp(state, state.herd.campId);
  if (!camp) return;
  const here = grazeableFraction(camp);
  const days = grazingDaysLeft(camp, state.herd);
  const stay =
    here >= 0.25 && days >= 3 && state.herd.daysInCamp < CONFIG.pasture.maxGrazingDaysDrySeason;
  if (stay) return;
  let best = camp;
  let bestFraction = here;
  for (const next of state.camps) {
    if (next.id < 0) continue;
    const fraction = grazeableFraction(next);
    if (fraction > bestFraction) {
      best = next;
      bestFraction = fraction;
    }
  }
  if (best.id !== state.herd.campId && bestFraction > here + 0.05) {
    state.herd.campId = best.id;
    state.herd.daysInCamp = 0;
    state.herd.transit = null;
  }
}

describe("year of play", () => {
  it("kills cattle that are left on a bare camp", () => {
    const state = otjozondu();
    const startHead = state.herd.headCount;
    for (const camp of state.camps) {
      camp.standingDmKgPerHa = CONFIG.pasture.residualDmKgPerHaMin;
    }
    for (let day = 0; day < 50; day += 1) stepDay(state);
    expect(state.herd.headCount).toBeLessThan(startHead);
    expect(state.story?.starvation.totalDeathsSeason ?? 0).toBeGreaterThan(0);
  });

  it("lets a herd that stays in one camp starve out", () => {
    const state = otjozondu();
    for (let day = 0; day < 370; day += 1) stepDay(state);
    expect(state.herd.headCount).toBeLessThan(10);
  });

  it("keeps a player who rotates camps solvent through year 1", () => {
    const state = otjozondu();
    const startHead = state.herd.headCount;
    for (let day = 0; day < 370; day += 1) {
      rotateToBetterGrass(state);
      stepDay(state);
    }
    expect(state.herd.headCount).toBeGreaterThanOrEqual(startHead);
    expect(state.herd.condition).toBeGreaterThan(50);
    expect(state.cashNad).toBeGreaterThan(50_000);
  });
});
