import { describe, expect, it } from "vitest";
import defaultFarm from "../../public/farms/default-farm.json";
import { generateFarmOffers } from "../picker/generateOffers";
import { isoLayout, tileCenter } from "../render/iso";
import { PIXELS_PER_METRE, scaleBarMetres } from "../render/worldScale";
import { campCountForSeed, farmOutlineMetres } from "./metreFarm";
import { TREES_PER_M2, treesInRect } from "./vegetation";
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
import { chooseAvailableHerder, moveFitsBeforeDusk } from "./herding";
import { carryingCapacityLsu } from "./pasture";
import { campGateBetween, pathLengthKm, planHerdPath } from "./path";
import { parseLegacySaved } from "./stateMigrate";
import { createGame, moveHerd } from "./simulation";
import { hireFarmhand } from "./workers";
import { setWorkPriority } from "./workGrid";
import type { GameState } from "./types";

const LISTED_HA = 3300;

function campAspect(camp: { rect?: { w: number; h: number }; tiles: { x: number; y: number }[] }): number {
  if (camp.rect && camp.rect.w > 0 && camp.rect.h > 0) {
    return Math.max(camp.rect.w, camp.rect.h) / Math.min(camp.rect.w, camp.rect.h);
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = 0;
  let maxY = 0;
  for (const tile of camp.tiles) {
    minX = Math.min(minX, tile.x);
    minY = Math.min(minY, tile.y);
    maxX = Math.max(maxX, tile.x);
    maxY = Math.max(maxY, tile.y);
  }
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  return Math.max(width, height) / Math.min(width, height);
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
    expect(CONFIG.farm.hectares).toBe(LISTED_HA);
    const outline = farmOutlineMetres(CONFIG.farm.hectares);
    expect(outline.width).toBe(5_745);
    expect(outline.height).toBe(5_745);
    expect(CONFIG.farm.homesteadHectares).toBe(8);
    expect(CONFIG.transit.kmPerTile).toBe(0.001);
    expect(CONFIG.herd.headCount).toBe(120);
  });

  it("keeps cow world scale and raises carrying capacity with the hectares", () => {
    expect(PIXELS_PER_METRE).toBeCloseTo((64 * 0.62) / 2.4, 5);
    expect(carryingCapacityLsu()).toBe(330);
    expect(CONFIG.farm.hectaresPerLsu).toBe(10);
    expect(BUSH_COUNT_TRIM).toBeCloseTo(0.62, 5);
  });

  it("mixes eight to ten camps, smaller beside the house", () => {
    const state = generateFarm(3300);
    const outline = farmOutlineMetres(LISTED_HA);
    expect(state.width).toBe(outline.width);
    expect(state.height).toBe(outline.height);
    expect(campCountForSeed(3300)).toBe(9);
    expect(state.camps.length).toBe(9);
    const hectares = state.camps.map((camp) => camp.hectares);
    const sum = hectares.reduce((total, value) => total + value, 0);
    expect(Math.abs(sum - 3_300)).toBeLessThan(2);
    expect(Math.min(...hectares)).toBeGreaterThan(100);
    expect(Math.max(...hectares)).toBeLessThan(1_200);
    const cuts = new Set<number>();
    for (const camp of state.camps) {
      expect(campAspect(camp)).toBeLessThanOrEqual(2.5);
      expect(campAspect(camp)).toBeGreaterThan(1);
      if (camp.rect && camp.rect.x > 0) cuts.add(camp.rect.x);
    }
    expect(cuts.size).toBeGreaterThan(3);
    const house = state.features.find((feature) => feature.kind === "house");
    expect(house).toBeTruthy();
    const host = state.camps.find((camp) => camp.id === state.herd.campId)!;
    const near = state.camps.filter((camp) => {
      const rect = camp.rect!;
      return Math.hypot(rect.x + rect.w / 2 - house!.x, rect.y + rect.h / 2 - house!.y) < 2_200;
    });
    const far = state.camps.filter((camp) => !near.includes(camp));
    const avg = (list: typeof near) => list.reduce((total, camp) => total + camp.hectares, 0) / list.length;
    expect(near.length).toBeGreaterThan(0);
    expect(far.length).toBeGreaterThan(0);
    expect(avg(near)).toBeLessThan(avg(far));
    expect(host.hectares).toBeLessThan(avg(far));
    for (const camp of state.camps) {
      const neighbours = state.camps.filter((other) => other.id !== camp.id && campGateBetween(camp, other));
      expect(neighbours.length).toBeGreaterThan(0);
      const watered = state.farmWaterPoints?.some((point) => point.servedCampIds.includes(camp.id));
      expect(watered).toBe(true);
    }
  });

  it("ships the exported default farm at the listed hectares", () => {
    expect(defaultFarm.hectares).toBe(3_300);
    expect(defaultFarm.camps.length).toBe(9);
    expect(defaultFarm.width).toBe(5_745);
    expect(defaultFarm.height).toBe(5_745);
  });

  it("keeps the screenshot tree spacing on every region", () => {
    for (const base of [88001, 42] as const) {
      for (const offer of generateFarmOffers(base)) {
        const side = 400;
        const spots = [
          [800, 800],
          [800, 3600],
          [3600, 800],
          [3600, 3600],
        ];
        let total = 0;
        let windows = 0;
        const crossesFence = (x: number, y: number) =>
          offer.previewState.camps.some((camp) => {
            const rect = camp.rect;
            if (!rect) return false;
            const pad = 18;
            const vertical =
              rect.x > x - pad &&
              rect.x < x + side + pad &&
              rect.y < y + side &&
              rect.y + rect.h > y;
            const horizontal =
              rect.y > y - pad &&
              rect.y < y + side + pad &&
              rect.x < x + side &&
              rect.x + rect.w > x;
            return vertical || horizontal;
          });
        for (const [x, y] of spots) {
          if (x + side >= offer.previewState.width || y + side >= offer.previewState.height) continue;
          if (crossesFence(x, y)) continue;
          total += treesInRect(offer.previewState, x, y, x + side, y + side).length;
          windows += 1;
        }
        expect(windows, `${base} ${offer.id}`).toBeGreaterThan(0);
        const expected = TREES_PER_M2 * side * side;
        const perWindow = total / windows;
        expect(
          Math.abs(perWindow - expected) / expected,
          `${base} ${offer.id} trees ${perWindow.toFixed(0)} vs ${expected.toFixed(1)}`,
        ).toBeLessThan(0.1);
        for (const camp of offer.previewState.camps) {
          expect(campAspect(camp), `${base} ${offer.id} camp ${camp.id}`).toBeLessThanOrEqual(2.5);
        }
        expect(offer.previewState.camps.length).toBeGreaterThanOrEqual(8);
        expect(offer.previewState.camps.length).toBeLessThanOrEqual(10);
        if (offer.playable) expect(offer.askingPriceNad).toBeLessThanOrEqual(2_750_000);
      }
    }
  });

  it("matches the screenshot tree count per start-zoom screen within 10 percent", () => {
    const state = generateFarm(3300);
    const zoom = CONFIG.view.desktopTilePx / CONFIG.view.tileWidth;
    const widthM = 1280 / zoom / PIXELS_PER_METRE;
    const heightM = 800 / zoom / PIXELS_PER_METRE;
    const reference = TREES_PER_M2 * widthM * heightM;
    let total = 0;
    const windows = 9;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const x = 700 + col * (widthM + 80);
        const y = 700 + row * (heightM + 80);
        total += treesInRect(state, x, y, x + widthM, y + heightM).length;
      }
    }
    const perScreen = total / windows;
    expect(Math.abs(perScreen - reference) / reference).toBeLessThan(0.1);
  });

  it("measures neighbour drives on the larger camps", () => {
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
        expect(km).toBeGreaterThan(0.4);
        expect(km).toBeLessThan(8);
      }
    }
    expect(pairs).toBeGreaterThan(6);
    expect(longestKm).toBeGreaterThan(0.8);
    expect(longestKm / CONFIG.transit.cattleWalkKmH).toBeLessThan(6);
    state.date = { ...state.date, hour: 6 };
    expect(moveFitsBeforeDusk(state, longestKm, longestKm)).toBe(true);
  });

  it("starts a neighbour drive at first light", () => {
    const state = generateFarm(3300);
    state.date = { ...state.date, hour: 6 };
    if (state.clock) state.clock.bankMs = 0;
    expect(chooseAvailableHerder(state)).toBe("farmer");
    const home = state.camps.find((camp) => camp.id === state.herd.campId)!;
    const next = state.camps.find((camp) => camp.id !== home.id && campGateBetween(home, camp));
    expect(next).toBeTruthy();
    const started = moveHerd(state, next!.id);
    expect(started.ok).toBe(true);
    if (started.ok) expect(started.queued).toBeUndefined();
    expect(state.herd.transit?.phase).toBe("approach");
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
    expect(loaded!.width).toBeGreaterThan(1000);
    expect(loaded!.scaleReset).toBe(true);
    expect(loaded!.herd.headCount).toBe(120);
    expect(loaded!.camps[0].rect).toBeTruthy();
  });

  it("keeps the camp on screen and the scale bar on the cow's metre", () => {
    const state = generateFarm(3300);
    const camp = state.camps.find((item) => item.rect);
    expect(camp?.rect).toBeTruthy();
    const rect = camp!.rect!;
    const ppm = PIXELS_PER_METRE;
    const layout = isoLayout(state.width, state.height, ppm, ppm / 2, 0);
    const xs = [
      tileCenter(rect.x, rect.y, layout, ppm, ppm / 2).x,
      tileCenter(rect.x + rect.w, rect.y, layout, ppm, ppm / 2).x,
      tileCenter(rect.x + rect.w, rect.y + rect.h, layout, ppm, ppm / 2).x,
      tileCenter(rect.x, rect.y + rect.h, layout, ppm, ppm / 2).x,
    ];
    const span = Math.max(...xs) - Math.min(...xs);
    const side = (rect.w + rect.h) / 2;
    expect(Math.abs(span / ppm - side) / side).toBeLessThan(0.02);
    expect(camp!.hectares).toBeCloseTo((rect.w * rect.h) / 10000, 3);
    expect(scaleBarMetres(120, 1)).toBeCloseTo(120 / ppm, 5);
    expect(PIXELS_PER_METRE).toBeCloseTo((64 * 0.62) / 2.4, 5);
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
