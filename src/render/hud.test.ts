// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";
import "../style.css";
import { initialGameState } from "../sim/persist";

vi.mock("./colour", () => ({
  paintMinimap: () => {},
  grassTint: () => "#888",
  lerpColour: () => ({ r: 0, g: 0, b: 0 }),
  toCss: () => "#000",
  tileTint: () => ({ r: 0, g: 0, b: 0 }),
  trackKeys: () => new Set(),
  groundTexture: () => "grass",
  terrainVariant: () => 0,
}));

import { mountHud } from "./hud";

describe("compact phone HUD", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="game"></div><div id="hud-root"></div>`;
  });

  it("mounts a slim top bar, collapsed sheet, and minimap chrome", () => {
    const state = initialGameState();
    const hud = mountHud({
      onSpeed: () => {},
      onMinimap: () => {},
      onNewFarm: () => {},
      onHome: () => {},
      onDeselect: () => {},
      onConfirmMove: () => {},
      onCancelMove: () => {},
    });
    hud.update(state, { selected: true, pendingCampId: null, pendingCampName: "" });

    const topbar = document.querySelector<HTMLElement>(".topbar.compact");
    const minimap = document.querySelector<HTMLElement>(".minimap");
    const summary = document.querySelector<HTMLElement>(".sheet-summary");
    expect(topbar).toBeTruthy();
    expect(minimap).toBeTruthy();
    expect(summary).toBeTruthy();
    expect(topbar?.classList.contains("compact")).toBe(true);
    expect(minimap?.classList.contains("minimap")).toBe(true);
    expect(document.getElementById("herd-sheet")?.getAttribute("data-expanded")).toBe("false");
    expect(document.getElementById("menu-overflow")).toBeTruthy();
    hud.destroy();
  });
});
