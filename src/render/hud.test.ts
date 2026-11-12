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
import { mountMarketSheet } from "./marketSheet";

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
      onOpenMarket: () => {},
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

  it("hides the toast while a story card is open and shows the queued hint after", () => {
    const hud = mountHud({
      onSpeed: () => {},
      onMinimap: () => {},
      onNewFarm: () => {},
      onHome: () => {},
      onDeselect: () => {},
      onConfirmMove: () => {},
      onCancelMove: () => {},
      onOpenMarket: () => {},
    });
    hud.setHint("Walking to Camp 2.");
    expect(document.getElementById("toast")?.hidden).toBe(false);

    hud.showEventCard("Month in review", "Licks, vet and diesel are paid.");
    expect(document.getElementById("toast")?.hidden).toBe(true);
    expect(document.getElementById("event-card")?.hidden).toBe(false);

    hud.setHint("Grass in Camp 4 is getting short.");
    expect(document.getElementById("toast")?.hidden).toBe(true);

    document.getElementById("event-dismiss")?.click();
    const toast = document.getElementById("toast");
    expect(document.getElementById("event-card")?.hidden).toBe(true);
    expect(toast?.hidden).toBe(false);
    expect(toast?.textContent).toBe("Grass in Camp 4 is getting short.");
    hud.destroy();
  });

  it("keeps the tutorial card as the only message and drops its echo", () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<aside id="flow-tutorial"><h2 id="flow-tutorial-title">Select the herd</h2><p id="flow-tutorial-body">Tap the cattle once. The strip shows camp, head count, and grass. Time stays paused while this tip is open.</p></aside>`,
    );
    const hud = mountHud({
      onSpeed: () => {},
      onMinimap: () => {},
      onNewFarm: () => {},
      onHome: () => {},
      onDeselect: () => {},
      onConfirmMove: () => {},
      onCancelMove: () => {},
      onOpenMarket: () => {},
    });
    hud.holdToasts();
    hud.setHint(
      "Select the herd: Tap the cattle once. The strip shows camp, head count, and grass. Time stays paused while this tip is open.",
    );
    expect(document.getElementById("toast")?.hidden).toBe(true);

    document.getElementById("flow-tutorial")!.hidden = true;
    hud.releaseToasts();
    expect(document.getElementById("toast")?.hidden).toBe(true);

    document.getElementById("flow-tutorial")!.hidden = false;
    hud.holdToasts();
    hud.setHint("Walking to Camp 8.");
    expect(document.getElementById("toast")?.hidden).toBe(true);
    document.getElementById("flow-tutorial")!.hidden = true;
    hud.releaseToasts();
    expect(document.getElementById("toast")?.textContent).toBe("Walking to Camp 8.");
    expect(document.getElementById("toast")?.hidden).toBe(false);
    hud.destroy();
  });

  it("shows the herd name once when the card is open, without the summary line", () => {
    const state = initialGameState();
    const hud = mountHud({
      onSpeed: () => {},
      onMinimap: () => {},
      onNewFarm: () => {},
      onHome: () => {},
      onDeselect: () => {},
      onConfirmMove: () => {},
      onCancelMove: () => {},
      onOpenMarket: () => {},
    });
    hud.update(state, { selected: true, expanded: true, pendingCampId: null, pendingCampName: "" });
    const sheet = document.getElementById("herd-sheet");
    const name = document.getElementById("herd-name");
    const line = document.getElementById("sheet-line");
    expect(sheet?.dataset.expanded).toBe("true");
    expect(name?.textContent).toBe(state.herd.name);
    expect(name?.hidden).toBe(false);
    expect(line?.hidden).toBe(true);
    expect(line?.textContent).toContain("Herd");
    expect(document.querySelectorAll("#herd-name").length).toBe(1);
    hud.destroy();
  });

  it("keeps the market sheet after the HUD mounts", () => {
    const hud = mountHud({
      onSpeed: () => {},
      onMinimap: () => {},
      onNewFarm: () => {},
      onHome: () => {},
      onDeselect: () => {},
      onConfirmMove: () => {},
      onCancelMove: () => {},
      onOpenMarket: () => {},
    });
    const state = initialGameState();
    const market = mountMarketSheet({
      getState: () => state,
      onChange: () => {},
      onToast: () => {},
    });
    market.open();
    expect(document.getElementById("market-sell-btn")?.isConnected).toBe(true);
    expect(document.getElementById("market-sheet")?.hidden).toBe(false);
    market.destroy();
    hud.destroy();
  });
});
