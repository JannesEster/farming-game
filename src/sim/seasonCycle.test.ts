import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { closeMonth, monthPhaseTransitionLine, tryCalving, tryWeaning } from "./seasonCycle";
import { createGame } from "./simulation";
import { createStoryState } from "./story";

describe("calving and weaning", () => {
  it("adds calves in calving season when condition allows", () => {
    const state = createGame(3300);
    state.story = createStoryState(state.herd.headCount);
    state.story.composition.cow = 60;
    state.story.breedingPaused = false;
    state.herd.condition = 70;
    state.date = { year: 2026, month: CONFIG.calendar.calvingMonths[0], day: 5, hour: 6 };
    const calvesBefore = state.story.composition.calf;
    tryCalving(state);
    expect(state.story.composition.calf).toBeGreaterThan(calvesBefore);
  });

  it("moves calves to heifers and tollies in May", () => {
    const state = createGame(3300);
    state.story = createStoryState(state.herd.headCount);
    state.story.composition.calf = 20;
    state.date = { year: 2027, month: CONFIG.calendar.weaningMonths[0], day: 3, hour: 6 };
    tryWeaning(state);
    expect(state.story.composition.heifer).toBeGreaterThan(0);
    expect(state.story.composition.tolly).toBeGreaterThan(0);
    expect(state.story.composition.calf).toBeLessThan(20);
  });
});

describe("month in review", () => {
  it("omits a season line when the phase did not change", () => {
    const line = monthPhaseTransitionLine({ year: 2026, month: 7, day: 31, hour: 6 });
    expect(line).toBeNull();
  });

  it("lists costs on separate lines", () => {
    const state = createGame(88);
    state.story = createStoryState(state.herd.headCount);
    state.date = { year: 2026, month: 8, day: 31, hour: 6 };
    closeMonth(state);
    const card = state.story!.pendingCards.find((c) => c.kind === "summary");
    expect(card?.body).toContain("Why the bills moved");
    expect(card?.body).toContain("Labour N$");
    expect(card?.body).not.toContain("Dry season ended");
  });
});
