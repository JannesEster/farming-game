import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { createGame } from "./simulation";
import {
  applyYoungstockGrowth,
  calvingFromPregnantHeifers,
  classifyLegacyOxenByWeight,
  defaultClassLiveweights,
  migrateLegacyComposition,
  reclassifyGrowersByWeight,
  splitWeanersToHeiferAndTolly,
  tollyNadPerKgLive,
} from "./cattleClasses";
import { baseLivePrice, quoteSale } from "./economy";
import { createStoryState } from "./story";
import { tryWeaning } from "./seasonCycle";

describe("cattle class weights", () => {
  it("moves tollies to stoors then oxen when average weight crosses gates", () => {
    const story = createStoryState(40);
    story.composition.tolly = 1;
    story.composition.stoor = 0;
    story.composition.ox = 0;
    story.classLiveweights.tolly = CONFIG.cattle.stoorWeightMinKg;
    reclassifyGrowersByWeight(story);
    expect(story.composition.tolly).toBe(0);
    expect(story.composition.stoor).toBe(1);
    story.classLiveweights.stoor = CONFIG.cattle.oxWeightMinKg;
    reclassifyGrowersByWeight(story);
    expect(story.composition.stoor).toBe(0);
    expect(story.composition.ox).toBe(1);
  });

  it("gains weight on good feed and reclassifies", () => {
    const state = createGame(42);
    state.story = createStoryState(40);
    state.story.composition = {
      cow: 30,
      bull: 2,
      calf: 10,
      heifer: 4,
      pregnant_heifer: 0,
      tolly: 6,
      stoor: 0,
      ox: 0,
    };
    state.story.classLiveweights = defaultClassLiveweights();
    const before = state.story.classLiveweights.tolly;
    for (let i = 0; i < 200; i += 1) {
      applyYoungstockGrowth(state, 0.95, CONFIG);
    }
    expect(state.story.classLiveweights.tolly).toBeGreaterThan(before);
    expect(
      state.story.composition.stoor + state.story.composition.ox,
    ).toBeGreaterThan(0);
  });
});

describe("heifer breeding", () => {
  it("turns pregnant heifers into cows after calving", () => {
    const state = createGame(12);
    state.story = createStoryState(30);
    state.story.composition.pregnant_heifer = 5;
    state.story.composition.heifer = 0;
    const cowsBefore = state.story.composition.cow;
    const calvesBefore = state.story.composition.calf;
    const joined = calvingFromPregnantHeifers(state);
    expect(joined).toBeGreaterThan(0);
    expect(state.story.composition.cow).toBeGreaterThan(cowsBefore);
    expect(state.story.composition.calf).toBeGreaterThan(calvesBefore);
    expect(state.story.composition.pregnant_heifer).toBeLessThan(5);
  });
});

describe("prices", () => {
  it("charges more for pregnant heifers than open heifers", () => {
    const state = createGame(1);
    state.story!.composition.heifer = 2;
    state.story!.composition.pregnant_heifer = 2;
    const open = quoteSale(state, "heifer", 1, "auction");
    const preg = quoteSale(state, "pregnant_heifer", 1, "auction");
    if ("reason" in open || "reason" in preg) throw new Error("expected quotes");
    expect(preg.totalNad).toBeGreaterThan(open.totalNad);
    expect(baseLivePrice("pregnant_heifer").baseNadPerKgLive).toBe(34);
    expect(baseLivePrice("heifer").baseNadPerKgLive).toBe(28);
  });

  it("uses wet season high tolly price Dec to Apr", () => {
    const wet = tollyNadPerKgLive({ year: 2026, month: 1, day: 1, hour: 0 });
    const dry = tollyNadPerKgLive({ year: 2026, month: 8, day: 1, hour: 0 });
    expect(wet).toBe(CONFIG.cattle.tollyNadPerKgWetSeason);
    expect(dry).toBe(CONFIG.cattle.tollyNadPerKgDrySeason);
    expect(wet).toBeGreaterThan(dry);
  });
});

describe("save migration", () => {
  it("splits legacy weaners evenly and classifies oxen by weight", () => {
    const split = splitWeanersToHeiferAndTolly(9);
    expect(split.heifer).toBe(4);
    expect(split.tolly).toBe(5);
    const heavy = classifyLegacyOxenByWeight(6, 420);
    expect(heavy.ox).toBe(6);
    const light = classifyLegacyOxenByWeight(6, 250);
    expect(light.tolly).toBe(6);
    const migrated = migrateLegacyComposition(
      { cow: 40, bull: 2, calf: 8, weaner: 10, ox: 4 } as never,
      450,
    );
    expect(migrated.composition.heifer).toBe(5);
    expect(migrated.composition.tolly).toBe(5);
    expect(migrated.composition.ox).toBe(4);
  });
});

describe("weaning split", () => {
  it("splits weaned calves into heifers and tollies in May", () => {
    const state = createGame(5);
    state.date = { year: 2026, month: 5, day: 15, hour: 6 };
    state.story!.composition.calf = 20;
    state.story!.seasonEventsFired = [];
    tryWeaning(state);
    expect(state.story!.composition.heifer).toBeGreaterThan(0);
    expect(state.story!.composition.tolly).toBeGreaterThan(0);
    expect(state.story!.composition.calf).toBeLessThan(20);
  });
});
