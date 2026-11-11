import Phaser from "phaser";
import { isSeasonStart } from "../sim/calendar";
import type { GameState } from "../sim/types";
import type { Hud } from "../render/hud";
import { NotificationBus } from "./events";
import { createYearBaseline, detectMilestones } from "./goals";
import type { FarmOffer, StoryEconomyPort } from "./interfaces";
import { defaultFlowMeta } from "./metaDefaults";
import {
  clearSlot,
  getActiveSlotId,
  readSlot,
  writeSlot,
  type SavedSlotPayload,
} from "./saveSlots";
import { stubFarmPicker } from "./stubs/farmOffers";
import { stubStoryEconomy } from "./stubs/storyEconomy";
import { stubStoryEvents } from "./stubs/storyEvents";
import { transition, type FlowEvent } from "./stateMachine";
import {
  activeStep,
  advanceTutorial,
  tutorialActionForSimEvent,
  type TutorialStep,
} from "./tutorial";
import type { FlowPhase, FlowRuntime, YearEndReport } from "./types";
import { mountFlowUi, type FlowUi } from "./ui/mountFlowUi";

let singleton: GameFlowService | null = null;

export function getGameFlow(): GameFlowService {
  if (!singleton) singleton = new GameFlowService();
  return singleton;
}

export class GameFlowService {
  readonly bus = new NotificationBus();
  readonly storyEvents = stubStoryEvents(this.bus);
  readonly farmPicker = stubFarmPicker;

  private economy: StoryEconomyPort = stubStoryEconomy(defaultFlowMeta());
  private runtime: FlowRuntime = {
    phase: "boot",
    meta: defaultFlowMeta(),
    slotId: getActiveSlotId(),
    gameState: null,
  };
  private ui: FlowUi | null = null;
  private game: Phaser.Game | null = null;
  private farmSceneKey = "farm";
  private pendingState: GameState | null = null;
  private lastMonthKey = "";
  private yearEndReport: YearEndReport | null = null;

  boot(game: Phaser.Game): void {
    this.game = game;
    this.ui = mountFlowUi({
      onNewGame: () => this.dispatch({ type: "PRESS_NEW_GAME" }),
      onContinue: () =>
        this.dispatch({ type: "PRESS_CONTINUE", hasSave: Boolean(readSlot(this.runtime.slotId)) }),
      onPickOffer: (offer) => this.pickFarmOffer(offer),
      onBackToStart: () => this.dispatch({ type: "RETURN_TO_START" }),
      onYearEndContinue: () => this.onYearEndContinue(),
      onGameOverAck: () => this.dispatch({ type: "RETURN_TO_START" }),
      onTutorialSkip: () => this.skipTutorial(),
      onTutorialNext: () => this.dismissTutorialStep(),
      listOffers: () => this.farmPicker.listOffers(Date.now() % 100_000),
    });
    this.dispatch({ type: "BOOT_DONE" });
    this.applyCaptureOverrides();
  }

  private applyCaptureOverrides(): void {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const flow = params.get("flowCapture");
    if (params.get("capture") === "1" && !flow) {
      this.startStubFarm();
      return;
    }
    if (flow === "tutorial") {
      this.runtime.meta.tutorial = {
        completed: false,
        skipped: false,
        currentStepId: "selectHerd",
        finishedStepIds: [],
      };
      this.startStubFarm();
      this.ui?.hideAll();
    } else if (flow === "yearend") {
      this.startStubFarm();
      this.yearEndReport = this.economy.buildYearEndReport(
        this.runtime.gameState!,
        this.runtime.meta.farmYear,
      );
      this.runtime.phase = "yearEndReview";
      this.syncUi();
      this.pauseFarmScene(true);
    }
  }

  dispatch(event: FlowEvent): void {
    const result = transition(this.runtime.phase, event);
    if (!result.ok) {
      this.bus.toast(result.reason, "warn");
      return;
    }
    this.runtime.phase = result.phase;
    this.onPhaseEntered(event);
    this.syncUi();
  }

  private onPhaseEntered(event: FlowEvent): void {
    switch (this.runtime.phase) {
      case "start":
        this.pauseFarmScene(true);
        this.runtime.gameState = null;
        break;
      case "farmPicker":
        this.pauseFarmScene(true);
        break;
      case "playing":
        if (event.type === "PRESS_CONTINUE") this.resumeFromSlot();
        else if (event.type === "OFFER_SELECTED" || event.type === "YEAR_END_CONTINUE") {
          /* state already set */
        } else if (event.type === "PLAY_BEGIN") {
          /* noop */
        }
        this.startOrResumeFarmScene();
        break;
      case "yearEndReview":
        this.pauseFarmScene(true);
        break;
      case "gameOver":
        this.pauseFarmScene(true);
        clearSlot(this.runtime.slotId);
        break;
      default:
        break;
    }
  }

  pickFarmOffer(offer: FarmOffer): void {
    const state = this.farmPicker.createGameStateFromOffer(offer);
    this.runtime.meta = {
      ...defaultFlowMeta(),
      farmOfferId: offer.id,
      yearBaseline: createYearBaseline(state, 1),
      farmYear: 1,
    };
    this.economy = stubStoryEconomy(this.runtime.meta);
    this.runtime.gameState = state;
    this.pendingState = state;
    this.dispatch({ type: "OFFER_SELECTED" });
    this.persist();
    const step = activeStep(this.runtime.meta.tutorial);
    if (step) this.showTutorial(step);
  }

  private resumeFromSlot(): void {
    const slot = readSlot(this.runtime.slotId);
    if (!slot) return;
    this.runtime.meta = slot.meta;
    this.runtime.gameState = slot.state;
    this.pendingState = slot.state;
    this.economy = stubStoryEconomy(this.runtime.meta);
    this.lastMonthKey = `${slot.state.date.year}-${slot.state.date.month}`;
  }

  private startStubFarm(): void {
    if (this.runtime.phase !== "farmPicker" && this.runtime.phase !== "playing") {
      this.runtime.phase = "farmPicker";
    }
    const offer = this.farmPicker.listOffers(3300)[0];
    this.pickFarmOffer(offer);
    this.ui?.hideAll();
  }

  consumeGameStateForScene(): GameState | null {
    const state = this.pendingState;
    this.pendingState = null;
    return state;
  }

  attachFarmHud(hud: Hud): void {
    this.bus.subscribe((event) => {
      if (event.type === "toast") hud.setHint(event.message);
    });
  }

  onSimDayAdvanced(state: GameState): void {
    this.runtime.gameState = state;
    this.runtime.meta.milestones = detectMilestones(state, this.runtime.meta.milestones);
    const monthKey = `${state.date.year}-${state.date.month}`;
    if (monthKey !== this.lastMonthKey) {
      this.lastMonthKey = monthKey;
      const summary = this.economy.buildMonthEndSummary?.(state);
      if (summary) this.storyEvents.publish({ kind: "monthEnd", summary });
    }
    if (isSeasonStart(state.date) && this.runtime.meta.yearBaseline) {
      this.openYearEnd(state);
    }
    if (this.economy.isBankrupt(state)) {
      this.runtime.meta.gameOverReason = "bankrupt";
      this.dispatch({ type: "GAME_OVER", reason: "bankrupt" });
    } else if (this.economy.isHerdLost(state)) {
      this.runtime.meta.gameOverReason = "herdLost";
      this.dispatch({ type: "GAME_OVER", reason: "herdLost" });
    }
    this.persist();
  }

  private openYearEnd(state: GameState): void {
    this.yearEndReport = this.economy.buildYearEndReport(state, this.runtime.meta.farmYear);
    this.runtime.gameState = state;
    this.dispatch({ type: "YEAR_END_REACHED" });
  }

  onYearEndContinue(): void {
    if (!this.runtime.gameState) return;
    this.runtime.meta.farmYear += 1;
    this.runtime.meta.yearBaseline = createYearBaseline(
      this.runtime.gameState,
      this.runtime.meta.farmYear,
    );
    this.dispatch({ type: "YEAR_END_CONTINUE" });
    this.persist();
  }

  persist(): void {
    if (!this.runtime.gameState) return;
    const payload: SavedSlotPayload = {
      version: 2,
      savedAt: new Date().toISOString(),
      slotId: this.runtime.slotId,
      meta: this.runtime.meta,
      state: this.runtime.gameState,
    };
    writeSlot(this.runtime.slotId, payload);
  }

  runtimePatchState(state: GameState): void {
    this.runtime.gameState = state;
  }

  clearActiveSlot(): void {
    clearSlot(this.runtime.slotId);
    this.runtime.gameState = null;
    this.runtime.phase = "start";
    this.pauseFarmScene(true);
    this.syncUi();
  }

  notifySim(event: "herdSelected" | "moveConfirmed" | "speedFast" | "grassChecked" | "salePlanned"): void {
    const action = tutorialActionForSimEvent(event);
    if (!action) return;
    this.runtime.meta.tutorial = advanceTutorial(this.runtime.meta.tutorial, action);
    const step = activeStep(this.runtime.meta.tutorial);
    if (step) this.showTutorial(step);
    else this.ui?.hideTutorial();
    this.persist();
  }

  private skipTutorial(): void {
    this.runtime.meta.tutorial = advanceTutorial(this.runtime.meta.tutorial, "skip");
    this.ui?.hideTutorial();
    this.persist();
  }

  private dismissTutorialStep(): void {
    const current = this.runtime.meta.tutorial.currentStepId;
    if (current) {
      this.runtime.meta.tutorial = advanceTutorial(this.runtime.meta.tutorial, current);
    }
    const step = activeStep(this.runtime.meta.tutorial);
    if (step) this.showTutorial(step);
    else this.ui?.hideTutorial();
  }

  private showTutorial(step: TutorialStep): void {
    this.ui?.showTutorial(step);
  }

  getPhase(): FlowPhase {
    return this.runtime.phase;
  }

  getYearEndReport(): YearEndReport | null {
    return this.yearEndReport;
  }

  getTutorialStep(): TutorialStep | null {
    return activeStep(this.runtime.meta.tutorial);
  }

  private syncUi(): void {
    this.ui?.render({
      phase: this.runtime.phase,
      offers: this.farmPicker.listOffers(42),
      yearEnd: this.yearEndReport,
      gameOverReason: this.runtime.meta.gameOverReason,
      slotSummary: readSlot(this.runtime.slotId),
    });
  }

  private startOrResumeFarmScene(): void {
    if (!this.game) return;
    const farm = this.game.scene.getScene(this.farmSceneKey);
    if (farm && farm.scene.isPaused()) {
      this.pauseFarmScene(false);
      if (this.pendingState) farm.scene.restart({ flowState: this.pendingState });
      return;
    }
    if (!farm || !farm.scene.isActive()) {
      this.game.scene.start(this.farmSceneKey, { flowState: this.pendingState });
    } else if (this.pendingState) {
      farm.scene.restart({ flowState: this.pendingState });
    }
    this.pauseFarmScene(false);
    this.ui?.hideAll();
  }

  private pauseFarmScene(pause: boolean): void {
    if (!this.game) return;
    const farm = this.game.scene.getScene(this.farmSceneKey);
    if (!farm) return;
    if (pause) farm.scene.pause();
    else farm.scene.resume();
  }

  /** Capture / test bridge */
  exposeCaptureApi(): Record<string, unknown> {
    return {
      showTutorialStep1: () => {
        this.runtime.phase = "playing";
        this.runtime.meta.tutorial = {
          completed: false,
          skipped: false,
          currentStepId: "selectHerd",
          finishedStepIds: [],
        };
        this.ui?.hideAll();
        const step = activeStep(this.runtime.meta.tutorial);
        if (step) this.showTutorial(step);
      },
      showYearEndReview: () => {
        if (!this.runtime.gameState) this.startStubFarm();
        this.yearEndReport = this.economy.buildYearEndReport(
          this.runtime.gameState!,
          this.runtime.meta.farmYear,
        );
        this.runtime.phase = "yearEndReview";
        this.syncUi();
      },
      flowPhase: () => this.runtime.phase,
    };
  }
}

export { defaultFlowMeta } from "./metaDefaults";
