import { isRainyMonth } from "./calendar";
import { CONFIG, type GameConfig } from "./config";
import { grazeableFraction, grazingDaysLeft } from "./pasture";
import type { CalendarDate, CampState, HerdState } from "./types";

export type MoveAdvice = {
  shouldWarn: boolean;
  reason: "time" | "forage" | "both" | "none";
};

export function maxGrazingDaysInCamp(date: CalendarDate, config: GameConfig = CONFIG): number {
  return isRainyMonth(date.month, config)
    ? config.pasture.maxGrazingDaysRainySeason
    : config.pasture.maxGrazingDaysDrySeason;
}

export function moveAdvice(
  herd: HerdState,
  camp: CampState,
  date: CalendarDate,
  config: GameConfig = CONFIG,
): MoveAdvice {
  const maxDays = maxGrazingDaysInCamp(date, config);
  const timeDue = herd.daysInCamp >= maxDays;
  const fraction = grazeableFraction(camp, config);
  const daysLeft = grazingDaysLeft(camp, herd, config);
  const forageDue = fraction <= config.pasture.moveWarnGrazeableFraction || daysLeft < 2;
  if (timeDue && forageDue) return { shouldWarn: true, reason: "both" };
  if (timeDue) return { shouldWarn: true, reason: "time" };
  if (forageDue) return { shouldWarn: true, reason: "forage" };
  return { shouldWarn: false, reason: "none" };
}
