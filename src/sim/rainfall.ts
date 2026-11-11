import { CONFIG, type GameConfig } from "./config";
import { daysInMonth } from "./calendar";
import type { Rng } from "./rng";
import type { CalendarDate } from "./types";

/**
 * One daily rainfall draw.
 * Dry months return 0. A wet day is an exponential storm whose mean,
 * times the chance of rain, matches that month's average.
 */
export function dailyRainMm(date: CalendarDate, rng: Rng, config: GameConfig = CONFIG): number {
  const mean = config.rain.monthlyMeanMm[date.month] ?? 0;
  const chance = config.rain.monthlyRainDayChance[date.month] ?? 0;
  if (mean <= 0 || chance <= 0) {
    rng.next();
    return 0;
  }
  if (rng.next() > chance) return 0;
  const meanStorm = mean / daysInMonth(date.year, date.month) / chance;
  const unit = Math.min(rng.next(), 1 - 1e-12);
  const raw = -meanStorm * Math.log(1 - unit);
  return Math.min(config.rain.maxDailyRainMm, raw);
}
