import { CONFIG, type GameConfig } from "./config";
import { daysBetween, isRainyMonth, seasonOpenedOn } from "./calendar";
import { moveAdvice } from "./grazing";
import { consumableDmKgInCamp, dailyDemandKg, grazeableFraction, grazingDaysLeft } from "./pasture";
import type { CalendarDate, CampState, GameState, HerdState, RainLogEntry } from "./types";
import type { UiCard } from "./storyTypes";

/**
 * Labels over the existing rain table (November to April wet, July season start).
 * Colour does not use these. Standing grass and soil moisture do.
 */
export type SeasonStageId = "early_dry" | "late_dry" | "first_storms" | "mid_rains" | "late_rains";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function seasonStage(date: CalendarDate): { id: SeasonStageId; label: string } {
  const month = date.month;
  if (month === 11) return { id: "first_storms", label: "First storms" };
  if (month === 12 || month === 1 || month === 2) return { id: "mid_rains", label: "Mid rains" };
  if (month === 3 || month === 4) return { id: "late_rains", label: "Late rains" };
  if (month === 5 || month === 6 || month === 7) return { id: "early_dry", label: "Early dry" };
  return { id: "late_dry", label: "Late dry" };
}

export function ensureYearFeel(state: GameState): void {
  if (!state.rainLog) state.rainLog = [];
  if (state.lastUsefulRain === undefined) state.lastUsefulRain = null;
  for (const camp of state.camps) {
    if (camp.restDaysAfterRain === undefined) camp.restDaysAfterRain = 0;
    if (camp.restOwedAfterRain === undefined) camp.restOwedAfterRain = false;
  }
  if (state.story && state.story.restWarnCampId === undefined) state.story.restWarnCampId = null;
}

export function shortDate(date: { month: number; day: number }): string {
  const month = MONTHS[date.month - 1] ?? "";
  return `${date.day} ${month}`;
}

/** Record the storm that stepDayWithRain is about to apply. Date is the day it fell. */
export function recordDayRain(
  state: GameState,
  fellOn: CalendarDate,
  mm: number,
  config: GameConfig = CONFIG,
): void {
  ensureYearFeel(state);
  if (mm > 0) {
    const entry: RainLogEntry = { year: fellOn.year, month: fellOn.month, day: fellOn.day, mm };
    state.rainLog!.push(entry);
    const cap = Math.max(1, config.rain.rainLogCap);
    while (state.rainLog!.length > cap) state.rainLog!.shift();
  }
  if (mm >= config.rain.usefulRainMm) {
    state.lastUsefulRain = { year: fellOn.year, month: fellOn.month, day: fellOn.day };
  }
}

export function daysSinceLastUsefulRain(state: GameState): number | null {
  const last = state.lastUsefulRain;
  if (!last) return null;
  return daysBetween({ year: last.year, month: last.month, day: last.day, hour: 0 }, state.date);
}

/**
 * Empty days since the last useful rain, while the camp still owes the NAU rest.
 * Returns null when no useful rain has started the clock.
 */
export function restRemainingAfterRain(camp: CampState, config: GameConfig = CONFIG): number | null {
  const done = camp.restDaysAfterRain ?? 0;
  const owed = Boolean(camp.restOwedAfterRain);
  if (!owed && done <= 0) return null;
  return Math.max(0, config.pasture.fullRestDays - done);
}

export function applyRestAfterRain(
  camp: CampState,
  occupied: boolean,
  usefulRain: boolean,
  config: GameConfig = CONFIG,
): void {
  if (usefulRain) camp.restOwedAfterRain = true;
  if (occupied) {
    camp.restDaysAfterRain = 0;
    return;
  }
  if (!camp.restOwedAfterRain) return;
  camp.restDaysAfterRain = usefulRain ? 1 : (camp.restDaysAfterRain ?? 0) + 1;
  if ((camp.restDaysAfterRain ?? 0) >= config.pasture.fullRestDays) camp.restOwedAfterRain = false;
}

export type ForageBudget = {
  standingKg: number;
  consumableKg: number;
  demandKgPerDay: number;
  days: number;
  horizonDays: number;
  short: boolean;
};

/** Kruger May budget: 50% of standing DM, 3% of liveweight a day, against the 270 day horizon. */
export function mayForageBudget(
  camps: CampState[],
  herd: HerdState,
  config: GameConfig = CONFIG,
): ForageBudget {
  const standingKg = camps.reduce((sum, camp) => sum + camp.standingDmKgPerHa * camp.hectares, 0);
  const consumableKg = camps.reduce((sum, camp) => sum + consumableDmKgInCamp(camp, config), 0);
  const demandKgPerDay = dailyDemandKg(herd, config);
  const days = demandKgPerDay <= 0 ? Number.POSITIVE_INFINITY : consumableKg / demandKgPerDay;
  const horizonDays = config.pasture.forageBudgetHorizonDays;
  return {
    standingKg,
    consumableKg,
    demandKgPerDay,
    days,
    horizonDays,
    short: days < horizonDays,
  };
}

export function mayForageCardBody(budget: ForageBudget): string {
  const days = Math.round(budget.days);
  const horizon = budget.horizonDays;
  const lead = budget.short
    ? `About ${days} days of consumable grass, short of ${horizon} days to about February. Consider destocking early.`
    : `About ${days} days of consumable grass, enough for the ${horizon} days to about February.`;
  return `${lead} This count uses half of the standing grass and 3 percent of liveweight a day. 3 percent is conservative for cattle. The ministry guide is about 2.19 to 2.34 percent. Close this and keep playing.`;
}

export function greenerCampLines(state: GameState, config: GameConfig = CONFIG, limit = 3): string[] {
  return state.camps
    .filter((camp) => camp.id !== state.herd.campId)
    .map((camp) => ({ camp, days: grazingDaysLeft(camp, state.herd, config) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, limit)
    .map(({ camp, days }) => {
      const rounded = Number.isFinite(days) ? Math.max(0, Math.round(days)) : 0;
      return `${camp.name} about ${rounded} days of grass`;
    });
}

export function droughtChoiceBody(state: GameState, config: GameConfig = CONFIG): string {
  const camps = greenerCampLines(state, config);
  const cover = camps.length
    ? `Rested cover: ${camps.join("; ")}.`
    : "No other camp has a grass count yet.";
  const rain = Math.round(state.seasonRainMm);
  return `Season rain is ${rain} mm. Choose in Sell / market: sell some tollies, buy boskos with camelthorn pods, or move the herd to a camp that still has grass. ${cover} Boskos stays at ${config.story.droughtBoskosKgPerHeadDay} kg per head per day and camelthorn pods at ${config.story.droughtCamelthornPodsKgPerHeadDay} kg per head per day. The boskos cash figure is a stand-in, not a farm invoice.`;
}

export function moveHerdMessage(state: GameState, config: GameConfig = CONFIG): string {
  const best = greenerCampLines(state, config, 2);
  const where = best.length ? ` Best cover now: ${best.join("; ")}.` : "";
  return `Move the herd onto rested grass.${where} Empty camps recover when rain returns.`;
}

export type CampDuty = { resting: number; due: number };

export function campDutyCounts(state: GameState, config: GameConfig = CONFIG): CampDuty {
  let resting = 0;
  let due = 0;
  for (const camp of state.camps) {
    if (camp.id !== state.herd.campId && camp.restDays > 0) resting += 1;
    if (camp.id !== state.herd.campId) continue;
    const advice = moveAdvice(state.herd, camp, state.date, config);
    const owed = Boolean(camp.restOwedAfterRain);
    if (advice.shouldWarn || owed) due += 1;
  }
  return { resting, due };
}

export function formatCampDuty(state: GameState, config: GameConfig = CONFIG): string {
  const { resting, due } = campDutyCounts(state, config);
  const restLabel = resting === 1 ? "1 camp resting" : `${resting} camps resting`;
  const dueLabel = due === 0 ? "none due to move" : due === 1 ? "1 due to move" : `${due} due to move`;
  return `${restLabel}, ${dueLabel}.`;
}

export function formatRainStatus(state: GameState, config: GameConfig = CONFIG): string {
  const season = Math.round(state.seasonRainMm);
  if (state.todayRainMm > 0) {
    return `Storm today, ${Math.round(state.todayRainMm)} mm. Season ${season} mm.`;
  }
  const log = state.rainLog ?? [];
  const last = log[log.length - 1];
  if (!last) {
    const opened = seasonOpenedOn(state.date, config);
    return `No rain since ${shortDate(opened)}. Season ${season} mm.`;
  }
  return `Last rain ${Math.round(last.mm)} mm on ${shortDate(last)}. Season ${season} mm.`;
}

export function formatRainChip(state: GameState): string {
  if ((state.seasonRainMm ?? 0) <= 0 && (state.todayRainMm ?? 0) <= 0) return "No rain";
  if (state.todayRainMm > 0) return `${Math.round(state.todayRainMm)} mm`;
  return `${Math.round(state.seasonRainMm)} mm`;
}

export function formatYearLine(state: GameState, config: GameConfig = CONFIG): string {
  return `${seasonStage(state.date).label}. ${formatRainStatus(state, config)} ${formatCampDuty(state, config)}`;
}

export type RainBookModel = { headline: string; lines: string[] };

export function rainBookModel(state: GameState, config: GameConfig = CONFIG): RainBookModel {
  const log = [...(state.rainLog ?? [])].reverse();
  if (log.length === 0) {
    const opened = seasonOpenedOn(state.date, config);
    return {
      headline: `No reading yet. No rain since ${shortDate(opened)}.`,
      lines: [],
    };
  }
  const latest = log[0];
  const days = daysBetween({ year: latest.year, month: latest.month, day: latest.day, hour: 0 }, state.date);
  const headline =
    days === 1
      ? `Yesterday: ${Math.round(latest.mm)} mm.`
      : `Last reading: ${Math.round(latest.mm)} mm on ${shortDate(latest)}.`;
  return {
    headline,
    lines: log.map((entry) => `${shortDate(entry)} ${entry.year}: ${Math.round(entry.mm)} mm`),
  };
}

function seasonYear(date: CalendarDate, config: GameConfig): number {
  return date.month >= config.calendar.seasonStartMonth ? date.year : date.year - 1;
}

function fired(state: GameState, id: string): boolean {
  return Boolean(state.story?.seasonEventsFired.includes(id));
}

function markFired(state: GameState, id: string): void {
  state.story?.seasonEventsFired.push(id);
}

function pushCard(state: GameState, card: UiCard): void {
  state.story?.pendingCards.push(card);
}

export function restWarningBody(camp: CampState, config: GameConfig = CONFIG): string {
  const left = restRemainingAfterRain(camp, config);
  const days = left === null ? config.pasture.fullRestDays : left;
  return `${camp.name} should rest after rain. The NAU rest is six weeks, and grass does not grow back while the herd stays in the camp. Six weeks of rest still does nothing if no rain fell. About ${days} days of that rest are still left.`;
}

export function veldReadsGreen(state: GameState, config: GameConfig = CONFIG): boolean {
  const empty = state.camps.filter((camp) => camp.id !== state.herd.campId);
  const list = empty.length > 0 ? empty : state.camps;
  if (list.length === 0) return false;
  let cover = 0;
  let wet = 0;
  for (const camp of list) {
    cover += grazeableFraction(camp, config);
    wet += Math.max(0, Math.min(1, camp.soilMoistureMm / config.rain.moistureMmForFullGrowth));
  }
  cover /= list.length;
  wet /= list.length;
  return cover >= config.view.grassColourMidpoint && wet >= config.rain.greenVeldMoistureFraction;
}

export function lickGreenBody(): string {
  return "The veld is turning green. Switch the lick to summer phosphate, P6 or P12. Leave the urea lick for the dry season.";
}

export function lickDryBody(): string {
  return "The dry season is starting. Switch to the winter protein lick. Keep urea out of a wet trough.";
}

export function ureaRainBody(): string {
  return "Urea in the rain. A wet urea trough can poison cattle. Cover the trough or switch to a phosphate lick until the ground dries.";
}

function queueMayCard(state: GameState, config: GameConfig): void {
  const story = state.story;
  if (!story || state.date.month !== 5) return;
  const id = `may-forage-${state.date.year}`;
  if (fired(state, id)) return;
  markFired(state, id);
  const budget = mayForageBudget(state.camps, state.herd, config);
  pushCard(state, {
    id,
    kind: "season",
    title: "May forage budget",
    body: mayForageCardBody(budget),
    priority: 3,
  });
}

function queueRestWarning(state: GameState, config: GameConfig): void {
  const story = state.story;
  if (!story) return;
  const camp = state.camps.find((item) => item.id === state.herd.campId);
  if (!camp || !camp.restOwedAfterRain) {
    if (story.restWarnCampId !== state.herd.campId) story.restWarnCampId = null;
    return;
  }
  const moist = camp.soilMoistureMm > 0 || state.todayRainMm >= config.rain.usefulRainMm;
  if (!moist) return;
  if (story.restWarnCampId === camp.id) return;
  story.restWarnCampId = camp.id;
  pushCard(state, {
    id: `rest-after-rain-${state.date.year}-${state.date.month}-${state.date.day}-${camp.id}`,
    kind: "warning",
    title: "Rest this camp",
    body: restWarningBody(camp, config),
    priority: 3,
  });
}

function queueLickNudges(state: GameState, config: GameConfig): void {
  const story = state.story;
  const lick = story?.costLevers?.lick;
  if (!story || !lick) return;
  const year = seasonYear(state.date, config);
  const winter = lick === "winter_protein_urea";
  const summer = lick.startsWith("summer");
  const greenId = `lick-green-${year}`;
  const dryId = `lick-dry-${year}`;
  const turningGreen = isRainyMonth(state.date.month, config) || veldReadsGreen(state, config);
  if (turningGreen && winter && !fired(state, greenId)) {
    markFired(state, greenId);
    pushCard(state, {
      id: greenId,
      kind: "season",
      title: "Switch the lick",
      body: lickGreenBody(),
      priority: 2,
    });
  }
  const dryBegins = state.date.month === 5;
  if (dryBegins && summer && !fired(state, dryId)) {
    markFired(state, dryId);
    pushCard(state, {
      id: dryId,
      kind: "season",
      title: "Switch the lick",
      body: lickDryBody(),
      priority: 2,
    });
  }
}

function queueUreaWarning(state: GameState): void {
  const lick = state.story?.costLevers?.lick;
  if (lick !== "winter_protein_urea") return;
  if (state.todayRainMm <= 0) return;
  const bucket = `${state.date.year}-${state.date.month}`;
  const id = `urea-rain-${bucket}`;
  if (fired(state, id)) return;
  markFired(state, id);
  pushCard(state, {
    id,
    kind: "warning",
    title: "Urea in the rain",
    body: ureaRainBody(),
    priority: 4,
  });
}

/** Letters for May, rest after rain, lick timing, and wet urea. None of these block the map. */
export function tickYearFeel(state: GameState, config: GameConfig = CONFIG): void {
  if (!state.story) return;
  ensureYearFeel(state);
  queueMayCard(state, config);
  queueRestWarning(state, config);
  queueLickNudges(state, config);
  queueUreaWarning(state);
}
