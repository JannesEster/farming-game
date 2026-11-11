import Phaser from "phaser";
import { CONFIG } from "../sim/config";
import { COPY } from "../sim/format";
import { clamp } from "../sim/math";
import { campIdAt, createGame, moveHerd, stepDay } from "../sim/simulation";
import { grazeableFraction } from "../sim/pasture";
import { TILE_HOMESTEAD, TILE_OUTSIDE, type GameState } from "../sim/types";
import { ART_ORIGIN, buildArt, WINDMILL_AXLE_LIFT } from "./art";
import { tileTint, trackKeys } from "./colour";
import { mountHud, type Hud, type SpeedMode } from "./hud";
import { isoLayout, tileCenter, tileTop, worldToTile, type IsoLayout } from "./iso";
import { palette } from "./palette";

type PointerRec = { x: number; y: number; sx: number; sy: number; moved: boolean };
type Segment = { x1: number; y1: number; x2: number; y2: number };

export class FarmScene extends Phaser.Scene {
  private state!: GameState;
  private layout!: IsoLayout;
  private hud!: Hud;
  private mode: SpeedMode = "play";
  private selected = false;
  private bank = 0;
  private minZoom = 0.2;
  private maxZoom = 2;
  private track = new Set<string>();
  private tileSprites: Phaser.GameObjects.Image[] = [];
  private shownPct = new Map<number, number>();
  private fences!: Phaser.GameObjects.Graphics;
  private rain!: Phaser.GameObjects.Graphics;
  private ring!: Phaser.GameObjects.Graphics;
  private cows: Phaser.GameObjects.Image[] = [];
  private blades?: Phaser.GameObjects.Image;
  private reduceMotion = false;
  private pointers = new Map<number, PointerRec>();
  private pinching = false;
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private gesturePinched = false;
  private herdVisual = { x: 0, y: 0, fromX: 0, fromY: 0, toX: 0, toY: 0, t: 1 };

  constructor() {
    super("farm");
  }

  create(): void {
    this.state = createGame();
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    this.layout = isoLayout(this.state.width, this.state.height, tileW, tileH, CONFIG.view.boundsPadPx);
    this.track = trackKeys(this.state);
    this.paintTextures();
    this.paintGround();
    this.paintProps();
    this.paintLabels();
    this.fences = this.add.graphics().setDepth(1);
    this.redrawFences();
    this.ring = this.add.graphics().setDepth(9);
    this.rain = this.add.graphics().setScrollFactor(0).setDepth(30000);
    const anchor = this.anchorPoint();
    this.herdVisual.x = anchor.x;
    this.herdVisual.y = anchor.y;
    this.herdVisual.toX = anchor.x;
    this.herdVisual.toY = anchor.y;
    this.spawnCows();
    this.cameras.main.setBounds(0, 0, this.layout.width, this.layout.height);
    this.layoutCamera(true);
    this.bindInput();
    this.hud = mountHud({
      onSpeed: (mode) => this.setSpeed(mode),
      onMinimap: (nx, ny) => this.onMinimap(nx, ny),
    });
    this.hud.setSpeed(this.mode);
    this.hud.setHint(COPY.hintStart);
    this.syncHud();
    this.scale.on("resize", () => this.layoutCamera(false));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hud.destroy());
    this.game.canvas.style.touchAction = "none";
    this.game.canvas.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
    this.game.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    requestAnimationFrame(() => this.layoutCamera(true));
  }

  update(time: number, delta: number): void {
    const interval = this.msPerDay();
    if (interval !== null) {
      this.bank += Math.min(delta, CONFIG.view.maxFrameMs);
      let steps = 0;
      while (this.bank >= interval && steps < CONFIG.view.maxDaysPerFrame) {
        this.bank -= interval;
        stepDay(this.state);
        steps += 1;
      }
      if (steps > 0) {
        this.refreshGrass();
        this.syncHud();
      }
    }
    this.animateHerd(time, delta);
    if (this.blades && !this.reduceMotion) {
      this.blades.rotation += (delta / 1000) * CONFIG.view.windmillRadiansPerSecond;
    }
    this.drawRain(time);
    this.drawRing();
  }

  private setSpeed(mode: SpeedMode): void {
    this.mode = mode;
    if (mode === "pause") this.bank = 0;
    this.hud.setSpeed(mode);
  }

  private msPerDay(): number | null {
    if (this.mode === "pause") return null;
    const seconds = this.mode === "fast" ? CONFIG.view.secondsPerDayFast : CONFIG.view.secondsPerDayPlay;
    return seconds * 1000;
  }

  private paintTextures(): void {
    const art = buildArt(CONFIG.view.tileWidth, CONFIG.view.tileHeight);
    this.addCanvas("diamond", art.diamond);
    art.cows.forEach((cow, index) => this.addCanvas(`cow-${index}`, cow));
    this.addCanvas("tree", art.tree);
    this.addCanvas("bush", art.bush);
    this.addCanvas("house", art.house);
    this.addCanvas("tower", art.tower);
    this.addCanvas("blades", art.blades);
    this.addCanvas("kraal", art.kraal);
    this.addCanvas("reservoir", art.reservoir);
    this.addCanvas("trough", art.trough);
  }

  private addCanvas(key: string, source: HTMLCanvasElement): void {
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, source);
  }

  private paintGround(): void {
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    this.tileSprites = [];
    for (let y = 0; y < this.state.height; y += 1) {
      for (let x = 0; x < this.state.width; x += 1) {
        const top = tileTop(x, y, this.layout, tileW, tileH);
        const sprite = this.add
          .image(top.x, top.y, "diamond")
          .setOrigin(ART_ORIGIN.diamond.x, ART_ORIGIN.diamond.y)
          .setDepth(0)
          .setTint(tileTint(this.state, x, y, this.track));
        sprite.setTintMode(Phaser.TintModes.FILL);
        this.tileSprites.push(sprite);
      }
    }
    for (const camp of this.state.camps) {
      this.shownPct.set(camp.id, Math.round(grazeableFraction(camp) * 100));
    }
  }

  private paintProps(): void {
    for (const feature of this.state.features) {
      if (feature.kind === "track") continue;
      const center = tileCenter(
        feature.x,
        feature.y,
        this.layout,
        CONFIG.view.tileWidth,
        CONFIG.view.tileHeight,
      );
      const depth = 10 + feature.x + feature.y;
      if (feature.kind === "windmill") {
        const tower = this.footImage("tower", center.x, center.y, depth);
        tower.setScale(1);
        this.blades = this.add
          .image(center.x, center.y - WINDMILL_AXLE_LIFT, "blades")
          .setOrigin(ART_ORIGIN.blades.x, ART_ORIGIN.blades.y)
          .setDepth(depth + 0.2);
        continue;
      }
      const key = feature.kind;
      const image = this.footImage(key, center.x, center.y, depth + (feature.kind === "trough" ? 0 : 0.4));
      if (feature.kind === "tree" || feature.kind === "bush") image.setScale(feature.scale);
    }
  }

  private footImage(key: string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    const origin = ART_ORIGIN[key as keyof typeof ART_ORIGIN] ?? { x: 0.5, y: 1 };
    return this.add.image(x, y, key).setOrigin(origin.x, origin.y).setDepth(depth);
  }

  private paintLabels(): void {
    for (const camp of this.state.camps) {
      let sx = 0;
      let sy = 0;
      for (const tile of camp.tiles) {
        sx += tile.x;
        sy += tile.y;
      }
      const point = tileCenter(
        sx / camp.tiles.length,
        sy / camp.tiles.length,
        this.layout,
        CONFIG.view.tileWidth,
        CONFIG.view.tileHeight,
      );
      this.add
        .text(point.x, point.y, String(camp.id + 1), {
          fontFamily: "Segoe UI, Helvetica Neue, sans-serif",
          fontSize: `${CONFIG.view.labelSizePx}px`,
          color: "#f7f0e2",
          stroke: "#2a1c12",
          strokeThickness: 4,
          fontStyle: "700",
        })
        .setOrigin(0.5, 0.5)
        .setDepth(20000)
        .setResolution(2);
    }
  }

  private spawnCows(): void {
    const keys = ["cow-0", "cow-1", "cow-2"];
    for (let i = 0; i < CONFIG.view.cowCount; i += 1) {
      const cow = this.add
        .image(0, 0, keys[i % keys.length])
        .setOrigin(ART_ORIGIN.cow.x, ART_ORIGIN.cow.y)
        .setScale(0.78)
        .setFlipX(i % 2 === 0);
      this.cows.push(cow);
    }
    this.placeHerd(0);
  }

  private refreshGrass(): void {
    for (const camp of this.state.camps) {
      const pct = Math.round(grazeableFraction(camp) * 100);
      if (this.shownPct.get(camp.id) === pct) continue;
      this.shownPct.set(camp.id, pct);
      for (const tile of camp.tiles) {
        if (this.track.has(`${tile.x},${tile.y}`)) continue;
        const sprite = this.tileSprites[tile.y * this.state.width + tile.x];
        sprite.setTint(tileTint(this.state, tile.x, tile.y, this.track));
      }
    }
  }

  private redrawFences(): void {
    this.fences.clear();
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const buckets: Record<"boundary" | "selected" | "inner", Segment[]> = {
      boundary: [],
      selected: [],
      inner: [],
    };
    const herd = this.state.herd.campId;
    for (let y = 0; y < this.state.height; y += 1) {
      for (let x = 0; x < this.state.width; x += 1) {
        const id = this.state.campIds[y * this.state.width + x];
        const top = tileTop(x, y, this.layout, tileW, tileH);
        const right = { x: top.x + tileW / 2, y: top.y + tileH / 2 };
        const bottom = { x: top.x, y: top.y + tileH };
        const left = { x: top.x - tileW / 2, y: top.y + tileH / 2 };
        this.pushEdge(buckets, id, x + 1 < this.state.width ? this.idAt(x + 1, y) : null, herd, right, bottom);
        this.pushEdge(buckets, id, y + 1 < this.state.height ? this.idAt(x, y + 1) : null, herd, left, bottom);
      }
    }
    this.strokeBucket(buckets.inner, CONFIG.view.fencePx, palette.fence);
    this.strokeBucket(buckets.boundary, CONFIG.view.fenceBoundaryPx, palette.fenceStrong);
    this.strokeBucket(buckets.selected, CONFIG.view.fenceSelectedPx, palette.fenceSelected);
  }

  private pushEdge(
    buckets: Record<"boundary" | "selected" | "inner", Segment[]>,
    id: number,
    other: number | null,
    herd: number,
    a: { x: number; y: number },
    b: { x: number; y: number },
  ): void {
    if (other === null) {
      if (id !== TILE_OUTSIDE) buckets.boundary.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      return;
    }
    if (other === id) return;
    buckets[this.fenceKind(id, other, herd)].push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }

  private fenceKind(a: number, b: number, herd: number): "boundary" | "selected" | "inner" {
    if (a === TILE_OUTSIDE || b === TILE_OUTSIDE) return "boundary";
    if (this.selected && (a === herd || b === herd)) return "selected";
    return "inner";
  }

  private strokeBucket(segments: Segment[], width: number, colour: number): void {
    if (segments.length === 0) return;
    this.fences.lineStyle(width, colour, 1);
    this.fences.beginPath();
    for (const segment of segments) {
      this.fences.moveTo(segment.x1, segment.y1);
      this.fences.lineTo(segment.x2, segment.y2);
    }
    this.fences.strokePath();
  }

  private idAt(x: number, y: number): number {
    return this.state.campIds[y * this.state.width + x];
  }

  private anchorPoint(): { x: number; y: number } {
    const camp = this.state.camps.find((item) => item.id === this.state.herd.campId) ?? this.state.camps[0];
    return tileCenter(camp.anchor.x, camp.anchor.y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
  }

  private animateHerd(time: number, delta: number): void {
    if (this.herdVisual.t < 1) {
      this.herdVisual.t = Math.min(1, this.herdVisual.t + delta / CONFIG.view.moveMs);
      const t = this.herdVisual.t;
      const eased = t * t * (3 - 2 * t);
      this.herdVisual.x = this.herdVisual.fromX + (this.herdVisual.toX - this.herdVisual.fromX) * eased;
      this.herdVisual.y = this.herdVisual.fromY + (this.herdVisual.toY - this.herdVisual.fromY) * eased;
    }
    this.placeHerd(time);
  }

  private placeHerd(time: number): void {
    const tile = worldToTile(
      this.herdVisual.x,
      this.herdVisual.y,
      this.layout,
      CONFIG.view.tileWidth,
      CONFIG.view.tileHeight,
    );
    const depth = 20 + tile.x + tile.y;
    const bobAmp = this.reduceMotion ? 0 : CONFIG.view.cowBobPx;
    this.cows.forEach((cow, index) => {
      const offset = CONFIG.view.cowOffsets[index] ?? { x: 0, y: 0 };
      const bob = Math.sin(time / 280 + index) * bobAmp;
      cow.setPosition(this.herdVisual.x + offset.x, this.herdVisual.y + offset.y + bob);
      cow.setDepth(depth);
    });
  }

  private startMove(): void {
    const dest = this.anchorPoint();
    this.herdVisual.fromX = this.herdVisual.x;
    this.herdVisual.fromY = this.herdVisual.y;
    this.herdVisual.toX = dest.x;
    this.herdVisual.toY = dest.y;
    this.herdVisual.t = 0;
  }

  private drawRing(): void {
    this.ring.clear();
    if (!this.selected) return;
    this.ring.lineStyle(CONFIG.view.ringLinePx, palette.fenceSelected, 0.95);
    this.ring.strokeEllipse(
      this.herdVisual.x,
      this.herdVisual.y + 4,
      CONFIG.view.ringRx,
      CONFIG.view.ringRy,
    );
    const tile = worldToTile(
      this.herdVisual.x,
      this.herdVisual.y,
      this.layout,
      CONFIG.view.tileWidth,
      CONFIG.view.tileHeight,
    );
    this.ring.setDepth(19 + tile.x + tile.y);
  }

  private drawRain(time: number): void {
    this.rain.clear();
    const mm = this.state.todayRainMm;
    if (mm <= 0) return;
    const count = Math.min(CONFIG.view.rainDropCap, Math.round(8 + mm));
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.rain.lineStyle(2, 0xc5dce8, 0.45);
    const drift = this.reduceMotion ? 0 : time * 0.08;
    for (let i = 0; i < count; i += 1) {
      const x = (i * 97 + 13) % Math.max(1, width);
      const y = (i * 53 + drift) % (height + 24) - 12;
      this.rain.beginPath();
      this.rain.moveTo(x, y);
      this.rain.lineTo(x + 3, y + 11);
      this.rain.strokePath();
    }
  }

  private syncHud(): void {
    this.hud.update(this.state, this.selected);
  }

  private bindInput(): void {
    this.input.addPointer(1);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.pointers.set(pointer.id, {
        x: pointer.x,
        y: pointer.y,
        sx: pointer.x,
        sy: pointer.y,
        moved: false,
      });
      if (this.pointers.size >= 2) {
        this.pinching = true;
        this.gesturePinched = true;
        const [a, b] = [...this.pointers.values()];
        this.pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
        this.pinchStartZoom = this.cameras.main.zoom;
      }
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const rec = this.pointers.get(pointer.id);
      if (!rec) return;
      const previousX = rec.x;
      const previousY = rec.y;
      rec.x = pointer.x;
      rec.y = pointer.y;
      if (Math.hypot(rec.x - rec.sx, rec.y - rec.sy) > CONFIG.view.dragSlopPx) rec.moved = true;
      if (this.pointers.size >= 2 && this.pinching) {
        const [a, b] = [...this.pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchStartDist > 8) {
          this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, this.pinchStartZoom * (distance / this.pinchStartDist));
        }
        return;
      }
      if (this.pointers.size === 1 && rec.moved && !this.gesturePinched) {
        const camera = this.cameras.main;
        camera.scrollX -= (pointer.x - previousX) / camera.zoom;
        camera.scrollY -= (pointer.y - previousY) / camera.zoom;
        this.clampScroll();
      }
    });
    const end = (pointer: Phaser.Input.Pointer) => {
      const rec = this.pointers.get(pointer.id);
      this.pointers.delete(pointer.id);
      if (this.pointers.size < 2) this.pinching = false;
      if (this.pointers.size > 0) return;
      const pinched = this.gesturePinched;
      this.gesturePinched = false;
      if (!rec || rec.moved || pinched) return;
      this.onTap(pointer);
    };
    this.input.on("pointerup", end);
    this.input.on("pointerupoutside", end);
    this.input.on(
      "wheel",
      (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
        const factor = dy > 0 ? 1 / CONFIG.view.wheelZoomStep : CONFIG.view.wheelZoomStep;
        this.zoomAt(pointer.x, pointer.y, this.cameras.main.zoom * factor);
      },
    );
    this.input.keyboard?.on("keydown-SPACE", (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.tagName === "BUTTON") return;
      event.preventDefault();
      this.setSpeed(this.mode === "pause" ? "play" : "pause");
    });
    this.input.keyboard?.on("keydown-F", () => this.setSpeed("fast"));
    this.input.keyboard?.on("keydown-ONE", () => this.setSpeed("pause"));
    this.input.keyboard?.on("keydown-TWO", () => this.setSpeed("play"));
    this.input.keyboard?.on("keydown-THREE", () => this.setSpeed("fast"));
  }

  private onTap(pointer: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const radius = Math.max(
      CONFIG.view.herdPickTiles * CONFIG.view.tileWidth,
      CONFIG.view.herdPickMinScreenPx / this.cameras.main.zoom,
    );
    if (Math.hypot(world.x - this.herdVisual.x, world.y - this.herdVisual.y) <= radius) {
      this.selected = true;
      this.hud.setHint(COPY.hintSelected);
      this.redrawFences();
      this.syncHud();
      return;
    }
    const tile = worldToTile(world.x, world.y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
    this.chooseTile(tile.x, tile.y);
  }

  private onMinimap(nx: number, ny: number): void {
    const x = clamp(Math.floor(nx * this.state.width), 0, this.state.width - 1);
    const y = clamp(Math.floor(ny * this.state.height), 0, this.state.height - 1);
    const center = tileCenter(x, y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
    this.cameras.main.centerOn(center.x, center.y);
    this.clampScroll();
    this.chooseTile(x, y);
  }

  private chooseTile(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.state.width || y >= this.state.height) {
      this.hud.setHint(COPY.hintOutside);
      return;
    }
    const id = campIdAt(this.state, x, y);
    if (id === null) return;
    if (!this.selected) {
      this.hud.setHint(COPY.hintNeedHerd);
      return;
    }
    if (id === TILE_HOMESTEAD) {
      this.hud.setHint(COPY.hintHomestead);
      return;
    }
    if (id === TILE_OUTSIDE || id < 0) {
      this.hud.setHint(COPY.hintOutside);
      return;
    }
    const result = moveHerd(this.state, id);
    if (!result.ok) {
      this.hud.setHint(result.reason === "same" ? COPY.hintSame : COPY.hintNeedHerd);
      return;
    }
    this.hud.setHint(COPY.hintMoved(result.campName));
    this.startMove();
    this.redrawFences();
    this.syncHud();
  }

  private layoutCamera(resetView: boolean): void {
    const camera = this.cameras.main;
    const fit =
      Math.min(camera.width / this.layout.width, camera.height / this.layout.height) * CONFIG.view.fitMargin;
    this.minZoom = Math.max(0.05, fit);
    this.maxZoom = Math.max(this.minZoom, CONFIG.view.maxTilePx / CONFIG.view.tileWidth);
    const target =
      camera.width >= CONFIG.view.desktopMinWidthPx ? CONFIG.view.desktopTilePx : CONFIG.view.phoneTilePx;
    const fillHeight = (camera.height / this.layout.height) * CONFIG.view.fitMargin;
    const preferred = clamp(
      Math.max(target / CONFIG.view.tileWidth, fillHeight),
      this.minZoom,
      this.maxZoom,
    );
    if (resetView) {
      camera.setZoom(preferred);
      camera.centerOn(this.herdVisual.x, this.herdVisual.y);
    } else {
      camera.setZoom(clamp(camera.zoom, this.minZoom, this.maxZoom));
    }
    this.clampScroll();
  }

  private zoomAt(screenX: number, screenY: number, zoom: number): void {
    const camera = this.cameras.main;
    const next = clamp(zoom, this.minZoom, this.maxZoom);
    const before = camera.getWorldPoint(screenX, screenY);
    camera.setZoom(next);
    const after = camera.getWorldPoint(screenX, screenY);
    camera.scrollX += before.x - after.x;
    camera.scrollY += after.y - after.y;
    this.clampScroll();
  }

  private clampScroll(): void {
    const camera = this.cameras.main;
    const viewW = camera.width / camera.zoom;
    const viewH = camera.height / camera.zoom;
    if (viewW >= this.layout.width) camera.scrollX = (this.layout.width - viewW) / 2;
    else camera.scrollX = clamp(camera.scrollX, 0, this.layout.width - viewW);
    if (viewH >= this.layout.height) camera.scrollY = (this.layout.height - viewH) / 2;
    else camera.scrollY = clamp(camera.scrollY, 0, this.layout.height - viewH);
  }
}
