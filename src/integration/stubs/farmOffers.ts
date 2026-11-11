import { createGame } from "../../sim/simulation";
import type { GameState } from "../../sim/types";
import type { FarmOffer, FarmPickerPort } from "../interfaces";

function stubOffers(rollSeed: number): FarmOffer[] {
  const bases = [
    {
      id: "offer-kalahari",
      name: "Kalahari fringe",
      hectares: 3200,
      cashNad: 180_000,
      worldSeed: rollSeed + 11,
      headCount: 90,
      infrastructure: ["Windmill", "12 camps", "Homestead kraal"],
      blurb: "Mixed sweet and sour veld, rested Camp 3 ready.",
    },
    {
      id: "offer-otavi",
      name: "Otavi thornveld",
      hectares: 2800,
      cashNad: 220_000,
      worldSeed: rollSeed + 29,
      headCount: 120,
      infrastructure: ["Borehole", "14 camps", "Sale pen"],
      blurb: "Strong carrying capacity, needs a water check.",
    },
    {
      id: "offer-hardap",
      name: "Hardap savanna",
      hectares: 4100,
      cashNad: 140_000,
      worldSeed: rollSeed + 47,
      headCount: 75,
      infrastructure: ["Dam", "18 camps", "Workshop"],
      blurb: "Room to grow if you rest camps early.",
    },
  ];
  return bases;
}

export const stubFarmPicker: FarmPickerPort = {
  listOffers(rollSeed: number) {
    return stubOffers(rollSeed);
  },
  createGameStateFromOffer(offer: FarmOffer): GameState {
    const state = createGame(offer.worldSeed);
    state.cashNad = offer.cashNad;
    state.herd.headCount = offer.headCount;
    return state;
  },
};
