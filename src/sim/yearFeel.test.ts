import { describe, expect, it } from "vitest";
import { daysInGameMonth } from "./calendar";
import { ecologyScalePerGameDay } from "./clock";
import { CONFIG } from "./config";
import { hasBlockingCard } from "./story";
import { droughtWatchScore, tickDrought } from "./drought";
import { createGame, findCamp, stepDay, stepDayWithRain } from "./simulation";
import { parseLegacySaved } from "./stateMigrate";
import type { CampState, GameState, HerdState } from "./types";
import {
  daysSinceLastUsefulRain,
  formatRainChip,
  formatYearLine,
  mayForageBudget,
  mayForageCardBody,
  restRemainingAfterRain,
  tickYearFeel,
} from "./yearFeel";

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

function noDash(text: string): void {
  expect(text).not.toMatch(/\u2013|\u2014/);
}

describe("rain log", () => {
  it("records the storm stepDayWithRain applies, on the day it fell", () => {
    const state = createGame(9);
    const fell = { ...state.date };
    stepDayWithRain(state, 18);
    expect(state.rainLog).toEqual([{ year: fell.year, month: fell.month, day: fell.day, mm: 18 }]);
    expect(state.lastUsefulRain).toEqual({ year: fell.year, month: fell.month, day: fell.day });
    expect(state.todayRainMm).toBe(18);
    expect(state.seasonRainMm).toBeCloseTo(18);
    expect(daysSinceLastUsefulRain(state)).toBe(1);
    expect(state.date.day).toBe(fell.day + 1);
  });

  it("skips a dry day and keeps a light fall below the useful line", () => {
    const dry = createGame(10);
    stepDayWithRain(dry, 0);
    expect(dry.rainLog).toEqual([]);
    expect(dry.lastUsefulRain).toBeNull();

    const drizzle = createGame(10);
    const fell = { ...drizzle.date };
    stepDayWithRain(drizzle, 4);
    expect(drizzle.rainLog).toEqual([{ year: fell.year, month: fell.month, day: fell.day, mm: 4 }]);
    expect(drizzle.lastUsefulRain).toBeNull();
    expect(daysSinceLastUsefulRain(drizzle)).toBeNull();
  });

  it("says the dry season has had no rain, instead of a bare zero", () => {
    const state = createGame(21);
    expect(formatRainChip(state)).toBe("No rain");
    const line = formatYearLine(state);
    expect(line.startsWith("Late dry.")).toBe(true);
    expect(line).toContain("No rain since 1 Jul");
    expect(line).toContain("Season 0 mm");
    noDash(line);
    for (let day = 0; day < 6; day += 1) stepDay(state);
    if (state.seasonRainMm <= 0 && state.todayRainMm <= 0) {
      expect(formatRainChip(state)).toBe("No rain");
      expect(formatYearLine(state)).toContain("No rain since 1 Jul");
    } else {
      expect(state.rainLog?.length).toBeGreaterThan(0);
      expect(formatRainChip(state)).not.toBe("No rain");
    }
  });
});

describe("grass after rain", () => {
  it("grows an empty moist camp and does not grow the occupied camp", () => {
    const state = createGame(17);
    const occupied = findCamp(state, state.herd.campId);
    const empty = state.camps.find((item) => item.id !== state.herd.campId);
    if (!occupied || !empty) throw new Error("expected two camps");
    for (const item of state.camps) {
      item.soilMoistureMm = 18;
      item.standingDmKgPerHa = item.peakDmKgPerHa * 0.45;
      item.restDays = 14;
    }
    const emptyStart = empty.standingDmKgPerHa;
    const occupiedStart = occupied.standingDmKgPerHa;
    stepDayWithRain(state, 0);
    expect(empty.standingDmKgPerHa).toBeGreaterThan(emptyStart);
    expect(occupied.standingDmKgPerHa).toBeLessThanOrEqual(occupiedStart);
    expect(occupied.restDaysAfterRain).toBe(0);
  });

  it("does not regrow a rested camp when soil moisture is zero", () => {
    const state = createGame(16);
    const empty = state.camps.find((item) => item.id !== state.herd.campId);
    if (!empty) throw new Error("expected an empty camp");
    empty.standingDmKgPerHa = empty.peakDmKgPerHa * 0.5;
    empty.soilMoistureMm = 0;
    empty.restDays = CONFIG.pasture.fullRestDays;
    empty.restOwedAfterRain = true;
    empty.restDaysAfterRain = 20;
    const before = empty.standingDmKgPerHa;
    stepDayWithRain(state, 0);
    expect(empty.standingDmKgPerHa).toBeCloseTo(before);
    expect(restRemainingAfterRain(empty)).toBe(CONFIG.pasture.fullRestDays - 21);
  });

  it("starts the six week rest on a useful rain and holds it while the herd stays", () => {
    const state = createGame(18);
    const occupied = findCamp(state, state.herd.campId);
    const empty = state.camps.find((item) => item.id !== state.herd.campId);
    if (!occupied || !empty) throw new Error("expected two camps");
    stepDayWithRain(state, 8);
    expect(empty.restOwedAfterRain).toBe(true);
    expect(empty.restDaysAfterRain).toBe(1);
    expect(restRemainingAfterRain(empty)).toBe(41);
    expect(occupied.restOwedAfterRain).toBe(true);
    expect(occupied.restDaysAfterRain).toBe(0);
    expect(restRemainingAfterRain(occupied)).toBe(42);
  });
});

describe("ecology scale", () => {
  function growthAfter(daysPerMonth: number, seed: number): { emptyGain: number; season: number } {
    const state = createGame(seed);
    if (state.clock) state.clock.settings.daysPerMonth = daysPerMonth;
    const empty = state.camps.find((item) => item.id !== state.herd.campId);
    if (!empty) throw new Error("expected an empty camp");
    for (const item of state.camps) {
      item.soilMoistureMm = 0;
      item.standingDmKgPerHa = item.peakDmKgPerHa * 0.4;
      item.restDays = 10;
    }
    const start = empty.standingDmKgPerHa;
    stepDayWithRain(state, 8);
    return { emptyGain: empty.standingDmKgPerHa - start, season: state.seasonRainMm };
  }

  it("still grows faster at 3 game days a month than at the 28 day realism setting", () => {
    const fast = growthAfter(3, 41);
    const slow = growthAfter(28, 42);
    const augustDays = daysInGameMonth(28, 2026, 8);
    expect(ecologyScalePerGameDay(3, 30)).toBe(10);
    expect(augustDays).toBe(31);
    expect(ecologyScalePerGameDay(augustDays, 30)).toBeCloseTo(30 / 31);
    expect(fast.emptyGain).toBeGreaterThan(0);
    expect(slow.emptyGain).toBeGreaterThan(0);
    expect(fast.emptyGain).toBeGreaterThan(slow.emptyGain);
    expect(fast.season).toBeCloseTo(8);
    expect(slow.season).toBeCloseTo(8);
  });
});

describe("May forage budget", () => {
  it("matches the Kruger worked example of 331 days against a 270 day horizon", () => {
    const animals = herd();
    animals.headCount = 1;
    animals.averageLiveweightKg = 200_500;
    const budget = mayForageBudget([camp({ hectares: 5000, standingDmKgPerHa: 797 })], animals);
    expect(budget.consumableKg).toBeCloseTo(5000 * 797 * 0.5);
    expect(budget.demandKgPerDay).toBeCloseTo(200_500 * 0.03);
    expect(Math.round(budget.days)).toBe(331);
    expect(budget.horizonDays).toBe(270);
    expect(budget.short).toBe(false);
    const body = mayForageCardBody(budget);
    expect(body).toContain("331 days");
    expect(body).toContain("270 days");
    expect(body).toContain("2.19 to 2.34 percent");
    expect(body).not.toContain("destock");
    noDash(body);
  });

  it("marks a herd short of the same 270 day horizon and does not block the map", () => {
    const budget = mayForageBudget([camp({ hectares: 10, standingDmKgPerHa: 0 })], herd());
    expect(budget.short).toBe(true);
    expect(budget.horizonDays).toBe(270);
    const body = mayForageCardBody(budget);
    expect(body).toContain("destocking early");
    noDash(body);

    const state = createGame(19);
    state.date = { year: 2027, month: 5, day: 1, hour: 6 };
    stepDayWithRain(state, 0);
    const card = state.story?.pendingCards.find((item) => item.id.startsWith("may-forage"));
    expect(card?.kind).toBe("season");
    expect(card?.body).toContain("3 percent");
    expect(card?.body).toContain("2.19 to 2.34 percent");
    expect(hasBlockingCard(state)).toBe(false);
    if (card) noDash(`${card.title} ${card.body}`);
  });
});

describe("drought stays a letter before the choice", () => {
  it("warns in January and only then offers the February choice", () => {
    const state = createGame(23);
    state.date = { year: 2027, month: 1, day: 10, hour: 6 };
    state.seasonRainMm = 20;
    expect(droughtWatchScore(state)).toBeGreaterThan(CONFIG.story.droughtWatchThreshold);
    tickDrought(state);
    expect(state.story?.drought.warnedAt).not.toBeNull();
    expect(state.story?.drought.choicePending).toBeNull();
    expect(state.notifications?.log.some((item) => item.kind === "drought_watch")).toBe(true);
    expect(state.story?.pendingCards.some((item) => item.kind === "drought")).toBe(false);

    state.date = { year: 2027, month: 2, day: 10, hour: 6 };
    tickDrought(state);
    const card = state.story?.pendingCards.find((item) => item.kind === "drought");
    expect(state.story?.drought.choicePending).not.toBeNull();
    expect(card?.kind).toBe("drought");
    expect(hasBlockingCard(state)).toBe(false);
    expect(card?.body).toContain("days of grass");
    expect(card?.body).toContain("0.2 kg");
    expect(card?.body).toContain("0.03 kg");
    expect(card?.body).not.toContain("5.5");
    expect(card?.body).toContain("stand-in");
    if (card) noDash(`${card.title} ${card.body}`);
  });
});

describe("lick and rest letters", () => {
  it("does not nag about lick on the August start", () => {
    const state = createGame(24);
    state.date = { year: 2026, month: 8, day: 1, hour: 6 };
    tickYearFeel(state);
    expect(state.story?.pendingCards.some((item) => item.title === "Switch the lick")).toBe(false);
  });

  it("asks for a phosphate lick when the rains start and for urea when May begins", () => {
    const green = createGame(25);
    green.date = { year: 2026, month: 11, day: 2, hour: 6 };
    if (green.story?.costLevers) green.story.costLevers.lick = "winter_protein_urea";
    tickYearFeel(green);
    const greenCard = green.story?.pendingCards.find((item) => item.id.startsWith("lick-green"));
    expect(greenCard?.kind).toBe("season");
    expect(greenCard?.body).toContain("P6 or P12");
    tickYearFeel(green);
    expect(green.story?.pendingCards.filter((item) => item.id.startsWith("lick-green")).length).toBe(1);

    const dry = createGame(26);
    dry.date = { year: 2027, month: 5, day: 2, hour: 6 };
    tickYearFeel(dry);
    const dryCard = dry.story?.pendingCards.find((item) => item.id.startsWith("lick-dry"));
    expect(dryCard?.body).toContain("winter protein");
    expect(hasBlockingCard(dry)).toBe(false);
    if (greenCard && dryCard) noDash(`${greenCard.body} ${dryCard.body}`);
  });

  it("warns once when a urea trough is out in the rain", () => {
    const state = createGame(27);
    state.date = { year: 2026, month: 11, day: 4, hour: 6 };
    state.todayRainMm = 12;
    if (state.story?.costLevers) state.story.costLevers.lick = "winter_protein_urea";
    tickYearFeel(state);
    const card = state.story?.pendingCards.find((item) => item.id.startsWith("urea-rain"));
    expect(card?.kind).toBe("warning");
    expect(card?.body.toLowerCase()).toContain("poison");
    expect(hasBlockingCard(state)).toBe(false);
    tickYearFeel(state);
    expect(state.story?.pendingCards.filter((item) => item.id.startsWith("urea-rain")).length).toBe(1);
    if (card) noDash(`${card.title} ${card.body}`);
  });

  it("warns once to rest a camp that still has moisture after rain", () => {
    const state = createGame(28);
    const campHeld = findCamp(state, state.herd.campId);
    if (!campHeld) throw new Error("expected herd camp");
    campHeld.restOwedAfterRain = true;
    campHeld.restDaysAfterRain = 2;
    campHeld.soilMoistureMm = 16;
    state.todayRainMm = 0;
    tickYearFeel(state);
    const card = state.story?.pendingCards.find((item) => item.title === "Rest this camp");
    expect(card?.kind).toBe("warning");
    expect(card?.body).toContain("six weeks");
    expect(card?.body).toContain("if no rain fell");
    expect(hasBlockingCard(state)).toBe(false);
    tickYearFeel(state);
    expect(state.story?.pendingCards.filter((item) => item.title === "Rest this camp").length).toBe(1);

    const dryCamp = createGame(29);
    const held = findCamp(dryCamp, dryCamp.herd.campId);
    if (!held) throw new Error("expected herd camp");
    held.restOwedAfterRain = true;
    held.soilMoistureMm = 0;
    dryCamp.todayRainMm = 0;
    tickYearFeel(dryCamp);
    expect(dryCamp.story?.pendingCards.some((item) => item.title === "Rest this camp")).toBe(false);
    if (card) noDash(`${card.title} ${card.body}`);
  });
});

describe("save migration", () => {
  it("adds the rain log and rest clocks to an older save", () => {
    const state = createGame(12);
    const legacy = JSON.parse(JSON.stringify(state)) as GameState;
    delete legacy.rainLog;
    delete legacy.lastUsefulRain;
    for (const item of legacy.camps) {
      delete item.restDaysAfterRain;
      delete item.restOwedAfterRain;
    }
    if (legacy.story) delete legacy.story.restWarnCampId;
    legacy.stateVersion = 9;
    const loaded = parseLegacySaved(JSON.stringify({ version: 8, savedAt: "2026-08-01", state: legacy }));
    expect(loaded?.rainLog).toEqual([]);
    expect(loaded?.lastUsefulRain).toBeNull();
    expect(loaded?.camps.every((item) => item.restDaysAfterRain === 0 && item.restOwedAfterRain === false)).toBe(true);
    expect(loaded?.story?.restWarnCampId).toBeNull();
    expect(loaded?.stateVersion).toBe(10);
  });
});
