import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { createGame } from "./simulation";
import {
  bfsCampRoute,
  campAdjacencyGraph,
  campGateBetween,
  campGateToward,
  pathLengthKm,
  planHerdPath,
  pointOnPath,
} from "./path";

function centroid(tiles: { x: number; y: number }[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const t of tiles) x += t.x, y += t.y;
  return { x: x / tiles.length, y: y / tiles.length };
}

describe("herd paths", () => {
  it("builds seed 3300 with 18 camps in the expected hectare band", () => {
    const state = createGame(3300);
    expect(state.camps.length).toBe(18);
    const ha = state.camps.map((c) => c.hectares);
    expect(Math.min(...ha)).toBeGreaterThanOrEqual(250);
    expect(Math.max(...ha)).toBeLessThanOrEqual(1300);
    const avg = ha.reduce((a, b) => a + b, 0) / ha.length;
    expect(avg).toBeGreaterThan(480);
    expect(avg).toBeLessThan(620);
  });

  it("picks the near gate, not the far side of the camp", () => {
    const state = createGame(3300);
    const from = state.camps[0];
    const to = state.camps[1];
    const toward = centroid(to.tiles);
    const gate = campGateToward(from, toward);
    const farScore = from.tiles
      .filter((tile) => {
        const neighbors = [
          { x: tile.x + 1, y: tile.y },
          { x: tile.x - 1, y: tile.y },
          { x: tile.x, y: tile.y + 1 },
          { x: tile.x, y: tile.y - 1 },
        ];
        return neighbors.some((n) => !from.tiles.some((t) => t.x === n.x && t.y === n.y));
      })
      .map((tile) => {
        const dx = toward.x - tile.x;
        const dy = toward.y - tile.y;
        return { tile, score: dx * dx + dy * dy };
      })
      .sort((a, b) => b.score - a.score)[0];
    const near = campGateToward(from, toward);
    const nearDist = (toward.x - near.x) ** 2 + (toward.y - near.y) ** 2;
    const farDist = (toward.x - farScore.tile.x) ** 2 + (toward.y - farScore.tile.y) ** 2;
    expect(nearDist).toBeLessThan(farDist);
    expect(gate).toEqual(near);
  });

  it("uses a shared gate when two camps touch", () => {
    const state = createGame(3300);
    let found = false;
    for (let i = 0; i < state.camps.length; i += 1) {
      for (let j = i + 1; j < state.camps.length; j += 1) {
        const pair = campGateBetween(state.camps[i], state.camps[j]);
        if (pair) {
          found = true;
          const path = planHerdPath(state, state.camps[i].id, state.camps[j].id);
          expect(path.some((p) => p.x === pair.fromGate.x && p.y === pair.fromGate.y)).toBe(true);
        }
      }
    }
    expect(found).toBe(true);
  });

  it("finds a multi camp route when camps are not neighbours", () => {
    const state = createGame(CONFIG.worldSeed);
    const graph = campAdjacencyGraph(state);
    const from = state.herd.campId;
  let farId = state.camps.find((c) => !(graph.get(from) ?? []).includes(c.id))?.id;
    if (farId === undefined) {
      for (const camp of state.camps) {
        const route = bfsCampRoute(state, from, camp.id);
        if (route && route.length >= 3) {
          farId = camp.id;
          break;
        }
      }
    }
    expect(farId).toBeDefined();
    const route = bfsCampRoute(state, from, farId!);
    expect(route).not.toBeNull();
    expect(route!.length).toBeGreaterThanOrEqual(2);
    const path = planHerdPath(state, from, farId!);
    expect(path.length).toBeGreaterThan(2);
    expect(pathLengthKm(path)).toBeGreaterThan(CONFIG.transit.minDistanceKm);
  });

  it("plans a path between two camps on the default farm", () => {
    const state = createGame(CONFIG.worldSeed);
    const from = state.herd.campId;
    const to = state.camps.find((c) => c.id !== from)?.id;
    if (to === undefined) throw new Error("expected another camp");
    const path = planHerdPath(state, from, to);
    expect(path.length).toBeGreaterThan(2);
    const km = pathLengthKm(path);
    expect(km).toBeGreaterThan(CONFIG.transit.minDistanceKm);
    const mid = pointOnPath(path, 0.5);
    expect(mid.x).toBeGreaterThanOrEqual(0);
    expect(mid.y).toBeGreaterThanOrEqual(0);
  });
});
