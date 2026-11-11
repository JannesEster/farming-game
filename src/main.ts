import Phaser from "phaser";
import { FarmScene } from "./render/FarmScene";
import "./style.css";

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
    autoRound: true,
  },
  input: {
    activePointers: 3,
    smoothFactor: 0,
  },
  render: {
    antialias: true,
    roundPixels: true,
    pixelArt: false,
    powerPreference: "high-performance",
  },
  fps: {
    limit: 0,
    smoothStep: false,
  },
  scene: [FarmScene],
});

window.addEventListener("resize", () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
