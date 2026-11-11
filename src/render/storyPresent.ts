import type { UiCard } from "../sim/storyTypes";

type StoryCardSurface = {
  showEventCard: (title: string, body: string) => void;
  setHint: (text: string) => void;
};

/** One surface per card. Summary, drought, and warnings use the event card. */
export function presentStoryCard(card: UiCard, hud: StoryCardSurface): void {
  if (card.kind === "summary" || card.kind === "drought" || card.kind === "warning") {
    hud.showEventCard(card.title, card.body);
    return;
  }
  hud.setHint(`${card.title}: ${card.body}`);
}
