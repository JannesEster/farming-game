import { CONFIG, type GameConfig } from "./config";
import { STEP3B } from "./step3bConfig";
import { findCamp } from "./simulation";
import { herdInTransit } from "./transit";
import type { CampState, GameState, TilePoint } from "./types";
import type { DrinkingTripState, FarmWaterPoint } from "./storyTypes";

function campTileSet(camp: CampState): Set<string> {
  return new Set(camp.tiles.map((t) => `${t.x},${t.y}`));
}

export function farmWaterPoints(state: GameState): FarmWaterPoint[] {
  return state.farmWaterPoints ?? [];
}

export function troughInCamp(state: GameState, camp: CampState): TilePoint | null {
  const keys = campTileSet(camp);
  const inCamp = state.features.find((f) => f.kind === "trough" && keys.has(`${f.x},${f.y}`));
  if (inCamp) return { x: inCamp.x, y: inCamp.y };
  const wp = farmWaterPoints(state).find((w) => w.servedCampIds.includes(camp.id));
  if (wp) return { ...wp.trough };
  return null;
}

export function campHasTroughInPolygon(state: GameState, camp: CampState): boolean {
  const keys = campTileSet(camp);
  return state.features.some((f) => f.kind === "trough" && keys.has(`${f.x},${f.y}`));
}

export function campHasWaterAccess(state: GameState, camp: CampState): boolean {
  if (campHasTroughInPolygon(state, camp)) return true;
  return farmWaterPoints(state).some((w) => w.servedCampIds.includes(camp.id));
}

export function distanceMetres(a: TilePoint, b: TilePoint, metresPerTile: number): number {
  return Math.hypot(a.x - b.x, a.y - b.y) * metresPerTile;
}

export function metresPerTileForState(config: GameConfig = CONFIG): number {
  return config.transit.kmPerTile * 1000;
}

export function campWaterDistanceMetres(state: GameState, camp: CampState, config: GameConfig = CONFIG): number {
  const metresPerTile = metresPerTileForState(config);
  const trough = troughInCamp(state, camp);
  if (!trough) return Number.POSITIVE_INFINITY;
  if (campHasTroughInPolygon(state, camp)) {
    const corners = camp.tiles.map((t) => distanceMetres(t, trough, metresPerTile));
    return Math.max(...corners, 0);
  }
  return distanceMetres(camp.anchor, trough, metresPerTile);
}

export function waterGrazeMultiplier(state: GameState, camp: CampState, config: GameConfig = CONFIG): number {
  if (campHasTroughInPolygon(state, camp)) return 1;
  if (!campHasWaterAccess(state, camp)) return STEP3B.grazeRemoteFraction;
  const trough = troughInCamp(state, camp);
  const rect = camp.rect;
  if (trough && rect) {
    const onCamp =
      trough.x >= rect.x - 1 &&
      trough.x <= rect.x + rect.w + 1 &&
      trough.y >= rect.y - 1 &&
      trough.y <= rect.y + rect.h + 1;
    if (onCamp) return 1;
  }
  const dist = campWaterDistanceMetres(state, camp, config);
  if (!Number.isFinite(dist)) return STEP3B.grazeRemoteFraction;
  if (dist <= STEP3B.grazeFullWithinMetres) return 1;
  if (dist >= STEP3B.grazeHalfBeyondMetres) return STEP3B.grazeRemoteFraction;
  const t = (dist - STEP3B.grazeFullWithinMetres) / (STEP3B.grazeHalfBeyondMetres - STEP3B.grazeFullWithinMetres);
  return 1 - t * (1 - STEP3B.grazeRemoteFraction);
}

export function defaultDrinkingTrip(): DrinkingTripState {
  return {
    active: false,
    troughTile: null,
    walkProgress: 1,
    drinkingTicks: 0,
    cowsAtTrough: 0,
    lastSatisfiedDayKey: "",
  };
}

function dayKey(state: GameState): string {
  return `${state.date.year}-${state.date.month}-${state.date.day}`;
}

export function tickHerdWaterDay(state: GameState, config: GameConfig = CONFIG): void {
  if (!state.story || herdInTransit(state.herd)) return;
  if (!state.story.drinkingTrip) state.story.drinkingTrip = defaultDrinkingTrip();
  const trip = state.story.drinkingTrip;
  const camp = findCamp(state, state.herd.campId);
  if (!camp) return;

  if (!campHasWaterAccess(state, camp)) {
    state.herd.condition = Math.max(
      config.herd.conditionMin,
      state.herd.condition - STEP3B.thirstConditionLossPerDay,
    );
    trip.active = false;
    trip.walkProgress = 1;
    trip.cowsAtTrough = 0;
    return;
  }

  const inCampTrough = campHasTroughInPolygon(state, camp);
  const trough = troughInCamp(state, camp);
  if (!trough) return;

  if (inCampTrough) {
    trip.active = true;
    trip.troughTile = { ...trough };
    trip.walkProgress = 1;
    trip.cowsAtTrough = Math.min(4, Math.max(1, Math.floor(state.herd.headCount / 30)));
    trip.drinkingTicks = STEP3B.drinkSlotsPerTrip;
    trip.lastSatisfiedDayKey = dayKey(state);
    return;
  }

  const metresPerTile = metresPerTileForState(config);
  const dist = distanceMetres(camp.anchor, trough, metresPerTile);
  const needsWalk = dist > metresPerTile * 0.5;
  const key = dayKey(state);
  const daysSince =
    trip.lastSatisfiedDayKey && trip.lastSatisfiedDayKey !== key
      ? 1
      : trip.lastSatisfiedDayKey === key
        ? 0
        : STEP3B.drinkTripIntervalGameDays;

  if (needsWalk && daysSince >= STEP3B.drinkTripIntervalGameDays) {
    trip.active = true;
    trip.troughTile = { ...trough };
    trip.walkProgress = 0;
    trip.cowsAtTrough = 0;
    trip.drinkingTicks = 0;
    return;
  }

  if (!needsWalk) {
    trip.lastSatisfiedDayKey = key;
  }
}

/** Advance drinking walk/drink during realtime ticks (deterministic from delta). */
export function tickDrinkingRealtime(state: GameState, deltaMs: number, speed: number, config: GameConfig = CONFIG): void {
  const trip = state.story?.drinkingTrip;
  if (!trip?.active || !trip.troughTile || herdInTransit(state.herd)) return;
  const camp = findCamp(state, state.herd.campId);
  if (!camp || !campHasWaterAccess(state, camp)) return;

  const mpt = metresPerTileForState(config);
  const walkRate = (0.00035 * speed) / Math.max(1, campWaterDistanceMetres(state, camp, config) / (mpt * 8));
  if (trip.walkProgress < 1) {
    trip.walkProgress = Math.min(1, trip.walkProgress + walkRate * deltaMs);
    if (trip.walkProgress >= 1) {
      trip.cowsAtTrough = Math.min(3, Math.max(1, Math.floor(state.herd.headCount / 35)));
      trip.drinkingTicks = STEP3B.drinkSlotsPerTrip;
    }
    return;
  }

  if (trip.drinkingTicks > 0) {
    trip.drinkingTicks -= (deltaMs / STEP3B.drinkPoseMsPerSlot) * speed;
    if (trip.drinkingTicks <= 0) {
      trip.drinkingTicks = 0;
      trip.active = false;
      trip.lastSatisfiedDayKey = dayKey(state);
    }
  }
}

export function herdDrinkingAtTrough(state: GameState): boolean {
  const trip = state.story?.drinkingTrip;
  return Boolean(trip?.active && trip.walkProgress >= 1 && trip.drinkingTicks > 0);
}

export function herdsWalkingToWater(state: GameState): boolean {
  const trip = state.story?.drinkingTrip;
  return Boolean(trip?.active && trip.walkProgress < 1);
}
