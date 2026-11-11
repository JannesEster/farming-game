import Phaser from "phaser";
import { BootScene } from "./integration/BootScene";
import { FarmScene } from "./render/FarmScene";
import "./style.css";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#3b2a1e",
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
  scene: [BootScene, FarmScene],
});

window.addEventListener("resize", () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
