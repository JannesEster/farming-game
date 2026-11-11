// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { measureTopbarSpare } from "./hud";

describe("measureTopbarSpare", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="hud-root">
        <header class="topbar compact">
          <div class="chips" style="flex:1;width:260px">
            <span class="chip" id="stat-date" style="display:inline-block;width:40px">1 Aug</span>
            <span class="chip-icon" id="stat-season" style="display:inline-block;width:24px"></span>
            <span class="chip" id="stat-cash" style="display:inline-block;width:43px">N$250k</span>
            <span class="chip" id="stat-rain" style="display:inline-block;width:35px">0 mm</span>
          </div>
          <div class="top-actions" style="position:absolute;left:210px;width:148px;height:36px"></div>
        </header>
      </div>
    `;
    const root = document.getElementById("hud-root")!;
    const chips = root.querySelector<HTMLElement>(".chips")!;
    const actions = root.querySelector<HTMLElement>(".top-actions")!;
    chips.getBoundingClientRect = () => ({ right: 260, left: 0, top: 0, bottom: 44, width: 260, height: 44, x: 0, y: 0, toJSON: () => ({}) });
    actions.getBoundingClientRect = () => ({ left: 210, right: 358, top: 0, bottom: 36, width: 148, height: 36, x: 210, y: 0, toJSON: () => ({}) });
    root.querySelectorAll<HTMLElement>(".chips .chip, .chips .chip-icon").forEach((el, i) => {
      const rights = [40, 64, 107, 142];
      const w = [40, 24, 43, 35][i];
      el.getBoundingClientRect = () => ({
        right: rights[i],
        left: rights[i] - w,
        top: 0,
        bottom: 20,
        width: w,
        height: 20,
        x: rights[i] - w,
        y: 0,
        toJSON: () => ({}),
      });
    });
  });

  it("measures gap from the last chip, not the flex chips row width", () => {
    const { sparePx, chipsRight, actionsLeft } = measureTopbarSpare();
    expect(chipsRight).toBe(142);
    expect(actionsLeft).toBe(210);
    expect(sparePx).toBe(68);
  });
});
