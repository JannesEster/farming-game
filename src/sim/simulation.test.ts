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
  consumableDmKgInCamp,
  dailyDemandKg,
  effectiveGrazingHectares,
  grazeableFraction,
  grazingDaysLeft,
  grazeStanding,
  growthKgPerHa,
  herdLsu,
  nextCondition,
  residualDmKgPerHa,
  tramplingLossKgPerHa,
} from "./pasture";
import { parseSaved, serializeState } from "./persist";
import { maxGrazingDaysInCamp, moveAdvice } from "./grazing";
import { formatMoveWarning } from "./format";
import { dailyRainMm } from "./rainfall";
import { createGame, findCamp, moveHerd, stepDay, stepDayWithRain } from "./simulation";
import { campHasWaterAccess } from "./water";
import { tickHerdingRealtime } from "./herding";
import { herdMoveActive } from "./transit";
import type { CampState, GameState, HerdState } from "./types";

function finishTransit(state: GameState): void {
  let guard = 0;
  while (state.herd.transit && guard < 800) {
    tickHerdingRealtime(state, 120, "x1", CONFIG);
    if (!state.herd.transit) break;
    guard += 1;
  }
}

function herd(): HerdState {
  return {
    name: "Cattle herd",
    headCount: CONFIG.herd.headCount,
    averageLiveweightKg: CONFIG.herd.averageLiveweightKg,
    condition: 80,
    campId: 0,
    daysInCamp: 0,
    transit: null,
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
  it("uses a low residual litter line, not half of peak", () => {
    expect(residualDmKgPerHa(1600)).toBeCloseTo(200);
    expect(residualDmKgPerHa(1600)).toBeLessThan(1600 * 0.5);
  });

  it("applies Kruger half only to the May budget helper", () => {
    const sample = camp({ standingDmKgPerHa: 1000, hectares: 100 });
    expect(consumableDmKgInCamp(sample)).toBeCloseTo(1000 * 100 * 0.5);
  });

  it("eats demand from the grass above the litter floor", () => {
    const ha = 100;
    const grazed = grazeStanding(1000, 1600, ha, 500);
    expect(grazed.eatenKg).toBeCloseTo(500);
    expect(grazed.standingDmKgPerHa).toBeCloseTo(1000 - 500 / ha);
  });

  it("stops when the active graze area is at residual", () => {
    const ha = 100;
    const grazeHa = effectiveGrazingHectares(ha);
    const floor = residualDmKgPerHa(1600);
    const standing = floor + 5;
    const demand = (standing - floor) * grazeHa + 50;
    const grazed = grazeStanding(standing, 1600, ha, demand);
    expect(grazed.eatenKg).toBeCloseTo((standing - floor) * grazeHa);
    expect(grazed.standingDmKgPerHa).toBeLessThanOrEqual(standing);
    const bare = grazeStanding(floor, 1600, ha, 1000);
    expect(bare.eatenKg).toBe(0);
    expect(bare.standingDmKgPerHa).toBeCloseTo(floor);
  });

  it("grows with moisture and rest only when the camp is empty", () => {
    const full = CONFIG.rain.moistureMmForFullGrowth;
    expect(growthKgPerHa(0, 42, false)).toBe(0);
    expect(growthKgPerHa(full, 42, false)).toBeCloseTo(CONFIG.pasture.maxDailyGrowthKgPerHa);
    const justRested = growthKgPerHa(full, 0, false);
    expect(justRested).toBeCloseTo(CONFIG.pasture.maxDailyGrowthKgPerHa * CONFIG.pasture.restGrowthFloor);
    expect(growthKgPerHa(full, 42, true)).toBe(0);
    expect(growthKgPerHa(full, 0, true)).toBe(0);
  });

  it("tramples faster when stocking pressure is higher", () => {
    const ha = 200;
    const small: HerdState = {
      name: "small",
      campId: 0,
      headCount: 40,
      averageLiveweightKg: 450,
      condition: 70,
      daysInCamp: 0,
      transit: null,
    };
    const large: HerdState = {
      ...small,
      headCount: 200,
    };
    const light = tramplingLossKgPerHa(ha, small);
    const heavy = tramplingLossKgPerHa(ha, large);
    expect(heavy).toBeGreaterThan(light);
    expect(heavy / light).toBeCloseTo(5);
  });

  it("drops condition in proportion to the missed feed and clamps it", () => {
    expect(nextCondition(80, 0, 100)).toBeCloseTo(80 - CONFIG.herd.conditionDropPerDayAtNoFeed);
    expect(nextCondition(80, 40, 100)).toBeCloseTo(80 - CONFIG.herd.conditionDropPerDayAtNoFeed * 0.6);
    expect(nextCondition(80, 100, 100)).toBeCloseTo(80 + CONFIG.herd.conditionGainPerDayWhenFed);
    expect(nextCondition(1, 0, 100)).toBe(0);
    expect(nextCondition(99.8, 100, 100)).toBe(100);
  });

  it("reports grazeable grass against the litter floor", () => {
    const peak = 1600;
    const floor = residualDmKgPerHa(peak);
    const full = camp({ standingDmKgPerHa: peak, peakDmKgPerHa: peak });
    const mid = camp({ standingDmKgPerHa: floor + (peak - floor) / 2, peakDmKgPerHa: peak });
    const bare = camp({ standingDmKgPerHa: floor, peakDmKgPerHa: peak });
    expect(grazeableFraction(full)).toBeCloseTo(1);
    expect(grazeableFraction(mid)).toBeCloseTo(0.5);
    expect(grazeableFraction(bare)).toBeCloseTo(0);
    const grazeHa = effectiveGrazingHectares(100);
    expect(grazingDaysLeft(mid, herd())).toBeCloseTo(
      ((mid.standingDmKgPerHa - floor) * grazeHa) / dailyDemandKg(herd()),
    );
  });
});

describe("grazing rhythm and warnings", () => {
  it("drops camp grass on seed 3300 within two dry weeks", () => {
    const state = createGame(3300);
    const camp = findCamp(state, state.herd.campId);
    if (!camp) throw new Error("expected camp");
    for (const item of state.camps) item.soilMoistureMm = 0;
    const start = camp.standingDmKgPerHa;
    for (let day = 0; day < 14; day += 1) stepDayWithRain(state, 0);
    expect(camp.standingDmKgPerHa).toBeLessThan(start - 10);
    expect(state.herd.daysInCamp).toBeGreaterThanOrEqual(14);
  });

  it("warns after the sourced dry season graze spell on seed 3300", () => {
    const state = createGame(3300);
    const camp = findCamp(state, state.herd.campId);
    if (!camp) throw new Error("expected camp");
    for (const item of state.camps) item.soilMoistureMm = 0;
    expect(maxGrazingDaysInCamp(state.date)).toBe(CONFIG.pasture.maxGrazingDaysDrySeason);
    for (let day = 0; day < CONFIG.pasture.maxGrazingDaysDrySeason; day += 1) {
      stepDayWithRain(state, 0);
    }
    const advice = moveAdvice(state.herd, camp, state.date);
    expect(advice.shouldWarn).toBe(true);
    expect(formatMoveWarning(state.herd, camp, state.date).length).toBeGreaterThan(0);
  });

  it("raises condition after a move onto a rested camp with rain", () => {
    const state = createGame(8);
    dry(state);
    const fromId = state.herd.campId;
    const rested = state.camps.find((item) => item.id !== fromId && campHasWaterAccess(state, item));
    if (!rested) throw new Error("expected second camp");
    rested.restDays = CONFIG.pasture.fullRestDays;
    rested.standingDmKgPerHa = rested.peakDmKgPerHa * 0.9;
    state.herd.condition = 70;
    moveHerd(state, rested.id);
    finishTransit(state);
    for (let day = 0; day < 12; day += 1) stepDayWithRain(state, 8);
    expect(state.herd.condition).toBeGreaterThan(70);
  });
});

describe("local save", () => {
  it("round trips game state through JSON", () => {
    const state = createGame(3);
    stepDayWithRain(state, 0);
    state.herd.condition = 71.2;
    const loaded = parseSaved(serializeState(state));
    expect(loaded?.herd.condition).toBeCloseTo(71.2);
    expect(loaded?.date).toEqual(state.date);
    expect(loaded?.rngState).toBe(state.rngState);
  });

  it("rejects bad save JSON", () => {
    expect(parseSaved("{")).toBeNull();
    expect(parseSaved(JSON.stringify({ version: 2, state: {} }))).toBeNull();
  });
});

describe("calendar and rain", () => {
  it("rolls months and leap days", () => {
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(addDays({ year: 2027, month: 2, day: 28, hour: 0 }, 1)).toEqual({
      year: 2027,
      month: 3,
      day: 1,
      hour: 0,
    });
    expect(addDays({ year: 2028, month: 2, day: 28, hour: 0 }, 1)).toEqual({
      year: 2028,
      month: 2,
      day: 29,
      hour: 0,
    });
    expect(addDays({ year: 2026, month: 12, day: 31, hour: 0 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
      hour: 0,
    });
    expect(addDays({ year: 2026, month: 8, day: 1, hour: 0 }, 1)).toEqual({
      year: 2026,
      month: 8,
      day: 2,
      hour: 0,
    });
  });

  it("labels the dry season and the November to April rains", () => {
    expect(formatSeason({ year: 2026, month: 8, day: 1, hour: 0 })).toBe("Dry season");
    expect(formatSeason({ year: 2026, month: 11, day: 1, hour: 0 })).toBe("Rainy season");
    expect(formatSeason({ year: 2027, month: 4, day: 30, hour: 0 })).toBe("Rainy season");
    expect(formatSeason({ year: 2027, month: 5, day: 1, hour: 0 })).toBe("Dry season");
    expect(isRainyMonth(1)).toBe(true);
    expect(isRainyMonth(7)).toBe(false);
    expect(formatDate({ year: 2026, month: 8, day: 1, hour: 6 })).toBe("1 Aug 2026, 06:00");
    expect(formatMoney(250000)).toBe("N$250,000");
    expect(formatMoney(-19917)).toBe("-N$19,917");
  });

  it("resets season rain on 1 July and keeps June on the old total", () => {
    const state = createGame(4);
    if (state.clock) state.clock.settings.daysPerMonth = 30;
    state.date = { year: 2027, month: 6, day: 29, hour: 6 };
    state.seasonRainMm = 200;
    stepDayWithRain(state, 5);
    expect(state.seasonRainMm).toBeCloseTo(205);
    expect(state.date).toEqual({ year: 2027, month: 6, day: 30, hour: 6 });
    stepDayWithRain(state, 3);
    expect(state.seasonRainMm).toBeCloseTo(3);
    expect(state.date).toEqual({ year: 2027, month: 7, day: 1, hour: 6 });
  });

  it("puts most rain in November to April and none in July", () => {
    const totals = new Array<number>(13).fill(0);
    const rng = createRng(2026);
    for (let year = 2026; year < 2038; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        const days = daysInMonth(year, month);
        for (let day = 1; day <= days; day += 1) {
          totals[month] += dailyRainMm({ year, month, day, hour: 12 }, rng);
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
      const troughs = first.features.filter((feature) => feature.kind === "trough");
      expect(troughs.length).toBeGreaterThan(0);
      expect(troughs.length).toBeLessThan(first.camps.length);
      expect(first.farmWaterPoints?.length ?? 0).toBeGreaterThan(0);
      expect(first.camps.some((camp) => !campHasWaterAccess(first, camp))).toBe(true);
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
      expect(first.cashNad).toBeLessThanOrEqual(CONFIG.economy.startingCashNad);
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
    expect(state.herd.campId).toBe(firstId);
    expect(herdMoveActive(state.herd)).toBe(true);
    finishTransit(state);
    expect(state.herd.campId).toBe(other.id);
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

  it("never regrows grass in an occupied camp even with rain", () => {
    const state = createGame(61);
    const camp = findCamp(state, state.herd.campId);
    if (!camp) throw new Error("expected camp");
    camp.standingDmKgPerHa = camp.peakDmKgPerHa * 0.85;
    camp.soilMoistureMm = CONFIG.rain.moistureMmForFullGrowth;
    camp.restDays = CONFIG.pasture.fullRestDays;
    const before = camp.standingDmKgPerHa;
    for (let day = 0; day < 10; day += 1) stepDayWithRain(state, 12);
    expect(camp.standingDmKgPerHa).toBeLessThan(before);
  });

  it("regrows an empty camp when rain returns", () => {
    const state = createGame(62);
    const occupiedId = state.herd.campId;
    const empty = state.camps.find((item) => item.id !== occupiedId);
    if (!empty) throw new Error("expected second camp");
    empty.standingDmKgPerHa = empty.peakDmKgPerHa * 0.5;
    empty.soilMoistureMm = 0;
    empty.restDays = CONFIG.pasture.fullRestDays;
    const before = empty.standingDmKgPerHa;
    for (let day = 0; day < 15; day += 1) stepDayWithRain(state, 10);
    expect(empty.standingDmKgPerHa).toBeGreaterThan(before);
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
    const floor = residualDmKgPerHa(occupied.peakDmKgPerHa);
    let guard = 0;
    while (occupied.standingDmKgPerHa > floor + 0.01 && guard < 5000) {
      stepDayWithRain(state, 0);
      guard += 1;
    }
    expect(guard).toBeLessThan(5000);
    expect(occupied.standingDmKgPerHa).toBeLessThanOrEqual(floor + 5);
    const before = state.herd.condition;
    stepDayWithRain(state, 0);
    expect(state.herd.condition).toBeLessThan(before);
    expect(state.cashNad).toBeLessThanOrEqual(CONFIG.economy.startingCashNad);
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
