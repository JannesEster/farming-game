import Phaser from "phaser";
import { CONFIG } from "../sim/config";
import { SPRITE_KEYS } from "./sprites";
import type { FenceSegment } from "./fences";

export function placeGateSprites(
  scene: Phaser.Scene,
  segments: FenceSegment[],
  painted: boolean,
): Phaser.GameObjects.Image[] {
  if (!painted || !scene.textures.exists(SPRITE_KEYS.gate)) return [];
  const gates: Phaser.GameObjects.Image[] = [];
  const scale = (CONFIG.view.tileWidth * 0.95) / 256;
  for (const segment of segments) {
    if (!segment.gate) continue;
    const mx = (segment.x1 + segment.x2) * 0.5;
    const my = (segment.y1 + segment.y2) * 0.5;
    const angle = Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1);
    const gate = scene.add
      .image(mx, my, SPRITE_KEYS.gate)
      .setOrigin(0.5, 0.88)
      .setScale(scale)
      .setRotation(angle * 0.35)
      .setDepth(2.5);
    gates.push(gate);
  }
  return gates;
}
