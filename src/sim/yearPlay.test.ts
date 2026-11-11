import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { stateFromOfferCard } from "../integration/pickerAdapter";
import { generateFarmOffers } from "../picker/generateOffers";
import { applySale, quoteSale } from "./economy";
import { grazeableFraction, grazingDaysLeft } from "./pasture";
import { findCamp, stepDay } from "./simulation";
import type { GameState } from "./types";

function otjozondu(): GameState {
  const card = generateFarmOffers(88001).find((offer) => offer.id === "otjozondjupa-ranch");
  if (!card) throw new Error("missing otjozondjupa offer");
  return stateFromOfferCard(card);
}

function marketSales(state: GameState): void {
  if (!state.story) return;
  if (!CONFIG.calendar.weanerSaleMonths.includes(state.date.month)) return;
  const sellClass = (stockClass: "weaner" | "ox", keep: number) => {
    const excess = state.story!.composition[stockClass] - keep;
    if (excess <= 0) return;
    const line = quoteSale(state, stockClass, excess, "auction");
    if ("reason" in line) return;
    applySale(state, line);
  };
  sellClass("weaner", 8);
  sellClass("ox", 4);
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
    const smallest = state.camps
      .filter((camp) => camp.id >= 0)
      .sort((a, b) => a.hectares - b.hectares)[0];
    state.herd.campId = smallest.id;
    state.herd.daysInCamp = 0;
    for (let day = 0; day < 370; day += 1) {
      state.herd.campId = smallest.id;
      stepDay(state);
    }
    expect(state.herd.headCount).toBeLessThan(10);
  });

  it("stays roughly break-even to modestly profitable with rotation and weaner sales", () => {
    const state = otjozondu();
    const startCash = state.cashNad;
    const startHead = state.herd.headCount;
    for (let day = 0; day < 370; day += 1) {
      rotateToBetterGrass(state);
      marketSales(state);
      stepDay(state);
    }
    expect(state.herd.headCount).toBeGreaterThanOrEqual(startHead - 12);
    expect(state.herd.condition).toBeGreaterThan(50);
    expect(state.cashNad).toBeGreaterThan(startCash * 0.9);
    expect(state.cashNad).toBeLessThan(startCash * 1.2);
  });
});
