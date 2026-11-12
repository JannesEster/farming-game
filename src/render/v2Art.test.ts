import { describe, expect, it } from "vitest";
import { cattleBodyTiles, cattleFile, facingFromOctant, grazeFacing, nwSeDiagonal, personFile, personPose } from "./v2Art";

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

  it("draws a calf at about two thirds of a cow's length", () => {
    const cow = cattleBodyTiles(false);
    const calf = cattleBodyTiles(true);
    expect(cow).toBeCloseTo(0.62, 2);
    expect(calf / cow).toBeGreaterThanOrEqual(0.65);
    expect(calf / cow).toBeLessThanOrEqual(0.7);
  });

  it("draws a worker tall enough to read behind a herd", () => {
    const pose = personPose("farmhand", 1, 0.4, true);
    expect(pose).not.toBeNull();
    const heightTiles = ((pose?.scale ?? 0) * 140) / 64;
    expect(heightTiles).toBeGreaterThan(0.5);
  });

  it("tells the two fence diagonals apart", () => {
    expect(nwSeDiagonal(32, 16)).toBe(true);
    expect(nwSeDiagonal(-32, 16)).toBe(false);
  });
});
