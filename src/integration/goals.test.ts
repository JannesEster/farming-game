import { describe, expect, it } from "vitest";
import { createGame } from "../sim/simulation";
import {
  buildYearEndReport,
  createYearBaseline,
  evaluateFirstYearGoals,
  scoreFarm,
} from "./goals";

describe("goals and farm score", () => {
  it("scores herd condition on the 0 to 100 scale", () => {
    const state = createGame(42);
    const baseline = createYearBaseline(state, 1);
    state.herd.condition = 3.5;
    const low = evaluateFirstYearGoals(state, baseline).find((row) => row.id === "herdCondition");
    expect(low?.met).toBe(false);
    state.herd.condition = 55;
    const held = evaluateFirstYearGoals(state, baseline).find((row) => row.id === "herdCondition");
    expect(held?.met).toBe(true);
    expect(held?.label).toContain("55");
  });

  it("evaluates first-year cash or head goal", () => {
    const state = createGame(42);
    const baseline = createYearBaseline(state, 1);
    const improved = { ...state, cashNad: state.cashNad + 10_000 };
    const results = evaluateFirstYearGoals(improved, baseline);
    const cashGoal = results.find((r) => r.id === "cashOrHead");
    expect(cashGoal?.met).toBe(true);
  });

  it("builds a year-end report with rating", () => {
    const state = createGame(99);
    const baseline = createYearBaseline(state, 1);
    const milestones = {
      restCamp: true,
      sellBeforeDrought: false,
      keepWaterRunning: true,
    };
    const report = buildYearEndReport(state, 1, baseline, milestones, {
      bankrupt: false,
      herdLost: false,
    });
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(["Struggling", "Steady", "Thriving"]).toContain(report.rating);
    const { rating, score } = scoreFarm(
      state,
      report.goalResults,
      milestones,
    );
    expect(score).toBe(report.score);
    expect(rating).toBe(report.rating);
  });
});
