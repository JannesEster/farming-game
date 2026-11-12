import {
  COPY,
  formatCampBadge,
  formatCampLine,
  formatCondition,
  formatHudDate,
  formatHudMoney,
  formatHudRain,
  formatHerdSheetSummary,
  formatDaysInCamp,
  formatFeedStatus,
  formatGrassLeft,
  formatGrassPercent,
  formatHead,
  formatMoveWarning,
} from "../sim/format";
import { compositionSummaryLine } from "../sim/cattleClasses";
import { seasonLabelForHud } from "../sim/story";
import { moveAdvice } from "../sim/grazing";
import { findCamp } from "../sim/simulation";
import { formatClockTime, type DayLengthSeconds } from "../sim/clock";
import { CONFIG } from "../sim/config";
import type { NotificationItem } from "../sim/notifications";
import { grazeableFraction, grazingDaysLeft } from "../sim/pasture";
import type { GameState } from "../sim/types";
import type { ViewInsets } from "./camera";
import { paintMinimap } from "./colour";
import { grassTint, lerpColour, palette, toCss } from "./palette";

export type SpeedMode = "pause" | "x1" | "x2" | "x3";

export type Hud = {
  update(
    state: GameState,
    ui: { selected: boolean; expanded?: boolean; pendingCampId: number | null; pendingCampName: string },
  ): void;
  campBadge(campId: number): string;
  setSpeed(mode: SpeedMode): void;
  setHint(text: string): void;
  clearHint(): void;
  showEventCard(title: string, body: string): void;
  hideEventCard(): void;
  /** Hide the hint toast while a tutorial or story card is on screen. */
  holdToasts(): void;
  /** Show the newest queued hint once every card is closed. */
  releaseToasts(): void;
  setHerdLocator(visible: boolean, label: string, edge: "left" | "right" | "top" | "bottom"): void;
  pushLetter(item: NotificationItem): void;
  syncAlerts(labels: string[]): void;
  pushNewsLog(lines: string[]): void;
  setScaleBar(label: string): void;
  setDaylight(blend: number): void;
  setNightChrome(active: boolean): void;
  destroy(): void;
};

const ICONS = {
  pause:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l12 7-12 7z"></path></svg>',
  x2: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5l8 7-8 7z"></path><path d="M12 5l8 7-8 7z"></path></svg>',
  x3: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 5l7 7-7 7z"></path><path d="M9 5l7 7-7 7z"></path><path d="M16 5l7 7-7 7z"></path></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>',
  dry: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4 4l1.5 1.5M18.5 18.5L20 20M4 20l1.5-1.5M18.5 5.5L20 4"></path></svg>',
  rain: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14a6 6 0 0111.3-2.8A4.5 4.5 0 0118 16H7a3 3 0 01-1-2z"></path><path d="M8 18l1 3M12 17l1 3M16 18l1 3"></path></svg>',
};

export function mountHud(options: {
  onSpeed: (mode: SpeedMode) => void;
  onMinimap: (nx: number, ny: number) => void;
  onNewFarm: () => void;
  onHome: () => void;
  onDeselect: () => void;
  onConfirmMove: () => void;
  onCancelMove: () => void;
  onOpenMarket: () => void;
  onOpenOps?: () => void;
  onSheetExpanded?: (expanded: boolean) => void;
  onHerdLocator?: () => void;
  onDayLength?: (seconds: DayLengthSeconds) => void;
}): Hud {
  const root = document.getElementById("hud-root");
  if (!root) throw new Error("Missing the HUD root.");
  root.replaceChildren();
  root.innerHTML = `
    <header class="topbar compact">
      <div class="chips" role="group" aria-label="Farm stats">
        <span class="chip chip-date" id="stat-date"></span>
        <span class="chip chip-time" id="stat-time" title="Ranch clock"></span>
        <span class="chip chip-icon" id="stat-season" title="Season"></span>
        <span class="chip" id="stat-cash" title="${COPY.cashTitle}"></span>
        <span class="chip" id="stat-rain" title="${COPY.rainTitle}"></span>
      </div>
      <div class="top-actions">
        <div class="speeds compact" role="group" aria-label="Speed">
          <button type="button" id="speed-pause" aria-label="Pause">${ICONS.pause}</button>
          <button type="button" id="speed-x1" aria-label="Speed 1x">${ICONS.play}</button>
          <button type="button" id="speed-x2" aria-label="Speed 2x">${ICONS.x2}</button>
          <button type="button" id="speed-x3" aria-label="Speed 3x">${ICONS.x3}</button>
        </div>
        <button type="button" class="icon-btn" id="menu-overflow" aria-label="More actions" aria-expanded="false">${ICONS.menu}</button>
      </div>
      <div class="overflow-menu" id="overflow-menu" hidden>
        <button type="button" id="view-home">Home</button>
        <button type="button" id="market-open">Sell / market</button>
        <button type="button" id="ops-open">Ranch ops</button>
        <label class="settings-row" for="day-length-select">Day length</label>
        <select id="day-length-select" aria-label="Day length in minutes">
          <option value="180">3 minutes</option>
          <option value="240">4 minutes</option>
          <option value="300">5 minutes</option>
        </select>
        <button type="button" id="new-farm">${COPY.newFarmLabel}</button>
      </div>
    </header>
    <aside class="news-rail" id="news-rail" aria-label="News">
      <div class="letter-stack" id="letter-stack" hidden></div>
      <ul class="alert-strip" id="alert-strip" hidden></ul>
    </aside>
    <p class="toast" id="toast" role="status" aria-live="polite" hidden></p>
    <aside class="news-log" id="news-log" hidden>
      <header><strong>News log</strong><button type="button" class="icon-btn" id="news-log-close" aria-label="Close log">×</button></header>
      <ul id="news-log-list"></ul>
    </aside>
    <button type="button" class="chip news-log-btn" id="news-log-open" hidden>News</button>
    <div class="scale-bar" id="scale-bar" aria-hidden="true"><span id="scale-label"></span><i id="scale-tick"></i></div>
    <article class="event-card" id="event-card" hidden>
      <h3 id="event-title"></h3>
      <p id="event-body"></p>
      <button type="button" class="pill-btn ghost" id="event-dismiss">OK</button>
    </article>
    <section class="sheet" id="herd-sheet" hidden data-expanded="false">
      <div class="sheet-summary" id="sheet-summary" role="button" tabindex="0" aria-expanded="false">
        <span class="sheet-line" id="sheet-line"></span>
        <span class="warn-dot" id="sheet-warn-dot" hidden aria-label="Time to move"></span>
        <button type="button" class="icon-btn sheet-close" id="sheet-close" aria-label="Close herd card">×</button>
      </div>
      <div class="sheet-detail" id="sheet-detail" hidden>
        <h2 id="herd-name"></h2>
        <p id="herd-camp"></p>
        <p id="herd-head"></p>
        <div class="meter"><span>Condition</span><div class="bar"><span id="condition-bar"></span></div><b id="condition-value"></b></div>
        <div class="meter"><span>Grass</span><div class="bar"><span id="grass-bar"></span></div><b id="grass-value"></b></div>
        <p id="herd-days"></p>
        <p class="warn move-warn" id="herd-move-warn" hidden></p>
        <p class="move-recovery" id="herd-recovery" hidden></p>
        <p class="extra" id="herd-classes"></p>
        <p class="extra" id="herd-left"></p>
        <p class="extra warn" id="herd-status"></p>
        <div class="move-confirm" id="move-confirm" hidden>
          <p id="move-confirm-text"></p>
          <button type="button" class="pill-btn confirm" id="move-confirm-btn">Move here</button>
          <button type="button" class="pill-btn ghost" id="move-cancel-btn">Cancel</button>
        </div>
      </div>
    </section>
    <canvas class="minimap" id="minimap" width="232" height="232" aria-label="Camp minimap. Tap to look there. With the herd selected, tap a camp to move it."></canvas>
    <button type="button" class="chip herd-locator" id="herd-locator" hidden>→ Herd</button>
  `;

  const dateEl = required(root, "stat-date");
  const timeEl = required(root, "stat-time");
  const seasonEl = required(root, "stat-season");
  const cashEl = required(root, "stat-cash");
  const rainEl = required(root, "stat-rain");
  const toastEl = required(root, "toast");
  const sheet = required(root, "herd-sheet");
  const summary = required(root, "sheet-summary");
  const sheetLine = required(root, "sheet-line");
  const warnDot = required(root, "sheet-warn-dot");
  const sheetDetail = required(root, "sheet-detail");
  const closeBtn = requiredButton(root, "sheet-close");
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
  const classesEl = required(root, "herd-classes");
  const leftEl = required(root, "herd-left");
  const statusEl = required(root, "herd-status");
  const moveConfirm = required(root, "move-confirm");
  const moveConfirmText = required(root, "move-confirm-text");
  const moveConfirmBtn = requiredButton(root, "move-confirm-btn");
  const moveCancelBtn = requiredButton(root, "move-cancel-btn");
  const marketBtn = requiredButton(root, "market-open");
  const opsBtn = requiredButton(root, "ops-open");
  const overflowBtn = requiredButton(root, "menu-overflow");
  const eventCard = required(root, "event-card");
  const eventTitle = required(root, "event-title");
  const eventBody = required(root, "event-body");
  const eventDismiss = requiredButton(root, "event-dismiss");
  const overflowMenu = required(root, "overflow-menu");
  const newFarmBtn = requiredButton(root, "new-farm");
  const homeBtn = requiredButton(root, "view-home");
  const dayLengthSelect = required(root, "day-length-select") as HTMLSelectElement;
  const minimap = root.querySelector<HTMLCanvasElement>("#minimap");
  if (!minimap) throw new Error("Missing the minimap.");
  const herdLocator = requiredButton(root, "herd-locator");
  herdLocator.addEventListener("click", () => options.onHerdLocator?.());

  const letterStack = required(root, "letter-stack");
  const alertStrip = required(root, "alert-strip");
  const newsLog = required(root, "news-log");
  const newsLogList = required(root, "news-log-list");
  const newsLogOpen = requiredButton(root, "news-log-open");
  const   newsLogClose = requiredButton(root, "news-log-close");
  newsLogOpen.addEventListener("click", () => {
    newsLog.hidden = false;
  });
  newsLogClose.addEventListener("click", () => {
    newsLog.hidden = true;
  });
  const scaleLabel = required(root, "scale-label");
  const buttons: Record<SpeedMode, HTMLButtonElement> = {
    pause: requiredButton(root, "speed-pause"),
    x1: requiredButton(root, "speed-x1"),
    x2: requiredButton(root, "speed-x2"),
    x3: requiredButton(root, "speed-x3"),
  };
  (Object.keys(buttons) as SpeedMode[]).forEach((mode) => {
    buttons[mode].addEventListener("click", () => options.onSpeed(mode));
  });
  marketBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    overflowMenu.hidden = true;
    overflowBtn.setAttribute("aria-expanded", "false");
    options.onOpenMarket();
  });
  opsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    overflowMenu.hidden = true;
    overflowBtn.setAttribute("aria-expanded", "false");
    options.onOpenOps?.();
  });
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let toastHeld = false;
  let queuedHint: string | null = null;
  let blockedText: string[] = [];

  const tutorialOpen = (): boolean => {
    const tutorial = document.getElementById("flow-tutorial");
    return Boolean(tutorial && !tutorial.hidden);
  };
  const cardBlocksToast = (): boolean => toastHeld || tutorialOpen() || !eventCard.hidden;
  const rememberBlockedCopy = (): void => {
    const bits: string[] = [];
    const push = (value: string | null | undefined) => {
      const text = value?.trim();
      if (text) bits.push(text);
    };
    if (tutorialOpen() || toastHeld) {
      push(document.getElementById("flow-tutorial-title")?.textContent);
      push(document.getElementById("flow-tutorial-body")?.textContent);
    }
    if (!eventCard.hidden) {
      push(eventTitle.textContent);
      push(eventBody.textContent);
    }
    if (bits.length > 0) blockedText = bits;
  };
  const echoesCard = (text: string, bits: string[]): boolean =>
    bits.some((bit) => bit.length > 8 && text.includes(bit));
  const hideToast = (): void => {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
    toastEl.classList.remove("is-visible");
    toastEl.hidden = true;
  };
  const showToast = (text: string): void => {
    toastEl.textContent = text;
    toastEl.hidden = false;
    toastEl.classList.add("is-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("is-visible");
      toastTimer = setTimeout(() => {
        toastEl.hidden = true;
      }, 320);
    }, 3000);
  };
  const flushQueuedToast = (): void => {
    if (cardBlocksToast()) return;
    const text = queuedHint;
    const bits = blockedText;
    queuedHint = null;
    blockedText = [];
    if (!text || echoesCard(text, bits)) return;
    showToast(text);
  };

  eventDismiss.addEventListener("click", () => {
    eventCard.hidden = true;
    flushQueuedToast();
  });
  newFarmBtn.addEventListener("click", () => {
    overflowMenu.hidden = true;
    options.onNewFarm();
  });
  homeBtn.addEventListener("click", () => {
    overflowMenu.hidden = true;
    options.onHome();
  });
  dayLengthSelect.value = String(CONFIG.time.dayLengthSecondsDefault);
  dayLengthSelect.addEventListener("change", () => {
    const seconds = Number(dayLengthSelect.value) as DayLengthSeconds;
    if (CONFIG.time.dayLengthOptions.includes(seconds)) options.onDayLength?.(seconds);
  });
  overflowBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = overflowMenu.hidden;
    overflowMenu.hidden = !open;
    overflowBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  root.addEventListener(
    "pointerdown",
    (event) => {
      if (overflowMenu.hidden) return;
      const target = event.target as Node | null;
      if (target && (overflowBtn.contains(target) || overflowMenu.contains(target))) return;
      overflowMenu.hidden = true;
      overflowBtn.setAttribute("aria-expanded", "false");
    },
    true,
  );
  closeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    options.onDeselect();
  });
  moveConfirmBtn.addEventListener("click", () => options.onConfirmMove());
  moveCancelBtn.addEventListener("click", () => options.onCancelMove());
  summary.addEventListener("click", () => toggleExpanded());
  summary.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpanded();
    }
  });
  minimap.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = minimap.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    options.onMinimap(nx, ny);
  });

  let lastState: GameState | null = null;
  let expanded = false;

  const syncChromeInsets = (): void => {
    const topbarH = root.querySelector<HTMLElement>(".topbar")?.getBoundingClientRect().height ?? 44;
    const minimapRect = minimap.getBoundingClientRect();
    const sheetRect = sheet.hidden ? null : sheet.getBoundingClientRect();
    const clearTop = topbarH;
    const clearBottom =
      sheetRect === null
        ? Math.max(0, window.innerHeight - minimapRect.top)
        : Math.max(0, window.innerHeight - Math.min(sheetRect.top, minimapRect.top));
    root.style.setProperty("--hud-top-chrome", `${clearTop}px`);
    root.style.setProperty("--hud-bottom-chrome", `${clearBottom}px`);
    const toastLift = clearBottom + (expanded ? 12 : 8);
    root.style.setProperty("--toast-bottom", `${toastLift}px`);
  };

  function toggleExpanded(): void {
    expanded = !expanded;
    sheet.dataset.expanded = expanded ? "true" : "false";
    summary.setAttribute("aria-expanded", expanded ? "true" : "false");
    sheetDetail.hidden = !expanded;
    options.onSheetExpanded?.(expanded);
    syncChromeInsets();
  }

  return {
    campBadge(campId) {
      if (!lastState) return "";
      const camp = findCamp(lastState, campId);
      if (!camp) return "";
      const advice = moveAdvice(lastState.herd, camp, lastState.date);
      return formatCampBadge(advice, campId === lastState.herd.campId);
    },
    update(state, ui) {
      lastState = state;
      const seasonText = seasonLabelForHud(state);
      const dry = !seasonText.toLowerCase().includes("rain");
      dateEl.textContent = formatHudDate(state.date);
      timeEl.textContent = formatClockTime(state.date);
      if (state.clock?.settings.dayLengthSeconds) {
        dayLengthSelect.value = String(state.clock.settings.dayLengthSeconds);
      }
      seasonEl.innerHTML = dry ? ICONS.dry : ICONS.rain;
      seasonEl.title = seasonText;
      cashEl.textContent = formatHudMoney(state.cashNad);
      rainEl.textContent = formatHudRain(state.seasonRainMm);
      rainEl.classList.toggle("is-raining", state.todayRainMm > 0);

      sheet.hidden = !ui.selected;
      if (!ui.selected) {
        expanded = false;
        sheet.dataset.expanded = "false";
        sheetDetail.hidden = true;
        options.onSheetExpanded?.(false);
      } else {
        const prevExpanded = expanded;
        if (ui.expanded !== undefined) expanded = ui.expanded;
        sheet.dataset.expanded = expanded ? "true" : "false";
        summary.setAttribute("aria-expanded", expanded ? "true" : "false");
        sheetDetail.hidden = !expanded;
        if (prevExpanded !== expanded) options.onSheetExpanded?.(expanded);

        const camp = findCamp(state, state.herd.campId);
        const fraction = camp ? grazeableFraction(camp) : 0;
        const pct = Math.round(fraction * 100);
        const warn = camp ? formatMoveWarning(state.herd, camp, state.date).length > 0 : false;
        sheetLine.textContent = formatHerdSheetSummary(
          state.herd.headCount,
          camp?.name ?? "Camp",
          pct,
        );
        warnDot.hidden = !warn;

        if (expanded && camp) {
          const daysLeft = grazingDaysLeft(camp, state.herd);
          nameEl.textContent = state.herd.name;
          campEl.textContent = formatCampLine(camp.name, camp.hectares);
          headEl.textContent = formatHead(state.herd.headCount);
          const conditionPct = Math.max(0, Math.min(100, state.herd.condition));
          conditionBar.style.width = `${conditionPct}%`;
          conditionBar.style.background = toCss(
            lerpColour(palette.grassBrown, palette.grassGreen, conditionPct / 100),
          );
          conditionValue.textContent = formatCondition(state.herd.condition);
          grassBar.style.width = `${pct}%`;
          grassBar.style.background = toCss(grassTint(fraction));
          grassValue.textContent = formatGrassPercent(fraction);
          daysEl.textContent = formatDaysInCamp(state.herd.daysInCamp);
          const moveWarn = formatMoveWarning(state.herd, camp, state.date);
          moveWarnEl.textContent = moveWarn;
          moveWarnEl.hidden = moveWarn.length === 0;
          recoveryEl.textContent = moveWarn.length > 0 ? COPY.moveRecovery : "";
          recoveryEl.hidden = moveWarn.length === 0;
          if (state.story?.composition) {
            classesEl.textContent = compositionSummaryLine(state.story.composition);
            classesEl.hidden = false;
          } else {
            classesEl.hidden = true;
          }
          leftEl.textContent = formatGrassLeft(daysLeft, fraction);
          const status = formatFeedStatus(daysLeft);
          const farmhand = state.story?.farmhand;
          const presence = state.story?.farmhandPresence;
          const farmLine =
            farmhand?.hired && presence ? `Piet: ${presence.activityLabel}` : "";
          statusEl.textContent = [status, farmLine].filter(Boolean).join(" · ");
          statusEl.hidden = statusEl.textContent.length === 0;
        }

        if (ui.pendingCampId !== null) {
          moveConfirm.hidden = false;
          moveConfirmText.textContent = `Move the herd to ${ui.pendingCampName}?`;
          if (!expanded) {
            expanded = true;
            sheet.dataset.expanded = "true";
            sheetDetail.hidden = false;
          }
        } else {
          moveConfirm.hidden = true;
        }
      }
      paintMinimap(minimap, state);
      syncChromeInsets();
    },
    setSpeed(mode) {
      (Object.keys(buttons) as SpeedMode[]).forEach((key) => {
        buttons[key].setAttribute("aria-pressed", key === mode ? "true" : "false");
      });
    },
    clearHint() {
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = null;
      toastEl.classList.remove("is-visible");
      toastEl.hidden = true;
      toastEl.textContent = "";
    },
    setHint(text) {
      if (!text) return;
      if (cardBlocksToast()) {
        rememberBlockedCopy();
        queuedHint = echoesCard(text, blockedText) ? queuedHint : text;
        hideToast();
        return;
      }
      queuedHint = null;
      showToast(text);
    },
    showEventCard(title, body) {
      eventTitle.textContent = title;
      eventBody.textContent = body;
      eventCard.hidden = false;
      rememberBlockedCopy();
      if (!toastEl.hidden && toastEl.textContent && !echoesCard(toastEl.textContent, blockedText)) {
        queuedHint = toastEl.textContent;
      }
      hideToast();
    },
    holdToasts() {
      toastHeld = true;
      rememberBlockedCopy();
      if (!toastEl.hidden && toastEl.textContent && !echoesCard(toastEl.textContent, blockedText)) {
        queuedHint = toastEl.textContent;
      }
      hideToast();
    },
    releaseToasts() {
      toastHeld = false;
      flushQueuedToast();
    },
    hideEventCard() {
      eventCard.hidden = true;
    },
    setHerdLocator(visible, label, edge) {
      herdLocator.hidden = !visible;
      if (!visible) return;
      herdLocator.textContent = label;
      herdLocator.dataset.edge = edge;
    },
    pushLetter(item) {
      letterStack.hidden = false;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "letter-card";
      btn.textContent = item.title;
      btn.title = item.body;
      btn.addEventListener("click", () => {
        btn.remove();
        if (letterStack.childElementCount === 0) letterStack.hidden = true;
        showToast(item.body);
      });
      letterStack.prepend(btn);
    },
    syncAlerts(labels) {
      alertStrip.replaceChildren();
      if (labels.length === 0) {
        alertStrip.hidden = true;
        return;
      }
      alertStrip.hidden = false;
      for (const label of labels) {
        const li = document.createElement("li");
        li.textContent = label;
        alertStrip.appendChild(li);
      }
    },
    pushNewsLog(lines) {
      if (lines.length === 0) return;
      newsLogOpen.hidden = false;
      for (const line of lines) {
        const li = document.createElement("li");
        li.textContent = line;
        newsLogList.prepend(li);
      }
      while (newsLogList.childElementCount > 200) newsLogList.lastElementChild?.remove();
    },
    setScaleBar(label) {
      scaleLabel.textContent = label;
    },
    setDaylight(blend) {
      root.style.setProperty("--daylight-blend", String(Math.max(0, Math.min(1, blend))));
    },
    setNightChrome(active) {
      root.classList.toggle("ranch-night", active);
    },
    destroy() {
      if (toastTimer) clearTimeout(toastTimer);
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

/** Measure HUD chrome heights for layout checks (portrait phone). */
export function measureHudHeights(root: HTMLElement = document.getElementById("hud-root")!): {
  topbarPx: number;
  sheetCollapsedPx: number;
  minimapPx: number;
} {
  const topbar = root.querySelector<HTMLElement>(".topbar");
  const sheet = root.querySelector<HTMLElement>(".sheet:not([hidden])");
  const minimap = root.querySelector<HTMLElement>(".minimap");
  return {
    topbarPx: topbar?.getBoundingClientRect().height ?? 0,
    sheetCollapsedPx: sheet?.querySelector<HTMLElement>(".sheet-summary")?.getBoundingClientRect().height ?? 0,
    minimapPx: minimap?.getBoundingClientRect().height ?? 0,
  };
}

export function measureChipWidths(root: HTMLElement = document.getElementById("hud-root")!): Record<
  string,
  { chipPx: number; textPx: number; label: string }
> {
  const measure = (id: string, labelId?: string): { chipPx: number; textPx: number; label: string } => {
    const chip = root.querySelector<HTMLElement>(`#${id}`);
    const label = labelId ? root.querySelector<HTMLElement>(`#${labelId}`) : chip;
    const text = label?.textContent ?? "";
    return {
      chipPx: chip?.getBoundingClientRect().width ?? 0,
      textPx: label ? label.scrollWidth : 0,
      label: text,
    };
  };
  return {
    date: measure("stat-date"),
    cash: measure("stat-cash"),
    rain: measure("stat-rain"),
    sheet: measure("sheet-line", "sheet-line"),
  };
}

export function measureTopbarMetrics(root: HTMLElement = document.getElementById("hud-root")!): {
  chipFontPx: number;
  chipLetterSpacing: string;
  speedButtonPx: number;
  menuButtonPx: number;
  sparePx: number;
  chipsRight: number;
  actionsLeft: number;
  chips: ReturnType<typeof measureChipWidths>;
} {
  const spare = measureTopbarSpare(root);
  const dateChip = root.querySelector<HTMLElement>("#stat-date");
  const speedBtn = root.querySelector<HTMLElement>("#speed-pause");
  const menuBtn = root.querySelector<HTMLElement>("#menu-overflow");
  return {
    chipFontPx: dateChip ? Number.parseFloat(getComputedStyle(dateChip).fontSize) : 0,
    chipLetterSpacing: dateChip ? getComputedStyle(dateChip).letterSpacing : "",
    speedButtonPx: speedBtn?.getBoundingClientRect().width ?? 0,
    menuButtonPx: menuBtn?.getBoundingClientRect().width ?? 0,
    ...spare,
    chips: measureChipWidths(root),
  };
}

export function measureTopbarSpare(root: HTMLElement = document.getElementById("hud-root")!): {
  sparePx: number;
  chipsRight: number;
  actionsLeft: number;
} {
  const actions = root.querySelector<HTMLElement>(".top-actions");
  if (!actions) return { sparePx: 0, chipsRight: 0, actionsLeft: 0 };
  const actionsRect = actions.getBoundingClientRect();
  let chipsRight = 0;
  root.querySelectorAll<HTMLElement>(".chips .chip, .chips .chip-icon").forEach((el) => {
    chipsRight = Math.max(chipsRight, el.getBoundingClientRect().right);
  });
  const sparePx = actionsRect.left - chipsRight;
  return { sparePx, chipsRight, actionsLeft: actionsRect.left };
}

export function measureToastClearance(root: HTMLElement = document.getElementById("hud-root")!): {
  toastTop: number;
  toastBottom: number;
  sheetTop: number | null;
  clearancePx: number | null;
  toastBottomCss: string;
} {
  const toast = root.querySelector<HTMLElement>("#toast");
  const sheet = root.querySelector<HTMLElement>("#herd-sheet");
  const toastRect = toast?.getBoundingClientRect();
  const sheetHidden = sheet?.hasAttribute("hidden");
  const sheetRect = sheet && !sheetHidden ? sheet.getBoundingClientRect() : null;
  const toastTop = toastRect?.top ?? 0;
  const toastBottom = toastRect?.bottom ?? 0;
  const sheetTop = sheetRect?.top ?? null;
  const clearancePx = sheetTop !== null && toastRect ? sheetTop - toastBottom : null;
  return {
    toastTop,
    toastBottom,
    sheetTop,
    clearancePx,
    toastBottomCss: toast ? getComputedStyle(toast).bottom : "",
  };
}

export function viewportCameraInsets(root: HTMLElement = document.getElementById("hud-root")!): ViewInsets {
  const topbar = root.querySelector<HTMLElement>(".topbar");
  const top = topbar?.getBoundingClientRect().height ?? 44;
  const minimap = root.querySelector<HTMLElement>(".minimap");
  const sheet = root.querySelector<HTMLElement>(".sheet:not([hidden])");
  const minimapTop = minimap?.getBoundingClientRect().top ?? window.innerHeight;
  const sheetTop = sheet?.getBoundingClientRect().top ?? window.innerHeight;
  const bottom = Math.max(0, window.innerHeight - Math.min(minimapTop, sheetTop));
  const safeLeft = 6;
  const safeRight = 6;
  return { top, bottom, left: safeLeft, right: safeRight };
}
