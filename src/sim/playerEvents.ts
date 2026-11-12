import { CONFIG, type GameConfig } from "./config";
import { applySale, quoteSale } from "./economy";
import { STEP2 } from "./step2Config";
import { appendMonthDiary } from "./monthDiary";
import { diaryLineForPlayerAction } from "./playCopy";
import type { GameState } from "./types";
import { rngFromState } from "./rng";

export function tickPlayerEvents(state: GameState, config: GameConfig = CONFIG): void {
  const story = state.story;
  if (!story || story.pendingPlayerEvent) return;
  if (!story.farmhand.hired && state.date.day % 2 !== 0) return;
  const rng = rngFromState(state.rngState);
  const roll = rng.next();
  state.rngState = rng.getState();
  if (roll > STEP2.eventDailyChance) return;
  const pick = rng.next();
  state.rngState = rng.getState();
  if (pick < 0.38) queuePumpFault(state);
  else if (pick < 0.68) queueJackal(state);
  else queueBuyerOffer(state, config);
}

function queuePumpFault(state: GameState): void {
  const story = state.story!;
  const defer = story.costLevers?.maintenance === "defer";
  story.pendingPlayerEvent = {
    id: `pump-${state.date.year}-${state.date.month}-${state.date.day}`,
    kind: "pump_fault",
    title: defer ? "Windmill struggling" : "Pump fault",
    body: defer
      ? "The windmill bearings are rough. Fix now or risk a bigger bill."
      : "Water pressure dropped at the main point. A mechanic can sort it today.",
    ignoreConsequence: `Emergency callout about N$${STEP2.emergencyPumpRepairNad.toLocaleString("en-NA")} if you wait.`,
    critical: defer && (story.infrastructure?.pumpReliability ?? 1) < 0.55,
    actions: [
      { id: "repair_now", label: `Repair now (N$${STEP2.routineMaintenanceNad.toLocaleString("en-NA")})`, costNad: STEP2.routineMaintenanceNad },
      { id: "defer_fix", label: "Ignore for now", costNad: 0 },
    ],
  };
}

function queueJackal(state: GameState): void {
  const calves = state.story?.composition.calf ?? 0;
  const loss = Math.min(STEP2.jackalLossCalvesMax, Math.max(1, Math.floor(calves * 0.04)));
  state.story!.pendingPlayerEvent = {
    id: `jackal-${state.date.year}-${state.date.month}-${state.date.day}`,
    kind: "jackal",
    title: "Jackal near calves",
    body: `Tracks at the calf camp. Up to ${loss} calves at risk tonight.`,
    ignoreConsequence: `Could lose ${loss} calf${loss === 1 ? "" : "ves"} if you do nothing.`,
    critical: calves >= 15 && loss >= 2,
    actions: [
      { id: "night_guard", label: `Night guard (N$${STEP2.jackalGuardCostNad.toLocaleString("en-NA")})`, costNad: STEP2.jackalGuardCostNad },
      { id: "fix_fence", label: `Patch fence gap (N$${STEP2.jackalRepairFenceCostNad.toLocaleString("en-NA")})`, costNad: STEP2.jackalRepairFenceCostNad },
      { id: "ignore", label: "Take the risk", costNad: 0 },
    ],
  };
}

function queueBuyerOffer(state: GameState, config: GameConfig = CONFIG): void {
  const quote = quoteSale(state, "tolly", 5, "speculator", config);
  let body = "A speculator wants 5 tollies off hand at a fair price.";
  if ("reason" in quote) {
    body = "A buyer wants a small load of young stock before the dry pinch.";
  } else {
    body = `Offer about ${Math.round(quote.totalNad).toLocaleString("en-NA")} for 5 tollies, pickup this week.`;
  }
  state.story!.pendingPlayerEvent = {
    id: `buyer-${state.date.year}-${state.date.month}-${state.date.day}`,
    kind: "buyer_offer",
    title: "Buyer on the phone",
    body,
    ignoreConsequence: "No sale; tollies stay on the veld.",
    critical: false,
    actions: [
      { id: "accept_offer", label: `Accept (N$${STEP2.buyerOfferPickupNad} pickup fee)`, costNad: STEP2.buyerOfferPickupNad },
      { id: "decline", label: "Decline", costNad: 0 },
    ],
  };
}

export function resolvePlayerEvent(
  state: GameState,
  actionId: string,
  config: GameConfig = CONFIG,
): { ok: boolean; message: string; card?: { title: string; body: string; critical: boolean } } {
  const story = state.story;
  const event = story?.pendingPlayerEvent;
  if (!story || !event) return { ok: false, message: "No event waiting." };
  const action = event.actions.find((a) => a.id === actionId) ?? event.actions[0];
  if (action.costNad > 0) {
    if (state.cashNad < action.costNad) return { ok: false, message: "Not enough cash." };
    state.cashNad -= action.costNad;
    story.ledger.expenseNad += action.costNad;
  }
  let message = "Done.";
  if (event.kind === "pump_fault") {
    if (actionId === "repair_now" && story.infrastructure) {
      story.infrastructure.pumpReliability = Math.min(1, story.infrastructure.pumpReliability + 0.2);
      message = "Pump serviced. Water flow is steady again.";
      appendMonthDiary(story, `Pump service N$${action.costNad}.`);
    } else {
      story.infrastructure = story.infrastructure ?? { fenceWear: 0.2, pumpReliability: 0.7, deferredMaintenanceMonths: 0 };
      story.infrastructure.pumpReliability = Math.max(0.3, story.infrastructure.pumpReliability - 0.15);
      const later = STEP2.emergencyPumpRepairNad;
      state.cashNad -= later;
      story.ledger.expenseNad += later;
      message = `Ignored fault. Emergency repair cost N$${later.toLocaleString("en-NA")}.`;
      appendMonthDiary(story, `Emergency pump repair N$${later}.`);
    }
  }
  if (event.kind === "jackal") {
    if (actionId === "ignore") {
      const calves = story.composition.calf;
      const loss = Math.min(STEP2.jackalLossCalvesMax, Math.max(1, Math.floor(calves * 0.04)));
      story.composition.calf = Math.max(0, calves - loss);
      story.ledger.deathCount += loss;
      message = `${loss} calf${loss === 1 ? "" : "ves"} lost to predators.`;
      appendMonthDiary(story, `Predator loss ${loss} calves.`);
    } else {
      message = actionId === "night_guard" ? "Night guard posted." : "Fence gap patched.";
      appendMonthDiary(story, diaryLineForPlayerAction(actionId));
    }
  }
  if (event.kind === "buyer_offer") {
    if (actionId === "accept_offer") {
      const line = quoteSale(state, "tolly", 5, "speculator", config);
      if (!("reason" in line)) {
        applySale(state, line);
        message = `Sold 5 tollies for about N$${Math.round(line.totalNad).toLocaleString("en-NA")}.`;
        appendMonthDiary(story, `Buyer pickup: tollies sold.`);
      }
    } else {
      message = "Buyer moved on.";
    }
  }
  story.pendingPlayerEvent = null;
  const critical = event.critical && actionId.includes("ignore");
  return {
    ok: true,
    message,
    card: critical ? { title: event.title, body: message, critical: true } : undefined,
  };
}

/** Step 3 hook: future worker housing checks land here. */
export function workersNeedHousing(_state: GameState): boolean {
  return false;
}
