import { CONFIG } from "../sim/config";
import {
  COPY,
  formatCampBadge,
  formatCampLine,
  formatCondition,
  formatDate,
  formatDaysInCamp,
  formatFeedStatus,
  formatGrassLeft,
  formatGrassPercent,
  formatHead,
  formatMoney,
  formatMoveWarning,
  formatRain,
  formatSeason,
} from "../sim/format";
import { moveAdvice } from "../sim/grazing";
import { findCamp } from "../sim/simulation";
import { grazeableFraction, grazingDaysLeft } from "../sim/pasture";
import type { GameState } from "../sim/types";
import { paintMinimap } from "./colour";
import { grassTint, lerpColour, palette, toCss } from "./palette";

export type SpeedMode = "pause" | "play" | "fast";

export type Hud = {
  update(state: GameState, selected: boolean): void;
  campBadge(campId: number): string;
  setSpeed(mode: SpeedMode): void;
  setHint(text: string): void;
  destroy(): void;
};

const ICONS = {
  pause:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l12 7-12 7z"></path></svg>',
  fast: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5l8 7-8 7z"></path><path d="M12 5l8 7-8 7z"></path></svg>',
};

export function mountHud(options: {
  onSpeed: (mode: SpeedMode) => void;
  onMinimap: (nx: number, ny: number) => void;
  onNewFarm: () => void;
  onHome: () => void;
}): Hud {
  const root = document.getElementById("hud-root");
  if (!root) throw new Error("Missing the HUD root.");
  root.replaceChildren();
  root.innerHTML = `
    <header class="topbar">
      <p class="brand">${CONFIG.farm.name}</p>
      <div class="stats">
        <span class="pill" id="stat-date"></span>
        <span class="pill" id="stat-season"></span>
        <span class="pill" id="stat-cash" title="${COPY.cashTitle}"></span>
        <span class="pill" id="stat-rain" title="${COPY.rainTitle}"></span>
      </div>
      <div class="speeds" role="group" aria-label="Speed">
        <button type="button" id="speed-pause" aria-label="Pause">${ICONS.pause}</button>
        <button type="button" id="speed-play" aria-label="Play">${ICONS.play}</button>
        <button type="button" id="speed-fast" aria-label="Fast">${ICONS.fast}</button>
      </div>
      <button type="button" class="pill-btn" id="view-home" title="Centre on the homestead">Home</button>
      <button type="button" class="pill-btn" id="new-farm">${COPY.newFarmLabel}</button>
      <p class="hint" id="hint"></p>
    </header>
    <section class="card" id="herd-card" hidden>
      <h2 id="herd-name"></h2>
      <p id="herd-camp"></p>
      <p id="herd-head"></p>
      <div class="meter"><span>Condition</span><div class="bar"><span id="condition-bar"></span></div><b id="condition-value"></b></div>
      <div class="meter"><span>Grass</span><div class="bar"><span id="grass-bar"></span></div><b id="grass-value"></b></div>
      <p id="herd-days"></p>
      <p class="warn move-warn" id="herd-move-warn" hidden></p>
      <p class="move-recovery" id="herd-recovery" hidden></p>
      <p class="extra" id="herd-left"></p>
      <p class="extra warn" id="herd-status"></p>
    </section>
    <canvas class="minimap" id="minimap" width="232" height="232" aria-label="Camp minimap. Tap to look there. With the herd selected, tap a camp to move it."></canvas>
  `;

  const dateEl = required(root, "stat-date");
  const seasonEl = required(root, "stat-season");
  const cashEl = required(root, "stat-cash");
  const rainEl = required(root, "stat-rain");
  const hintEl = required(root, "hint");
  const card = required(root, "herd-card");
  const nameEl = required(root, "herd-name");
  const campEl = required(root, "herd-camp");
  const headEl = required(root, "herd-head");
  const conditionBar = required(root, "condition-bar");
  const conditionValue = required(root, "condition-value");
  const grassBar = required(root, "grass-bar");
  const grassValue = required(root, "grass-value");
  const daysEl = required(root, "herd-days");
  const moveWarnEl = required(root, "herd-move-warn");
  const recoveryEl = required(root, "herd-recovery");
  const leftEl = required(root, "herd-left");
  const statusEl = required(root, "herd-status");
  const newFarmBtn = requiredButton(root, "new-farm");
  const homeBtn = requiredButton(root, "view-home");
  const minimap = root.querySelector<HTMLCanvasElement>("#minimap");
  if (!minimap) throw new Error("Missing the minimap.");

  const buttons: Record<SpeedMode, HTMLButtonElement> = {
    pause: requiredButton(root, "speed-pause"),
    play: requiredButton(root, "speed-play"),
    fast: requiredButton(root, "speed-fast"),
  };
  (Object.keys(buttons) as SpeedMode[]).forEach((mode) => {
    buttons[mode].addEventListener("click", () => options.onSpeed(mode));
  });
  newFarmBtn.addEventListener("click", () => options.onNewFarm());
  homeBtn.addEventListener("click", () => options.onHome());
  minimap.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = minimap.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    options.onMinimap(nx, ny);
  });

  let lastState: GameState | null = null;

  return {
    campBadge(campId) {
      if (!lastState) return "";
      const camp = findCamp(lastState, campId);
      if (!camp) return "";
      const advice = moveAdvice(lastState.herd, camp, lastState.date);
      return formatCampBadge(advice, campId === lastState.herd.campId);
    },
    update(state, selected) {
      lastState = state;
      dateEl.textContent = formatDate(state.date);
      seasonEl.textContent = formatSeason(state.date);
      cashEl.textContent = formatMoney(state.cashNad);
      rainEl.textContent = formatRain(state.seasonRainMm);
      rainEl.classList.toggle("is-raining", state.todayRainMm > 0);
      card.hidden = !selected;
      if (selected) {
        const camp = findCamp(state, state.herd.campId);
        nameEl.textContent = state.herd.name;
        if (camp) {
          const fraction = grazeableFraction(camp);
          const daysLeft = grazingDaysLeft(camp, state.herd);
          campEl.textContent = formatCampLine(camp.name, camp.hectares);
          headEl.textContent = formatHead(state.herd.headCount);
          const conditionPct = Math.max(0, Math.min(100, state.herd.condition));
          conditionBar.style.width = `${conditionPct}%`;
          conditionBar.style.background = toCss(
            lerpColour(palette.grassBrown, palette.grassGreen, conditionPct / 100),
          );
          conditionValue.textContent = formatCondition(state.herd.condition);
          grassBar.style.width = `${Math.round(fraction * 100)}%`;
          grassBar.style.background = toCss(grassTint(fraction));
          grassValue.textContent = formatGrassPercent(fraction);
          daysEl.textContent = formatDaysInCamp(state.herd.daysInCamp);
          const moveWarn = formatMoveWarning(state.herd, camp, state.date);
          moveWarnEl.textContent = moveWarn;
          moveWarnEl.hidden = moveWarn.length === 0;
          recoveryEl.textContent = moveWarn.length > 0 ? COPY.moveRecovery : "";
          recoveryEl.hidden = moveWarn.length === 0;
          leftEl.textContent = formatGrassLeft(daysLeft, fraction);
          const status = formatFeedStatus(daysLeft);
          statusEl.textContent = status;
          statusEl.hidden = status.length === 0;
        }
      }
      paintMinimap(minimap, state);
    },
    setSpeed(mode) {
      (Object.keys(buttons) as SpeedMode[]).forEach((key) => {
        buttons[key].setAttribute("aria-pressed", key === mode ? "true" : "false");
      });
    },
    setHint(text) {
      hintEl.textContent = text;
    },
    destroy() {
      root.replaceChildren();
    },
  };
}

function required(root: ParentNode, id: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(`#${id}`);
  if (!element) throw new Error(`Missing #${id}.`);
  return element;
}

function requiredButton(root: ParentNode, id: string): HTMLButtonElement {
  const element = root.querySelector<HTMLButtonElement>(`#${id}`);
  if (!element) throw new Error(`Missing #${id}.`);
  return element;
}
