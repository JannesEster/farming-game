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

  it("warns before the first death on a bare camp", () => {
    const state = createGame(3300);
    const camp = findCamp(state, state.herd.campId);
    if (!camp || !state.story) throw new Error("expected camp");
    camp.standingDmKgPerHa = CONFIG.pasture.residualDmKgPerHaMin;
    const startHead = state.herd.headCount;
    let warnDay = -1;
    let deathDay = -1;
    for (let day = 0; day < 80; day += 1) {
      stepDayWithRain(state, 0);
      if (warnDay < 0 && state.story.pendingCards.some((card) => card.kind === "warning")) warnDay = day;
      if (deathDay < 0 && state.herd.headCount < startHead) deathDay = day;
    }
    expect(warnDay).toBeGreaterThanOrEqual(0);
    expect(deathDay).toBeGreaterThan(warnDay);
  });

  it("warns when the camp has no trough and does not kill that day", () => {
    const state = createGame(3300);
    const camp = findCamp(state, state.herd.campId);
    if (!camp) throw new Error("expected camp");
    const tiles = new Set(camp.tiles.map((tile) => `${tile.x},${tile.y}`));
    state.features = state.features.filter(
      (feature) => !(feature.kind === "trough" && tiles.has(`${feature.x},${feature.y}`)),
    );
    const head = state.herd.headCount;
    stepDayWithRain(state, 0);
    expect(state.herd.headCount).toBe(head);
    expect(state.story?.pendingCards.some((card) => card.title === "Water warning")).toBe(true);
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
