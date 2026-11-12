import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { monthlyOperatingCosts } from "./economy";
import { createGame } from "./simulation";
import { afterFeedDay } from "./story";
import { hireFarmhand } from "./workers";
import { setWorkPriority, pickActiveJob, tickFarmhandWorld } from "./workGrid";
import { defaultCostLevers } from "./levers";
import { STEP2 } from "./step2Config";
import { resolvePlayerEvent } from "./playerEvents";

describe("cost levers", () => {
  it("cuts diesel when bakkie runs drop", () => {
    const state = createGame(3300);
    const base = monthlyOperatingCosts(state).diesel;
    state.story!.costLevers = { ...defaultCostLevers(), bakkieRunsPerMonth: STEP2.bakkieRunsMin };
    const low = monthlyOperatingCosts(state).diesel;
    expect(low).toBeLessThan(base);
  });

  it("raises repair bill when maintenance deferred", () => {
    const state = createGame(3300);
    state.story!.infrastructure!.fenceWear = 0.4;
    state.story!.costLevers!.maintenance = "maintain";
    const maintained = monthlyOperatingCosts(state).repairs;
    state.story!.costLevers!.maintenance = "defer";
    const deferred = monthlyOperatingCosts(state).repairs;
    expect(deferred).toBeGreaterThan(maintained);
  });
});

describe("work grid", () => {
  it("picks highest priority job", () => {
    const state = createGame(3300);
    hireFarmhand(state);
    setWorkPriority(state, "check_water", 1);
    setWorkPriority(state, "fix_fences", 3);
    expect(pickActiveJob(state)).toBe("fix_fences");
  });

  it("moves farmhand toward job target", () => {
    const state = createGame(3300);
    hireFarmhand(state);
    setWorkPriority(state, "check_water", 3);
    expect(state.story!.farmhandPresence).toBeDefined();
    const startX = state.story!.farmhandPresence!.tileX;
    tickFarmhandWorld(state);
    const endX = state.story!.farmhandPresence!.tileX;
    expect(Math.abs(endX - startX)).toBeGreaterThan(0);
  });
});

describe("player events", () => {
  it("charges for pump repair choice", () => {
    const state = createGame(3300);
    const cash = state.cashNad;
    state.story!.pendingPlayerEvent = {
      id: "t",
      kind: "pump_fault",
      title: "Pump",
      body: "Fault",
      ignoreConsequence: "Bad",
      critical: false,
      actions: [
        { id: "repair_now", label: "Fix", costNad: STEP2.routineMaintenanceNad },
        { id: "defer_fix", label: "Wait", costNad: 0 },
      ],
    };
    resolvePlayerEvent(state, "repair_now");
    expect(state.cashNad).toBeLessThan(cash);
    expect(state.story!.pendingPlayerEvent).toBeNull();
  });
});

describe("daily play", () => {
  it("runs step2 ticks without throwing", () => {
    const state = createGame(3300);
    hireFarmhand(state);
    afterFeedDay(state, 8000, 9000, CONFIG, 1);
    expect(state.story?.dailyPlay).toBeDefined();
  });
});
