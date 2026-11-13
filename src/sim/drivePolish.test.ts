import { describe, expect, it } from "vitest";
import defaultFarm from "../../public/farms/default-farm.json";
import { generateFarmOffers } from "../picker/generateOffers";
import {
  defaultRanchClock,
  formatClockTime,
  realMsPerGameHour,
  tickRanchClock,
} from "./clock";
import { columnMetrics, herderStandTile } from "./convoy";
import { clearYardRadiusTiles, generateFarm } from "./generate";
import { CONFIG } from "./config";
import { tickHerdingRealtime } from "./herding";
import { campGateBetween, fenceCrossingsOffGate, pathLengthKm, planHerdPath, pointOnPath } from "./path";
import { createGame, moveHerd, primeDefaultFarmCache } from "./simulation";
import { migrateState } from "./stateMigrate";
import { gameHoursElapsed, repairStuckTransit, walkGameHours } from "./transit";
import type { GameState, TilePoint } from "./types";

primeDefaultFarmCache(defaultFarm);

function ready(seed?: number): GameState {
  const state = migrateState(seed === undefined ? createGame() : createGame(seed));
  state.clock = state.clock ?? defaultRanchClock();
  state.date.hour = 10;
  state.clock.bankMs = 0;
  return state;
}

function tileLength(path: TilePoint[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return total;
}

function straight(a: TilePoint, b: TilePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function neighbourPairs(state: GameState): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (const a of state.camps) {
    for (const b of state.camps) {
      if (a.id >= b.id) continue;
      if (campGateBetween(a, b)) pairs.push([a.id, b.id]);
    }
  }
  return pairs;
}

function tickBoth(state: GameState, deltaMs: number, pace: number): void {
  const clock = state.clock ?? defaultRanchClock();
  state.clock = clock;
  const tick = tickRanchClock(state.date, clock, deltaMs, false, pace);
  state.date = tick.date;
  clock.bankMs = tick.bankMs;
  tickHerdingRealtime(state, deltaMs, "x1", CONFIG);
}

describe("drive polish", () => {
  it("routes a default-farm neighbour move through the shared gate, within 1.3x of straight", () => {
    const state = ready();
    const pairs = neighbourPairs(state);
    expect(pairs.length).toBeGreaterThan(0);
    for (const [fromId, toId] of pairs) {
      const from = state.camps.find((camp) => camp.id === fromId)!;
      const to = state.camps.find((camp) => camp.id === toId)!;
      const path = planHerdPath(state, fromId, toId);
      const ratio = tileLength(path) / Math.max(0.01, straight(from.anchor, to.anchor));
      expect(ratio).toBeLessThanOrEqual(1.3);
      expect(fenceCrossingsOffGate(state, path)).toBe(0);
      const gate = campGateBetween(from, to)!;
      expect(path.some((tile) => tile.x === gate.fromGate.x && tile.y === gate.fromGate.y)).toBe(true);
    }
  });

  it("keeps picker-farm neighbour routes within 2x and on gates", () => {
    const offers = generateFarmOffers(88001).filter((offer) => offer.playable);
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      const state = offer.previewState;
      const pairs = neighbourPairs(state);
      expect(pairs.length).toBeGreaterThan(0);
      for (const [fromId, toId] of pairs) {
        const from = state.camps.find((camp) => camp.id === fromId)!;
        const to = state.camps.find((camp) => camp.id === toId)!;
        const path = planHerdPath(state, fromId, toId);
        const ratio = tileLength(path) / Math.max(0.01, straight(from.anchor, to.anchor));
        expect(ratio).toBeLessThanOrEqual(2);
        expect(fenceCrossingsOffGate(state, path)).toBe(0);
      }
    }
  });

  it("prints the clock as whole HH:MM", () => {
    const date = { year: 2026, month: 8, day: 1, hour: 18.012288667834838 };
    expect(formatClockTime(date)).toMatch(/^\d\d:\d\d$/);
    expect(formatClockTime(date)).toBe("18:00");
    const ten = { year: 2026, month: 8, day: 1, hour: 10.62649946217332 };
    expect(formatClockTime(ten)).toBe("10:37");
    const bank = realMsPerGameHour(10, 240) * 0.5;
    expect(formatClockTime({ year: 2026, month: 8, day: 1, hour: 10 }, bank, 240)).toBe("10:30");
  });

  it("does not freeze when a drive is still going at dusk", () => {
    const state = ready();
    const pair = neighbourPairs(state)
      .map((ids) => ({ ids, km: pathLengthKm(planHerdPath(state, ids[0], ids[1])) }))
      .sort((a, b) => a.km - b.km)[0]?.ids;
    expect(pair).toBeTruthy();
    if (!pair) return;
    state.herd.campId = pair[0];
    state.date.hour = 16;
    state.clock!.bankMs = 0;
    const started = moveHerd(state, pair[1]);
    expect(started.ok).toBe(true);
    expect(state.herd.transit).toBeTruthy();
    const day = state.date.day;
    let sawNight = false;
    state.date.hour = 17;
    state.clock!.bankMs = realMsPerGameHour(17, state.clock!.settings.dayLengthSeconds) * 0.85;
    let guard = 0;
    while ((state.herd.transit || state.date.hour !== 6) && guard < 40000) {
      tickBoth(state, 80, state.herd.transit ? CONFIG.transit.driveClockFactor : 1);
      if (state.date.hour >= 18 || state.date.hour < 6) sawNight = true;
      expect(formatClockTime(state.date, state.clock!.bankMs, state.clock!.settings.dayLengthSeconds)).toMatch(
        /^\d\d:\d\d$/,
      );
      guard += 1;
    }
    expect(state.herd.transit).toBeNull();
    expect(state.date.hour).toBe(6);
    expect(state.date.day).toBe(day);
    expect(sawNight).toBe(true);
    expect(Number.isInteger(state.date.hour)).toBe(true);
  });

  it("queues a move that cannot finish before 18:00", () => {
    const state = ready();
    const dest = state.camps.find((camp) => camp.id !== state.herd.campId);
    if (!dest) throw new Error("expected a camp");
    state.date.hour = 17;
    state.clock!.bankMs = realMsPerGameHour(17, state.clock!.settings.dayLengthSeconds) * 0.95;
    const result = moveHerd(state, dest.id);
    expect(result.ok).toBe(true);
    if ("queued" in result) expect(result.queued).toBe(true);
    expect(state.herd.transit).toBeNull();
    expect(state.story?.herdMoveQueue?.reason).toBe("night");
  });

  it("repairs a save stuck at a fractional dusk hour", () => {
    const state = ready();
    const dest = state.camps.find((camp) => camp.id !== state.herd.campId)!;
    moveHerd(state, dest.id);
    expect(state.herd.transit).toBeTruthy();
    state.date.hour = 18.012288667834838;
    repairStuckTransit(state);
    expect(state.herd.transit).toBeNull();
    expect(state.herd.campId).toBe(dest.id);
    expect(state.date.hour).toBe(18);
    expect(formatClockTime(state.date)).toBe("18:00");
  });

  it("covers one kilometre at 3.5 km/h of the slowed drive clock", () => {
    expect(CONFIG.transit.cattleWalkKmH).toBe(3.5);
    expect(CONFIG.transit.herderWalkKmH).toBe(5);
    expect(CONFIG.transit.driveClockFactor).toBe(0.5);
    const hours = walkGameHours(1);
    expect(hours).toBeCloseTo(1 / 3.5, 5);
    let km = 0;
    let ms = 0;
    while (km < 1 && ms < 60_000) {
      const slice = gameHoursElapsed(10, 1000, "x1", CONFIG.transit.driveClockFactor, CONFIG);
      km += slice * CONFIG.transit.cattleWalkKmH;
      ms += 1000;
    }
    expect(km).toBeGreaterThanOrEqual(1);
    expect(ms).toBeGreaterThan(6_000);
    expect(ms).toBeLessThan(12_000);
  });

  it("keeps the herder moving behind the mob instead of standing at the start", () => {
    const state = ready();
    const pair = neighbourPairs(state)[0];
    state.herd.campId = pair[0];
    moveHerd(state, pair[1]);
    const who = state.herd.transit?.herder ?? "farmer";
    const presence = () => (who === "piet" ? state.story?.farmhandPresence : state.story?.farmerPresence);
    let stillMs = 0;
    let worstStill = 0;
    let guard = 0;
    let previous = { x: presence()?.tileX ?? 0, y: presence()?.tileY ?? 0 };
    while (state.herd.transit && guard < 20000) {
      tickBoth(state, 16, CONFIG.transit.driveClockFactor);
      const now = presence();
      if (!now) break;
      const step = Math.hypot(now.tileX - previous.x, now.tileY - previous.y);
      expect(step).toBeLessThan(0.5);
      const driving = (state.herd.transit?.progress ?? 0) > 0.02 || (state.herd.transit?.approachProgress ?? 0) > 0.05;
      if (driving && step < 0.01) stillMs += 16;
      else stillMs = 0;
      worstStill = Math.max(worstStill, stillMs);
      previous = { x: now.tileX, y: now.tileY };
      guard += 1;
    }
    expect(state.herd.transit).toBeNull();
    expect(worstStill).toBeLessThanOrEqual(1500);
    const filed = columnMetrics(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ],
      0.5,
      40,
    );
    expect(filed.centerTiles - filed.rearProgress * filed.total).toBeLessThanOrEqual(12);
  });

  it("keeps the herder behind the rear animal for most of a drive, in a mob several animals wide", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 48, y: 0 },
    ];
    const samples = [0.2, 0.35, 0.5, 0.65, 0.8, 0.95];
    let behind = 0;
    for (const progress of samples) {
      const filed = columnMetrics(path, progress, 80);
      const rear = filed.rearProgress * filed.total;
      const herder = filed.herderProgress * filed.total;
      expect(filed.centerTiles - rear).toBeLessThanOrEqual(12);
      expect(filed.abreast).toBeGreaterThanOrEqual(4);
      expect(filed.widthTiles).toBeGreaterThanOrEqual(3);
      expect(filed.widthTiles).toBeLessThanOrEqual(5);
      if (herder < rear - 0.3) behind += 1;
    }
    expect(behind).toBe(samples.length);
    const stand = herderStandTile(path, 0.5, 80);
    const filed = columnMetrics(path, 0.5, 80);
    const rear = pointOnPath(path, filed.rearProgress);
    expect(rear.x - stand.x).toBeGreaterThan(2);
    expect(Math.abs(stand.y - rear.y)).toBeLessThan(0.2);
  });

  it("leaves a clear yard around the house and plants an open scatter of trees", () => {
    const state = generateFarm(1);
    const house = state.features.find((feature) => feature.kind === "house");
    expect(house).toBeTruthy();
    const trees = state.features.filter((feature) => feature.kind === "tree");
    const clear = clearYardRadiusTiles();
    for (const tree of trees) {
      const dist = Math.hypot(tree.x - house!.x, tree.y - house!.y);
      expect(dist).toBeGreaterThan(clear - 0.05);
      const onTrack = state.features.some(
        (feature) => feature.kind === "track" && feature.x === tree.x && feature.y === tree.y,
      );
      expect(onTrack).toBe(false);
    }
    expect(trees.length).toBeGreaterThan(20);
    expect(trees.length).toBeLessThan(180);
  });
});
