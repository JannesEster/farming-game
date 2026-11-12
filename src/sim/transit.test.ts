import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { createGame, moveHerd, stepDayWithRain } from "./simulation";
import { tickHerdingRealtime } from "./herding";
import { gameHoursElapsed, herdInTransit, herdMoveActive, walkGameHours } from "./transit";

function finishTransitPlay(state: ReturnType<typeof createGame>): void {
  let guard = 0;
  while (state.herd.transit && guard < 800) {
    const progress = state.herd.transit?.progress ?? 0;
    tickHerdingRealtime(state, 50, "x1", CONFIG);
    if (!state.herd.transit) break;
    if (state.herd.transit.phase === "drive" && (state.herd.transit?.progress ?? 1) === progress) {
      guard += 1;
    } else {
      guard = 0;
    }
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
    expect(herdMoveActive(state.herd)).toBe(true);
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

  it("walks cattle at 3.5 km/h of game time", () => {
    const hours = gameHoursElapsed(10, 1000, "x1", CONFIG.transit.driveClockFactor, CONFIG);
    const km = hours * CONFIG.transit.cattleWalkKmH;
    expect(CONFIG.transit.cattleWalkKmH).toBe(3.5);
    expect(km).toBeGreaterThan(0);
    expect(km).toBeLessThan(0.2);
    const oneKmHours = 1 / CONFIG.transit.cattleWalkKmH;
    expect(walkGameHours(1)).toBeCloseTo(oneKmHours, 5);
  });

  it("reaches the correct clock after many 16 ms ticks", () => {
    const state = createGame(3300);
    const fromId = state.herd.campId;
  let longestKm = 0;
    for (const camp of state.camps) {
      if (camp.id === fromId) continue;
      moveHerd(state, camp.id);
      longestKm = Math.max(longestKm, state.herd.transit!.distanceKm);
      state.herd.transit = null;
    }
    const dest = state.camps.find((c) => c.id !== fromId);
    if (!dest) throw new Error("expected destination");
    moveHerd(state, dest.id);
    state.date = { year: 2026, month: 8, day: 1, hour: 6 };
    const transit = state.herd.transit!;
    transit.phase = "drive";
    transit.approachProgress = 1;
    const expectedHours = walkGameHours(transit.distanceKm);
    expect(expectedHours).toBeGreaterThan(0.05);
    let guard = 0;
    while (herdInTransit(state.herd) && guard < 20000) {
      tickHerdingRealtime(state, 50, "x1", CONFIG);
      guard += 1;
    }
    expect(state.herd.transit).toBeNull();
    expect(state.date.hour).toBe(6);
    expect(Number.isInteger(state.date.hour)).toBe(true);
  });

  it("advances the game clock during a walk", () => {
    const state = createGame(9);
    const dest = state.camps.find((c) => c.id !== state.herd.campId);
    if (!dest) throw new Error("expected destination");
    moveHerd(state, dest.id);
    const transit = state.herd.transit!;
    transit.phase = "drive";
    transit.approachProgress = 1;
    const km = transit.distanceKm;
    const expectedHours = walkGameHours(km, CONFIG);
    expect(expectedHours).toBeCloseTo(km / CONFIG.transit.cattleWalkKmH, 5);
    const before = state.herd.transit?.progress ?? 0;
    tickHerdingRealtime(state, 2000, "x1", CONFIG);
    expect(state.herd.transit?.progress ?? 0).toBeGreaterThan(before);
    expect(Number.isInteger(state.date.hour)).toBe(true);
    finishTransitPlay(state);
    expect(state.herd.campId).toBe(dest.id);
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
