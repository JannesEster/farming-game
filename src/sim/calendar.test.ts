import { describe, expect, it } from "vitest";
import { addHours } from "./calendar";
import { walkGameHours } from "./transit";

describe("addHours", () => {
  it("accumulates fractional hours over many small ticks", () => {
    let date = { year: 2026, month: 8, day: 1, hour: 6 };
    for (let i = 0; i < 100; i += 1) {
      date = addHours(date, 0.02);
    }
    expect(date.hour).toBeCloseTo(8, 10);
    expect(date.day).toBe(1);
  });

  it("does not roll the day until hours cross midnight", () => {
    let date = { year: 2026, month: 8, day: 1, hour: 23.5 };
    date = addHours(date, 0.4);
    expect(date.day).toBe(1);
    expect(date.hour).toBeCloseTo(23.9, 8);
    date = addHours(date, 0.2);
    expect(date.day).toBe(2);
    expect(date.hour).toBeCloseTo(0.1, 8);
  });

  it("matches a 4.54 km walk at 3.5 km/h from 06:00", () => {
    const hours = walkGameHours(4.54);
    expect(hours).toBeCloseTo(4.54 / 3.5, 2);
    const after = addHours({ year: 2026, month: 8, day: 1, hour: 6 }, hours);
    expect(Math.floor(after.hour)).toBe(7);
    expect(after.day).toBe(1);
  });
});
