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

  it("fills camp warning ids missing from older story saves", () => {
    const state = createGame(3);
    const story = { ...state.story! };
    delete (story as { moveWarnCampId?: number | null }).moveWarnCampId;
    delete (story as { thirstWarnCampId?: number | null }).thirstWarnCampId;
    const raw = JSON.stringify({ version: 2, savedAt: "2026-08-01", state: { ...state, story } });
    const loaded = parseSaved(raw);
    expect(loaded?.story?.moveWarnCampId).toBeNull();
    expect(loaded?.story?.thirstWarnCampId).toBeNull();
  });

  it("round-trips v2 saves", () => {
    const state = createGame(3300);
    const raw = serializeState(state);
    const again = parseSaved(raw);
    expect(again?.story?.composition).toEqual(state.story?.composition);
    expect(SAVE_KEY).toBe("farming-game-v2");
  });
});
