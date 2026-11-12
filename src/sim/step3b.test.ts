import { describe, expect, it } from "vitest";
import defaultFarm from "../../public/farms/default-farm.json";
import { CONFIG } from "./config";
import { quoteSale } from "./economy";
import { isFarmDefinition } from "./farmDefinition";
import { migrateState } from "./stateMigrate";
import {
  stepDay,
  findCamp,
  clearDefaultFarmCacheForTests,
  createGame,
  primeDefaultFarmCache,
} from "./simulation";
import {
  beginSaleConvoy,
  saleConvoyActive,
  tickSaleConvoyRealtime,
} from "./sales";
import { campHasWaterAccess, campHasTroughInPolygon, herdDrinkingAtTrough, tickDrinkingRealtime } from "./water";
import { maybeStartBakkieRun, tickBakkieRealtime, bakkieOnRoad } from "./bakkie";
import { setWorkPriority } from "./workGrid";
import { hireFarmhand } from "./workers";
import type { GameState } from "./types";

function loadDefault(): GameState {
  clearDefaultFarmCacheForTests();
  if (!isFarmDefinition(defaultFarm)) throw new Error("bad farm json");
  primeDefaultFarmCache(defaultFarm);
  return migrateState(createGame(CONFIG.worldSeed));
}

describe("step 3b water, sales, bakkie", () => {
  it("default farm: some camps lack in-camp trough but retain shared water", () => {
    const state = loadDefault();
    expect(state.farmWaterPoints?.length).toBeGreaterThan(3);
    const dry = findCamp(state, 16);
    expect(dry).toBeTruthy();
    if (!dry) return;
    expect(campHasTroughInPolygon(state, dry)).toBe(false);
    expect(campHasWaterAccess(state, dry)).toBe(true);
  });

  it("camp without water access loses condition over days", () => {
    const state = loadDefault();
    state.herd.campId = 16;
    state.story!.farmhand.hired = false;
    if (state.story?.costLevers) state.story.costLevers.lick = "winter_protein_urea";
    state.farmWaterPoints = (state.farmWaterPoints ?? []).filter((w) => !w.servedCampIds.includes(16));
    state.features = state.features.filter((f) => {
      if (f.kind !== "trough" && f.kind !== "windmill" && f.kind !== "solar_pump" && f.kind !== "reservoir") {
        return true;
      }
      return false;
    });
    const camp = findCamp(state, 16)!;
    expect(campHasWaterAccess(state, camp)).toBe(false);
    const before = state.herd.condition;
    for (let i = 0; i < 4; i += 1) stepDay(state);
    expect(state.herd.condition).toBeLessThanOrEqual(before - 0.3);
  });

  it("drinking trip reaches trough pose in camp with water", () => {
    const state = loadDefault();
    state.herd.campId = 1;
    stepDay(state);
    if (!state.story?.drinkingTrip) throw new Error("missing trip");
    state.story.drinkingTrip.walkProgress = 1;
    state.story.drinkingTrip.active = true;
    state.story.drinkingTrip.drinkingTicks = 2;
    tickDrinkingRealtime(state, 4000, 1);
    expect(herdDrinkingAtTrough(state)).toBe(true);
  });

  it("sale pays only when truck departs", () => {
    const state = loadDefault();
    const q = quoteSale(state, "tolly", 2, "auction");
    if ("reason" in q) throw new Error(q.reason);
    const cash0 = state.cashNad;
    const begin = beginSaleConvoy(state, "tolly", 2, "auction", q);
    expect(begin.ok).toBe(true);
    expect(saleConvoyActive(state)).toBe(true);
    for (let i = 0; i < 80 && saleConvoyActive(state); i += 1) {
      tickSaleConvoyRealtime(state, 1200, 8);
    }
    expect(state.cashNad).toBeGreaterThan(cash0);
    expect(state.story?.saleConvoy?.paid).toBe(true);
    expect((state.story?.composition.tolly ?? 0)).toBeLessThan(120);
  });

  it("bakkie run consumes diesel litres", () => {
    const state = loadDefault();
    hireFarmhand(state);
    setWorkPriority(state, "check_water", 3);
    maybeStartBakkieRun(state, "check_water");
    expect(bakkieOnRoad(state)).toBe(true);
    tickBakkieRealtime(state, 6000, 3);
    tickBakkieRealtime(state, 6000, 3);
    expect((state.story?.bakkieDieselLitresMonth ?? 0)).toBeGreaterThan(0);
  });
});
