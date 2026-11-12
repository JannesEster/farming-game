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
  const pens = state.features.filter((feature) => feature.kind === "holding_pen");
  const ramp = state.features.find((feature) => feature.kind === "loading_ramp");
  const crush = state.features.find((feature) => feature.kind === "crush");
  const cottage = state.features.find((feature) => feature.kind === "worker_house");
  const house = state.features.find((feature) => feature.kind === "house");
  expect(pens.length).toBeGreaterThanOrEqual(3);
  expect(new Set(pens.map((pen) => pen.scale)).size).toBeGreaterThanOrEqual(2);
  expect(ramp).toBeTruthy();
  expect(crush).toBeTruthy();
  expect(state.features.some((feature) => feature.kind === "race")).toBe(true);
  expect(state.features.some((feature) => feature.kind === "handling_roof")).toBe(true);
  expect(state.features.some((feature) => feature.kind === "kraal")).toBe(false);
  expect(cottage).toBeTruthy();
  expect(rampTouchesTrack(state)).toBe(true);
  const idAt = (x: number, y: number) => state.campIds[y * state.width + x];
  expect(idAt(ramp!.x, ramp!.y)).toBeGreaterThanOrEqual(0);
  expect(idAt(pens[0].x, pens[0].y)).toBe(idAt(ramp!.x, ramp!.y));
  expect(idAt(cottage!.x, cottage!.y)).toBe(-1);
  expect(house).toBeTruthy();
  expect(Math.hypot(ramp!.x - house!.x, ramp!.y - house!.y)).toBeGreaterThan(8);
  expect(state.camps.some((camp) => !campHasWaterAccess(state, camp))).toBe(true);
  expect(state.features.some((feature) => feature.kind === "lick_feeder")).toBe(true);
  const start = state.camps.find((camp) => camp.id === state.herd.campId);
  expect(start && campHasWaterAccess(state, start)).toBe(true);
}

describe("generated farm water and yard", () => {
  it("keeps the homestead pieces on separate tiles, with loading out by the road", () => {
    for (const roadSouth of [true, false]) {
      const pieces = homesteadYardPieces(7, 6, roadSouth);
      const keys = pieces.map((piece) => `${piece.x},${piece.y}`);
      expect(new Set(keys).size).toBe(keys.length);
      expect(pieces.some((piece) => piece.kind === "loading_ramp" || piece.kind === "kraal")).toBe(false);
      expect(pieces.some((piece) => piece.kind === "house")).toBe(true);
    }
  });

  it("gives every generated offer shared water, a dry camp, and a road-side cattle yard", () => {
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
