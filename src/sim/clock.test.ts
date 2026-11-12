import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLOCK_SETTINGS,
  daylightBlend,
  defaultRanchClock,
  ecologyScalePerGameDay,
  realMsPerGameHour,
  tickRanchClock,
} from "./clock";
import type { CalendarDate } from "./types";

const dawn: CalendarDate = { year: 2026, month: 8, day: 1, hour: 6 };

describe("ranch clock", () => {
  it("uses 160s daylight and 80s night at 4 minute days", () => {
    expect(realMsPerGameHour(8, 240)).toBeCloseTo(13333, 0);
    expect(realMsPerGameHour(22, 240)).toBeCloseTo(6667, 0);
  });

  it("advances hours and rolls a day at dawn", () => {
    const clock = defaultRanchClock();
    clock.settings = { ...DEFAULT_CLOCK_SETTINGS };
    let date: CalendarDate = { ...dawn, hour: 5 };
    let steps = 0;
    for (let i = 0; i < 500; i += 1) {
      const tick = tickRanchClock(date, clock, 5000, false);
      date = tick.date;
      clock.bankMs = tick.bankMs;
      steps += tick.daySteps;
      if (steps > 0) break;
    }
    expect(steps).toBe(1);
    expect(date.hour).toBe(6);
  });

  it("scales ecology by days per month", () => {
    expect(ecologyScalePerGameDay(3, 30)).toBe(10);
    expect(ecologyScalePerGameDay(1, 30)).toBe(30);
  });

  it("dims at night", () => {
    expect(daylightBlend(12)).toBe(1);
    expect(daylightBlend(2)).toBeLessThan(0.2);
  });
});
