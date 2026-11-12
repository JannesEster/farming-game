import Phaser from "phaser";
import { preloadDefaultFarm } from "../sim/simulation";
import { getGameFlow } from "./GameFlowService";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    void preloadDefaultFarm().finally(() => {
      getGameFlow().boot(this.game);
    });
  }
}
