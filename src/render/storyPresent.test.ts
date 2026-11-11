import { describe, expect, it } from "vitest";
import { presentStoryCard } from "./storyPresent";
import type { UiCard } from "../sim/storyTypes";

function card(kind: UiCard["kind"]): UiCard {
  return { id: "c", kind, title: "Month in review", body: "August is closed.", priority: 1 };
}

describe("presentStoryCard", () => {
  it("shows a month review on the event card only", () => {
    const seen: string[] = [];
    presentStoryCard(card("summary"), {
      showEventCard: (title, body) => seen.push(`card:${title}:${body}`),
      setHint: (text) => seen.push(`hint:${text}`),
    });
    expect(seen).toEqual(["card:Month in review:August is closed."]);
  });

  it("uses one hint for a season note", () => {
    const seen: string[] = [];
    presentStoryCard(card("season"), {
      showEventCard: () => seen.push("card"),
      setHint: (text) => seen.push(text),
    });
    expect(seen).toEqual(["Month in review: August is closed."]);
  });
});
