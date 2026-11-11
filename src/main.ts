import Phaser from "phaser";
import { FarmScene } from "./render/FarmScene";
import { runStartFlow } from "./picker/flow";
import { saveGame } from "./sim/persist";
import type { GameState } from "./sim/types";
import "./style.css";

import { REGISTRY_STATE_KEY } from "./boot/registry";

function launchGame(initialState: GameState): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#c56a32",
    banner: false,
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    input: {
      activePointers: 3,
      smoothFactor: 0,
    },
    fps: {
      target: 60,
      forceSetTimeOut: false,
    },
    render: {
      antialias: true,
      roundPixels: false,
      pixelArt: false,
    },
    scene: [FarmScene],
  });
  game.registry.set(REGISTRY_STATE_KEY, initialState);
  window.addEventListener("resize", () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
  });
  return game;
}

async function boot(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const capture = params.get("capture") === "1";
  const offerParam = params.get("offer") ?? undefined;

  if (capture) {
    const offerId = offerParam ?? "otjozondjupa-ranch";
    const result = await runStartFlow({ skipMenu: true, forceOfferId: offerId });
    if (result.kind === "bought") {
      saveGame(result.state);
      launchGame(result.state);
      return;
    }
    if (result.kind === "continue") {
      launchGame(result.state);
      return;
    }
  }

  const result = await runStartFlow({});
  if (result.kind === "continue") {
    launchGame(result.state);
    return;
  }
  if (result.kind === "bought") {
    saveGame(result.state);
    launchGame(result.state);
  }
}

boot().catch((error) => {
  console.error(error);
});
