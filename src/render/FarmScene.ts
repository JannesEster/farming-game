import Phaser from "phaser";
import { CONFIG } from "../sim/config";
import { COPY } from "../sim/format";
import { clamp } from "../sim/math";
import { clearSavedGame, initialGameState, saveGame } from "../sim/persist";
import { campIdAt, moveHerd, stepDay } from "../sim/simulation";
import { herdInTransit, herdWorldTile, pathTangent, tickTransitRealtime } from "../sim/transit";
import { zoomScrollDelta } from "./camera";
import { grazeableFraction } from "../sim/pasture";
import { TILE_HOMESTEAD, TILE_OUTSIDE, type GameState } from "../sim/types";
import {
  ART_ORIGIN,
  buildArt,
  groundTextureKey,
  maybeTermiteAt,
  treeDeadAt,
  WINDMILL_AXLE_LIFT,
  type HerdOffset,
} from "./art";
import { groundTexture, terrainVariant, tileTint, trackKeys } from "./colour";
import { collectFenceSegments, drawFences } from "./fences";
import { mountHud, type Hud, type SpeedMode } from "./hud";
import { isoLayout, tileCenter, tileTop, worldToTile, type IsoLayout } from "./iso";
import { palette } from "./palette";
import { offsetsForHerd } from "./herdLayout";
import { boundsVisible, chunkCoordsForTile } from "./terrain";

type PointerRec = { x: number; y: number; sx: number; sy: number; moved: boolean };

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
  private chunkRoots = new Map<string, Phaser.GameObjects.Container>();
  private shownPct = new Map<number, number>();
  private fences!: Phaser.GameObjects.Graphics;
  private rain!: Phaser.GameObjects.Graphics;
  private ring!: Phaser.GameObjects.Graphics;
  private cows: Phaser.GameObjects.Image[] = [];
  private herdOffsets: HerdOffset[] = [];
  private lastHerdCampId = -1;
  private propSprites: Phaser.GameObjects.Image[] = [];
  private blades?: Phaser.GameObjects.Image;
  private reduceMotion = false;
  private pointers = new Map<number, PointerRec>();
  private pinching = false;
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private gesturePinched = false;
  private herdLabel?: Phaser.GameObjects.Text;
  private herdVisual = { x: 0, y: 0 };
  private campLabels = new Map<number, Phaser.GameObjects.Text>();

  constructor() {
    super("farm");
  }

  create(): void {
    this.state = initialGameState();
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    this.layout = isoLayout(this.state.width, this.state.height, tileW, tileH, CONFIG.view.boundsPadPx);
    this.track = trackKeys(this.state);
    this.paintTextures();
    this.paintGround();
    this.paintProps();
    this.paintLabels();
    this.fences = this.add.graphics().setDepth(2);
    this.redrawFences();
    this.ring = this.add.graphics().setDepth(9);
    this.rain = this.add.graphics().setScrollFactor(0).setDepth(30000);
    this.syncHerdFromSim();
    this.spawnCows();
    this.herdLabel = this.add
      .text(this.herdVisual.x, this.herdVisual.y - 52, "", {
        fontFamily: "Segoe UI, Helvetica Neue, sans-serif",
        fontSize: "15px",
        color: "#f7f0e2",
        stroke: "#2a1c12",
        strokeThickness: 4,
        fontStyle: "700",
      })
      .setOrigin(0.5, 1)
      .setDepth(20001)
      .setResolution(2);
    this.refreshHerdLabel();
    this.cameras.main.setBounds(0, 0, this.layout.width, this.layout.height);
    this.layoutCamera(true);
    this.bindInput();
    this.hud = mountHud({
      onSpeed: (mode) => this.setSpeed(mode),
      onMinimap: (nx, ny) => this.onMinimap(nx, ny),
      onNewFarm: () => this.startNewFarm(),
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
    const walking = herdInTransit(this.state.herd);
    if (interval !== null && !walking) {
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
        this.persist();
      }
    }
    if (walking) {
      const was = this.state.herd.transit?.progress ?? 0;
      tickTransitRealtime(this.state, delta, this.mode);
      if (!herdInTransit(this.state.herd)) {
        this.syncHud();
        this.persist();
        this.redrawFences();
      } else if ((this.state.herd.transit?.progress ?? 0) !== was) {
        this.syncHerdFromSim();
      }
    }
    const prevCamp = this.state.herd.campId;
    this.syncHerdFromSim();
    this.refreshHerdOffsets();
    if (this.state.herd.campId !== prevCamp) this.redrawFences();
    this.placeHerd(time);
    this.cullProps();
    this.cullChunks();
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
    (Object.keys(art.grounds) as (keyof typeof art.grounds)[]).forEach((kind) => {
      art.grounds[kind].forEach((sheet, variant) => this.addCanvas(groundTextureKey(kind, variant), sheet));
    });
    art.cows.forEach((cow, index) => this.addCanvas(`cow-${index}`, cow));
    this.addCanvas("tree", art.tree);
    this.addCanvas("tree-dead", art.treeDead);
    this.addCanvas("bush", art.bush);
    this.addCanvas("termite", art.termite);
    this.addCanvas("house", art.house);
    this.addCanvas("shed", art.shed);
    this.addCanvas("tower", art.tower);
    this.addCanvas("blades", art.blades);
    this.addCanvas("kraal", art.kraal);
    this.addCanvas("reservoir", art.reservoir);
    this.addCanvas("trough", art.trough);
    this.addCanvas("bakkie", art.bakkie);
    this.addCanvas("garden", art.garden);
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
        const { cx, cy } = chunkCoordsForTile(x, y);
        const chunkKey = `${cx},${cy}`;
        let root = this.chunkRoots.get(chunkKey);
        if (!root) {
          root = this.add.container(0, 0).setDepth(0);
          this.chunkRoots.set(chunkKey, root);
        }
        const kind = groundTexture(this.state, x, y, this.track);
        const variant = terrainVariant(x, y, kind);
        const textureKey = groundTextureKey(kind, variant);
        const top = tileTop(x, y, this.layout, tileW, tileH);
        const sprite = this.add
          .image(top.x, top.y, textureKey)
          .setOrigin(ART_ORIGIN.diamond.x, ART_ORIGIN.diamond.y);
        if (kind === "grass") {
          sprite.setTint(tileTint(this.state, x, y, this.track));
          sprite.setTintMode(Phaser.TintModes.FILL);
        }
        root.add(sprite);
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
      const center = tileCenter(feature.x, feature.y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
      const depth = 10 + feature.x + feature.y;
      if (feature.kind === "windmill") {
        const tower = this.footImage("tower", center.x, center.y, depth, 1.15);
        this.propSprites.push(tower);
        this.blades = this.add
          .image(center.x, center.y - WINDMILL_AXLE_LIFT * 1.15, "blades")
          .setOrigin(ART_ORIGIN.blades.x, ART_ORIGIN.blades.y)
          .setDepth(depth + 0.2);
        this.propSprites.push(this.blades);
        continue;
      }
      let textureKey: string = feature.kind;
      let scale = 1;
      if (feature.kind === "house") scale = 1.55;
      if (feature.kind === "shed") scale = 1.05;
      if (feature.kind === "kraal") scale = 1.12;
      if (feature.kind === "reservoir") scale = 1.1;
      if (feature.kind === "tree") {
        textureKey = treeDeadAt(feature.x, feature.y) ? "tree-dead" : "tree";
        scale = feature.scale;
      } else if (feature.kind === "bush") {
        scale = feature.scale;
      }
      const image = this.footImage(
        textureKey,
        center.x,
        center.y,
        depth + (feature.kind === "trough" ? 0 : 0.4),
        scale,
      );
      this.propSprites.push(image);
    }

    for (let y = 0; y < this.state.height; y += 1) {
      for (let x = 0; x < this.state.width; x += 1) {
        const id = this.state.campIds[y * this.state.width + x];
        if (id === TILE_HOMESTEAD || id === TILE_OUTSIDE || this.track.has(`${x},${y}`)) continue;
        if (!maybeTermiteAt(x, y)) continue;
        const center = tileCenter(x, y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
        const image = this.footImage("termite", center.x, center.y, 8 + x + y, 0.9 + (x % 3) * 0.08);
        this.propSprites.push(image);
      }
    }

    const house = this.state.features.find((f) => f.kind === "house");
    if (house) {
      const bakkieCenter = tileCenter(house.x + 2, house.y + 1, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
      const gardenCenter = tileCenter(house.x, house.y + 2, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
      this.propSprites.push(this.footImage("bakkie", bakkieCenter.x, bakkieCenter.y, 12 + house.x + house.y, 0.95));
      this.propSprites.push(this.footImage("garden", gardenCenter.x, gardenCenter.y, 11 + house.x + house.y, 1));
    }
  }

  private footImage(
    key: string,
    x: number,
    y: number,
    depth: number,
    scale = 1,
  ): Phaser.GameObjects.Image {
    const origin = ART_ORIGIN[key as keyof typeof ART_ORIGIN] ?? { x: 0.5, y: 1 };
    return this.add.image(x, y, key).setOrigin(origin.x, origin.y).setDepth(depth).setScale(scale);
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
      const label = this.add
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
      this.campLabels.set(camp.id, label);
    }
    this.refreshCampLabels();
  }

  private refreshCampLabels(): void {
    for (const camp of this.state.camps) {
      const label = this.campLabels.get(camp.id);
      if (!label) continue;
      const base = String(camp.id + 1);
      const badge = this.hud?.campBadge(camp.id) ?? "";
      label.setText(badge ? `${base}\n${badge}` : base);
      const active = camp.id === this.state.herd.campId;
      label.setColor(active && badge ? "#f0c27a" : "#f7f0e2");
    }
  }

  private startNewFarm(): void {
    clearSavedGame();
    this.scene.restart();
  }

  private persist(): void {
    saveGame(this.state);
  }

  private spawnCows(): void {
    const count = this.state.herd.headCount;
    for (let i = 0; i < count; i += 1) {
      const cow = this.add
        .image(0, 0, "cow-0")
        .setOrigin(ART_ORIGIN.cow.x, ART_ORIGIN.cow.y)
        .setScale(0.3);
      this.cows.push(cow);
    }
    this.refreshHerdOffsets();
    this.placeHerd(0);
  }

  private refreshHerdOffsets(): void {
    const walking = herdInTransit(this.state.herd);
    const progress = this.state.herd.transit?.progress ?? 0;
    this.herdOffsets = offsetsForHerd(
      this.state,
      this.layout,
      CONFIG.view.tileWidth,
      CONFIG.view.tileHeight,
      walking,
      progress,
      pathTangent(this.state),
    );
    if (this.state.herd.campId !== this.lastHerdCampId) this.lastHerdCampId = this.state.herd.campId;
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
    const herdCamp =
      this.state.herd.transit?.toCampId !== undefined && herdInTransit(this.state.herd)
        ? this.state.herd.campId
        : this.state.herd.campId;
    drawFences(
      this.fences,
      collectFenceSegments(this.state, this.layout, herdCamp, this.selected),
    );
  }

  private syncHerdFromSim(): void {
    const tile = herdWorldTile(this.state);
    const point = tileCenter(tile.x, tile.y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
    this.herdVisual.x = point.x;
    this.herdVisual.y = point.y;
    this.refreshHerdLabel();
  }

  private refreshHerdLabel(): void {
    if (!this.herdLabel) return;
    this.herdLabel.setText(`${this.state.herd.headCount} head`);
    this.herdLabel.setPosition(this.herdVisual.x, this.herdVisual.y - 48);
    const tile = worldToTile(
      this.herdVisual.x,
      this.herdVisual.y,
      this.layout,
      CONFIG.view.tileWidth,
      CONFIG.view.tileHeight,
    );
    this.herdLabel.setDepth(20000 + tile.x + tile.y);
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
    const keys = ["cow-0", "cow-1", "cow-2", "cow-3", "cow-4", "cow-5"];
    this.cows.forEach((cow, index) => {
      const offset = this.herdOffsets[index] ?? { x: 0, y: 0, flip: false, coat: 0, scale: 0.5 };
      const walk =
        herdInTransit(this.state.herd) && !this.reduceMotion
          ? Math.sin(time / 220 + index * 0.7) * 1.6
          : Math.sin(time / 280 + index) * bobAmp;
      cow.setTexture(keys[offset.coat % keys.length]);
      cow.setScale(offset.scale);
      cow.setFlipX(offset.flip);
      cow.setPosition(this.herdVisual.x + offset.x, this.herdVisual.y + offset.y + walk);
      cow.setDepth(depth + offset.y * 0.01);
      cow.setVisible(true);
    });
  }

  private cullProps(): void {
    const pad = CONFIG.view.propCullPadPx;
    const view = this.cameras.main.worldView;
    for (const sprite of this.propSprites) {
      sprite.setVisible(
        sprite.x >= view.x - pad &&
          sprite.x <= view.right + pad &&
          sprite.y >= view.y - pad &&
          sprite.y <= view.bottom + pad,
      );
    }
    for (const cow of this.cows) {
      cow.setVisible(
        this.herdVisual.x >= view.x - pad - 80 &&
          this.herdVisual.x <= view.right + pad + 80 &&
          this.herdVisual.y >= view.y - pad - 80 &&
          this.herdVisual.y <= view.bottom + pad + 80,
      );
    }
  }

  private cullChunks(): void {
    const camera = this.cameras.main;
    const pad = CONFIG.view.propCullPadPx;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    for (const [key, root] of this.chunkRoots) {
      const [cx, cy] = key.split(",").map(Number);
      const sample = tileTop(cx * CONFIG.view.terrainChunkTiles, cy * CONFIG.view.terrainChunkTiles, this.layout, tileW, tileH);
      const bounds = new Phaser.Geom.Rectangle(sample.x - tileW * 8, sample.y - tileH * 2, tileW * 16, tileH * 16);
      root.setVisible(boundsVisible(camera, bounds, pad));
    }
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
    this.refreshCampLabels();
    if (herdInTransit(this.state.herd)) this.redrawFences();
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
    if (herdInTransit(this.state.herd)) {
      this.hud.setHint(COPY.hintMoving);
      return;
    }
    const result = moveHerd(this.state, id);
    if (!result.ok) {
      const reason = result.reason;
      this.hud.setHint(
        reason === "same" ? COPY.hintSame : reason === "moving" ? COPY.hintMoving : COPY.hintNeedHerd,
      );
      return;
    }
    this.hud.setHint(`Walking to ${result.campName}. They graze again when they arrive.`);
    this.redrawFences();
    this.syncHud();
    this.persist();
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
    const delta = zoomScrollDelta(before.x, before.y, after.x, after.y);
    camera.scrollX += delta.scrollX;
    camera.scrollY += delta.scrollY;
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
