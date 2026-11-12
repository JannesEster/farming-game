import { CONFIG } from "../sim/config";
import { STEP2 } from "../sim/step2Config";
import { payForSolarUpgrade, seasonAppropriateLick } from "../sim/levers";
import { answerMorningDecision } from "../sim/morningPlay";
import { resolvePlayerEvent } from "../sim/playerEvents";
import type { LickChoice, MaintenanceMode, PumpChoice, WorkJobId, WorkPriority } from "../sim/storyTypes";
import { setWorkPriority, WORK_JOB_LABELS, defaultWorkGrid } from "../sim/workGrid";
import { hireFarmhand } from "../sim/workers";
import type { GameState } from "../sim/types";

export type OpsFocus = "default" | "event" | "grid" | "levers";

export type OpsSheet = {
  open(focus?: OpsFocus): void;
  close(): void;
  isOpen(): boolean;
  refresh(state: GameState): void;
  destroy(): void;
};

export function mountOpsSheet(options: {
  getState: () => GameState;
  onChange: () => void;
  onToast: (text: string) => void;
  onCritical?: (title: string, body: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
}): OpsSheet {
  const root = document.getElementById("hud-root");
  if (!root) throw new Error("Missing HUD root for ops sheet.");

  const sheet = document.createElement("section");
  sheet.className = "sheet ops-sheet";
  sheet.id = "ops-sheet";
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="sheet-summary ops-summary" role="button" tabindex="0">
      <span class="sheet-line" id="ops-title">Ranch ops</span>
      <button type="button" class="icon-btn sheet-close" id="ops-close" aria-label="Close ranch ops">×</button>
    </div>
    <div class="sheet-detail" id="ops-detail">
      <p class="extra ops-hide-on-event-focus ops-hide-on-lever-focus" id="ops-goal"></p>
      <p class="extra ops-hide-on-event-focus ops-hide-on-lever-focus" id="ops-farmhand-status"></p>
      <button type="button" class="pill-btn ghost ops-hide-on-event-focus ops-hide-on-lever-focus" id="ops-hire-btn">Hire farmhand (N$${Math.round(CONFIG.economy.farmhandMonthlyCashNad).toLocaleString("en-NA")}/mo)</button>
      <h3 class="ops-heading ops-hide-on-event-focus ops-hide-on-lever-focus" id="ops-heading-grid">Work grid</h3>
      <div class="work-grid ops-hide-on-event-focus ops-hide-on-lever-focus" id="work-grid"></div>
      <h3 class="ops-heading" id="ops-heading-levers">Cost levers</h3>
      <label class="market-field ops-hide-on-grid-focus">Lick type
        <select id="lever-lick">
          <option value="summer_phosphate_p6">Summer phosphate P6</option>
          <option value="summer_phosphate_p12">Summer phosphate P12</option>
          <option value="winter_protein_urea">Winter protein urea</option>
        </select>
      </label>
      <label class="market-field ops-hide-on-grid-focus">Water pumping
        <select id="lever-pump">
          <option value="windmill">Windmill (low running cost)</option>
          <option value="diesel">Diesel pump (high fuel)</option>
          <option value="solar">Solar pump (upfront + low fuel)</option>
        </select>
      </label>
      <button type="button" class="pill-btn ghost ops-hide-on-grid-focus" id="lever-solar-pay">Pay solar install (N$${STEP2.solarPumpUpfrontNad.toLocaleString("en-NA")})</button>
      <label class="market-field ops-hide-on-grid-focus">Bakkie runs per month
        <input id="lever-runs" type="number" min="${STEP2.bakkieRunsMin}" max="${STEP2.bakkieRunsMax}" value="${STEP2.bakkieRunsDefault}" />
      </label>
      <label class="market-field ops-hide-on-grid-focus">Maintenance
        <select id="lever-maintain">
          <option value="maintain">Routine maintenance</option>
          <option value="defer">Skip maintenance (risky)</option>
        </select>
      </label>
      <div id="ops-morning" class="ops-hide-on-event-focus ops-hide-on-lever-focus ops-hide-on-grid-focus" hidden>
        <h3 class="ops-heading">Morning choice</h3>
        <p class="extra" id="ops-morning-text"></p>
        <div id="ops-morning-actions"></div>
      </div>
      <div id="ops-event" class="ops-hide-on-lever-focus ops-hide-on-grid-focus" hidden>
        <h3 class="ops-heading" id="ops-event-title"></h3>
        <p class="extra" id="ops-event-body"></p>
        <p class="extra warn" id="ops-event-ignore"></p>
        <div id="ops-event-actions"></div>
      </div>
    </div>
  `;
  root.appendChild(sheet);

  const closeBtn = sheet.querySelector<HTMLButtonElement>("#ops-close")!;
  const hireBtn = sheet.querySelector<HTMLButtonElement>("#ops-hire-btn")!;
  const workGridEl = sheet.querySelector<HTMLElement>("#work-grid")!;
  const goalEl = sheet.querySelector<HTMLElement>("#ops-goal")!;
  const farmhandStatus = sheet.querySelector<HTMLElement>("#ops-farmhand-status")!;
  const lickSel = sheet.querySelector<HTMLSelectElement>("#lever-lick")!;
  const pumpSel = sheet.querySelector<HTMLSelectElement>("#lever-pump")!;
  const runsEl = sheet.querySelector<HTMLInputElement>("#lever-runs")!;
  const maintSel = sheet.querySelector<HTMLSelectElement>("#lever-maintain")!;
  const solarBtn = sheet.querySelector<HTMLButtonElement>("#lever-solar-pay")!;
  const morningBox = sheet.querySelector<HTMLElement>("#ops-morning")!;
  const morningText = sheet.querySelector<HTMLElement>("#ops-morning-text")!;
  const morningActions = sheet.querySelector<HTMLElement>("#ops-morning-actions")!;
  const eventBox = sheet.querySelector<HTMLElement>("#ops-event")!;
  const eventTitle = sheet.querySelector<HTMLElement>("#ops-event-title")!;
  const eventBody = sheet.querySelector<HTMLElement>("#ops-event-body")!;
  const eventIgnore = sheet.querySelector<HTMLElement>("#ops-event-ignore")!;
  const eventActions = sheet.querySelector<HTMLElement>("#ops-event-actions")!;

  const jobs: WorkJobId[] = ["check_water", "fix_fences", "fill_lick", "move_herd_help"];

  const renderWorkGrid = (state: GameState): void => {
    workGridEl.replaceChildren();
    const grid = state.story?.workGrid ?? defaultWorkGrid();
    for (const job of jobs) {
      const row = document.createElement("div");
      row.className = "work-grid-row";
      const label = document.createElement("span");
      label.textContent = WORK_JOB_LABELS[job];
      const select = document.createElement("select");
      select.dataset.job = job;
      for (const pri of [0, 1, 2, 3] as WorkPriority[]) {
        const opt = document.createElement("option");
        opt.value = String(pri);
        opt.textContent = pri === 0 ? "Off" : String(pri);
        if (grid[job] === pri) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener("change", () => {
        setWorkPriority(state, job, Number(select.value) as WorkPriority);
        options.onChange();
        refresh(state);
      });
      row.append(label, select);
      workGridEl.appendChild(row);
    }
  };

  const applyLeversFromUi = (state: GameState): void => {
    const levers = state.story?.costLevers;
    if (!levers) return;
    levers.lick = lickSel.value as LickChoice;
    levers.pump = pumpSel.value as PumpChoice;
    levers.bakkieRunsPerMonth = Math.max(
      STEP2.bakkieRunsMin,
      Math.min(STEP2.bakkieRunsMax, Number.parseInt(runsEl.value, 10) || STEP2.bakkieRunsDefault),
    );
    levers.maintenance = maintSel.value as MaintenanceMode;
  };

  let open = false;

  const refresh = (state: GameState): void => {
    const play = state.story?.dailyPlay;
    if (play) {
      goalEl.textContent = play.goalMet ? `Today: ${play.goalText} (done)` : `Today: ${play.goalText}`;
    }
    const fh = state.story?.farmhand;
    const presence = state.story?.farmhandPresence;
    if (fh?.hired) {
      hireBtn.hidden = true;
      farmhandStatus.textContent = presence
        ? `Piet: ${presence.activityLabel}`
        : "Piet is on the farm.";
    } else {
      hireBtn.hidden = false;
      farmhandStatus.textContent = "No farmhand hired yet.";
    }
    renderWorkGrid(state);
    const levers = state.story?.costLevers;
    if (levers) {
      lickSel.value = levers.lick;
      pumpSel.value = levers.pump;
      runsEl.value = String(levers.bakkieRunsPerMonth);
      maintSel.value = levers.maintenance;
      solarBtn.hidden = levers.solarPaid || levers.pump === "solar";
    }
    const suggested = seasonAppropriateLick(state.date.month);
    lickSel.title = `Season hint: ${suggested}`;
    morningBox.hidden = !play?.morningDecisionId || play.morningDecisionAnswered;
    if (!morningBox.hidden && play?.morningDecisionId) {
      morningText.textContent = "Open the morning letter or pick below.";
      morningActions.replaceChildren();
      const labels: Record<string, string> = {
        one_trip: "One long round",
        two_trips: "Two short trips",
        far_first: "Far windmill",
        near_first: "Near trough",
        yes_fence: "Fence first",
        no_fence: "Leave fence",
      };
      const ids =
        play.morningDecisionId === "lick_batch"
          ? ["one_trip", "two_trips"]
          : play.morningDecisionId === "water_round"
            ? ["far_first", "near_first"]
            : ["yes_fence", "no_fence"];
      for (const id of ids) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pill-btn ghost";
        btn.textContent = labels[id] ?? id;
        btn.addEventListener("click", () => {
          const msg = answerMorningDecision(state, id);
          options.onToast(msg);
          options.onChange();
          refresh(state);
        });
        morningActions.appendChild(btn);
      }
    }
    const ev = state.story?.pendingPlayerEvent;
    eventBox.hidden = !ev;
    if (ev) {
      eventTitle.textContent = ev.title;
      eventBody.textContent = ev.body;
      eventIgnore.textContent = ev.ignoreConsequence;
      eventActions.replaceChildren();
      for (const action of ev.actions) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = ev.critical ? "pill-btn confirm" : "pill-btn ghost";
        btn.textContent = action.label;
        btn.addEventListener("click", () => {
          const res = resolvePlayerEvent(state, action.id);
          options.onToast(res.message);
          if (res.card) options.onCritical?.(res.card.title, res.card.body);
          options.onChange();
          refresh(state);
        });
        eventActions.appendChild(btn);
      }
    }
  };

  const close = (): void => {
    open = false;
    sheet.hidden = true;
    options.onClose?.();
  };

  closeBtn.addEventListener("click", close);
  hireBtn.addEventListener("click", () => {
    const state = options.getState();
    const res = hireFarmhand(state);
    options.onToast(res.message);
    if (res.ok) options.onChange();
    refresh(state);
  });
  for (const el of [lickSel, pumpSel, maintSel]) {
    el.addEventListener("change", () => {
      applyLeversFromUi(options.getState());
      options.onChange();
    });
  }
  runsEl.addEventListener("change", () => {
    applyLeversFromUi(options.getState());
    options.onChange();
  });
  solarBtn.addEventListener("click", () => {
    const state = options.getState();
    const res = payForSolarUpgrade(state);
    options.onToast(res.message);
    if (res.ok) {
      pumpSel.value = "solar";
      options.onChange();
    }
    refresh(state);
  });

  return {
    open(focus: OpsFocus = "default") {
      open = true;
      sheet.hidden = false;
      sheet.dataset.focus = focus;
      refresh(options.getState());
      if (focus === "levers") {
        const anchor = sheet.querySelector("#ops-heading-levers");
        anchor?.scrollIntoView({ block: "start" });
        sheet.querySelector("#ops-detail")?.scrollTo({ top: (anchor as HTMLElement)?.offsetTop ?? 0 });
      }
      options.onOpen?.();
    },
    close,
    isOpen: () => open,
    refresh,
    destroy() {
      sheet.remove();
    },
  };
}
