import { describe, expect, it } from "vitest";
import { cattleBodyTiles, cattleFile, cattlePose, facingFromOctant, grazeFacing, nwSeDiagonal, personFile, personPose } from "./v2Art";
import { displayScaleForFile, keyRatios } from "./worldScale";
import { CONFIG } from "../sim/config";

describe("v2 art choices", () => {
  it("maps a travel octant onto the facing sheet", () => {
    expect(facingFromOctant(0)).toBe("e");
    expect(facingFromOctant(1)).toBe("se");
    expect(facingFromOctant(2)).toBe("s");
    expect(facingFromOctant(3)).toBe("sw");
    expect(facingFromOctant(4)).toBe("w");
    expect(facingFromOctant(6)).toBe("n");
    expect(facingFromOctant(7)).toBe("ne");
  });

  it("uses a graze pose while standing and the calf set for calves", () => {
    expect(cattleFile(1, false, 0, true)).toBe("cattle-brahman-graze-se.png");
    expect(cattleFile(3, false, 1, true)).toBe("cattle-bonsmara-graze-sw.png");
    expect(cattleFile(0, false, 2, false)).toBe("cattle-angus-e.png");
    expect(cattleFile(5, false, 3, false)).toBe("cattle-nguni-nw.png");
    expect(cattleFile(4, true, 0, false)).toBe("cattle-calf-w.png");
    expect(cattleFile(1, true, 9, true)).toBe("cattle-calf-graze-se.png");
    expect(grazeFacing(6)).toBe("sw");
    expect(grazeFacing(1)).toBe("se");
  });

  it("picks Piet and the farmer from the screen step", () => {
    expect(personFile("farmhand", -1, 0.4, true)).toContain("piet-walk");
    expect(personFile("farmer", 0, 1, false)).toBe("person-farmer-stand-s.png");
  });

  it("draws a calf at the world-scale fraction of a cow", () => {
    const cow = cattleBodyTiles(false);
    const calf = cattleBodyTiles(true);
    const ratios = keyRatios();
    expect(cow).toBeCloseTo(ratios.cow / CONFIG.view.tileWidth, 2);
    expect(calf / cow).toBeCloseTo(ratios.calf / ratios.cow, 2);
    const side = cattlePose(0, false, 1, false);
    expect(side?.scale).toBeCloseTo(displayScaleForFile("cattle-bonsmara-e.png") ?? 0, 5);
  });

  it("keeps the step 3c person height on every pose", () => {
    const pose = personPose("farmer", 0, 1, false);
    expect(pose).not.toBeNull();
    expect(pose!.scale).toBeCloseTo(displayScaleForFile("person-farmer-stand-s.png") ?? 0, 5);
    const ratios = keyRatios();
    expect(ratios.person).toBeCloseTo(CONFIG.view.tileWidth * 0.58, 5);
    expect(ratios.cow).toBeCloseTo(CONFIG.view.tileWidth * 0.62, 5);
  });

  it("tells the two fence diagonals apart", () => {
    expect(nwSeDiagonal(32, 16)).toBe(true);
    expect(nwSeDiagonal(-32, 16)).toBe(false);
  });
});
