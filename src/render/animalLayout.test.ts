import { describe, expect, it } from "vitest";
import { advanceHerdMotion, herdAgentList } from "../sim/herdMotion";
import { createGame } from "../sim/simulation";
import { CONFIG } from "../sim/config";
import { isoLayout } from "./iso";
import { PIXELS_PER_METRE } from "./worldScale";
import { layoutAnimals } from "./animalLayout";

describe("animal layout identity", () => {
  it("keeps every other cow on its own spot when one is sold", () => {
    const state = createGame(3300);
    advanceHerdMotion(state, 30, "graze");
    const tileW = PIXELS_PER_METRE;
    const tileH = PIXELS_PER_METRE / 2;
    const layout = isoLayout(state.width, state.height, tileW, tileH, CONFIG.view.boundsPadPx);
    const before = layoutAnimals(state, layout, tileW, tileH, 0);
    const victim = herdAgentList(state)[6];
    const record = state.story?.animals?.find((animal) => animal.id === victim.id);
    expect(record).toBeTruthy();
    if (!record) return;
    record.whereabouts = "sold";
    const after = layoutAnimals(state, layout, tileW, tileH, 0);
    const afterById = new Map(after.map((spot) => [spot.animal.id, spot]));
    expect(afterById.has(victim.id)).toBe(false);
    for (const spot of before) {
      if (spot.animal.id === victim.id) continue;
      if (spot.role !== "herd-animal") continue;
      const next = afterById.get(spot.animal.id);
      expect(next).toBeTruthy();
      expect(next?.x).toBeCloseTo(spot.x, 4);
      expect(next?.y).toBeCloseTo(spot.y, 4);
    }
  });
});
