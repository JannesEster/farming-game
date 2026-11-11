import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { droughtWatchScore, tickDrought } from "./drought";
import { createGame } from "./simulation";
import { createStoryState } from "./story";

describe("drought trigger", () => {
  it("offers a choice when season rain stays low into late summer", () => {
    const state = createGame(3300);
    state.story = createStoryState(state.herd.headCount);
    state.date = { year: 2027, month: CONFIG.story.droughtChoiceMonth, day: 10, hour: 6 };
    state.seasonRainMm = 20;
    const score = droughtWatchScore(state);
    expect(score).toBeGreaterThan(CONFIG.story.droughtChoiceScore);
    tickDrought(state);
    expect(state.story!.drought.choicePending).not.toBeNull();
    expect(state.story!.pendingCards.some((c) => c.kind === "drought")).toBe(true);
  });
});
