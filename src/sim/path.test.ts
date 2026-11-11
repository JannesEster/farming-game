import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { createGame } from "./simulation";
import { pathLengthKm, planHerdPath, pointOnPath } from "./path";

describe("herd paths", () => {
  it("plans a path between two camps on the default farm", () => {
    const state = createGame(CONFIG.worldSeed);
    expect(state.camps.length).toBeGreaterThanOrEqual(CONFIG.map.campCountMin);
    const from = state.herd.campId;
    const to = state.camps.find((c) => c.id !== from)?.id;
    if (to === undefined) throw new Error("expected another camp");
    const path = planHerdPath(state, from, to);
    expect(path.length).toBeGreaterThan(2);
    expect(path[0]).toEqual(state.camps.find((c) => c.id === from)!.anchor);
    const km = pathLengthKm(path);
    expect(km).toBeGreaterThan(CONFIG.transit.minDistanceKm);
    const mid = pointOnPath(path, 0.5);
    expect(mid.x).toBeGreaterThanOrEqual(0);
    expect(mid.y).toBeGreaterThanOrEqual(0);
  });
});
