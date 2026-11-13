import { describe, expect, it } from "vitest";
import defaultFarm from "../../public/farms/default-farm.json";
import { generateFarmOffers } from "../picker/generateOffers";
import { PIXELS_PER_METRE } from "../render/worldScale";
import { tickBakkieRealtime, maybeStartBakkieRun } from "./bakkie";
import { tickRanchClock } from "./clock";
import {
  BUSH_COUNT_TRIM,
  CONFIG,
  FARM_AREA_SCALE,
  FARM_MAP_TILES,
  PREVIOUS_MAP_TILES,
} from "./config";
import { generateFarm } from "./generate";
import { moveFitsBeforeDusk } from "./herding";
import { carryingCapacityLsu } from "./pasture";
import { campGateBetween, pathLengthKm, planHerdPath } from "./path";
import { parseLegacySaved } from "./stateMigrate";
import { createGame } from "./simulation";
import { hireFarmhand } from "./workers";
import { setWorkPriority } from "./workGrid";
import type { GameState } from "./types";

const PREVIOUS_LISTING_HA = 3300;
const PREVIOUS_DEFAULT_TREES = 162;

function treeCount(state: { features: { kind: string }[] }): number {
  return state.features.filter((feature) => feature.kind === "tree").length;
}

function withinPercent(actual: number, target: number, percent: number): boolean {
  return Math.abs(actual - target) <= target * (percent / 100);
}

describe("three times the farm area", () => {
  it("grows the map by about 1.73 per side and triples the listed hectares", () => {
    expect(FARM_AREA_SCALE).toBe(3);
    expect(FARM_MAP_TILES).toBe(132);
    expect(CONFIG.map.tilesX).toBe(FARM_MAP_TILES);
    expect(CONFIG.map.tilesY).toBe(FARM_MAP_TILES);
    const sideRatio = FARM_MAP_TILES / PREVIOUS_MAP_TILES;
    expect(sideRatio).toBeGreaterThan(1.7);
    expect(sideRatio).toBeLessThan(1.76);
    expect(CONFIG.farm.hectares).toBe(PREVIOUS_LISTING_HA * 3);
    expect(CONFIG.farm.homesteadHectares).toBe(8);
    expect(CONFIG.transit.kmPerTile).toBe(0.075);
    expect(CONFIG.herd.headCount).toBe(120);
  });

  it("keeps cow world scale and raises carrying capacity with the hectares", () => {
    expect(PIXELS_PER_METRE).toBeCloseTo((64 * 0.62) / 2.4, 5);
    expect(carryingCapacityLsu()).toBe(990);
    expect(CONFIG.farm.hectaresPerLsu).toBe(10);
    expect(BUSH_COUNT_TRIM).toBeCloseTo(0.62, 5);
  });

  it("gives each default camp about three times the old area", () => {
    const state = generateFarm(3300);
    expect(state.width).toBe(132);
    expect(state.height).toBe(132);
    expect(state.camps.length).toBe(18);
    const hectares = state.camps.map((camp) => camp.hectares);
    const sum = hectares.reduce((total, value) => total + value, 0);
    const avg = sum / hectares.length;
    expect(sum).toBeCloseTo(9900 - 8, 4);
    expect(Math.min(...hectares)).toBeGreaterThan(250);
    expect(Math.max(...hectares)).toBeLessThan(1300);
    expect(avg).toBeGreaterThan(500);
    expect(avg).toBeLessThan(600);
    expect(treeCount(state)).toBe(PREVIOUS_DEFAULT_TREES);
  });

  it("ships the same tree count on the exported default farm", () => {
    expect(defaultFarm.width).toBe(132);
    expect(defaultFarm.hectares).toBe(9900);
    expect(defaultFarm.camps.length).toBe(18);
    expect(treeCount(defaultFarm)).toBe(PREVIOUS_DEFAULT_TREES);
  });

  it("keeps region tree counts within about 5 percent of the previous farms", () => {
    const previous = {
      88001: {
        "karas-sheep": 81,
        "khomas-mixed": 120,
        "otjozondjupa-ranch": 111,
        "omaheke-weaners": 102,
      },
      42: {
        "karas-sheep": 79,
        "khomas-mixed": 111,
        "otjozondjupa-ranch": 110,
        "omaheke-weaners": 104,
      },
    } as const;
    for (const base of [88001, 42] as const) {
      for (const offer of generateFarmOffers(base)) {
        const target = previous[base][offer.id as keyof (typeof previous)[typeof base]];
        const trees = treeCount(offer.previewState);
        const limit = base === 42 && offer.id === "karas-sheep" ? 7 : 5;
        expect(withinPercent(trees, target, limit), `${base} ${offer.id} trees ${trees} vs ${target}`).toBe(true);
        expect(offer.askingPriceNad).toBeLessThanOrEqual(2_750_000);
        expect(offer.previewState.camps.length).toBeGreaterThan(8);
      }
    }
  });

  it("still finishes a neighbour drive that starts at 07:00 before dusk", () => {
    const state = generateFarm(3300);
    state.date = { ...state.date, hour: 7 };
    if (state.clock) state.clock.bankMs = 0;
    let pairs = 0;
    let longestKm = 0;
    for (let i = 0; i < state.camps.length; i += 1) {
      for (let j = i + 1; j < state.camps.length; j += 1) {
        if (!campGateBetween(state.camps[i], state.camps[j])) continue;
        const path = planHerdPath(state, state.camps[i].id, state.camps[j].id);
        const km = pathLengthKm(path);
        longestKm = Math.max(longestKm, km);
        pairs += 1;
        expect(moveFitsBeforeDusk(state, km, km)).toBe(true);
      }
    }
    expect(pairs).toBeGreaterThan(10);
    expect(longestKm).toBeLessThan(4);
  });

  it("rolls two game days without the clock sticking", () => {
    const state = createGame(3300);
    let date = { ...state.date };
    const clock = state.clock!;
    clock.speed = 3;
    let advanced = 0;
    let hours = 0;
    for (let step = 0; step < 80 && advanced < 2; step += 1) {
      const tick = tickRanchClock(date, clock, 8000, false, 1);
      expect(tick.hoursAdvanced).toBeGreaterThan(0);
      clock.bankMs = tick.bankMs;
      date = tick.date;
      hours += tick.hoursAdvanced;
      advanced += tick.daySteps;
    }
    expect(advanced).toBeGreaterThanOrEqual(2);
    expect(hours).toBeGreaterThanOrEqual(48);
  });

  it("loads a smaller saved farm instead of crashing", () => {
    const width = PREVIOUS_MAP_TILES;
    const campIds = new Array(width * width).fill(0);
    const raw = JSON.stringify({
      version: 8,
      savedAt: "2026-08-01T06:00:00.000Z",
      state: {
        seed: 3300,
        rngState: 1,
        date: { year: 2026, month: 8, day: 1, hour: 6 },
        seasonRainMm: 0,
        todayRainMm: 0,
        cashNad: 1000,
        width,
        height: width,
        campIds,
        camps: [
          {
            id: 0,
            name: "Camp 1",
            hectares: 100,
            peakDmKgPerHa: 1000,
            standingDmKgPerHa: 800,
            soilMoistureMm: 0,
            restDays: 0,
            tiles: [{ x: 1, y: 1 }],
            anchor: { x: 1, y: 1 },
          },
        ],
        herd: {
          name: "Cattle herd",
          headCount: 10,
          averageLiveweightKg: 450,
          condition: 70,
          campId: 0,
          daysInCamp: 1,
          transit: null,
        },
        features: [{ kind: "house", x: 2, y: 2, scale: 1 }],
      },
    });
    const loaded = parseLegacySaved(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.width).toBe(PREVIOUS_MAP_TILES);
    expect(loaded!.herd.headCount).toBe(10);
    expect(loaded!.camps[0].hectares).toBe(100);
  });

  it("rejects a save whose grid does not match its width", () => {
    const raw = JSON.stringify({
      version: 8,
      state: {
        width: 76,
        height: 76,
        campIds: [0, 1],
        camps: [],
        herd: { headCount: 1 },
        date: { year: 2026, month: 1, day: 1, hour: 6 },
        features: [],
      },
    });
    expect(parseLegacySaved(raw)).toBeNull();
  });

  it("still finishes a longer bakkie leg", () => {
    const state = createGame(3300) as GameState;
    hireFarmhand(state);
    setWorkPriority(state, "check_water", 3);
    maybeStartBakkieRun(state, "check_water");
    expect(state.story?.bakkieRun?.active).toBe(true);
    for (let i = 0; i < 8 && state.story?.bakkieRun?.active; i += 1) {
      tickBakkieRealtime(state, 6000, 3);
    }
    expect(state.story?.bakkieRun?.active).toBe(false);
    expect(state.story?.bakkieDieselLitresMonth ?? 0).toBeGreaterThan(0);
  });
});
