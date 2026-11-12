import type { UiCard } from "../sim/storyTypes";

type StoryCardSurface = {
  showEventCard: (title: string, body: string) => void;
  setHint: (text: string) => void;
};

/** Month, drought, season, and warnings use the event card so the clock can pause. Weekly notes stay a toast. */
export function presentStoryCard(card: UiCard, hud: StoryCardSurface): void {
  if (card.kind === "summary" || card.kind === "drought" || card.kind === "warning" || card.kind === "season") {
    hud.showEventCard(card.title, card.body);
    return;
  }
  hud.setHint(`${card.title}: ${card.body}`);
}
