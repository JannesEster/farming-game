import { PURCHASE_BUDGET_NAD } from "./budget";
import { cashAfterPurchase, generateFarmOffers } from "./generateOffers";
import type { FarmOfferCard } from "./types";
import { drawOfferMinimap } from "./minimap";
import { formatMoney } from "../sim/format";
import type { GameState } from "../sim/types";
import { hasSavedGame, loadSavedGame } from "../sim/persist";

export type PickerResult =
  | { kind: "continue"; state: GameState }
  | { kind: "bought"; state: GameState; offer: FarmOfferCard }
  | { kind: "cancel" };

let pickerRoot: HTMLElement | null = null;
let pickerOffers: FarmOfferCard[] = [];
let pickerIndex = 0;
let pickerRenderCard: (() => void) | null = null;
let pickerShowStart: (() => void) | null = null;
let pickerShowOffers: (() => void) | null = null;
let pickerResolve: ((result: PickerResult) => void) | null = null;

export type PickerSlotSummary = {
  id: number;
  occupied: boolean;
  label: string;
};

export type PickerFlowHost = {
  hasSavedGame: () => boolean;
  onContinue: () => void;
  onRequestOffers: () => void;
  onPurchased: (state: GameState, offer: FarmOfferCard) => void;
  slots?: () => PickerSlotSummary[];
  activeSlot?: () => number;
  onSelectSlot?: (slotId: number) => void;
};

let pickerHost: PickerFlowHost | null = null;

export function setPickerFlowHost(host: PickerFlowHost | null): void {
  pickerHost = host;
}

function finishPicker(result: PickerResult): void {
  destroyRoot();
  if (pickerHost) {
    if (result.kind === "continue") pickerHost.onContinue();
    else if (result.kind === "bought") pickerHost.onPurchased(result.state, result.offer);
    return;
  }
  pickerResolve?.(result);
  pickerResolve = null;
}

export function openStartScreen(): void {
  ensurePickerMounted();
  pickerShowStart?.();
}

export function openOfferPicker(): void {
  ensurePickerMounted();
  pickerShowOffers?.();
}

export function closePickerScreen(): void {
  destroyRoot();
}

function ensurePickerMounted(): void {
  if (pickerShowStart && pickerRoot?.isConnected) return;
  pickerShowStart = null;
  pickerShowOffers = null;
  pickerRenderCard = null;
  pickerIndex = 0;
  pickerOffers = generateFarmOffers(88001);
  mountPickerUi();
  installPickerCaptureBridge();
}

function mountPickerUi(): void {
  const root = ensureRoot();
  const showStart = () => {
    const saved = pickerHost ? pickerHost.hasSavedGame() : hasSavedGame();
    const slots = pickerHost?.slots?.() ?? [];
    const activeSlot = pickerHost?.activeSlot?.() ?? 0;
    const slotRow =
      slots.length === 0
        ? ""
        : `<div class="picker-slots" role="listbox" aria-label="Save slots">
            ${slots
              .map(
                (slot) => `<button type="button" role="option" class="picker-slot${slot.id === activeSlot ? " active" : ""}" data-slot="${slot.id}" aria-selected="${slot.id === activeSlot ? "true" : "false"}">
              <span>Slot ${slot.id + 1}</span>
              <small>${slot.occupied ? slot.label : "Empty"}</small>
            </button>`,
              )
              .join("")}
          </div>
          <p class="picker-slot-note">New game replaces the highlighted slot.</p>`;
    root.innerHTML = `
        <div class="picker-screen start-screen" data-test="start-screen">
          <div class="picker-panel">
            <p class="picker-eyebrow">Namibia · dry season 2026</p>
            <h1 class="picker-title">Dust &amp; Hooves</h1>
            <p class="picker-lead">Buy a farm, run the camps, and keep the herd alive through drought, rain and red tape.</p>
            <p class="picker-budget">
              <span class="picker-budget-label">Your purse</span>
              <strong>${formatMoney(PURCHASE_BUDGET_NAD)}</strong>
            </p>
            ${slotRow}
            <div class="picker-actions">
              <button type="button" class="picker-btn primary" data-action="new">New game</button>
              <button type="button" class="picker-btn" data-action="continue" ${saved ? "" : "disabled"}>Continue</button>
            </div>
          </div>
        </div>
      `;

    root.querySelectorAll<HTMLButtonElement>("[data-slot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.slot);
        if (Number.isFinite(id)) pickerHost?.onSelectSlot?.(id);
      });
    });
    root.querySelector<HTMLButtonElement>('[data-action="new"]')?.addEventListener("click", () => {
      if (pickerHost) pickerHost.onRequestOffers();
      else showPicker();
    });
    root.querySelector<HTMLButtonElement>('[data-action="continue"]')?.addEventListener("click", () => {
      if (pickerHost) {
        pickerHost.onContinue();
        destroyRoot();
        return;
      }
      const state = loadSavedGame();
      if (!state) return;
      finishPicker({ kind: "continue", state });
    });
  };

  const renderCard = () => {
    const offer = pickerOffers[pickerIndex];
    const remaining = PURCHASE_BUDGET_NAD - offer.askingPriceNad;
    const buyDisabled = !offer.playable || remaining < 0;
    const lock = !offer.playable
      ? `<p class="picker-lock">${offer.lockedReason ?? "Coming soon"}</p>`
      : "";

    root.innerHTML = `
        <div class="picker-screen picker-flow" data-test="farm-picker">
          <header class="picker-top">
            <button type="button" class="picker-btn ghost" data-action="back">← Menu</button>
            <span class="picker-step">${pickerIndex + 1} / ${pickerOffers.length}</span>
            <span class="picker-purse">Purse ${formatMoney(PURCHASE_BUDGET_NAD)}</span>
          </header>
          <article class="picker-card" data-offer-id="${offer.id}">
            ${lock}
            <div class="picker-card-head">
              <h2>${offer.title}</h2>
              <p class="picker-sub">${offer.subtitle}</p>
            </div>
            <div class="picker-preview">
              <canvas class="picker-minimap" width="160" height="120" aria-label="Farm layout preview"></canvas>
              <p class="picker-preview-cap">Isometric camps · seed ${offer.seed}</p>
            </div>
            <dl class="picker-stats">
              <div><dt>Region</dt><dd>${offer.regionKey}</dd></div>
              <div><dt>Size</dt><dd>${offer.hectares.toLocaleString()} ha</dd></div>
              <div><dt>Rain (3-season avg)</dt><dd>${offer.rainfallMm} mm</dd></div>
              <div><dt>Camps</dt><dd>${offer.campCount}</dd></div>
              <div><dt>Water</dt><dd>${offer.water.boreholes} borehole(s), ${offer.water.windmills} windmill(s), ${offer.water.solar} solar</dd></div>
              <div><dt>Yard</dt><dd>House, kraal, ${offer.buildings.workerHouses} worker house(s)</dd></div>
              <div><dt>Fences</dt><dd>${fenceLabel(offer.fenceCondition)}</dd></div>
              <div><dt>Livestock</dt><dd>${offer.livestock.head > 0 ? `${offer.livestock.head} ${offer.livestock.classLabel}` : offer.livestock.classLabel}</dd></div>
              <div><dt>Asking</dt><dd>${formatMoney(offer.askingPriceNad)}</dd></div>
              <div><dt>Left in purse</dt><dd class="${remaining < 0 ? "picker-warn" : ""}">${formatMoney(remaining)}</dd></div>
            </dl>
          </article>
          <div class="picker-nav">
            <button type="button" class="picker-btn" data-action="prev" ${pickerIndex === 0 ? "disabled" : ""}>Previous</button>
            <button type="button" class="picker-btn primary" data-action="buy" ${buyDisabled ? "disabled" : ""}>Buy this farm</button>
            <button type="button" class="picker-btn" data-action="next" ${pickerIndex === pickerOffers.length - 1 ? "disabled" : ""}>Next</button>
          </div>
          <div class="picker-dots" role="tablist">
            ${pickerOffers
              .map(
                (_, i) =>
                  `<button type="button" class="picker-dot${i === pickerIndex ? " active" : ""}" data-dot="${i}" aria-label="Farm ${i + 1}"></button>`,
              )
              .join("")}
          </div>
        </div>
      `;

    const regionLabels: Record<string, string> = {
      karas: "//Karas",
      khomas: "Khomas",
      otjozondjupa: "Otjozondjupa",
      omaheke: "Omaheke",
    };
    const regionCell = root.querySelector(".picker-stats div:first-child dd");
    if (regionCell) regionCell.textContent = regionLabels[offer.regionKey] ?? offer.regionKey;

    const canvas = root.querySelector<HTMLCanvasElement>(".picker-minimap");
    if (canvas) drawOfferMinimap(canvas, offer.previewState);

    root.querySelector('[data-action="back"]')?.addEventListener("click", () => showStart());
    root.querySelector('[data-action="prev"]')?.addEventListener("click", () => {
      if (pickerIndex > 0) {
        pickerIndex -= 1;
        renderCard();
      }
    });
    root.querySelector('[data-action="next"]')?.addEventListener("click", () => {
      if (pickerIndex < pickerOffers.length - 1) {
        pickerIndex += 1;
        renderCard();
      }
    });
    root.querySelectorAll<HTMLButtonElement>(".picker-dot").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ix = Number(btn.dataset.dot);
        if (Number.isFinite(ix)) {
          pickerIndex = ix;
          renderCard();
        }
      });
    });

    let touchStartX = 0;
    const card = root.querySelector(".picker-card");
    card?.addEventListener(
      "touchstart",
      (evt) => {
        const e = evt as TouchEvent;
        touchStartX = e.changedTouches[0]?.clientX ?? 0;
      },
      { passive: true },
    );
    card?.addEventListener(
      "touchend",
      (evt) => {
        const e = evt as TouchEvent;
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX;
        if (Math.abs(dx) < 40) return;
        if (dx < 0 && pickerIndex < pickerOffers.length - 1) {
          pickerIndex += 1;
          renderCard();
        } else if (dx > 0 && pickerIndex > 0) {
          pickerIndex -= 1;
          renderCard();
        }
      },
      { passive: true },
    );

    root.querySelector('[data-action="buy"]')?.addEventListener("click", () => {
      if (!offer.playable) return;
      const state = structuredClone(offer.previewState) as GameState;
      state.cashNad = cashAfterPurchase(offer.askingPriceNad);
      finishPicker({ kind: "bought", state, offer });
    });
  };

  const showPicker = () => {
    renderCard();
  };

  pickerRenderCard = renderCard;
  pickerShowStart = showStart;
  pickerShowOffers = showPicker;
}

export function installPickerCaptureBridge(): void {
  if (typeof window === "undefined") return;
  const cap = new URLSearchParams(window.location.search).get("capture");
  if (cap !== "picker" && cap !== "1") return;
  (window as Window & { __pickerCapture?: Record<string, unknown> }).__pickerCapture = {
    offerCount: () => pickerOffers.length,
    showStart: () => pickerShowStart?.(),
    showCard: (index: number) => {
      if (!Number.isFinite(index)) return;
      pickerIndex = Math.max(0, Math.min(pickerOffers.length - 1, Math.floor(index)));
      pickerRenderCard?.();
    },
    offerId: () => pickerOffers[pickerIndex]?.id,
  };
}

function ensureRoot(): HTMLElement {
  if (pickerRoot?.isConnected) return pickerRoot;
  pickerRoot?.remove();
  pickerRoot = document.createElement("div");
  pickerRoot.id = "picker-root";
  document.body.appendChild(pickerRoot);
  return pickerRoot;
}

function destroyRoot(): void {
  pickerRoot?.remove();
  pickerRoot = null;
  pickerShowStart = null;
  pickerShowOffers = null;
  pickerRenderCard = null;
}

function fenceLabel(condition: string): string {
  if (condition === "good") return "Good — jackal netting intact";
  if (condition === "fair") return "Fair — some re-tensioning due";
  return "Poor — breaks after stock pressure";
}

export function runStartFlow(options: {
  forceOfferId?: string;
  skipMenu?: boolean;
}): Promise<PickerResult> {
  return new Promise((resolve) => {
    pickerResolve = resolve;
    pickerIndex = 0;
    pickerOffers = generateFarmOffers(88001);
    if (options.forceOfferId) {
      const ix = pickerOffers.findIndex((o) => o.id === options.forceOfferId);
      if (ix >= 0) pickerIndex = ix;
    }
    mountPickerUi();
    installPickerCaptureBridge();

    if (options.skipMenu && options.forceOfferId) {
      const offer = pickerOffers.find((o) => o.id === options.forceOfferId);
      if (offer?.playable) {
        const state = structuredClone(offer.previewState) as GameState;
        state.cashNad = cashAfterPurchase(offer.askingPriceNad);
        finishPicker({ kind: "bought", state, offer });
        return;
      }
    }

    pickerShowStart?.();
  });
}

export function returnToPicker(onDone: (result: PickerResult) => void): void {
  clearHudForPicker();
  runStartFlow({}).then(onDone);
}

function clearHudForPicker(): void {
  document.getElementById("hud-root")?.replaceChildren();
}
