import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { addDays, daysInMonth, isRainyMonth } from "./calendar";
import { CONFIG } from "./config";
import { COPY, formatDate, formatMoney, formatSeason } from "./format";
import { createRng, rngFromState } from "./rng";
import {
  carryingCapacityLsu,
  dailyDemandKg,
  floorDmKgPerHa,
  grazeableFraction,
  grazingDaysLeft,
  grazeStanding,
  growthKgPerHa,
  herdLsu,
  nextCondition,
} from "./pasture";
import { dailyRainMm } from "./rainfall";
import { createGame, findCamp, moveHerd, stepDay, stepDayWithRain } from "./simulation";
import type { CampState, GameState, HerdState } from "./types";

function herd(): HerdState {
  return {
    name: "Cattle herd",
    headCount: CONFIG.herd.headCount,
    averageLiveweightKg: CONFIG.herd.averageLiveweightKg,
    condition: 80,
    campId: 0,
    daysInCamp: 0,
  };
}

function camp(partial: Partial<CampState> = {}): CampState {
  return {
    id: 0,
    name: "Camp 1",
    hectares: 100,
    peakDmKgPerHa: 1600,
    standingDmKgPerHa: 1000,
    soilMoistureMm: 0,
    restDays: 0,
    tiles: [],
    anchor: { x: 0, y: 0 },
    ...partial,
  };
}

function dry(state: GameState) {
  for (const item of state.camps) item.soilMoistureMm = 0;
}

describe("sourced constants", () => {
  it("keeps the sourced livestock and land figures", () => {
    expect(CONFIG.pasture.lsuLiveweightKg).toBe(450);
    expect(CONFIG.pasture.dailyIntakeFractionOfLiveweight).toBe(0.03);
    expect(CONFIG.pasture.consumableFractionOfStandingDm).toBe(0.5);
    expect(CONFIG.farm.hectares).toBe(3300);
    expect(CONFIG.farm.hectaresPerLsu).toBe(10);
    expect(CONFIG.pasture.fullRestDays).toBe(42);
    expect(CONFIG.calendar.seasonStartMonth).toBe(7);
    expect(CONFIG.farm.landValueNadPerHa).toBe(1951);
  });

  it("stocks the herd under the savanna carrying capacity", () => {
    const state = createGame(CONFIG.worldSeed);
    expect(herdLsu(state.herd)).toBeLessThan(carryingCapacityLsu());
    expect(dailyDemandKg(state.herd)).toBeCloseTo(
      state.herd.headCount * state.herd.averageLiveweightKg * CONFIG.pasture.dailyIntakeFractionOfLiveweight,
    );
  });
});

describe("pasture maths", () => {
  it("eats demand from the grass above the litter floor", () => {
    const grazed = grazeStanding(1000, 1600, 100, 500);
    expect(floorDmKgPerHa(1600)).toBeCloseTo(800);
    expect(grazed.eatenKg).toBeCloseTo(500);
    expect(grazed.standingDmKgPerHa).toBeCloseTo(995);
  });

  it("stops at the litter floor", () => {
    const grazed = grazeStanding(810, 1600, 10, 1000);
    expect(grazed.eatenKg).toBeCloseTo(100);
    expect(grazed.standingDmKgPerHa).toBeCloseTo(800);
    const bare = grazeStanding(800, 1600, 10, 1000);
    expect(bare.eatenKg).toBe(0);
    expect(bare.standingDmKgPerHa).toBeCloseTo(800);
  });

  it("grows with moisture and rest, and slower while occupied", () => {
    const full = CONFIG.rain.moistureMmForFullGrowth;
    expect(growthKgPerHa(0, 42, false)).toBe(0);
    expect(growthKgPerHa(full, 42, false)).toBeCloseTo(CONFIG.pasture.maxDailyGrowthKgPerHa);
    const justRested = growthKgPerHa(full, 0, false);
    expect(justRested).toBeCloseTo(CONFIG.pasture.maxDailyGrowthKgPerHa * CONFIG.pasture.restGrowthFloor);
    expect(growthKgPerHa(full, 42, true)).toBeCloseTo(
      CONFIG.pasture.maxDailyGrowthKgPerHa * CONFIG.pasture.occupiedGrowthFactor,
    );
    expect(growthKgPerHa(full, 42, true)).toBeLessThan(justRested);
  });

  it("drops condition in proportion to the missed feed and clamps it", () => {
    expect(nextCondition(80, 0, 100)).toBeCloseTo(80 - CONFIG.herd.conditionDropPerDayAtNoFeed);
    expect(nextCondition(80, 40, 100)).toBeCloseTo(80 - CONFIG.herd.conditionDropPerDayAtNoFeed * 0.6);
    expect(nextCondition(80, 100, 100)).toBeCloseTo(80 + CONFIG.herd.conditionGainPerDayWhenFed);
    expect(nextCondition(1, 0, 100)).toBe(0);
    expect(nextCondition(99.8, 100, 100)).toBe(100);
  });

  it("reports grazeable grass against the litter floor", () => {
    const full = camp({ standingDmKgPerHa: 1600, peakDmKgPerHa: 1600 });
    const half = camp({ standingDmKgPerHa: 1200, peakDmKgPerHa: 1600 });
    const bare = camp({ standingDmKgPerHa: 800, peakDmKgPerHa: 1600 });
    expect(grazeableFraction(full)).toBeCloseTo(1);
    expect(grazeableFraction(half)).toBeCloseTo(0.5);
    expect(grazeableFraction(bare)).toBeCloseTo(0);
    expect(grazingDaysLeft(half, herd())).toBeCloseTo((400 * 100) / dailyDemandKg(herd()));
  });
});

describe("calendar and rain", () => {
  it("rolls months and leap days", () => {
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(addDays({ year: 2027, month: 2, day: 28 }, 1)).toEqual({ year: 2027, month: 3, day: 1 });
    expect(addDays({ year: 2028, month: 2, day: 28 }, 1)).toEqual({ year: 2028, month: 2, day: 29 });
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(addDays({ year: 2026, month: 8, day: 1 }, 1)).toEqual({ year: 2026, month: 8, day: 2 });
  });

  it("labels the dry season and the November to April rains", () => {
    expect(formatSeason({ year: 2026, month: 8, day: 1 })).toBe("Dry season");
    expect(formatSeason({ year: 2026, month: 11, day: 1 })).toBe("Rainy season");
    expect(formatSeason({ year: 2027, month: 4, day: 30 })).toBe("Rainy season");
    expect(formatSeason({ year: 2027, month: 5, day: 1 })).toBe("Dry season");
    expect(isRainyMonth(1)).toBe(true);
    expect(isRainyMonth(7)).toBe(false);
    expect(formatDate({ year: 2026, month: 8, day: 1 })).toBe("1 Aug 2026");
    expect(formatMoney(250000)).toBe("N$ 250,000");
  });

  it("resets season rain on 1 July and keeps June on the old total", () => {
    const state = createGame(4);
    state.date = { year: 2027, month: 6, day: 30 };
    state.seasonRainMm = 200;
    stepDayWithRain(state, 5);
    expect(state.seasonRainMm).toBeCloseTo(205);
    expect(state.date).toEqual({ year: 2027, month: 7, day: 1 });
    stepDayWithRain(state, 3);
    expect(state.seasonRainMm).toBeCloseTo(3);
    expect(state.date).toEqual({ year: 2027, month: 7, day: 2 });
  });

  it("puts most rain in November to April and none in July", () => {
    const totals = new Array<number>(13).fill(0);
    const rng = createRng(2026);
    for (let year = 2026; year < 2038; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        const days = daysInMonth(year, month);
        for (let day = 1; day <= days; day += 1) {
          totals[month] += dailyRainMm({ year, month, day }, rng);
        }
      }
    }
    const annual = totals.slice(1).reduce((sum, value) => sum + value, 0);
    const summer = [11, 12, 1, 2, 3, 4].reduce((sum, month) => sum + totals[month], 0);
    expect(summer / annual).toBeGreaterThan(0.8);
    expect(totals[7]).toBe(0);
    expect(totals[1]).toBeGreaterThan(totals[8] * 5);
    const januaryDays = 12 * 31;
    const januaryDaily = totals[1] / januaryDays;
    const expectedDaily = CONFIG.rain.monthlyMeanMm[1] / 31;
    expect(januaryDaily).toBeGreaterThan(expectedDaily * 0.7);
    expect(januaryDaily).toBeLessThan(expectedDaily * 1.3);
  });
});

describe("the running farm", () => {
  it("builds a deterministic Otjozondjupa camp layout", () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const first = createGame(seed);
      const second = createGame(seed);
      expect(first.camps.length).toBeGreaterThanOrEqual(CONFIG.map.campCountMin);
      expect(first.camps.length).toBeLessThanOrEqual(CONFIG.map.campCountMax);
      const grazingHa = CONFIG.farm.hectares - CONFIG.farm.homesteadHectares;
      const hectares = first.camps.reduce((sum, item) => sum + item.hectares, 0);
      expect(hectares).toBeCloseTo(grazingHa, 5);
      for (const item of first.camps) {
        expect(item.tiles.length).toBeGreaterThanOrEqual(CONFIG.map.minCampTiles);
        expect(item.peakDmKgPerHa).toBeGreaterThanOrEqual(CONFIG.pasture.forageDmKgPerHaMin);
        expect(item.peakDmKgPerHa).toBeLessThanOrEqual(CONFIG.pasture.forageDmKgPerHaMax);
        expect(item.tiles.some((tile) => tile.x === item.anchor.x && tile.y === item.anchor.y)).toBe(true);
      }
      const kinds = new Set(first.features.map((feature) => feature.kind));
      expect(kinds.has("house")).toBe(true);
      expect(kinds.has("windmill")).toBe(true);
      expect(kinds.has("reservoir")).toBe(true);
      expect(kinds.has("kraal")).toBe(true);
      expect(first.features.filter((feature) => feature.kind === "trough")).toHaveLength(first.camps.length);
      expect(findCamp(first, first.herd.campId)).toBeDefined();
      expect(first.camps.map((item) => [item.hectares, item.standingDmKgPerHa, item.tiles.length])).toEqual(
        second.camps.map((item) => [item.hectares, item.standingDmKgPerHa, item.tiles.length]),
      );
      for (let day = 0; day < 10; day += 1) {
        stepDay(first);
        stepDay(second);
      }
      expect(first.seasonRainMm).toBeCloseTo(second.seasonRainMm);
      expect(first.date).toEqual(second.date);
      expect(first.herd.condition).toBeCloseTo(second.herd.condition);
      expect(first.cashNad).toBe(CONFIG.economy.startingCashNad);
    }
  });

  it("grazes only the camp the herd stands in", () => {
    const state = createGame(5);
    dry(state);
    const firstId = state.herd.campId;
    const other = state.camps.find((item) => item.id !== firstId);
    if (!other) throw new Error("expected a second camp");
    const first = findCamp(state, firstId);
    if (!first) throw new Error("expected the opening camp");
    first.standingDmKgPerHa = first.peakDmKgPerHa;
    other.standingDmKgPerHa = other.peakDmKgPerHa;
    const moved = moveHerd(state, other.id);
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(moved.campName).toBe(other.name);
    expect(state.herd.daysInCamp).toBe(0);
    expect(other.restDays).toBe(0);
    const beforeFirst = first.standingDmKgPerHa;
    const beforeOther = other.standingDmKgPerHa;
    stepDayWithRain(state, 0);
    expect(first.standingDmKgPerHa).toBeCloseTo(beforeFirst);
    expect(other.standingDmKgPerHa).toBeLessThan(beforeOther);
    expect(state.herd.daysInCamp).toBe(1);
    expect(moveHerd(state, other.id)).toEqual({ ok: false, reason: "same" });
    expect(moveHerd(state, 999)).toEqual({ ok: false, reason: "missing" });
  });

  it("lets a rested camp recover in the rain while the occupied camp falls behind", () => {
    const state = createGame(6);
    const occupied = findCamp(state, state.herd.campId);
    const rested = state.camps.find((item) => item.id !== state.herd.campId);
    if (!occupied || !rested) throw new Error("expected two camps");
    occupied.peakDmKgPerHa = 1600;
    rested.peakDmKgPerHa = 1600;
    occupied.standingDmKgPerHa = 1100;
    rested.standingDmKgPerHa = 1100;
    occupied.hectares = 400;
    rested.hectares = 400;
    occupied.soilMoistureMm = 0;
    rested.soilMoistureMm = 0;
    occupied.restDays = 42;
    rested.restDays = 42;
    for (const item of state.camps) item.soilMoistureMm = 0;
    for (let day = 0; day < 25; day += 1) stepDayWithRain(state, 10);
    expect(rested.standingDmKgPerHa).toBeGreaterThan(occupied.standingDmKgPerHa);
    expect(rested.standingDmKgPerHa).toBeGreaterThan(1100);
  });

  it("grazes a camp down to the floor and then the herd loses condition", () => {
    const state = createGame(7);
    dry(state);
    const occupied = findCamp(state, state.herd.campId);
    if (!occupied) throw new Error("expected a camp");
    const floor = floorDmKgPerHa(occupied.peakDmKgPerHa);
    let guard = 0;
    while (occupied.standingDmKgPerHa > floor + 0.01 && guard < 5000) {
      stepDayWithRain(state, 0);
      guard += 1;
    }
    expect(guard).toBeLessThan(5000);
    expect(occupied.standingDmKgPerHa).toBeCloseTo(floor, 4);
    const before = state.herd.condition;
    stepDayWithRain(state, 0);
    expect(state.herd.condition).toBeLessThan(before);
    expect(state.cashNad).toBe(CONFIG.economy.startingCashNad);
  });
});

describe("boundaries", () => {
  it("keeps the simulation free of the renderer", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(dir).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(3);
    for (const file of files) {
      const text = readFileSync(join(dir, file), "utf8").toLowerCase();
      expect(text, file).not.toContain("phaser");
    }
  });

  it("keeps dashes out of player facing copy", () => {
    const bad = /\u2013|\u2014/;
    for (const value of Object.values(COPY)) {
      const text = typeof value === "string" ? value : value("Camp 1");
      expect(text).not.toMatch(bad);
    }
  });

  it("resumes a saved random stream", () => {
    const rng = createRng(3300);
    const first = rng.next();
    const saved = rng.getState();
    const second = rng.next();
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(rngFromState(saved).next()).toBe(second);
  });
});
