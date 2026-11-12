import type { SpeedMode } from "./hud";
import type { SimSpeedMultiplier } from "../sim/clock";

export function speedMultiplier(mode: SpeedMode): SimSpeedMultiplier {
  if (mode === "pause") return 0;
  if (mode === "x3") return 3;
  if (mode === "x2") return 2;
  return 1;
}

/** Reasons the farm clock must not advance. Closing the overlay resumes the previous speed. */
export type SimBlockers = {
  tutorialHolding: boolean;
  eventCard: boolean;
  yearEnd: boolean;
  gameOver: boolean;
  market: boolean;
  startOrPicker: boolean;
};

export function isSimBlocked(blockers: SimBlockers): boolean {
  return (
    blockers.tutorialHolding ||
    blockers.eventCard ||
    blockers.yearEnd ||
    blockers.gameOver ||
    blockers.market ||
    blockers.startOrPicker
  );
}

/**
 * How many game days this frame may apply.
 * A blocker clears the bank so dismissed popups do not fast-forward the missed time.
 */
export function dayStepsThisFrame(args: {
  blocked: boolean;
  speed: SpeedMode;
  bankMs: number;
  deltaMs: number;
  intervalMs: number | null;
  maxFrameMs: number;
  maxDays: number;
}): { bankMs: number; days: number } {
  if (args.blocked || args.speed === "pause" || args.intervalMs === null || args.intervalMs <= 0) {
    return { bankMs: 0, days: 0 };
  }
  let bank = args.bankMs + Math.min(Math.max(0, args.deltaMs), args.maxFrameMs);
  let days = 0;
  while (bank >= args.intervalMs && days < args.maxDays) {
    bank -= args.intervalMs;
    days += 1;
  }
  return { bankMs: bank, days };
}

export function transitMayAdvance(blocked: boolean, speed: SpeedMode): boolean {
  return !blocked && speedMultiplier(speed) > 0;
}

/** Fixed sim tick: bank real time until one ranch-clock hour or day step is due. */
export function ranchClockStep(args: {
  blocked: boolean;
  speed: SpeedMode;
  bankMs: number;
  deltaMs: number;
  catchUpCapMs: number;
  tickMs: number;
}): { bankMs: number; spendMs: number } {
  if (args.blocked || speedMultiplier(args.speed) === 0) {
    return { bankMs: 0, spendMs: 0 };
  }
  const mult = speedMultiplier(args.speed);
  const bank = args.bankMs + Math.min(Math.max(0, args.deltaMs), args.catchUpCapMs) * mult;
  const spendMs = bank >= args.tickMs ? args.tickMs : 0;
  return { bankMs: spendMs > 0 ? bank - spendMs : bank, spendMs };
}

export function elementVisible(root: ParentNode, id: string): boolean {
  const el = root.querySelector<HTMLElement>(`#${id}`);
  return Boolean(el && !el.hidden);
}
