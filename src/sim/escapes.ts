import { STEP3C } from "./step3cConfig";
import { ensureAnimals, livingAnimals, mixHash, unitFromHash } from "./animals";
import { emitNotification, defaultNotificationState } from "./notifications";
import { TILE_OUTSIDE, type GameState, type TilePoint } from "./types";
import type { AnimalRecord } from "./storyTypes";
import type { NotificationState } from "./notifications";

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function escapeDailyChance(state: GameState): number {
  const maintain = state.story?.costLevers?.maintenance !== "defer";
  const wear = state.story?.infrastructure?.fenceWear ?? 0;
  const deferred = state.story?.infrastructure?.deferredMaintenanceMonths ?? 0;
  const base = maintain ? STEP3C.escapeDailyChanceMaintain : STEP3C.escapeDailyChanceDefer;
  const chance = base * (1 + Math.max(0, wear) * STEP3C.escapeWearFactor) + deferred * STEP3C.escapeDeferMonthFactor;
  return Math.min(STEP3C.escapeDailyChanceCap, Math.max(0, chance));
}

export function dailyEscapeRoll(state: GameState): number {
  const date = state.date;
  const key = state.seed ^ (date.year * 1000 + date.month * 40 + date.day);
  return unitFromHash(key);
}

function campHasTile(state: GameState, campId: number, x: number, y: number): boolean {
  const camp = state.camps.find((item) => item.id === campId);
  if (!camp) return false;
  return camp.tiles.some((tile) => tile.x === x && tile.y === y);
}

function tileId(state: GameState, x: number, y: number): number | null {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
  return state.campIds[y * state.width + x];
}

/** A tile just outside this camp, preferring open veld over another camp. */
export function escapeExitTile(state: GameState, campId: number, salt: number): TilePoint | null {
  const camp = state.camps.find((item) => item.id === campId);
  if (!camp) return null;
  const outside: TilePoint[] = [];
  const otherCamp: TilePoint[] = [];
  for (const tile of camp.tiles) {
    for (const [dx, dy] of NEIGHBOURS) {
      const x = tile.x + dx;
      const y = tile.y + dy;
      if (campHasTile(state, campId, x, y)) continue;
      const id = tileId(state, x, y);
      if (id === null) continue;
      if (id === TILE_OUTSIDE) outside.push({ x, y });
      else if (id !== campId) otherCamp.push({ x, y });
    }
  }
  const pool = outside.length > 0 ? outside : otherCamp;
  if (pool.length === 0) return null;
  return pool[mixHash(salt) % pool.length];
}

function animalsOut(state: GameState): AnimalRecord[] {
  return livingAnimals(state).filter(
    (animal) => animal.whereabouts === "escaped" || animal.whereabouts === "neighbour",
  );
}

function notesOf(state: GameState): NotificationState {
  if (!state.notifications) state.notifications = defaultNotificationState();
  return state.notifications;
}

function syncEscapeAlert(state: GameState): void {
  const notes = notesOf(state);
  const count = animalsOut(state).length;
  notes.alerts = notes.alerts.filter((alert) => alert.key !== "animals-out");
  if (count <= 0) return;
  notes.alerts.push({
    key: "animals-out",
    label: count === 1 ? "1 animal out" : `${count} animals out`,
    count: 1,
  });
}

export function startEscape(state: GameState, animal: AnimalRecord, salt = 1): boolean {
  const exit = escapeExitTile(state, animal.campId, salt + mixHash(Number(animal.tag) || 1));
  if (!exit) return false;
  const wear = state.story?.infrastructure?.fenceWear ?? 0;
  const deferred = (state.story?.costLevers?.maintenance ?? "maintain") === "defer";
  animal.whereabouts = "escaped";
  animal.tileX = exit.x;
  animal.tileY = exit.y;
  animal.escapeHours = 0;
  animal.escapeReason = deferred || wear >= 0.35 ? "broken_fence" : "open_gate";
  animal.neighbourCharged = false;
  animal.activity = "graze";
  animal.facing = mixHash(salt + 11) % 8;
  const notes = notesOf(state);
  const why = animal.escapeReason === "broken_fence" ? "A fence wire is down." : "A gate was left open.";
  emitNotification(notes, {
    id: `out-${animal.tag}-${state.date.year}-${state.date.month}-${state.date.day}`,
    tier: "message",
    kind: "animal_out",
    title: "Animal out",
    body: `Tag ${animal.tag} is outside the fence. ${why} It will graze there until someone rounds it up.`,
    priority: 2,
    at: { ...state.date },
    cooldownDays: 0,
    dedupeKey: `animal-out-${animal.tag}`,
  });
  syncEscapeAlert(state);
  return true;
}

/** One daily roll. Pass roll 0 in tests to force an escape when the chance is above zero. */
export function tryDailyEscape(state: GameState, roll = dailyEscapeRoll(state)): AnimalRecord | null {
  ensureAnimals(state);
  if (animalsOut(state).length >= STEP3C.maxAnimalsOut) return null;
  const chance = escapeDailyChance(state);
  if (roll >= chance) return null;
  const candidates = livingAnimals(state).filter(
    (animal) => animal.whereabouts === "in_camp" && !animal.split && animal.stockClass !== "calf",
  );
  if (candidates.length === 0) return null;
  const pick = candidates[mixHash(state.seed + state.date.day * 13 + Math.round(roll * 1000)) % candidates.length];
  if (!startEscape(state, pick, state.date.day + 4)) return null;
  return pick;
}

export function advanceEscapeTime(state: GameState, hours: number): void {
  if (hours <= 0 || !state.story) return;
  for (const animal of animalsOut(state)) {
    const before = animal.escapeHours;
    animal.escapeHours += hours;
    const overdueBefore = Math.max(0, before - STEP3C.escapeGraceHours);
    const overdueAfter = Math.max(0, animal.escapeHours - STEP3C.escapeGraceHours);
    const dayFrac = (overdueAfter - overdueBefore) / 24;
    if (dayFrac > 0) {
      animal.condition = Math.max(0, animal.condition - dayFrac * STEP3C.escapeConditionLossPerDay);
    }
    if (!animal.neighbourCharged && animal.escapeHours >= STEP3C.neighbourHours) {
      animal.whereabouts = "neighbour";
      animal.neighbourCharged = true;
      state.cashNad -= STEP3C.neighbourCostNad;
      state.story.ledger.expenseNad += STEP3C.neighbourCostNad;
      state.story.ledger.notes.push(
        `Neighbour call-out N$${STEP3C.neighbourCostNad}. Tag ${animal.tag} was out too long.`,
      );
      const notes = notesOf(state);
      emitNotification(notes, {
        id: `neighbour-${animal.tag}-${state.date.year}-${state.date.month}-${state.date.day}`,
        tier: "message",
        kind: "animal_out",
        title: "On a neighbour's land",
        body: `Tag ${animal.tag} has been out long enough to reach a neighbour. It cost N$${STEP3C.neighbourCostNad}. Round it up.`,
        priority: 3,
        at: { ...state.date },
        dedupeKey: `neighbour-${animal.tag}`,
      });
    }
  }
  syncEscapeAlert(state);
}

export function tickDailyEscapes(state: GameState): void {
  tryDailyEscape(state);
  advanceEscapeTime(state, 24);
}

function insideHomeCamp(state: GameState, animal: AnimalRecord, x: number, y: number): boolean {
  return campHasTile(state, animal.campId, Math.round(x), Math.round(y));
}

/** Visible drift outside the fence. Positions stay on the sim, not on the sprite. */
export function tickEscapeWanderRealtime(state: GameState, deltaMs: number, speed: number): void {
  if (speed <= 0) return;
  const seconds = (deltaMs / 1000) * speed;
  for (const animal of animalsOut(state)) {
    const home = escapeExitTile(state, animal.campId, mixHash(Number(animal.tag) || 1));
    const anchor = home ?? { x: animal.tileX, y: animal.tileY };
    const turn = Math.sin(animal.escapeHours + Number(animal.tag) * 0.17 + seconds) ;
    const heading = (animal.facing + turn * 0.15 + 8) % 8;
    animal.facing = Math.round(heading) % 8;
    const angle = (animal.facing * Math.PI) / 4;
    const step = STEP3C.wanderTilesPerSecond * seconds;
    let nextX = animal.tileX + Math.cos(angle) * step;
    let nextY = animal.tileY + Math.sin(angle) * step;
    const dist = Math.hypot(nextX - anchor.x, nextY - anchor.y);
    if (dist > STEP3C.wanderRadiusTiles || insideHomeCamp(state, animal, nextX, nextY)) {
      animal.facing = (animal.facing + 2) % 8;
      nextX = animal.tileX;
      nextY = animal.tileY;
    } else {
      animal.tileX = nextX;
      animal.tileY = nextY;
    }
    const graze = Math.sin(animal.tileX * 3 + animal.tileY + Number(animal.tag)) > 0.15;
    animal.activity = graze ? "graze" : "walk";
  }
}
