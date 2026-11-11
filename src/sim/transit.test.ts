import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { createGame, moveHerd, stepDayWithRain } from "./simulation";
import {
  herdInTransit,
  moveDurationMs,
  tickTransitRealtime,
  walkGameHours,
} from "./transit";

function finishTransitPlay(state: ReturnType<typeof createGame>): void {
  let guard = 0;
  while (herdInTransit(state.herd) && guard < 500) {
    const progress = state.herd.transit?.progress ?? 0;
    tickTransitRealtime(state, 50, "play", CONFIG);
    if ((state.herd.transit?.progress ?? 1) === progress) guard += 1;
    else guard = 0;
  }
}

describe("herd transit", () => {
  it("keeps the herd in the source camp until the walk finishes", () => {
    const state = createGame(9);
    const fromId = state.herd.campId;
    const dest = state.camps.find((c) => c.id !== fromId);
    if (!dest) throw new Error("expected a destination camp");
    const moved = moveHerd(state, dest.id);
    expect(moved.ok).toBe(true);
    expect(state.herd.campId).toBe(fromId);
    expect(herdInTransit(state.herd)).toBe(true);
    finishTransitPlay(state);
    expect(state.herd.campId).toBe(dest.id);
    expect(state.herd.transit).toBeNull();
    expect(state.herd.daysInCamp).toBe(0);
  });

  it("does not advance walk progress inside stepDay", () => {
    const state = createGame(11);
    const dest = state.camps.find((c) => c.id !== state.herd.campId);
    if (!dest) throw new Error("expected destination");
    moveHerd(state, dest.id);
    const before = state.herd.transit?.progress ?? 0;
    stepDayWithRain(state, 0);
    expect(state.herd.transit?.progress).toBe(before);
  });

  it("bounds play and fast walk duration", () => {
    const state = createGame(3300);
    const from = state.herd.campId;
    let shortestMs = Number.POSITIVE_INFINITY;
    let longestMs = 0;
    let maxKm = 0;
    for (const camp of state.camps) {
      if (camp.id === from) continue;
      moveHerd(state, camp.id);
      const km = state.herd.transit!.distanceKm;
      maxKm = Math.max(maxKm, km);
      shortestMs = Math.min(shortestMs, moveDurationMs(km, "play", CONFIG));
      longestMs = Math.max(longestMs, moveDurationMs(km, "play", CONFIG));
      state.herd.transit = null;
    }
    expect(shortestMs).toBeGreaterThanOrEqual(CONFIG.transit.playMsMin);
    expect(shortestMs).toBeLessThanOrEqual(CONFIG.transit.playMsMax);
    expect(longestMs).toBeLessThanOrEqual(CONFIG.transit.playMsMax);
    const fastMax = moveDurationMs(maxKm, "fast", CONFIG);
    const playMax = moveDurationMs(maxKm, "play", CONFIG);
    expect(fastMax).toBeGreaterThanOrEqual(CONFIG.transit.fastMsMin);
    expect(playMax - fastMax).toBeGreaterThanOrEqual(4000);
  });

  it("advances the game clock during a walk", () => {
    const state = createGame(9);
    const dest = state.camps.find((c) => c.id !== state.herd.campId);
    if (!dest) throw new Error("expected destination");
    moveHerd(state, dest.id);
    const km = state.herd.transit!.distanceKm;
    const expectedHours = walkGameHours(km, CONFIG);
    expect(expectedHours).toBeGreaterThan(0.2);
    const startTicks = state.date.day * 24 + state.date.hour;
    tickTransitRealtime(state, 2000, "play", CONFIG);
    expect(state.date.day * 24 + state.date.hour).toBeGreaterThanOrEqual(startTicks);
    finishTransitPlay(state);
    expect(state.date.day * 24 + state.date.hour).toBeGreaterThanOrEqual(
      startTicks + Math.floor(expectedHours * 0.9),
    );
  });

  it("blocks a second move while walking", () => {
    const state = createGame(10);
    const fromId = state.herd.campId;
    const others = state.camps.filter((c) => c.id !== fromId);
    if (others.length < 2) return;
    moveHerd(state, others[0].id);
    const blocked = moveHerd(state, others[1].id);
    expect(blocked).toEqual({ ok: false, reason: "moving" });
  });
});
