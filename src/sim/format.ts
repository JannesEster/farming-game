import { CONFIG, type GameConfig } from "./config";
import { isRainyMonth } from "./calendar";
import { moveAdvice, type MoveAdvice } from "./grazing";
import type { CalendarDate, CampState, HerdState } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const COPY = {
  hintStart: "Tap the herd, then tap a camp to move it.",
  hintSelected: "Tap a camp to move the herd.",
  hintMoved: (name: string) => `Moved to ${name}. Tap another camp to move again.`,
  hintSame: "The herd is already in this camp.",
  hintMoving: "The herd is on the road. Wait until they reach the camp.",
  hintHomestead: "The homestead is not a grazing camp.",
  hintOutside: "That is outside the farm fence.",
  hintNeedHerd: "Tap the herd first.",
  hintNewFarm: "Starting a new farm. Your last save is cleared.",
  newFarmLabel: "New farm",
  cashTitle: "Operating cash. Sales are not in this prototype, so it stays put.",
  rainTitle: "Rain since 1 July, the start of the season year.",
  moveRecovery:
    "Move to a rested camp. Grass and condition recover over the weeks that camp rests and when rain returns.",
};

export function formatDate(date: CalendarDate): string {
  const month = MONTHS[date.month - 1] ?? "";
  const hour = date.hour ?? 0;
  const hh = String(Math.floor(hour)).padStart(2, "0");
  return `${date.day} ${month} ${date.year}, ${hh}:00`;
}

export function formatSeason(date: CalendarDate, config: GameConfig = CONFIG): string {
  return isRainyMonth(date.month, config) ? "Rainy season" : "Dry season";
}

export function formatMoney(amount: number): string {
  const rounded = Math.round(amount);
  const body = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = rounded < 0 ? "-" : "";
  return `N$ ${sign}${body}`;
}

export function formatRain(mm: number): string {
  return `${Math.round(mm)} mm`;
}

export function formatHead(count: number): string {
  return `${count} head`;
}

export function formatCampLine(name: string, hectares: number): string {
  return `${name}, ${Math.round(hectares)} ha`;
}

export function formatDaysInCamp(days: number): string {
  const unit = days === 1 ? "day" : "days";
  return `${days} ${unit} in this camp`;
}

export function formatGrassLeft(daysLeft: number, fraction: number): string {
  if (fraction <= 0 || daysLeft <= 0) return "No grazable grass left.";
  const days = Math.max(0, Math.round(daysLeft));
  const unit = days === 1 ? "day" : "days";
  return `About ${days} ${unit} of grass left.`;
}

export function formatFeedStatus(daysLeft: number): string {
  if (daysLeft < 1) return "Condition is falling.";
  return "";
}

export function formatMoveWarning(
  herd: HerdState,
  camp: CampState,
  date: CalendarDate,
  config: GameConfig = CONFIG,
): string {
  const advice = moveAdvice(herd, camp, date, config);
  if (!advice.shouldWarn) return "";
  if (advice.reason === "time") {
    return "Time to move. This camp has had its graze spell.";
  }
  if (advice.reason === "forage") {
    return "Time to move. Grass here is running low.";
  }
  return "Time to move. This camp is worn and due for rest.";
}

export function formatCampBadge(advice: MoveAdvice, herdCamp: boolean): string {
  if (!herdCamp || !advice.shouldWarn) return "";
  return "Move";
}

export function formatCondition(condition: number): string {
  return `${Math.round(condition)}`;
}

export function formatGrassPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
