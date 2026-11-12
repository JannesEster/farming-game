import {
  emitNotification,
  type NotificationItem,
  type NotificationState,
} from "../sim/notifications";
import type { GameState } from "../sim/types";
import type { UiCard } from "../sim/storyTypes";

export type HudNotificationSink = {
  pushMessage: (text: string) => void;
  pushLetter: (item: NotificationItem) => void;
  pushCritical: (title: string, body: string) => void;
  syncAlerts: (labels: string[]) => void;
};

export function ensureNotifications(state: GameState): NotificationState {
  if (!state.notifications) {
    state.notifications = { log: [], letters: [], alerts: [], lastFiredDayKey: {} };
  }
  return state.notifications;
}

/** Bridge sim notifications and legacy pending cards into HUD tiers. */
export function deliverCard(
  state: GameState,
  card: UiCard,
  sink: HudNotificationSink,
): void {
  const notes = ensureNotifications(state);
  if (card.kind === "critical" || card.kind === "drought") {
    sink.pushCritical(card.title, card.body);
    return;
  }
  if (card.kind === "summary" || card.kind === "season" || card.kind === "warning") {
    const item = emitNotification(notes, {
      id: card.id,
      tier: card.kind === "warning" ? "letter" : "letter",
      kind:
        card.kind === "summary"
          ? "month_summary"
          : card.kind === "season"
            ? "season"
            : "feed_warning",
      title: card.title,
      body: card.body,
      priority: card.priority,
      at: { ...state.date },
      cooldownDays: card.kind === "warning" ? 2 : 0,
      dedupeKey: card.kind === "warning" ? card.title : card.id,
    });
    if (item) sink.pushLetter(item);
    return;
  }
  sink.pushMessage(`${card.title}: ${card.body}`);
}

export function syncAlertStrip(state: GameState, sink: HudNotificationSink): void {
  const notes = state.notifications;
  if (!notes) return;
  sink.syncAlerts(notes.alerts.map((a) => (a.count > 1 ? `${a.label} (${a.count})` : a.label)));
}
