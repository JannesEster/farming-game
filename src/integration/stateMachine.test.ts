import { describe, expect, it } from "vitest";
import { canInteractWithFarm, transition } from "./stateMachine";

describe("flow state machine", () => {
  it("steps through boot, start, picker, and play", () => {
    let phase = transition("boot", { type: "BOOT_DONE" }).phase;
    expect(phase).toBe("start");
    phase = transition(phase, { type: "PRESS_NEW_GAME" }).phase;
    expect(phase).toBe("farmPicker");
    phase = transition(phase, { type: "OFFER_SELECTED" }).phase;
    expect(phase).toBe("playing");
    expect(canInteractWithFarm(phase)).toBe(true);
  });

  it("blocks continue without a save", () => {
    const result = transition("start", { type: "PRESS_CONTINUE", hasSave: false });
    expect(result.ok).toBe(false);
  });

  it("routes year end and game over", () => {
    const afterYear = transition("playing", { type: "YEAR_END_REACHED" }).phase;
    expect(afterYear).toBe("yearEndReview");
    const backToPlay = transition(afterYear, { type: "YEAR_END_CONTINUE" }).phase;
    expect(backToPlay).toBe("playing");
    const gameOver = transition("playing", { type: "GAME_OVER", reason: "bankrupt" }).phase;
    expect(gameOver).toBe("gameOver");
    expect(transition(gameOver, { type: "RETURN_TO_START" }).phase).toBe("start");
  });
});
