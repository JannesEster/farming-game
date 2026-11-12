import type { GameState } from "../sim/types";
import type { MonthEndSummary, YearEndReport } from "./types";

/**
 * Farm offers. The play path uses `src/picker` and `pickerAdapter.ts`.
 */
export type FarmOffer = {
  id: string;
  name: string;
  hectares: number;
  /** Starting cash after purchase (N$). */
  cashNad: number;
  /** Procedural seed for map generation. */
  worldSeed: number;
  headCount: number;
  infrastructure: string[];
  blurb: string;
};

export interface FarmPickerPort {
  /** Return 3 to 4 offers for the current roll (deterministic if seed provided). */
  listOffers(rollSeed: number): FarmOffer[];
  /** Build initial {@link GameState} from a chosen offer. */
  createGameStateFromOffer(offer: FarmOffer): GameState;
}

/**
 * Economy rules, auctions, drought, costs, and the farmhand. Wired in `storyEconomyAdapter.ts`.
 */
export interface StoryEconomyPort {
  /** Called each sim day; return cash delta and optional story copy. */
  onDayAdvanced?(state: GameState, prevCash: number): { cashDeltaNad: number; note?: string };
  /** True when player cannot pay mandatory costs. */
  isBankrupt(state: GameState): boolean;
  /** True when herd is wiped (starvation / sell-out). */
  isHerdLost(state: GameState): boolean;
  /** Year-end financial and narrative rollup. */
  buildYearEndReport(state: GameState, farmYear: number): YearEndReport;
  /** Month tick from STORY; integration surfaces via event bus. */
  buildMonthEndSummary?(state: GameState): MonthEndSummary;
}

/**
 * STORY branch: scripted / random events publish here; integration shows toasts.
 */
export type StoryEventPayload =
  | { kind: "toast"; message: string; level?: "info" | "warn" | "urgent" }
  | { kind: "monthEnd"; summary: MonthEndSummary }
  | { kind: "droughtWarning"; weeksAhead: number }
  | { kind: "auctionReminder"; when: string }
  | { kind: "custom"; type: string; data: Record<string, unknown> };

export interface StoryEventsPort {
  /** Publish a story event onto the notification bus. */
  publish(event: StoryEventPayload): void;
}

/**
 * ART branch: no flow hooks required beyond existing FarmScene render.
 * Optional future: highlight camp polygons for tutorial coach marks.
 */
export interface ArtTutorialPort {
  highlightCamp?(campId: number | null): void;
}
