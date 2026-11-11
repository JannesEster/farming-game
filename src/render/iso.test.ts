import { describe, expect, it } from "vitest";
import { CONFIG } from "../sim/config";
import { isoLayout, tileCenter, tileTop, worldToTile } from "./iso";

describe("isometric tiles", () => {
  it("sends every tile center back to that tile", () => {
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const mapW = CONFIG.map.tilesX;
    const mapH = CONFIG.map.tilesY;
    const layout = isoLayout(mapW, mapH, tileW, tileH, CONFIG.view.boundsPadPx);
    for (let y = 0; y < mapH; y += 1) {
      for (let x = 0; x < mapW; x += 1) {
        const center = tileCenter(x, y, layout, tileW, tileH);
        expect(center.x).toBeGreaterThanOrEqual(0);
        expect(center.y).toBeGreaterThanOrEqual(0);
        expect(center.x).toBeLessThan(layout.width);
        expect(center.y).toBeLessThan(layout.height);
        expect(worldToTile(center.x, center.y, layout, tileW, tileH)).toEqual({ x, y });
      }
    }
    const corner = tileTop(0, mapH - 1, layout, tileW, tileH);
    expect(corner.x - tileW / 2).toBeCloseTo(CONFIG.view.boundsPadPx, 5);
  });
});
