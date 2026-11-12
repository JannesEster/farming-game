import { moveCampAnimals } from "./animals";
import { CONFIG, type GameConfig } from "./config";
import { DEFAULT_DAY_LENGTH_S, fractionalHour, realMsPerGameHour, type DayLengthSeconds } from "./clock";
import { mainHouseTile, workerHouseForFarmhand } from "./housing";
import { pathLengthKm, planHerdPath, planPersonPath, pointOnPath } from "./path";
import type { GameState, HerdState, TilePoint } from "./types";

export type TransitSpeed = "pause" | "x1" | "x2" | "x3";

function transitSpeedMult(mode: TransitSpeed): number {
  if (mode === "pause") return 0;
  if (mode === "x3") return 3;
  if (mode === "x2") return 2;
  return 1;
}

export function herdInTransit(herd: HerdState): boolean {
  const transit = herd.transit;
  if (!transit) return false;
  if (transit.phase === "approach") return false;
  return transit.progress < 1;
}

export function herdMoveActive(herd: HerdState): boolean {
  const transit = herd.transit;
  if (!transit) return false;
  if (transit.phase === "approach") return (transit.approachProgress ?? 0) < 1;
  return transit.progress < 1;
}

export function walkGameHours(distanceKm: number, config: GameConfig = CONFIG): number {
  const speed = config.transit.cattleWalkKmH;
  if (speed <= 0) return 0;
  return Math.max(0, distanceKm / speed);
}

/** Game hours implied by a real-time slice, on the same clock as tickRanchClock. */
export function gameHoursElapsed(
  hour: number,
  deltaMs: number,
  mode: TransitSpeed,
  pace: number,
  config: GameConfig = CONFIG,
): number {
  if (mode === "pause" || deltaMs <= 0 || pace <= 0) return 0;
  const mult = transitSpeedMult(mode);
  if (mult <= 0) return 0;
  const capped = Math.min(deltaMs, config.time.catchUpCapMs);
  const dayLength = config.time.dayLengthSecondsDefault as DayLengthSeconds;
  const msPerHour = realMsPerGameHour(hour, dayLength) / pace;
  if (msPerHour <= 0) return 0;
  return (capped * mult) / msPerHour;
}

export function fractionalRanchHour(state: GameState, config: GameConfig = CONFIG): number {
  const dayLength = (state.clock?.settings.dayLengthSeconds ?? config.time.dayLengthSecondsDefault) as DayLengthSeconds;
  return fractionalHour(state.date.hour, state.clock?.bankMs ?? 0, dayLength ?? DEFAULT_DAY_LENGTH_S);
}

/**
 * The only place herd walk progress advances. Distance is cattle speed times game hours.
 * Pause does nothing. The ranch clock itself is not touched here.
 */
export function tickTransitRealtime(
  state: GameState,
  deltaMs: number,
  mode: TransitSpeed,
  config: GameConfig = CONFIG,
): void {
  const transit = state.herd.transit;
  if (!transit || transit.phase === "approach" || mode === "pause") return;
  const hours = gameHoursElapsed(state.date.hour, deltaMs, mode, config.transit.driveClockFactor, config);
  const km = hours * config.transit.cattleWalkKmH;
  const distance = Math.max(transit.distanceKm, config.transit.minDistanceKm);
  transit.progress = Math.min(1, transit.progress + km / distance);
  if (transit.progress >= 1) finishTransit(state);
}

function homeFor(state: GameState, who: "farmer" | "piet" | undefined): TilePoint {
  if (who === "piet") return workerHouseForFarmhand(state) ?? mainHouseTile(state);
  return mainHouseTile(state);
}

function presenceOf(state: GameState, who: "farmer" | "piet" | undefined) {
  if (who === "piet") return state.story?.farmhandPresence ?? null;
  return state.story?.farmerPresence ?? null;
}

export function finishTransit(state: GameState): void {
  const transit = state.herd.transit;
  if (!transit) return;
  const dest = state.camps.find((c) => c.id === transit.toCampId);
  const fromCampId = state.herd.campId;
  state.herd.campId = transit.toCampId;
  moveCampAnimals(state, fromCampId, transit.toCampId);
  state.herd.daysInCamp = 0;
  state.herd.transit = null;
  if (dest) dest.restDays = 0;
  const story = state.story;
  if (story) {
    story.grazeIn = { campId: transit.toCampId, startedHour: fractionalRanchHour(state) };
    const presence = presenceOf(state, transit.herder);
    const home = homeFor(state, transit.herder);
    if (presence && transit.herder) {
      const path = planPersonPath(state, { x: presence.tileX, y: presence.tileY }, home);
      story.returnWalk = {
        path,
        progress: 0,
        distanceKm: Math.max(pathLengthKm(path), 0.01),
        who: transit.herder,
      };
      presence.onHerdingDuty = true;
      presence.walkProgress = 0.4;
      presence.activityLabel = "Walking home";
      presence.atHome = false;
    }
  }
}

/** A save that froze at dusk: the herd is put in the destination camp and the clock is a whole hour. */
export function repairStuckTransit(state: GameState): void {
  if (!Number.isInteger(state.date.hour)) {
    state.date = { ...state.date, hour: Math.min(23, Math.max(0, Math.round(state.date.hour))) };
  }
  const transit = state.herd.transit;
  if (!transit) return;
  const hour = ((state.date.hour % 24) + 24) % 24;
  if (hour >= 6 && hour < 18) return;
  finishTransit(state);
  const story = state.story;
  if (story?.returnWalk) story.returnWalk = null;
  const farmer = story?.farmerPresence;
  if (farmer) {
    const home = mainHouseTile(state);
    farmer.tileX = home.x;
    farmer.tileY = home.y;
    farmer.targetTileX = home.x;
    farmer.targetTileY = home.y;
    farmer.walkProgress = 1;
    farmer.onHerdingDuty = false;
    farmer.atHome = true;
    farmer.activityLabel = "At the main house";
  }
}

export function startHerdMove(state: GameState, toCampId: number, config: GameConfig = CONFIG): void {
  const path = planHerdPath(state, state.herd.campId, toCampId);
  const distanceKm = pathLengthKm(path, config);
  state.herd.transit = {
    toCampId,
    progress: 0,
    distanceKm,
    walkGameHours: walkGameHours(distanceKm, config),
    hoursApplied: 0,
    path,
  };
}

export function herdWorldTile(state: GameState): TilePoint {
  const transit = state.herd.transit;
  if (!transit || transit.path.length === 0) {
    const camp = state.camps.find((c) => c.id === state.herd.campId);
    return camp?.anchor ?? { x: 0, y: 0 };
  }
  return pointOnPath(transit.path, transit.progress);
}

export function pathTangent(state: GameState): { x: number; y: number } {
  const transit = state.herd.transit;
  if (!transit || transit.path.length < 2) return { x: 1, y: 0 };
  const p = Math.min(0.99, Math.max(0.01, transit.progress));
  const a = pointOnPath(transit.path, p - 0.01);
  const b = pointOnPath(transit.path, p + 0.01);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}
