import { describe, expect, it } from "vitest";
import { generateFarm } from "../sim/generate";
import { roadTileBesideRamp } from "../sim/yard";
import { V2_SPRITES } from "./v2Manifest";
import {
  BAKKIE_LENGTH_METRES,
  COW_LENGTH_METRES,
  DOOR_METRES,
  EAVES_METRES,
  FARMHOUSE_WIDTH_METRES,
  CALF_OF_COW,
  COW_BODY_TILES,
  cowDisplayPx,
  HOLDING_M2_PER_HEAD,
  PEN_ALONG_METRES,
  PEN_DEPTH_METRES,
  PERSON_HEIGHT_TILES,
  personDisplayPx,
  PIXELS_PER_METRE,
  ROAD_TRAIN_METRES,
  SPRITE_SIZES,
  WINDMILL_HEIGHT_METRES,
  displayPx,
  displayScaleForSprite,
  keyRatios,
  largestPenM2PerHead,
  chooseScaleBar,
  metresPerTile,
  truckBayTiles,
  truckToYardRatio,
  yardLongSideMetres,
} from "./worldScale";

describe("world scale", () => {
  it("keeps one metres-to-pixels factor and grades every size as an assumption", () => {
    expect(PIXELS_PER_METRE).toBeCloseTo(cowDisplayPx() / COW_LENGTH_METRES, 5);
    expect(SPRITE_SIZES.length).toBeGreaterThan(20);
    for (const row of SPRITE_SIZES) {
      expect(row.grade).toBe("A");
      expect(row.metres).toBeGreaterThan(0);
      expect(row.note.length).toBeGreaterThan(20);
    }
    const livestock = SPRITE_SIZES.filter((row) => row.livestock).map((row) => row.id);
    expect(livestock).toEqual(["person", "cow", "calf"]);
  });

  it("keeps people and cattle at the step 3c size and scales the bakkie from the cow", () => {
    const ratios = keyRatios();
    expect(ratios.person).toBeCloseTo(personDisplayPx(), 5);
    expect(ratios.person).toBeCloseTo(64 * PERSON_HEIGHT_TILES, 5);
    expect(ratios.cow).toBeCloseTo(cowDisplayPx(), 5);
    expect(ratios.cow).toBeCloseTo(64 * COW_BODY_TILES, 5);
    expect(ratios.calf / ratios.cow).toBeCloseTo(CALF_OF_COW, 5);
    expect(ratios.door).toBeCloseTo(DOOR_METRES * PIXELS_PER_METRE, 5);
    expect(ratios.eaves).toBeCloseTo(EAVES_METRES * PIXELS_PER_METRE, 5);
    expect(ratios.cowOverBakkie).toBeCloseTo(COW_LENGTH_METRES / BAKKIE_LENGTH_METRES, 5);
    expect(ratios.cow).toBeLessThan(ratios.bakkie);
    expect(ratios.bakkie / ratios.cow).toBeCloseTo(BAKKIE_LENGTH_METRES / COW_LENGTH_METRES, 5);
  });

  it("keeps the bakkie shorter than the road train and the windmill taller than the bakkie", () => {
    const ratios = keyRatios();
    expect(ratios.bakkieOverTruck).toBeGreaterThan(0.2);
    expect(ratios.bakkieOverTruck).toBeLessThan(0.35);
    expect(ratios.bakkieOverTruck).toBeCloseTo(BAKKIE_LENGTH_METRES / ROAD_TRAIN_METRES, 5);
    expect(ratios.windmillOverBakkie).toBeGreaterThan(1.5);
    expect(ratios.windmill).toBeGreaterThan(ratios.bakkie);
    expect(ratios.farmhouse).toBeCloseTo(FARMHOUSE_WIDTH_METRES * PIXELS_PER_METRE, 5);
    expect(ratios.windmill / WINDMILL_HEIGHT_METRES).toBeCloseTo(PIXELS_PER_METRE, 5);
    expect(ratios.truck / ratios.cow).toBeCloseTo(ROAD_TRAIN_METRES / COW_LENGTH_METRES, 5);
    expect(ratios.farmhouse / ratios.cow).toBeCloseTo(FARMHOUSE_WIDTH_METRES / COW_LENGTH_METRES, 5);
  });

  it("derives the manifest sprites from those metres", () => {
    const cow = displayPx("cattle-bonsmara-e.png");
    const calf = displayPx("cattle-calf-e.png");
    const person = displayPx("person-farmer-stand-s.png");
    const bakkie = displayPx("vehicle-bakkie-se.png");
    const truck = displayPx("vehicle-roadtrain-e.png");
    const windmill = displayPx("prop-windmill-reservoir.png");
    const house = displayPx("bldg-farmhouse.png");
    const ratios = keyRatios();
    expect(cow).toBeCloseTo(ratios.cow, 4);
    expect(calf! / cow!).toBeCloseTo(ratios.calf / ratios.cow, 2);
    expect(person).toBeCloseTo(ratios.person, 4);
    expect(bakkie).toBeCloseTo(ratios.bakkie, 4);
    expect(truck).toBeCloseTo(ratios.truck, 4);
    expect(windmill).toBeCloseTo(ratios.windmill, 4);
    expect(house).toBeCloseTo(ratios.farmhouse, 4);
    const front = displayPx("cattle-bonsmara-s.png");
    expect(front!).toBeLessThan(cow! * 0.7);
  });

  it("gives every cut-out sprite a scale, and leaves ground tiles as pattern fills", () => {
    for (const sprite of V2_SPRITES) {
      const scale = displayScaleForSprite(sprite);
      if (sprite.category === "ground-tile") {
        expect(scale).toBeNull();
      } else {
        expect(scale, sprite.file).toBeGreaterThan(0);
        expect(scale!, sprite.file).toBeLessThan(5);
      }
    }
  });

  it("sizes the pens for a sale draft and keeps the truck shorter than the yard", () => {
    expect(largestPenM2PerHead()).toBeGreaterThanOrEqual(1.5);
    expect(largestPenM2PerHead()).toBeLessThanOrEqual(2);
    expect(largestPenM2PerHead()).toBeCloseTo((PEN_ALONG_METRES[0] * PEN_DEPTH_METRES) / 24, 5);
    expect(HOLDING_M2_PER_HEAD).toBe(1.8);
    const longSide = yardLongSideMetres();
    expect(longSide).toBeGreaterThan(ROAD_TRAIN_METRES);
    expect(truckToYardRatio()).toBeGreaterThan(0.55);
    expect(truckToYardRatio()).toBeLessThan(0.85);
    expect(truckBayTiles()).toBeGreaterThanOrEqual(5);
  });

  it("rounds the scale bar to a nice distance and matches the bar length", () => {
    const close = chooseScaleBar(1);
    expect([5, 10, 20, 50, 100, 250, 500, 1000, 2000]).toContain(close.metres);
    expect(close.px).toBeGreaterThanOrEqual(48);
    expect(close.px).toBeLessThanOrEqual(200);
    expect(close.label.endsWith(" m") || close.label.endsWith(" km")).toBe(true);
    const far = chooseScaleBar(0.02);
    expect(far.metres).toBeGreaterThanOrEqual(100);
    expect(far.label).toMatch(/m|km/);
  });

  it("draws a gravel run long enough for the road train on a generated farm", () => {
    const state = generateFarm(1);
    const bay = roadTileBesideRamp(state);
    expect(bay).toBeTruthy();
    const tracks = new Set(
      state.features.filter((feature) => feature.kind === "track").map((feature) => `${feature.x},${feature.y}`),
    );
    const axes = [
      [1, 0],
      [0, 1],
    ] as const;
    let longest = 1;
    for (const [dx, dy] of axes) {
      let run = 1;
      for (const sign of [1, -1]) {
        let x = bay!.x;
        let y = bay!.y;
        while (tracks.has(`${x + dx * sign},${y + dy * sign}`)) {
          x += dx * sign;
          y += dy * sign;
          run += 1;
        }
      }
      longest = Math.max(longest, run);
    }
    expect(longest).toBeGreaterThanOrEqual(Math.ceil(ROAD_TRAIN_METRES / metresPerTile()));
    expect(longest).toBeGreaterThanOrEqual(truckBayTiles() - 4);
  });
});
