import { describe, expect, it } from "vitest";
import { dayStepsThisFrame, isSimBlocked, transitMayAdvance } from "./simGate";

const clear = {
  tutorialHolding: false,
  eventCard: false,
  yearEnd: false,
  gameOver: false,
  market: false,
  startOrPicker: false,
};

describe("sim gate", () => {
  it("runs only when every blocker is closed", () => {
    expect(isSimBlocked(clear)).toBe(false);
  });

  it.each([
    "tutorialHolding",
    "eventCard",
    "yearEnd",
    "gameOver",
    "market",
    "startOrPicker",
  ] as const)("pauses the clock while %s is open", (key) => {
    expect(isSimBlocked({ ...clear, [key]: true })).toBe(true);
  });

  it("does not tick days or bank time while a popup is open", () => {
    const held = dayStepsThisFrame({
      blocked: true,
      speed: "fast",
      bankMs: 500,
      deltaMs: 10_000,
      intervalMs: 120,
      maxFrameMs: 200,
      maxDays: 3,
    });
    expect(held).toEqual({ bankMs: 0, days: 0 });
  });

  it("resumes at the speed that was already selected", () => {
    const play = dayStepsThisFrame({
      blocked: false,
      speed: "play",
      bankMs: 0,
      deltaMs: 1000,
      intervalMs: 1000,
      maxFrameMs: 1000,
      maxDays: 3,
    });
    const fast = dayStepsThisFrame({
      blocked: false,
      speed: "fast",
      bankMs: 0,
      deltaMs: 1000,
      intervalMs: 120,
      maxFrameMs: 1000,
      maxDays: 3,
    });
    expect(play.days).toBe(1);
    expect(fast.days).toBe(3);
    expect(transitMayAdvance(false, "fast")).toBe(true);
    expect(transitMayAdvance(true, "fast")).toBe(false);
    expect(transitMayAdvance(false, "pause")).toBe(false);
  });
});
