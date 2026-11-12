import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import {
  farmDefinitionFromState,
  gameStateFromFarmDefinition,
  metresPerTileFromConfig,
} from "./farmDefinition";
import { createGame } from "./simulation";

describe("FarmDefinition", () => {
  it("exports the default seed farm with metres per tile", () => {
    const state = createGame(CONFIG.worldSeed);
    const def = farmDefinitionFromState(state);
    expect(def.schemaVersion).toBe(2);
    expect(def.hectares).toBe(3300);
    expect(def.metresPerTile).toBeCloseTo(metresPerTileFromConfig(), 3);
    expect(def.camps.length).toBeGreaterThan(10);
    expect(def.gates.length).toBeGreaterThan(0);
    expect(def.campIds.length).toBe(state.width * state.height);
  });

  it("rebuilds camp tiles from compact campIds grid", () => {
    const state = createGame(CONFIG.worldSeed);
    const def = farmDefinitionFromState(state);
    const rebuilt = gameStateFromFarmDefinition(def);
    expect(rebuilt.campIds).toEqual(def.campIds);
    for (const camp of state.camps) {
      const prior = state.camps.find((c) => c.id === camp.id);
      const next = rebuilt.camps.find((c) => c.id === camp.id);
      expect(prior && next).toBeTruthy();
      expect(next!.tiles.length).toBe(prior!.tiles.length);
    }
  });
});
