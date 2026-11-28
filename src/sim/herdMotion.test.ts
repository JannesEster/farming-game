import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAMP_GATE_METRES, COW_LENGTH_METRES } from "../render/worldScale";
import { CONFIG, HERD_MOTION_TUNING } from "./config";
import { gameHoursElapsed, repairStuckTransit } from "./transit";
import { tickHerdingRealtime } from "./herding";
import {
  advanceHerdMotion,
  herdAgent,
  herdAgentList,
  herdCentroid,
  setDrinkUrge,
  stripGrassHalf,
} from "./herdMotion";
import { campGateBetween, planHerdPath } from "./path";
import { pointCampId } from "./metreFarm";
import { createGame, moveHerd } from "./simulation";
import type { AnimalRecord } from "./storyTypes";
import type { CampState, GameState } from "./types";

function herdOf(state: GameState): AnimalRecord[] {
  return (state.story?.animals ?? []).filter((animal) => animal.whereabouts === "in_camp" && !animal.split);
}

function putHerdIn(state: GameState, campId: number): void {
  state.herd.campId = campId;
  for (const animal of herdOf(state)) animal.campId = campId;
}

function positions(state: GameState): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  for (const agent of herdAgentList(state)) out.set(agent.id, { x: agent.x, y: agent.y });
  return out;
}

function moved(before: Map<string, { x: number; y: number }>, after: Map<string, { x: number; y: number }>): number {
  let worst = 0;
  for (const [id, point] of before) {
    const next = after.get(id);
    if (!next) continue;
    worst = Math.max(worst, Math.hypot(next.x - point.x, next.y - point.y));
  }
  return worst;
}

function rms(points: { x: number; y: number }[]): number {
  if (points.length === 0) return 0;
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  x /= points.length;
  y /= points.length;
  let sum = 0;
  for (const point of points) sum += (point.x - x) ** 2 + (point.y - y) ** 2;
  return Math.sqrt(sum / points.length);
}

function stepAllowance(deltaMs: number): number {
  const hours = gameHoursElapsed(8, deltaMs, "x1", CONFIG.transit.driveClockFactor, CONFIG);
  return hours * CONFIG.transit.cattleWalkKmH * 1000 * 1.12 + 0.2;
}

function insideInset(camp: CampState, x: number, y: number, inset: number): boolean {
  const rect = camp.rect;
  if (!rect) return false;
  const pad = Math.max(0.4, Math.min(inset, rect.w * 0.5 - 1, rect.h * 0.5 - 1));
  return x >= rect.x + pad - 0.35 && y >= rect.y + pad - 0.35 && x <= rect.x + rect.w - pad + 0.35 && y <= rect.y + rect.h - pad + 0.35;
}

describe("herd motion", () => {
  it("walks camp 5 to camp 2 without a step larger than walking speed", () => {
    const state = createGame(3300);
    state.date.hour = 8;
    putHerdIn(state, 5);
    advanceHerdMotion(state, 20, "graze");
    const started = moveHerd(state, 2);
    expect(started.ok).toBe(true);
    const transit = state.herd.transit;
    expect(transit).toBeTruthy();
    if (!transit) return;
    transit.phase = "drive";
    transit.approachProgress = 1;
    const beforeDrive = [...positions(state).values()];
    const spread0 = rms(beforeDrive);
    expect(spread0).toBeGreaterThan(4);
    let minRatio = Number.POSITIVE_INFINITY;
    let worst = 0;
    const samples: number[] = [];
    const gates = new Map<string, { x: number; y: number }>();
    for (const a of state.camps) {
      for (const b of state.camps) {
        if (a.id >= b.id) continue;
        const gate = campGateBetween(a, b);
        if (!gate) continue;
        gates.set(`${a.id}:${b.id}`, { x: (gate.fromGate.x + gate.toGate.x) / 2, y: (gate.fromGate.y + gate.toGate.y) / 2 });
      }
    }
    const opening = CAMP_GATE_METRES / 2 + COW_LENGTH_METRES / 2;
    let guard = 0;
    let driveMs = 0;
    const deltaMs = 50;
    let sawFinish = false;
    while (state.herd.transit && guard < 8000) {
      const prev = positions(state);
      const prevCamp = new Map<string, number>();
      for (const [id, point] of prev) prevCamp.set(id, pointCampId(state, point.x, point.y));
      tickHerdingRealtime(state, deltaMs, "x1", CONFIG);
      const next = positions(state);
      const step = moved(prev, next);
      worst = Math.max(worst, step);
      samples.push(step);
      const cap = stepAllowance(deltaMs);
      expect(step).toBeLessThanOrEqual(cap);
      if (!state.herd.transit) {
        sawFinish = true;
        expect(step).toBeLessThanOrEqual(cap);
      }
      for (const [id, point] of next) {
        const was = prevCamp.get(id);
        const now = pointCampId(state, point.x, point.y);
        if (was === undefined || was < 0 || now < 0 || was === now) continue;
        const gate = gates.get(was < now ? `${was}:${now}` : `${now}:${was}`);
        const prevPoint = prev.get(id)!;
        expect(gate).toBeTruthy();
        if (!gate) continue;
        const dx = point.x - prevPoint.x;
        const dy = point.y - prevPoint.y;
        const len2 = dx * dx + dy * dy;
        const t = len2 <= 0 ? 0 : Math.max(0, Math.min(1, ((gate.x - prevPoint.x) * dx + (gate.y - prevPoint.y) * dy) / len2));
        const px = prevPoint.x + dx * t;
        const py = prevPoint.y + dy * t;
        expect(Math.hypot(px - gate.x, py - gate.y)).toBeLessThanOrEqual(opening + 0.6);
      }
      if (state.herd.transit?.phase === "drive" && driveMs < 5000) {
        driveMs += deltaMs;
        const ratio = rms([...next.values()]) / spread0;
        minRatio = Math.min(minRatio, ratio);
      }
      guard += 1;
    }
    expect(sawFinish).toBe(true);
    expect(state.herd.campId).toBe(2);
    expect(state.herd.transit).toBeNull();
    expect(minRatio).toBeGreaterThan(0.28);
    expect(worst).toBeLessThan(stepAllowance(deltaMs));
    if (process.env.HERD_EVIDENCE === "1") {
      const lines = ["step_index,max_cow_step_m", ...samples.map((value, index) => `${index},${value.toFixed(4)}`)];
      writeFileSync("docs/screenshots/herd-move-graze/max-step.csv", `${lines.join("\n")}\n`);
    }
  }, 30_000);

  it("does not move the other cows when one is sold", () => {
    const state = createGame(3300);
    advanceHerdMotion(state, 40, "graze");
    const before = positions(state);
    const victim = herdOf(state)[4];
    expect(victim).toBeTruthy();
    victim.whereabouts = "sold";
    const after = positions(state);
    for (const [id, point] of before) {
      if (id === victim.id) {
        expect(after.has(id)).toBe(false);
        continue;
      }
      expect(after.get(id)).toEqual(point);
    }
  });

  it("keeps a dusk finish and a stuck save inside the destination camp", () => {
    const repaired = createGame(3300);
    repaired.date.hour = 8;
    const dest = repaired.camps.find((camp) => camp.id !== repaired.herd.campId);
    expect(dest).toBeTruthy();
    if (!dest) return;
    expect(moveHerd(repaired, dest.id).ok).toBe(true);
    repaired.date.hour = 18.012288667834838;
    repairStuckTransit(repaired);
    expect(repaired.herd.transit).toBeNull();
    expect(repaired.herd.campId).toBe(dest.id);
    for (const agent of herdAgentList(repaired)) {
      expect(pointCampId(repaired, agent.x, agent.y)).toBe(dest.id);
      expect(insideInset(dest, agent.x, agent.y, 0.4)).toBe(true);
    }

    const held = createGame(17);
    held.date.hour = 8;
    const other = held.camps.find((camp) => camp.id !== held.herd.campId);
    expect(other).toBeTruthy();
    if (!other) return;
    expect(moveHerd(held, other.id).ok).toBe(true);
    const transit = held.herd.transit;
    expect(transit).toBeTruthy();
    if (!transit) return;
    transit.phase = "drive";
    transit.progress = 0.97;
    transit.distanceKm = 40;
    transit.approachProgress = 1;
    held.date.hour = 18;
    tickHerdingRealtime(held, 1000, "x1");
    expect(held.herd.transit).toBeNull();
    expect(held.herd.campId).toBe(other.id);
    for (const agent of herdAgentList(held)) {
      expect(pointCampId(held, agent.x, agent.y)).toBe(other.id);
      expect(insideInset(other, agent.x, agent.y, 0.4)).toBe(true);
    }
  });

  it("holds a long night drive on the path instead of jumping camp", () => {
    const state = createGame(3300);
    state.date.hour = 8;
    const dest = state.camps.find((camp) => camp.id !== state.herd.campId);
    expect(dest).toBeTruthy();
    if (!dest) return;
    expect(moveHerd(state, dest.id).ok).toBe(true);
    const transit = state.herd.transit;
    expect(transit).toBeTruthy();
    if (!transit) return;
    transit.phase = "drive";
    transit.progress = 0.2;
    transit.distanceKm = 40;
    transit.approachProgress = 1;
    advanceHerdMotion(state, 1, "drive");
    const before = positions(state);
    state.date.hour = 18;
    tickHerdingRealtime(state, 1000, "x1");
    expect(state.herd.transit?.phase).toBe("night");
    expect(state.herd.campId).not.toBe(dest.id);
    expect(moved(before, positions(state))).toBeLessThan(0.05);
  });

  it("grazes as individuals over 10 game minutes", () => {
    const state = createGame(3300);
    const start = positions(state);
    const listed = herdAgentList(state);
    const modes = new Map(listed.map((agent) => [agent.id, agent.mode]));
    const firstChange = listed.map(() => -1);
    const ids = listed.map((agent) => agent.id);
    for (let second = 1; second <= 180; second += 1) {
      advanceHerdMotion(state, 1, "graze");
      ids.forEach((id, index) => {
        const agent = herdAgent(state, id);
        if (!agent) return;
        if (firstChange[index] < 0 && agent.mode !== modes.get(id)) firstChange[index] = second;
      });
    }
    const changed = firstChange.filter((value) => value >= 0);
    expect(new Set(changed).size).toBeGreaterThan(4);
    advanceHerdMotion(state, 420, "graze");
    const end = positions(state);
    const shifts: string[] = [];
    for (const [id, point] of start) {
      const next = end.get(id);
      expect(next).toBeTruthy();
      if (!next) continue;
      const dist = Math.hypot(next.x - point.x, next.y - point.y);
      expect(dist).toBeGreaterThan(0.4);
      shifts.push(`${next.x - point.x},${next.y - point.y}`);
    }
    expect(new Set(shifts).size).toBe(shifts.length);
  });

  it("keeps a loose mob inside the camp fence", () => {
    const state = createGame(3300);
    const camp = state.camps.find((item) => item.id === state.herd.campId)!;
    let closestShare = 0;
    let samples = 0;
    const gap = COW_LENGTH_METRES * 0.45;
    for (let i = 0; i < 30; i += 1) {
      advanceHerdMotion(state, 20, "graze");
      const agents = herdAgentList(state);
      let crowded = 0;
      let pairs = 0;
      for (let a = 0; a < agents.length; a += 1) {
        expect(insideInset(camp, agents[a].x, agents[a].y, HERD_MOTION_TUNING.fenceInsetM)).toBe(true);
        for (let b = a + 1; b < agents.length; b += 1) {
          pairs += 1;
          if (Math.hypot(agents[a].x - agents[b].x, agents[a].y - agents[b].y) < gap) crowded += 1;
        }
      }
      samples += 1;
      closestShare += crowded / Math.max(1, pairs);
    }
    expect(closestShare / samples).toBeLessThan(0.02);
    const agents = herdAgentList(state);
    const centre = herdCentroid(state)!;
    let far = 0;
    let pairSum = 0;
    let pairCount = 0;
    for (let a = 0; a < agents.length; a += 1) {
      far = Math.max(far, Math.hypot(agents[a].x - centre.x, agents[a].y - centre.y));
      if (a % 3 !== 0) continue;
      for (let b = a + 1; b < agents.length; b += 4) {
        pairSum += Math.hypot(agents[a].x - agents[b].x, agents[a].y - agents[b].y);
        pairCount += 1;
      }
    }
    expect(far).toBeLessThan(170);
    expect(far).toBeGreaterThan(12);
    expect(pairSum / pairCount).toBeGreaterThan(14);
  });

  it("drifts toward the grass that is left", () => {
    const state = createGame(3300);
    const camp = state.camps.find((item) => item.id === state.herd.campId)!;
    stripGrassHalf(state, camp.id, "lowX");
    const before = herdCentroid(state)!.x;
    advanceHerdMotion(state, 6 * 3600, "graze", CONFIG, 4);
    const after = herdCentroid(state)!.x;
    expect(after).toBeGreaterThan(before + 20);
  }, 20_000);

  it("sends a thirsty cow to a trough that serves the camp, then back out", () => {
    const state = createGame(3300);
    const camp = state.camps.find((item) => item.id === state.herd.campId)!;
    const troughs = (state.farmWaterPoints ?? []).filter((point) => point.servedCampIds.includes(camp.id));
    expect(troughs.length).toBeGreaterThan(0);
    const animal = herdOf(state).find((item) => item.stockClass !== "calf");
    expect(animal).toBeTruthy();
    if (!animal) return;
    setDrinkUrge(state, animal.id, 1.2);
    let reached = false;
    for (let i = 0; i < 500 && !reached; i += 1) {
      advanceHerdMotion(state, 5, "graze");
      const agent = herdAgent(state, animal.id);
      expect(agent).toBeTruthy();
      if (!agent) return;
      if (agent.drinkPhase === "to") {
        const serves = troughs.some((point) => Math.hypot(point.trough.x - agent.targetX, point.trough.y - agent.targetY) < 1);
        expect(serves).toBe(true);
      }
      const near = troughs.some((point) => Math.hypot(point.trough.x - agent.x, point.trough.y - agent.y) <= HERD_MOTION_TUNING.troughReachM);
      if (agent.drinkPhase === "at" && near) reached = true;
    }
    expect(reached).toBe(true);
    const at = herdAgent(state, animal.id)!;
    const drankAt = { x: at.x, y: at.y };
    advanceHerdMotion(state, HERD_MOTION_TUNING.drinkSeconds + 40, "graze", CONFIG, 1);
    const left = herdAgent(state, animal.id)!;
    const still = troughs.some((point) => Math.hypot(point.trough.x - left.x, point.trough.y - left.y) <= HERD_MOTION_TUNING.troughReachM);
    expect(still).toBe(false);
    expect(Math.hypot(left.x - drankAt.x, left.y - drankAt.y)).toBeGreaterThan(1);
  });

  it("repeats the same positions for the same seed and elapsed time", () => {
    const a = createGame(4242);
    const b = createGame(4242);
    advanceHerdMotion(a, 25, "graze");
    advanceHerdMotion(b, 25, "graze");
    advanceHerdMotion(a, 15, "graze");
    advanceHerdMotion(b, 15, "graze");
    const left = herdAgentList(a);
    const right = herdAgentList(b);
    expect(left.length).toBe(right.length);
    for (let i = 0; i < left.length; i += 1) {
      expect(left[i].id).toBe(right[i].id);
      expect(left[i].x).toBeCloseTo(right[i].x, 6);
      expect(left[i].y).toBeCloseTo(right[i].y, 6);
      expect(left[i].mode).toBe(right[i].mode);
    }
  });

  it("steps 120 head fast enough for a phone frame", () => {
    const state = createGame(3300);
    herdAgentList(state);
    const frames = 40;
    const t0 = performance.now();
    for (let i = 0; i < frames; i += 1) advanceHerdMotion(state, 2.2, "graze");
    const perFrame = (performance.now() - t0) / frames;
    expect(perFrame).toBeLessThan(12);
  });

  it("plans the drive through to the grazing centre", () => {
    const state = createGame(3300);
    const path = planHerdPath(state, 5, 2);
    const dest = state.camps.find((camp) => camp.id === 2)!;
    const goal = path[path.length - 1];
    const centreX = dest.rect!.x + dest.rect!.w / 2;
    const centreY = dest.rect!.y + dest.rect!.h / 2;
    expect(Math.hypot(goal.x - centreX, goal.y - centreY)).toBeLessThan(dest.rect!.w * 0.45);
    expect(Math.hypot(goal.x - centreX, goal.y - centreY)).toBeGreaterThan(0);
    const gate = path[path.length - 3] ?? path[1];
    expect(Math.hypot(goal.x - gate.x, goal.y - gate.y)).toBeGreaterThan(80);
  });
});
