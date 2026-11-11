// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { getGameFlow } from "./GameFlowService";
import type { Hud } from "../render/hud";
import { stateFromOfferCard } from "./pickerAdapter";
import { generateFarmOffers } from "../picker/generateOffers";

describe("merged flow paths", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not stack toast listeners when the farm scene attaches twice", () => {
    const flow = getGameFlow();
    const hints: string[] = [];
    const hud = {
      setHint: (message: string) => hints.push(message),
      holdToasts: () => {},
      releaseToasts: () => {},
    } as unknown as Hud;
    flow.attachFarmHud(hud);
    flow.attachFarmHud(hud);
    flow.bus.toast("Walking to Camp 3.");
    expect(hints).toEqual(["Walking to Camp 3."]);
  });

  it("does not publish a second month review on the opening day", () => {
    const flow = getGameFlow();
    const events: string[] = [];
    flow.bus.subscribe((event) => {
      if (event.type === "toast") events.push(event.message);
      if (event.type === "monthEnd") events.push("monthEnd");
    });
    const card = generateFarmOffers(88001).find((offer) => offer.id === "otjozondjupa-ranch");
    if (!card) throw new Error("missing offer");
    const state = stateFromOfferCard(card);
    flow.pickFarmPurchase(state, card);
    events.length = 0;
    flow.onSimDayAdvanced(state);
    expect(events.filter((event) => event === "monthEnd" || event.includes("Month in review"))).toEqual([]);
    expect(flow.getPhase()).toBe("playing");
  });

  it("opens the year-end review when the date reaches 1 July", () => {
    const flow = getGameFlow();
    const card = generateFarmOffers(88001).find((offer) => offer.id === "otjozondjupa-ranch");
    if (!card) throw new Error("missing offer");
    const state = stateFromOfferCard(card);
    flow.pickFarmPurchase(state, card);
    state.date = { year: 2027, month: 7, day: 1, hour: 6 };
    flow.onSimDayAdvanced(state);
    expect(flow.getPhase()).toBe("yearEndReview");
  });
});
