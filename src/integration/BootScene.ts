import Phaser from "phaser";
import { getGameFlow } from "./GameFlowService";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    getGameFlow().boot(this.game);
  }
}
