import { describe, expect, it } from "vitest";
import { initialGameState } from "../sim/persist";
import { presentStoryCard } from "./storyPresent";
import type { UiCard } from "../sim/storyTypes";

function card(kind: UiCard["kind"]): UiCard {
  return { id: "c", kind, title: "Month in review", body: "August is closed.", priority: 1 };
}

describe("presentStoryCard", () => {
  const state = initialGameState();

  it("routes month review to the letter rail", () => {
    const seen: string[] = [];
    presentStoryCard(state, card("summary"), {
      showEventCard: (title, body) => seen.push(`card:${title}:${body}`),
      setHint: (text) => seen.push(`hint:${text}`),
      pushLetter: (item) => seen.push(`letter:${item.title}`),
      syncAlerts: () => {},
    });
    expect(seen.some((s) => s.startsWith("letter:"))).toBe(true);
  });

  it("pauses on critical cards", () => {
    const seen: string[] = [];
    presentStoryCard(state, card("critical"), {
      showEventCard: (title, body) => seen.push(`card:${title}:${body}`),
      setHint: (text) => seen.push(`hint:${text}`),
      pushLetter: () => {},
      syncAlerts: () => {},
    });
    expect(seen).toEqual(["card:Month in review:August is closed."]);
  });

  it("keeps a weekly note as one hint", () => {
    const seen: string[] = [];
    presentStoryCard(state, card("weekly"), {
      showEventCard: () => seen.push("card"),
      setHint: (text) => seen.push(text),
      pushLetter: () => {},
      syncAlerts: () => {},
    });
    expect(seen).toEqual(["Month in review: August is closed."]);
  });
});
