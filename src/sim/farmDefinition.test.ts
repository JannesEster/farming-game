import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { farmDefinitionFromState, metresPerTileFromConfig } from "./farmDefinition";
import { createGame } from "./simulation";

describe("FarmDefinition", () => {
  it("exports the default seed farm with metres per tile", () => {
    const state = createGame(CONFIG.worldSeed);
    const def = farmDefinitionFromState(state);
    expect(def.schemaVersion).toBe(1);
    expect(def.hectares).toBe(3300);
    expect(def.metresPerTile).toBeCloseTo(metresPerTileFromConfig(), 3);
    expect(def.camps.length).toBeGreaterThan(10);
    expect(def.gates.length).toBeGreaterThan(0);
  });
});
