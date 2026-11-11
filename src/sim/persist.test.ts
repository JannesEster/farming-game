import { describe, expect, it } from "vitest";
import { createGame } from "./simulation";
import { parseSaved, serializeState, SAVE_KEY } from "./persist";

describe("save migration", () => {
  it("upgrades v1 saves without story block", () => {
    const state = createGame(3300);
    const legacy = JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      state: { ...state, story: undefined },
    });
    const loaded = parseSaved(legacy);
    expect(loaded?.story?.composition.cow).toBeGreaterThan(0);
    expect(loaded?.herd.headCount).toBe(state.herd.headCount);
  });

  it("round-trips v2 saves", () => {
    const state = createGame(3300);
    const raw = serializeState(state);
    const again = parseSaved(raw);
    expect(again?.story?.composition).toEqual(state.story?.composition);
    expect(SAVE_KEY).toBe("farming-game-v2");
  });
});
