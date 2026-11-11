import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { createGame, findCamp, stepDayWithRain } from "./simulation";
import { applyStarvationDay, isPoorFeed } from "./consequences";
import { createStoryState } from "./story";

describe("starvation timeline", () => {
  it("warns before deaths on sustained poor feed", () => {
    const state = createGame(3300);
    state.story = createStoryState(state.herd.headCount);
    const camp = findCamp(state, state.herd.campId)!;
    camp.standingDmKgPerHa = camp.peakDmKgPerHa * 0.05;
    state.herd.condition = 8;

    const ctx = { eatenKg: 0, demandKg: 2000, grazeable: 0.02 };
    expect(isPoorFeed(ctx)).toBe(true);

    for (let d = 0; d < CONFIG.story.warnPoorFeedDays1; d += 1) {
      applyStarvationDay(state, ctx);
    }
    expect(state.story!.starvation.warningLevel).toBeGreaterThanOrEqual(1);

    const deathsBefore = state.herd.headCount;
    for (let d = 0; d < CONFIG.story.deathStartsDay + 5; d += 1) {
      applyStarvationDay(state, ctx);
    }
    expect(state.herd.headCount).toBeLessThan(deathsBefore);
  });

  it("condition drops when camp has no grazeable grass", () => {
    const state = createGame(3300);
    state.story = createStoryState(state.herd.headCount);
    const camp = findCamp(state, state.herd.campId)!;
    camp.standingDmKgPerHa = CONFIG.pasture.residualDmKgPerHaMin;
    const before = state.herd.condition;
    stepDayWithRain(state, 0);
    expect(state.herd.condition).toBeLessThan(before);
  });
});
