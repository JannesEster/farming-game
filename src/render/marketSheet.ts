import { CONFIG } from "../sim/config";
import { applySale, quoteSale } from "../sim/economy";
import { resolveDroughtChoice } from "../sim/drought";
import { formatHudMoney, formatMoney } from "../sim/format";
import { hireFarmhand, setFarmhandJob } from "../sim/workers";
import type { DroughtChoiceId, SaleChannel, SaleLine, StockClass } from "../sim/storyTypes";
import type { GameState } from "../sim/types";

export type MarketSheet = {
  open(): void;
  close(): void;
  isOpen(): boolean;
  refresh(state: GameState): void;
  destroy(): void;
};

const CLASSES: StockClass[] = ["weaner", "ox", "cow", "calf", "bull"];

export function mountMarketSheet(options: {
  getState: () => GameState;
  onChange: () => void;
  onToast: (text: string) => void;
}): MarketSheet {
  const root = document.getElementById("hud-root");
  if (!root) throw new Error("Missing HUD root for market sheet.");

  const sheet = document.createElement("section");
  sheet.className = "sheet market-sheet";
  sheet.id = "market-sheet";
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="sheet-summary market-summary" role="button" tabindex="0">
      <span class="sheet-line" id="market-title">Sell & market</span>
      <button type="button" class="icon-btn sheet-close" id="market-close" aria-label="Close market">×</button>
    </div>
    <div class="sheet-detail" id="market-detail">
      <p class="extra" id="market-cash"></p>
      <p class="extra" id="market-herd"></p>
      <label class="market-field">Class
        <select id="market-class"></select>
      </label>
      <label class="market-field">How many
        <input id="market-count" type="number" min="1" value="1" inputmode="numeric" />
      </label>
      <label class="market-field">Channel
        <select id="market-channel">
          <option value="auction">Auction</option>
          <option value="speculator">Out of hand (speculator)</option>
          <option value="feedlot">Feedlot buyer</option>
        </select>
      </label>
      <hr class="market-divider" />
      <p class="extra"><strong>Farmhand</strong></p>
      <p class="extra" id="market-worker"></p>
      <button type="button" class="pill-btn ghost" id="market-hire-btn">Hire farmhand (N$${Math.round(CONFIG.economy.farmhandMonthlyCashNad).toLocaleString("en-NA")}/mo)</button>
      <div class="market-jobs" id="market-jobs" hidden>
        <button type="button" class="pill-btn ghost" data-job="check_water">Check water</button>
        <button type="button" class="pill-btn ghost" data-job="move_herd">Help move herd</button>
      </div>
    </div>
    <div class="market-actions">
      <div id="market-drought" hidden>
        <p class="warn" id="market-drought-text"></p>
        <button type="button" class="pill-btn confirm" data-drought="sell_down">Sell weaners</button>
        <button type="button" class="pill-btn ghost" data-drought="buy_feed">Boskos feed</button>
        <button type="button" class="pill-btn ghost" data-drought="move_herd">Move camps</button>
      </div>
      <p class="extra" id="market-quote"></p>
      <button type="button" class="pill-btn confirm" id="market-sell-btn">Sell</button>
    </div>
  `;
  root.appendChild(sheet);

  const classSel = sheet.querySelector<HTMLSelectElement>("#market-class")!;
  const countEl = sheet.querySelector<HTMLInputElement>("#market-count")!;
  const channelSel = sheet.querySelector<HTMLSelectElement>("#market-channel")!;
  const quoteEl = sheet.querySelector<HTMLElement>("#market-quote")!;
  const cashEl = sheet.querySelector<HTMLElement>("#market-cash")!;
  const herdEl = sheet.querySelector<HTMLElement>("#market-herd")!;
  const workerEl = sheet.querySelector<HTMLElement>("#market-worker")!;
  const jobsEl = sheet.querySelector<HTMLElement>("#market-jobs")!;
  const droughtBox = sheet.querySelector<HTMLElement>("#market-drought")!;
  const droughtText = sheet.querySelector<HTMLElement>("#market-drought-text")!;
  const closeBtn = sheet.querySelector<HTMLButtonElement>("#market-close")!;
  const sellBtn = sheet.querySelector<HTMLButtonElement>("#market-sell-btn")!;
  const hireBtn = sheet.querySelector<HTMLButtonElement>("#market-hire-btn")!;

  CLASSES.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    classSel.appendChild(opt);
  });

  let open = false;

  const updateQuote = (): void => {
    const state = options.getState();
    const stockClass = classSel.value as StockClass;
    const count = Math.max(1, Number.parseInt(countEl.value, 10) || 1);
    const channel = channelSel.value as SaleChannel;
    const q = quoteSale(state, stockClass, count, channel);
    if ("reason" in q) {
      quoteEl.textContent = q.reason;
      return;
    }
    const sale = q as SaleLine;
    quoteEl.textContent = `About ${formatMoney(sale.totalNad)} after levies (${sale.pricePerKgLive.toFixed(2)} N$/kg).`;
  };

  const refresh = (state: GameState): void => {
    cashEl.textContent = `Cash ${formatHudMoney(state.cashNad)}`;
    const comp = state.story?.composition;
    if (comp) {
      herdEl.textContent = `Cows ${comp.cow}, bulls ${comp.bull}, calves ${comp.calf}, weaners ${comp.weaner}, oxen ${comp.ox}`;
    }
    const fh = state.story?.farmhand;
    if (fh?.hired) {
      hireBtn.hidden = true;
      jobsEl.hidden = false;
      workerEl.textContent = `Piet on the payroll · job: ${fh.job ?? "none"}`;
    } else {
      hireBtn.hidden = false;
      jobsEl.hidden = true;
      workerEl.textContent = "No farmhand hired.";
    }
    const drought = state.story?.drought;
    if (drought?.choicePending) {
      droughtBox.hidden = false;
      droughtText.textContent = "Drought choice pending.";
    } else {
      droughtBox.hidden = true;
    }
    updateQuote();
  };

  const close = (): void => {
    open = false;
    sheet.hidden = true;
  };

  closeBtn.addEventListener("click", close);
  classSel.addEventListener("change", updateQuote);
  channelSel.addEventListener("change", updateQuote);
  countEl.addEventListener("input", updateQuote);

  sellBtn.addEventListener("click", () => {
    const state = options.getState();
    const stockClass = classSel.value as StockClass;
    const count = Math.max(1, Number.parseInt(countEl.value, 10) || 1);
    const channel = channelSel.value as SaleChannel;
    const q = quoteSale(state, stockClass, count, channel);
    if ("reason" in q) {
      options.onToast(q.reason);
      return;
    }
    applySale(state, q);
    options.onToast(`Sold ${count} ${stockClass} for ${formatMoney(q.totalNad)}.`);
    options.onChange();
    refresh(state);
  });

  hireBtn.addEventListener("click", () => {
    const state = options.getState();
    const res = hireFarmhand(state);
    options.onToast(res.message);
    if (res.ok) options.onChange();
    refresh(state);
  });

  jobsEl.querySelectorAll<HTMLButtonElement>("button[data-job]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const job = btn.dataset.job as "check_water" | "move_herd";
      setFarmhandJob(options.getState(), job);
      options.onToast(`Farmhand set to ${job === "check_water" ? "check water" : "help move herd"}.`);
      options.onChange();
      refresh(options.getState());
    });
  });

  droughtBox.querySelectorAll<HTMLButtonElement>("button[data-drought]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = btn.dataset.drought as DroughtChoiceId;
      const res = resolveDroughtChoice(options.getState(), choice);
      options.onToast(res.message);
      if (res.ok) options.onChange();
      refresh(options.getState());
    });
  });

  return {
    open() {
      open = true;
      sheet.hidden = false;
      refresh(options.getState());
    },
    close,
    isOpen: () => open,
    refresh,
    destroy() {
      sheet.remove();
    },
  };
}
