import { describe, expect, it } from "vitest";
import { FIRST_YEAR_GOALS, MILESTONE_LABELS } from "./goals";
import { TUTORIAL_STEPS, advanceTutorial, freshTutorial } from "./tutorial";

const proseDash = /\u2013|\u2014|\s-\s/;

describe("tutorial progress", () => {
  it("advances only the step the player is on", () => {
    let progress = freshTutorial();
    progress = advanceTutorial(progress, "sellAtMarket");
    expect(progress.currentStepId).toBe("selectHerd");
    progress = advanceTutorial(progress, "selectHerd");
    expect(progress.currentStepId).toBe("moveToRestedCamp");
    expect(progress.completed).toBe(false);
  });

  it("keeps dashes out of tutorial and year end lines", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.title).not.toMatch(proseDash);
      expect(step.body).not.toMatch(proseDash);
    }
    for (const goal of FIRST_YEAR_GOALS) expect(goal.label).not.toMatch(proseDash);
    for (const label of Object.values(MILESTONE_LABELS)) expect(label).not.toMatch(proseDash);
  });
});
