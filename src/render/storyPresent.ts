import { deliverCard, type HudNotificationSink } from "../integration/notificationHub";
import type { GameState } from "../sim/types";
import type { UiCard } from "../sim/storyTypes";

type StoryCardSurface = {
  showEventCard: (title: string, body: string) => void;
  setHint: (text: string) => void;
  pushLetter: (item: import("../sim/notifications").NotificationItem) => void;
  syncAlerts: (labels: string[]) => void;
};

/** Critical cards pause the centre. Letters, alerts, and toasts use the news rail. */
export function presentStoryCard(state: GameState, card: UiCard, hud: StoryCardSurface): void {
  const sink: HudNotificationSink = {
    pushMessage: (text) => hud.setHint(text),
    pushLetter: (item) => hud.pushLetter(item),
    pushCritical: (title, body) => hud.showEventCard(title, body),
    syncAlerts: (labels) => hud.syncAlerts(labels),
  };
  if (card.kind === "weekly") {
    hud.setHint(`${card.title}: ${card.body}`);
    return;
  }
  deliverCard(state, card, sink);
}
