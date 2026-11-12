import { CONFIG, type GameConfig } from "./config";
import type { CalendarDate } from "./types";

const MONTH_DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return MONTH_DAYS[month] ?? 30;
}

/** Game days before the calendar rolls to the next month (FS style setting). */
export function gameDaysInMonth(state: import("./types").GameState, config: GameConfig = CONFIG): number {
  const dpm = state.clock?.settings.daysPerMonth ?? config.calendar.daysPerMonthDefault;
  const cap =
    dpm > config.calendar.daysPerMonthMax
      ? config.calendar.daysPerMonthRealism
      : config.calendar.daysPerMonthMax;
  return Math.max(config.calendar.daysPerMonthMin, Math.min(cap, Math.floor(dpm)));
}

export function isLastGameDayOfMonth(state: import("./types").GameState, config: GameConfig = CONFIG): boolean {
  return state.date.day >= gameDaysInMonth(state, config);
}

export function addHours(date: CalendarDate, hours: number): CalendarDate {
  if (hours <= 0) return date;
  let { year, month, day, hour } = date;
  let carry = hour + hours;
  while (carry >= 24) {
    const next = addDays({ year, month, day, hour: 0 }, 1);
    year = next.year;
    month = next.month;
    day = next.day;
    carry -= 24;
  }
  return { year, month, day, hour: carry };
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  let { year, month, day, hour } = date;
  let left = days;
  while (left > 0) {
    const span = daysInMonth(year, month) - day;
    if (left <= span) {
      day += left;
      left = 0;
    } else {
      left -= span + 1;
      day = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }
  return { year, month, day, hour };
}

export function isSeasonStart(date: CalendarDate, config: GameConfig = CONFIG): boolean {
  return date.month === config.calendar.seasonStartMonth && date.day === 1;
}

export function isRainyMonth(month: number, config: GameConfig = CONFIG): boolean {
  return config.calendar.rainyMonths.includes(month);
}
