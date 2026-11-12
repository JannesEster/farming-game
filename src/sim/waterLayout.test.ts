import { describe, expect, it } from "vitest";
import { generateFarmOffers } from "../picker/generateOffers";
import { generateFarm } from "./generate";
import type { GameState } from "./types";
import { campHasWaterAccess } from "./water";
import { homesteadYardPieces, rampTouchesTrack } from "./waterLayout";

function assertGeneratedInfrastructure(state: GameState): void {
  expect(state.farmWaterPoints?.length ?? 0).toBeGreaterThanOrEqual(1);
  for (const point of state.farmWaterPoints ?? []) {
    expect(point.servedCampIds.length).toBeGreaterThanOrEqual(2);
    expect(point.servedCampIds.length).toBeLessThanOrEqual(4);
  }
  const kraal = state.features.find((feature) => feature.kind === "kraal");
  const ramp = state.features.find((feature) => feature.kind === "loading_ramp");
  const cottage = state.features.find((feature) => feature.kind === "worker_house");
  expect(kraal).toBeTruthy();
  expect(ramp).toBeTruthy();
  expect(cottage).toBeTruthy();
  expect(rampTouchesTrack(state)).toBe(true);
  const idAt = (x: number, y: number) => state.campIds[y * state.width + x];
  expect(idAt(kraal!.x, kraal!.y)).toBe(-1);
  expect(idAt(ramp!.x, ramp!.y)).toBe(-1);
  expect(idAt(cottage!.x, cottage!.y)).toBe(-1);
  expect(Math.abs(kraal!.x - ramp!.x) + Math.abs(kraal!.y - ramp!.y)).toBeLessThanOrEqual(4);
  expect(state.camps.some((camp) => !campHasWaterAccess(state, camp))).toBe(true);
  expect(state.features.some((feature) => feature.kind === "lick_feeder")).toBe(true);
  const start = state.camps.find((camp) => camp.id === state.herd.campId);
  expect(start && campHasWaterAccess(state, start)).toBe(true);
}

describe("generated farm water and yard", () => {
  it("keeps the homestead pieces on separate tiles, ramp on the road edge", () => {
    for (const roadSouth of [true, false]) {
      const pieces = homesteadYardPieces(7, 6, roadSouth);
      const keys = pieces.map((piece) => `${piece.x},${piece.y}`);
      expect(new Set(keys).size).toBe(keys.length);
      const ramp = pieces.find((piece) => piece.kind === "loading_ramp");
      expect(ramp).toEqual({ kind: "loading_ramp", x: 3, y: roadSouth ? 5 : 0 });
    }
  });

  it("gives every generated offer shared water, a dry camp, and a road-side kraal", () => {
    for (const seed of [88001, 42]) {
      for (const card of generateFarmOffers(seed)) {
        assertGeneratedInfrastructure(card.previewState);
      }
    }
  });

  it("places the same infrastructure from generateFarm", () => {
    for (const seed of [1, 5, 12]) {
      assertGeneratedInfrastructure(generateFarm(seed));
    }
  });
});
