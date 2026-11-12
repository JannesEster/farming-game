import { CONFIG, type GameConfig } from "./config";
import { applySale } from "./economy";
import { beginHerdMove, herderIsBusy } from "./herding";
import { findCamp } from "./simulation";
import { STEP3B } from "./step3bConfig";
import { homesteadYardTile, kraalDestinationCampId } from "./yard";
import { herdInTransit } from "./transit";
import type { GameState, TilePoint } from "./types";
import type { SaleChannel, SaleConvoyState, SaleLine, StockClass } from "./storyTypes";

export type SalePhase =
  | "gather"
  | "drive_yard"
  | "kraal"
  | "crush"
  | "ramp"
  | "loading"
  | "truck_depart"
  | "done";

export function defaultSaleConvoy(): SaleConvoyState | null {
  return null;
}

function yardTile(state: GameState): TilePoint {
  return homesteadYardTile(state);
}

export function beginSaleConvoy(
  state: GameState,
  stockClass: StockClass,
  count: number,
  channel: SaleChannel,
  line: SaleLine,
): { ok: boolean; message: string } {
  if (!state.story) return { ok: false, message: "Missing story." };
  if (state.story.saleConvoy && state.story.saleConvoy.phase !== "done") {
    return { ok: false, message: "A sale is already in progress." };
  }
  if (herderIsBusy(state) || herdInTransit(state.herd)) {
    return { ok: false, message: "Finish the herd move before loading stock." };
  }
  state.story.saleConvoy = {
    stockClass,
    count,
    channel,
    quoted: line,
    phase: "gather",
    phaseProgress: 0,
    paid: false,
    herder: state.story.farmhand.hired ? "piet" : "farmer",
    toCampId: state.herd.campId,
  };
  return { ok: true, message: "Rounding up stock for the kraal." };
}

export function saleConvoyActive(state: GameState): boolean {
  const c = state.story?.saleConvoy;
  return Boolean(c && c.phase !== "done");
}

function phaseMs(phase: SalePhase, state: GameState, config: GameConfig): number {
  switch (phase) {
    case "gather":
      return STEP3B.saleGatherMs;
    case "drive_yard": {
      const camp = findCamp(state, state.herd.campId);
      const yard = yardTile(state);
      const distKm =
        camp && yard
          ? Math.hypot(camp.anchor.x - yard.x, camp.anchor.y - yard.y) * config.transit.kmPerTile
          : 0.8;
      return STEP3B.saleDriveMsPerKm * Math.max(0.5, distKm);
    }
    case "kraal":
      return STEP3B.saleKraalMs;
    case "crush":
      return STEP3B.saleCrushMs;
    case "ramp":
      return STEP3B.saleCrushMs;
    case "loading":
      return STEP3B.saleLoadMs;
    case "truck_depart":
      return STEP3B.saleTruckDepartMs;
    default:
      return 1;
  }
}

const PHASE_ORDER: SalePhase[] = [
  "gather",
  "drive_yard",
  "kraal",
  "crush",
  "ramp",
  "loading",
  "truck_depart",
  "done",
];

function nextPhase(phase: SalePhase): SalePhase {
  const i = PHASE_ORDER.indexOf(phase);
  return PHASE_ORDER[Math.min(PHASE_ORDER.length - 1, i + 1)];
}

export function tickSaleConvoyRealtime(
  state: GameState,
  deltaMs: number,
  speed: number,
  config: GameConfig = CONFIG,
): void {
  const convoy = state.story?.saleConvoy;
  if (!convoy || convoy.phase === "done") return;

  if (convoy.phase === "drive_yard") {
    if (!convoy.driveStarted && !herdInTransit(state.herd)) {
      const dest = kraalDestinationCampId(state);
      if (dest !== null && dest !== state.herd.campId) {
        beginHerdMove(state, dest, config);
      }
      convoy.driveStarted = true;
    }
    if (herdInTransit(state.herd)) {
      convoy.phaseProgress = state.herd.transit?.progress ?? convoy.phaseProgress;
      return;
    }
  }

  const duration = phaseMs(convoy.phase, state, config);
  convoy.phaseProgress += (deltaMs * speed) / duration;
  if (convoy.phaseProgress < 1) return;

  if (convoy.phase === "truck_depart" && !convoy.paid) {
    applySale(state, convoy.quoted);
    convoy.paid = true;
  }

  convoy.phase = nextPhase(convoy.phase);
  convoy.phaseProgress = 0;
}

export function saleTruckVisible(state: GameState): boolean {
  const c = state.story?.saleConvoy;
  if (!c || c.phase === "done" || c.phase === "gather" || c.phase === "drive_yard") return false;
  return c.phase === "loading" || c.phase === "truck_depart" || c.phase === "ramp";
}

export function saleTruckDeparting(state: GameState): boolean {
  const c = state.story?.saleConvoy;
  return Boolean(c && c.phase === "truck_depart");
}
