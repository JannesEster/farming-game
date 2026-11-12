import { daysInGameMonth } from "./calendar";
import type { GameState } from "./types";
import type { CalendarDate } from "./types";
import { CONFIG, type GameConfig } from "./config";

/** Real seconds for a full game day at 1x. */
export type DayLengthSeconds = 180 | 240 | 300;

export const DEFAULT_DAY_LENGTH_S: DayLengthSeconds = 240;

export type SimSpeedMultiplier = 0 | 1 | 2 | 3;

const DAYLIGHT_START = 6;
const DAYLIGHT_END = 18;

export type ClockSettings = {
  dayLengthSeconds: DayLengthSeconds;
  daysPerMonth: number;
  catchUpCapMs: number;
};

export const DEFAULT_CLOCK_SETTINGS: ClockSettings = {
  dayLengthSeconds: DEFAULT_DAY_LENGTH_S,
  daysPerMonth: 3,
  catchUpCapMs: 8000,
};

export type RanchClockState = {
  settings: ClockSettings;
  /** Unspent real ms toward the next game hour. */
  bankMs: number;
  /** Sim speed when not blocked (1, 2, or 3). */
  speed: SimSpeedMultiplier;
};

export function defaultRanchClock(): RanchClockState {
  return {
    settings: { ...DEFAULT_CLOCK_SETTINGS },
    bankMs: 0,
    speed: 1,
  };
}

export function isDaylightHour(hour: number): boolean {
  const h = ((hour % 24) + 24) % 24;
  return h >= DAYLIGHT_START && h < DAYLIGHT_END;
}

/** Real milliseconds for one game hour at 1x, given the current hour. */
export function realMsPerGameHour(hour: number, dayLengthSeconds: DayLengthSeconds): number {
  const nightSeconds = dayLengthSeconds / 3;
  const daylightSeconds = dayLengthSeconds - nightSeconds;
  const inDay = isDaylightHour(hour);
  const segmentHours = 12;
  const seconds = inDay ? daylightSeconds / segmentHours : nightSeconds / segmentHours;
  return seconds * 1000;
}

/** Canvas/CSS brightness while the sun is up (1 = full noon). */
export function sceneDaylightBlend(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h >= DAYLIGHT_START && h < DAYLIGHT_END) return 1;
  if (h >= DAYLIGHT_END && h < 19) return clamp01(1 - 0.82 * (h - DAYLIGHT_END));
  if (h >= 19 || h < 5) return 0.18;
  if (h >= 5 && h < DAYLIGHT_START) return clamp01(0.18 + 0.82 * (h - 5));
  return 1;
}

/** Blue-night overlay strength on the farm canvas (0 off, ~0.62 at midnight). */
export function nightOverlayAlpha(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  const peak = 0.62;
  if (h >= DAYLIGHT_START && h < DAYLIGHT_END) return 0;
  if (h >= DAYLIGHT_END && h < 19) return peak * (h - DAYLIGHT_END);
  if (h >= 19 || h < 5) return peak;
  if (h >= 5 && h < DAYLIGHT_START) return peak * (DAYLIGHT_START - h);
  return 0;
}

export function daylightBlend(hour: number): number {
  return sceneDaylightBlend(hour);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export type ClockTickResult = {
  bankMs: number;
  hoursAdvanced: number;
  daySteps: number;
  date: CalendarDate;
};

/**
 * Advance the ranch clock by real time. One full day rolls at hour 6 after hour 5.
 * Fixed tick separate from render: pass clamped deltaMs from the scene.
 */
export function tickRanchClock(
  date: CalendarDate,
  clock: RanchClockState,
  deltaMs: number,
  blocked: boolean,
): ClockTickResult {
  if (blocked || clock.speed === 0 || deltaMs <= 0) {
    return { bankMs: clock.bankMs, hoursAdvanced: 0, daySteps: 0, date };
  }
  const cap = clock.settings.catchUpCapMs;
  const scaled = Math.min(deltaMs, cap) * clock.speed;
  let bank = clock.bankMs + scaled;
  let current = { ...date };
  let hoursAdvanced = 0;
  let daySteps = 0;

  let guard = 0;
  while (guard < 48) {
    guard += 1;
    const msNeeded = realMsPerGameHour(current.hour, clock.settings.dayLengthSeconds);
    if (bank < msNeeded) break;
    bank -= msNeeded;
    hoursAdvanced += 1;
    const prevHour = current.hour;
    const nextHour = current.hour + 1;
    if (nextHour >= 24) {
      current = { ...current, hour: 0 };
    } else {
      current = { ...current, hour: nextHour };
    }
    const dawn =
      current.hour === DAYLIGHT_START &&
      (prevHour === 5 || (prevHour === 23 && clock.settings.daysPerMonth > 0));
    if (dawn && prevHour === 5) {
      daySteps += 1;
    }
  }

  return { bankMs: bank, hoursAdvanced, daySteps, date: current };
}

export function rollGameDay(
  date: CalendarDate,
  daysPerMonth: number,
  config: GameConfig = CONFIG,
): CalendarDate {
  const span = daysInGameMonth(daysPerMonth, date.year, date.month, config);
  let { year, month, day, hour } = date;
  day += 1;
  if (day > span) {
    day = 1;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return { year, month, day, hour };
}

export function rollGameDayFromState(state: GameState, config: GameConfig = CONFIG): CalendarDate {
  const requested = state.clock?.settings.daysPerMonth ?? config.calendar.daysPerMonthDefault;
  return rollGameDay(state.date, requested, config);
}

export function formatClockTime(date: CalendarDate): string {
  const h = ((date.hour % 24) + 24) % 24;
  const hh = String(h).padStart(2, "0");
  return `${hh}:00`;
}

export function ecologyScalePerGameDay(daysPerMonth: number, referenceDays = 30): number {
  const dpm = Math.max(1, daysPerMonth);
  return referenceDays / dpm;
}

export function gameDaysPerMonth(daysPerMonth: number): number {
  return Math.max(1, Math.min(28, Math.floor(daysPerMonth)));
}
