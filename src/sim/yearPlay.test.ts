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
  const sellClass = (stockClass: "tolly" | "heifer" | "ox", keep: number) => {
    const excess = state.story!.composition[stockClass] - keep;
    if (excess <= 0) return;
    const line = quoteSale(state, stockClass, excess, "auction");
    if ("reason" in line) return;
    applySale(state, line);
  };
  sellClass("tolly", 2);
  sellClass("heifer", 2);
  sellClass("ox", 4);
}

function runToNextSeasonStart(state: GameState, act: (state: GameState) => void): void {
  const startYear = state.date.year;
  for (let guard = 0; guard < 400; guard += 1) {
    act(state);
    stepDay(state);
    if (state.date.month === 7 && state.date.day === 1 && state.date.year > startYear) return;
  }
  throw new Error("season start was not reached");
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
  it("opens the bought farm with grass and water, and no deaths in the first weeks", () => {
    const state = otjozondu();
    const camp = findCamp(state, state.herd.campId);
    if (!camp) throw new Error("expected opening camp");
    const days = grazingDaysLeft(camp, state.herd);
    const atPeak = grazingDaysLeft({ ...camp, standingDmKgPerHa: camp.peakDmKgPerHa }, state.herd);
    expect(days).toBeGreaterThanOrEqual(Math.min(CONFIG.pasture.openingMinGrassDays, atPeak) - 0.2);
    const tiles = new Set(camp.tiles.map((tile) => `${tile.x},${tile.y}`));
    expect(state.features.some((feature) => feature.kind === "trough" && tiles.has(`${feature.x},${feature.y}`))).toBe(
      true,
    );
    expect(state.features.some((feature) => feature.kind === "windmill")).toBe(true);
    const head = state.herd.headCount;
    for (let day = 0; day < 20; day += 1) stepDay(state);
    expect(state.herd.headCount).toBeGreaterThanOrEqual(head);
    expect(state.story?.ledger.deathCount ?? 0).toBe(0);
  });

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

  it("keeps the herd fed on the larger ranch while running costs spend cash", () => {
    const state = otjozondu();
    const startCash = state.cashNad;
    const startHead = state.herd.headCount;
    runToNextSeasonStart(state, (current) => {
      rotateToBetterGrass(current);
      marketSales(current);
    });
    expect(state.date.month).toBe(7);
    expect(state.date.day).toBe(1);
    expect(state.herd.headCount).toBeGreaterThanOrEqual(startHead - 12);
    expect(state.herd.condition).toBeGreaterThan(50);
    // 120 head on the 3,300 ha listing. Sales cover most of the running costs, so the opening float stays mostly intact.
    expect(state.cashNad).toBeGreaterThan(startCash * 0.7);
    expect(state.cashNad).toBeLessThan(startCash);
  });

  it("warns a careless herd before deaths and leaves them worse off at year end", () => {
    const careful = otjozondu();
    runToNextSeasonStart(careful, (current) => {
      rotateToBetterGrass(current);
      marketSales(current);
    });
    const state = otjozondu();
    const startHead = state.herd.headCount;
    let warnDay = -1;
    let deathDay = -1;
    const startYear = state.date.year;
    for (let day = 0; day < 400; day += 1) {
      stepDay(state);
      if (
        warnDay < 0 &&
        (state.story?.pendingCards.some((card) => card.kind === "critical") ||
          state.notifications?.log.some((n) => n.kind === "feed_warning" || n.kind === "camp_worn"))
      ) {
        warnDay = day;
      }
      if (deathDay < 0 && state.herd.headCount < startHead) deathDay = day;
      if (state.date.month === 7 && state.date.day === 1 && state.date.year > startYear) break;
    }
    expect(warnDay).toBeGreaterThanOrEqual(0);
    if (deathDay >= 0) expect(deathDay).toBeGreaterThan(warnDay);
    expect(state.herd.daysInCamp).toBeGreaterThan(careful.herd.daysInCamp);
  });
});
