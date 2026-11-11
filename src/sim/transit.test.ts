import { describe, expect, it } from "vitest";
import { createGame, moveHerd, stepDayWithRain } from "./simulation";
import { herdInTransit } from "./transit";

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
    let guard = 0;
    while (herdInTransit(state.herd) && guard < 200) {
      stepDayWithRain(state, 0);
      guard += 1;
    }
    expect(guard).toBeLessThan(200);
    expect(state.herd.campId).toBe(dest.id);
    expect(state.herd.transit).toBeNull();
    expect(state.herd.daysInCamp).toBe(0);
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
