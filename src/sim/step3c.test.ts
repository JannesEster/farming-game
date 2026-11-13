import { describe, expect, it } from "vitest";
import { stateFromOfferCard } from "../integration/pickerAdapter";
import { generateFarmOffers } from "../picker/generateOffers";
import { cowOctantFromScreen } from "../render/sprites";
import { ensureAnimals, animalDetailCopy, filterAnimals, TOLLY_OVER_300 } from "./animals";
import { cutOutHerderProgress, cutOutRearProgress, requestCutOut, tickCutOutRealtime } from "./cutOut";
import { advanceEscapeTime, escapeDailyChance, startEscape, tryDailyEscape } from "./escapes";
import { defaultCostLevers } from "./levers";
import { createGame } from "./simulation";
import { GAME_STATE_VERSION, parseLegacySaved } from "./stateMigrate";
import { STEP3C } from "./step3cConfig";

describe("step 3c animals, escapes, and cut-out", () => {
  it("puts an ear-tagged animal on every head of a generated farm", () => {
    const card = generateFarmOffers(88001).find((offer) => offer.id === "otjozondjupa-ranch");
    expect(card).toBeTruthy();
    const state = stateFromOfferCard(card!);
    expect(state.stateVersion).toBe(GAME_STATE_VERSION);
    expect(state.story?.animals?.length).toBe(state.herd.headCount);
    const tags = new Set(state.story?.animals?.map((animal) => animal.tag));
    expect(tags.size).toBe(state.herd.headCount);
  });

  it("migrates an older save into individual animals", () => {
    const state = createGame(12);
    const legacy = JSON.parse(JSON.stringify(state)) as typeof state;
    delete legacy.story?.animals;
    delete legacy.stateVersion;
    const loaded = parseLegacySaved(JSON.stringify({ version: 2, savedAt: "2026-08-01", state: legacy }));
    expect(GAME_STATE_VERSION).toBe(9);
    expect(loaded?.stateVersion).toBe(9);
    expect(loaded?.story?.animals?.length).toBe(loaded?.herd.headCount);
    const copy = animalDetailCopy(loaded!.story!.animals![0]);
    expect(copy.title.startsWith("Tag ")).toBe(true);
    expect(`${copy.title} ${copy.body}`).not.toMatch(/\b(campId|stockClass)\b/);
    expect(copy.body).not.toContain(loaded!.story!.animals![0].id);
  });

  it("makes a maintained fence safer than a deferred one", () => {
    const state = createGame(20);
    state.story!.costLevers = { ...defaultCostLevers(), maintenance: "maintain" };
    state.story!.infrastructure!.fenceWear = 0.2;
    state.story!.infrastructure!.deferredMaintenanceMonths = 0;
    const kept = escapeDailyChance(state);
    state.story!.costLevers = { ...state.story!.costLevers, maintenance: "defer" };
    state.story!.infrastructure!.fenceWear = 0.55;
    state.story!.infrastructure!.deferredMaintenanceMonths = 3;
    const deferred = escapeDailyChance(state);
    expect(deferred).toBeGreaterThan(kept);
    expect(kept).toBeLessThan(0.05);
    expect(deferred).toBeLessThanOrEqual(STEP3C.escapeDailyChanceCap);
  });

  it("walks an escape outside the fence, then charges the neighbour once", () => {
    const state = createGame(21);
    const animal = state.story!.animals!.find((item) => item.stockClass === "cow");
    expect(animal).toBeTruthy();
    const before = animal!.condition;
    const cash = state.cashNad;
    expect(startEscape(state, animal!, 2)).toBe(true);
    const camp = state.camps.find((item) => item.id === animal!.campId);
    expect(camp?.tiles.some((tile) => tile.x === Math.round(animal!.tileX) && tile.y === Math.round(animal!.tileY))).toBe(
      false,
    );
    advanceEscapeTime(state, 10);
    expect(animal!.condition).toBeCloseTo(before, 5);
    advanceEscapeTime(state, 20);
    expect(animal!.condition).toBeLessThan(before);
    advanceEscapeTime(state, 30);
    expect(animal!.whereabouts).toBe("neighbour");
    expect(state.cashNad).toBeCloseTo(cash - STEP3C.neighbourCostNad, 5);
    advanceEscapeTime(state, 40);
    expect(state.cashNad).toBeCloseTo(cash - STEP3C.neighbourCostNad, 5);
    expect(state.notifications?.log.some((item) => item.kind === "animal_out")).toBe(true);
    expect(state.notifications?.log.some((item) => item.body.includes(animal!.id))).toBe(false);
  });

  it("selects tollies over 300 kg and leaves the lighter ones", () => {
    const state = createGame(22);
    ensureAnimals(state);
    const heavy = filterAnimals(state.story!.animals ?? [], TOLLY_OVER_300);
    const light = (state.story?.animals ?? []).filter((animal) => animal.stockClass === "tolly" && animal.weightKg < 300);
    expect(heavy.length).toBeGreaterThan(0);
    expect(light.length).toBeGreaterThan(0);
    expect(heavy.every((animal) => animal.stockClass === "tolly" && animal.weightKg >= 300)).toBe(true);
  });

  it("queues a night cut-out and then walks it without teleporting", () => {
    const state = createGame(23);
    const dest = state.camps.find((camp) => camp.id !== state.herd.campId);
    expect(dest).toBeTruthy();
    const ids = filterAnimals(state.story!.animals ?? [], TOLLY_OVER_300)
      .slice(0, 3)
      .map((animal) => animal.id);
    expect(ids.length).toBeGreaterThan(1);
    state.date.hour = 21;
    const night = requestCutOut(state, ids, { kind: "camp", campId: dest!.id });
    expect(night.ok).toBe(true);
    if (night.ok) expect(night.queued).toBe(true);
    expect(state.story?.cutOut?.phase).toBe("queued");
    expect(state.story?.cutOut?.queueReason).toBe("night");
    tickCutOutRealtime(state, 4000, "x3");
    expect(state.story?.cutOut?.phase).toBe("queued");
    for (const id of ids) {
      expect(state.story?.animals?.find((animal) => animal.id === id)?.whereabouts).toBe("in_camp");
    }

    state.date.hour = 9;
    tickCutOutRealtime(state, 40, "x1");
    expect(state.story?.cutOut?.phase).toBe("approach");
    const approached = state.story?.cutOut?.approachProgress ?? 0;
    expect(approached).toBeGreaterThan(0);
    expect(approached).toBeLessThan(0.5);
    for (const id of ids) {
      const animal = state.story?.animals?.find((item) => item.id === id);
      expect(animal?.campId).not.toBe(dest!.id);
    }

    let guard = 0;
    while (state.story?.cutOut?.phase === "approach" && guard < 300) {
      tickCutOutRealtime(state, 250, "x3");
      guard += 1;
    }
    expect(state.story?.cutOut?.phase).toBe("drive");
    const start = state.story?.cutOut?.progress ?? 0;
    tickCutOutRealtime(state, 50, "x1");
    const next = state.story?.cutOut?.progress ?? 0;
    expect(next).toBeGreaterThan(start);
    expect(next).toBeLessThan(0.4);
    expect(cutOutHerderProgress(state)).toBeLessThanOrEqual(cutOutRearProgress(state) + 0.001);
    expect(state.story?.cutOut?.herder === "farmer" || state.story?.cutOut?.herder === "piet").toBe(true);
  });

  it("rounds an escaped animal up with the same order", () => {
    const state = createGame(24);
    state.date.hour = 10;
    const animal = state.story!.animals!.find((item) => item.stockClass === "cow");
    expect(startEscape(state, animal!, 6)).toBe(true);
    const result = requestCutOut(state, [animal!.id], { kind: "camp", campId: state.herd.campId });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.queued).toBe(false);
    expect(state.story?.cutOut?.phase).toBe("approach");
    expect(state.story?.cutOut?.animalIds).toContain(animal!.id);
    const home = { x: animal!.tileX, y: animal!.tileY };
    tickCutOutRealtime(state, 30, "x1");
    expect(Math.hypot(animal!.tileX - home.x, animal!.tileY - home.y)).toBeLessThan(0.2);
  });

  it("treats a straight-down screen step as facing the camera", () => {
    expect(cowOctantFromScreen(0, 1)).toBe(2);
    expect(cowOctantFromScreen(0, -1)).toBe(6);
    expect(cowOctantFromScreen(1, 0)).toBe(0);
    expect(cowOctantFromScreen(-1, 0)).toBe(4);
    expect(tryDailyEscape(createGame(25), 0.99)).toBeNull();
  });
});
