import { cashAfterPurchase, generateFarmOffers } from "../picker/generateOffers";
import type { FarmOfferCard } from "../picker/types";
import type { GameState } from "../sim/types";
import type { FarmOffer, FarmPickerPort } from "./interfaces";

function toFarmOffer(card: FarmOfferCard): FarmOffer {
  return {
    id: card.id,
    name: card.title,
    hectares: card.hectares,
    cashNad: cashAfterPurchase(card.askingPriceNad),
    worldSeed: card.seed,
    headCount: card.livestock.head,
    infrastructure: [
      `${card.campCount} camps`,
      `${card.water.windmills} windmill(s)`,
      card.buildings.workerHouses ? `${card.buildings.workerHouses} worker house(s)` : "Worker housing",
    ],
    blurb: card.subtitle,
  };
}

export function createFarmPickerPort(rollSeed = 88001): FarmPickerPort & { cards: FarmOfferCard[] } {
  let cards = generateFarmOffers(rollSeed);
  return {
    cards,
    listOffers(seed: number) {
      cards = generateFarmOffers(seed);
      return cards.filter((c) => c.playable).map(toFarmOffer);
    },
    createGameStateFromOffer(offer: FarmOffer) {
      const card = cards.find((c) => c.id === offer.id);
      if (!card) {
        throw new Error(`Unknown offer ${offer.id}`);
      }
      return stateFromOfferCard(card);
    },
  };
}

export function stateFromOfferCard(card: FarmOfferCard): GameState {
  const state = structuredClone(card.previewState) as GameState;
  state.cashNad = cashAfterPurchase(card.askingPriceNad);
  return state;
}

export function refreshOffers(seed: number): FarmOfferCard[] {
  return generateFarmOffers(seed);
}
