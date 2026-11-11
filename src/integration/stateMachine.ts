import type { FlowPhase, GameOverReason } from "./types";

export type FlowEvent =
  | { type: "BOOT_DONE" }
  | { type: "PRESS_NEW_GAME" }
  | { type: "PRESS_CONTINUE"; hasSave: boolean }
  | { type: "OFFER_SELECTED" }
  | { type: "PLAY_BEGIN" }
  | { type: "YEAR_END_REACHED" }
  | { type: "YEAR_END_CONTINUE" }
  | { type: "GAME_OVER"; reason: GameOverReason }
  | { type: "RETURN_TO_START" };

const TRANSITIONS: Record<FlowPhase, Partial<Record<FlowEvent["type"], FlowPhase>>> = {
  boot: { BOOT_DONE: "start" },
  start: {
    PRESS_NEW_GAME: "farmPicker",
    PRESS_CONTINUE: "playing",
  },
  farmPicker: { OFFER_SELECTED: "playing", RETURN_TO_START: "start" },
  playing: { YEAR_END_REACHED: "yearEndReview", GAME_OVER: "gameOver" },
  yearEndReview: { YEAR_END_CONTINUE: "playing", GAME_OVER: "gameOver" },
  gameOver: { RETURN_TO_START: "start" },
};

export type TransitionResult =
  | { ok: true; phase: FlowPhase }
  | { ok: false; phase: FlowPhase; reason: string };

export function transition(phase: FlowPhase, event: FlowEvent): TransitionResult {
  if (event.type === "PRESS_CONTINUE" && !event.hasSave) {
    return { ok: false, phase, reason: "No save slot to continue." };
  }
  const next = TRANSITIONS[phase]?.[event.type];
  if (!next) {
    return { ok: false, phase, reason: `Event ${event.type} not allowed in ${phase}.` };
  }
  return { ok: true, phase: next };
}

export function canInteractWithFarm(phase: FlowPhase): boolean {
  return phase === "playing";
}
