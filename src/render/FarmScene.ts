import Phaser from "phaser";
import { CONFIG } from "../sim/config";
import { COPY } from "../sim/format";
import { clamp } from "../sim/math";
import { clearSavedGame, initialGameState, saveGame } from "../sim/persist";
import { popNextCard } from "../sim/story";
import { campIdAt, moveHerd, stepDay } from "../sim/simulation";
import { herdInTransit, herdWorldTile, pathTangent, tickTransitRealtime } from "../sim/transit";
import {
  PAN_INERTIA,
  HOMESTEAD_KINDS,
  applyPanFriction,
  boundsCenter,
  boundsFromPoints,
  clampCameraScrollWithInsets,
  scrollToLayoutTip,
  worldXAtScreenX,
  worldYAtScreenY,
  type LayoutTip,
  clampZoom,
  computeZoomLimits,
  homesteadBoundsPad,
  maxOnScreenTileBudget,
  minimapTileFromNormalized,
  pinchCenter,
  pinchZoom,
  preferredHomesteadZoom,
  readableCampZoom,
  zoomScrollDelta,
  type WorldBounds,
  type ZoomTargets,
} from "./camera";
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
import {
  measureChipWidths,
  measureHudHeights,
  measureToastClearance,
  measureTopbarMetrics,
  measureTopbarSpare,
  mountHud,
  viewportCameraInsets,
  type Hud,
  type SpeedMode,
} from "./hud";
import { mountMarketSheet, type MarketSheet } from "./marketSheet";
import { doubleTapGoesHome } from "./tap";
import { resolveGroundTap, resolveHerdTap } from "./selection";
import { isoLayout, tileCenter, tileTop, worldToTile, type IsoLayout } from "./iso";
import { palette } from "./palette";
import { offsetsForHerd } from "./herdLayout";
import { boundsVisible, chunkCoordsForTile } from "./terrain";

type PointerRec = {
  x: number;
  y: number;
  sx: number;
  sy: number;
  moved: boolean;
  lastAt: number;
  vx: number;
  vy: number;
};

export class FarmScene extends Phaser.Scene {
  private state!: GameState;
  private layout!: IsoLayout;
  private hud!: Hud;
  private market!: MarketSheet;
  private mode: SpeedMode = "play";
  private selected = false;
  private pendingCampId: number | null = null;
  private pendingCampName = "";
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
  private panVel: { vx: number; vy: number } | null = null;
  private lastTapAt = 0;
  private lastTapX = 0;
  private lastTapY = 0;
  private homesteadBounds: WorldBounds | null = null;
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
    this.homesteadBounds = this.buildHomesteadBounds();
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
    this.layoutCamera(true);
    this.bindInput();
    this.market = mountMarketSheet({
      getState: () => this.state,
      onChange: () => {
        this.syncHud();
        this.persist();
      },
      onToast: (text) => this.hud.setHint(text),
    });
    this.hud = mountHud({
      onSpeed: (mode) => this.setSpeed(mode),
      onMinimap: (nx, ny) => this.onMinimap(nx, ny),
      onNewFarm: () => this.startNewFarm(),
      onHome: () => this.goHome(),
      onDeselect: () => this.deselectHerd(),
      onConfirmMove: () => this.confirmPendingMove(),
      onCancelMove: () => this.cancelPendingMove(),
      onOpenMarket: () => this.market.open(),
    });
    this.hud.setSpeed(this.mode);
    this.hud.setHint(COPY.hintStart);
    this.syncHud();
    this.scale.on("resize", () => this.layoutCamera(false));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.hud.destroy();
      this.market.destroy();
    });
    this.game.canvas.style.touchAction = "none";
    this.game.canvas.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
    this.game.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    requestAnimationFrame(() => this.layoutCamera(true));
    this.installCaptureBridge();
  }

  private installCaptureBridge(): void {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("capture") !== "1") return;
    const bridge = {
      measureHud: () => measureHudHeights(),
      measureChips: () => measureChipWidths(),
      measureTopbarSpare: () => measureTopbarSpare(),
      measureTopbarMetrics: () => measureTopbarMetrics(),
      measureToast: () => measureToastClearance(),
      showHint: (text: string) => this.hud.setHint(text),
      expandSheet: () => {
        const summary = document.getElementById("sheet-summary");
        summary?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      },
      viewportInsets: () => viewportCameraInsets(),
      deselect: () => this.deselectHerd(),
      selectHerd: () => {
        this.selected = true;
        this.syncHud();
      },
      setPendingMove: (campId: number) => {
        const camp = this.state.camps.find((item) => item.id === campId);
        if (!camp) return false;
        this.selected = true;
        this.pendingCampId = campId;
        this.pendingCampName = camp.name;
        this.syncHud();
        return true;
      },
      moveHerdTo: (campId: number) => this.commitMove(campId),
      panToTip: (tip: LayoutTip, zoom: number | null = null) => {
        const camera = this.cameras.main;
        if (zoom !== null) camera.setZoom(clampZoom(zoom, this.minZoom, this.maxZoom));
        const insets = viewportCameraInsets();
        const next = scrollToLayoutTip(
          tip,
          this.layout.width,
          this.layout.height,
          camera.width,
          camera.height,
          camera.zoom,
          insets,
        );
        camera.scrollX = next.scrollX;
        camera.scrollY = next.scrollY;
        return { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom };
      },
      centerOnHerd: () => {
        this.cameras.main.centerOn(this.herdVisual.x, this.herdVisual.y);
        this.clampScroll();
      },
      openingZoom: () => {
        this.layoutCamera(true);
        return this.cameras.main.zoom;
      },
      tipAtScreen: () => {
        const camera = this.cameras.main;
        const insets = viewportCameraInsets();
        const top = insets.top + 8;
        const bottom = camera.height - insets.bottom - 8;
        const left = insets.left + 8;
        const right = camera.width - insets.right - 8;
        return {
          northWorldY: worldYAtScreenY(camera.scrollY, camera.height, camera.zoom, top),
          southWorldY: worldYAtScreenY(camera.scrollY, camera.height, camera.zoom, bottom),
          westWorldX: worldXAtScreenX(camera.scrollX, camera.width, camera.zoom, left),
          eastWorldX: worldXAtScreenX(camera.scrollX, camera.width, camera.zoom, right),
        };
      },
      setTransitProgress: (progress: number) => {
        const transit = this.state.herd.transit;
        if (!transit) return false;
        transit.progress = Math.max(0, Math.min(0.99, progress));
        this.syncHerdFromSim();
        this.placeHerd(performance.now());
        this.redrawFences();
        return true;
      },
      transitDestCampId: () => this.state.herd.transit?.toCampId ?? null,
      findMoveCampId: () => {
        const from = this.state.herd.campId;
        const dest = this.state.camps.find((camp) => camp.id >= 0 && camp.id !== from);
        return dest?.id ?? null;
      },
      openMarket: () => {
        this.market.open();
        return true;
      },
      showFeedWarning: () => {
        this.hud.showEventCard(
          "Feed warning",
          "12 days on bare veld. Move or sell before condition slips.",
        );
        return true;
      },
      showMonthSummary: () => {
        this.hud.showEventCard(
          "Month in review",
          "Dry season ended. Income N$0 · Expenses N$8,500. Net N$-8,500. Rain season-to-date 42 mm.",
        );
        return true;
      },
      showDroughtChoice: () => {
        if (this.state.story) {
          this.state.story.drought.choicePending = "sell_down";
        }
        this.market.open();
        return true;
      },
    };
    (window as Window & { __farmCapture?: typeof bridge }).__farmCapture = bridge;
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
        this.flushStoryCards();
        this.syncHud();
        this.market.refresh(this.state);
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
    if (this.state.herd.campId !== prevCamp) this.redrawFences();
    this.placeHerd(time);
    this.cullProps();
    this.cullChunks();
    if (this.blades && !this.reduceMotion) {
      this.blades.rotation += (delta / 1000) * CONFIG.view.windmillRadiansPerSecond;
    }
    this.applyPanInertia(delta);
    this.drawRain(time);
    this.drawRing();
  }

  private flushStoryCards(): void {
    for (let i = 0; i < 2; i += 1) {
      const card = popNextCard(this.state);
      if (!card) break;
      if (card.kind === "summary" || card.kind === "drought" || card.kind === "warning") {
        this.hud.showEventCard(card.title, card.body);
      } else {
        this.hud.setHint(`${card.title}: ${card.body}`);
      }
    }
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
      this.propSprites.push(this.footImage("bakkie", bakkieCenter.x, bakkieCenter.y, 12 + house.x + house.y, 1.22));
      this.propSprites.push(this.footImage("garden", gardenCenter.x, gardenCenter.y, 11 + house.x + house.y, 1.28));
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
    this.refreshHerdOffsets(0);
    this.placeHerd(0);
  }

  private refreshHerdOffsets(timeMs: number): void {
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
      timeMs,
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
    this.refreshHerdOffsets(time);
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
    this.rain.beginPath();
    for (let i = 0; i < count; i += 1) {
      const x = (i * 97 + 13) % Math.max(1, width);
      const y = (i * 53 + drift) % (height + 24) - 12;
      this.rain.moveTo(x, y);
      this.rain.lineTo(x + 3, y + 11);
    }
    this.rain.strokePath();
  }

  private syncHud(): void {
    this.hud.update(this.state, {
      selected: this.selected,
      pendingCampId: this.pendingCampId,
      pendingCampName: this.pendingCampName,
    });
    this.refreshCampLabels();
    if (herdInTransit(this.state.herd)) this.redrawFences();
  }

  private zoomTargets(): ZoomTargets {
    return {
      viewportFill: 0.5,
      phoneTilePx: CONFIG.view.phoneTilePx,
      desktopTilePx: CONFIG.view.desktopTilePx,
      desktopMinWidthPx: CONFIG.view.desktopMinWidthPx,
    };
  }

  private refreshZoomLimits(): void {
    const camera = this.cameras.main;
    const limits = computeZoomLimits({
      layoutWidth: this.layout.width,
      layoutHeight: this.layout.height,
      mapWidth: this.state.width,
      mapHeight: this.state.height,
      viewportWidth: camera.width,
      viewportHeight: camera.height,
      tileWidth: CONFIG.view.tileWidth,
      tileHeight: CONFIG.view.tileHeight,
      fitMargin: CONFIG.view.fitMargin,
      maxTilePx: CONFIG.view.maxTilePx,
      maxOnScreenTiles: maxOnScreenTileBudget(camera.width, camera.height),
      terrainChunkTiles: CONFIG.view.terrainChunkTiles,
      campCount: this.state.camps.length,
      minCampsVisibleAtMinZoom: 4,
    });
    this.minZoom = limits.minZoom;
    this.maxZoom = limits.maxZoom;
  }

  private buildHomesteadBounds(): WorldBounds | null {
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const points: { x: number; y: number }[] = [];
    for (let y = 0; y < this.state.height; y += 1) {
      for (let x = 0; x < this.state.width; x += 1) {
        if (this.state.campIds[y * this.state.width + x] === TILE_HOMESTEAD) {
          points.push(tileCenter(x, y, this.layout, tileW, tileH));
        }
      }
    }
    for (const feature of this.state.features) {
      if (!HOMESTEAD_KINDS.has(feature.kind)) continue;
      points.push(tileCenter(feature.x, feature.y, this.layout, tileW, tileH));
    }
    return boundsFromPoints(points, homesteadBoundsPad(tileW, tileH));
  }

  private jumpCameraTo(worldX: number, worldY: number, ensureReadable: boolean): void {
    this.panVel = null;
    const camera = this.cameras.main;
    this.refreshZoomLimits();
    if (ensureReadable) {
      const readable = readableCampZoom(camera.width, CONFIG.view.tileWidth, this.zoomTargets());
      const target = clampZoom(Math.max(camera.zoom, readable), this.minZoom, this.maxZoom);
      if (target !== camera.zoom) {
        this.zoomAt(camera.width / 2, camera.height / 2, target);
      }
    }
    camera.centerOn(worldX, worldY);
    this.clampScroll();
  }

  private goHome(): void {
    this.panVel = null;
    this.layoutCamera(true);
  }

  private applyPanInertia(delta: number): void {
    if (!this.panVel) return;
    const camera = this.cameras.main;
    const dt = Math.min(delta, CONFIG.view.maxFrameMs);
    camera.scrollX += (this.panVel.vx * dt) / 1000;
    camera.scrollY += (this.panVel.vy * dt) / 1000;
    this.clampScroll();
    this.panVel = applyPanFriction(
      this.panVel.vx,
      this.panVel.vy,
      dt,
      PAN_INERTIA.decayPerFrame,
      PAN_INERTIA.minSpeed,
    );
  }

  private bindInput(): void {
    this.input.addPointer(1);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.panVel = null;
      const now = performance.now();
      this.pointers.set(pointer.id, {
        x: pointer.x,
        y: pointer.y,
        sx: pointer.x,
        sy: pointer.y,
        moved: false,
        lastAt: now,
        vx: 0,
        vy: 0,
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
        const center = pinchCenter(a, b);
        const next = pinchZoom(
          this.pinchStartZoom,
          this.pinchStartDist,
          distance,
          this.minZoom,
          this.maxZoom,
        );
        if (next !== null) this.zoomAt(center.x, center.y, next);
        return;
      }
      if (this.pointers.size === 1 && rec.moved && !this.gesturePinched) {
        const camera = this.cameras.main;
        const worldDx = -(pointer.x - previousX) / camera.zoom;
        const worldDy = -(pointer.y - previousY) / camera.zoom;
        camera.scrollX += worldDx;
        camera.scrollY += worldDy;
        const now = performance.now();
        const dt = Math.max(1, now - rec.lastAt);
        rec.vx = clamp((worldDx / dt) * 1000, -PAN_INERTIA.maxSpeed, PAN_INERTIA.maxSpeed);
        rec.vy = clamp((worldDy / dt) * 1000, -PAN_INERTIA.maxSpeed, PAN_INERTIA.maxSpeed);
        rec.lastAt = now;
        this.clampScroll();
      }
    });
    const end = (pointer: Phaser.Input.Pointer) => {
      const rec = this.pointers.get(pointer.id);
      this.pointers.delete(pointer.id);
      if (this.pointers.size < 2) this.pinching = false;
      if (rec?.moved && !this.gesturePinched && this.pointers.size === 0) {
        const speed = Math.hypot(rec.vx, rec.vy);
        if (speed >= PAN_INERTIA.minSpeed) {
          this.panVel = { vx: rec.vx, vy: rec.vy };
        }
      }
      if (this.pointers.size > 0) return;
      const pinched = this.gesturePinched;
      this.gesturePinched = false;
      if (!rec || rec.moved || pinched) return;
      const now = performance.now();
      const isDoubleTap =
        now - this.lastTapAt < PAN_INERTIA.doubleTapMs &&
        Math.hypot(pointer.x - this.lastTapX, pointer.y - this.lastTapY) < PAN_INERTIA.doubleTapSlopPx;
      this.lastTapAt = now;
      this.lastTapX = pointer.x;
      this.lastTapY = pointer.y;
      if (isDoubleTap) {
        const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const radius = Math.max(
          CONFIG.view.herdPickTiles * CONFIG.view.tileWidth,
          CONFIG.view.herdPickMinScreenPx / this.cameras.main.zoom,
        );
        const hitHerd = Math.hypot(world.x - this.herdVisual.x, world.y - this.herdVisual.y) <= radius;
        if (doubleTapGoesHome(hitHerd)) {
          this.goHome();
          return;
        }
      }
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
    this.input.keyboard?.on("keydown-ESC", () => this.deselectHerd());
    this.input.keyboard?.on("keydown-ESCAPE", () => this.deselectHerd());
  }

  private deselectHerd(): void {
    if (!this.selected) return;
    this.selected = false;
    this.pendingCampId = null;
    this.pendingCampName = "";
    this.redrawFences();
    this.syncHud();
  }

  private cancelPendingMove(): void {
    this.pendingCampId = null;
    this.pendingCampName = "";
    this.syncHud();
  }

  private confirmPendingMove(): void {
    if (this.pendingCampId === null) return;
    this.commitMove(this.pendingCampId);
  }

  private onTap(pointer: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const radius = Math.max(
      CONFIG.view.herdPickTiles * CONFIG.view.tileWidth,
      CONFIG.view.herdPickMinScreenPx / this.cameras.main.zoom,
    );
    if (Math.hypot(world.x - this.herdVisual.x, world.y - this.herdVisual.y) <= radius) {
      const action = resolveHerdTap(this.selected);
      if (action === "deselect") {
        this.deselectHerd();
        return;
      }
      this.selected = true;
      this.pendingCampId = null;
      this.pendingCampName = "";
      this.hud.setHint(COPY.hintSelected);
      this.redrawFences();
      this.syncHud();
      return;
    }
    const tile = worldToTile(world.x, world.y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
    this.chooseTile(tile.x, tile.y);
  }

  private onMinimap(nx: number, ny: number): void {
    const { x, y } = minimapTileFromNormalized(nx, ny, this.state.width, this.state.height);
    const center = tileCenter(x, y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
    this.jumpCameraTo(center.x, center.y, true);
    this.chooseTile(x, y);
  }

  private chooseTile(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.state.width || y >= this.state.height) {
      if (this.selected) this.deselectHerd();
      else this.hud.setHint(COPY.hintOutside);
      return;
    }
    const id = campIdAt(this.state, x, y);
    const action = resolveGroundTap(this.selected, this.pendingCampId, id);
    if (action === "noop") {
      this.hud.setHint(COPY.hintNeedHerd);
      return;
    }
    if (action === "deselect") {
      this.deselectHerd();
      return;
    }
    if (action === "clear_pending") {
      this.cancelPendingMove();
      return;
    }
    if (id === TILE_HOMESTEAD) {
      this.hud.setHint(COPY.hintHomestead);
      return;
    }
    if (id === TILE_OUTSIDE || id === null || id < 0) {
      this.hud.setHint(COPY.hintOutside);
      return;
    }
    if (!this.selected) {
      this.hud.setHint(COPY.hintNeedHerd);
      return;
    }
    if (herdInTransit(this.state.herd)) {
      this.hud.setHint(COPY.hintMoving);
      return;
    }
    if (id === this.state.herd.campId) {
      this.hud.setHint(COPY.hintSame);
      return;
    }
    const camp = this.state.camps.find((item) => item.id === id);
    if (!camp) return;
    this.pendingCampId = id;
    this.pendingCampName = camp.name;
    this.hud.setHint(`Tap Move here to send the herd to ${camp.name}.`);
    this.syncHud();
  }

  private commitMove(campId: number): void {
    const result = moveHerd(this.state, campId);
    if (!result.ok) {
      const reason = result.reason;
      this.hud.setHint(
        reason === "same" ? COPY.hintSame : reason === "moving" ? COPY.hintMoving : COPY.hintNeedHerd,
      );
      this.pendingCampId = null;
      this.pendingCampName = "";
      this.syncHud();
      return;
    }
    this.pendingCampId = null;
    this.pendingCampName = "";
    this.hud.setHint(`Walking to ${result.campName}. They graze again when they arrive.`);
    this.redrawFences();
    this.syncHud();
    this.persist();
  }

  private layoutCamera(resetView: boolean): void {
    const camera = this.cameras.main;
    this.refreshZoomLimits();
    if (resetView && this.homesteadBounds) {
      const center = boundsCenter(this.homesteadBounds);
      const preferred = preferredHomesteadZoom(
        this.homesteadBounds,
        camera.width,
        camera.height,
        CONFIG.view.tileWidth,
        this.zoomTargets(),
      );
      camera.setZoom(clampZoom(preferred, this.minZoom, this.maxZoom));
      camera.centerOn(center.x, center.y);
    } else if (resetView) {
      camera.centerOn(this.herdVisual.x, this.herdVisual.y);
      camera.setZoom(clampZoom(camera.zoom, this.minZoom, this.maxZoom));
    } else {
      camera.setZoom(clampZoom(camera.zoom, this.minZoom, this.maxZoom));
    }
    this.clampScroll();
  }

  private zoomAt(screenX: number, screenY: number, zoom: number): void {
    const camera = this.cameras.main;
    this.panVel = null;
    const next = clampZoom(zoom, this.minZoom, this.maxZoom);
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
    const insets = viewportCameraInsets();
    const next = clampCameraScrollWithInsets(
      camera.scrollX,
      camera.scrollY,
      this.layout.width,
      this.layout.height,
      camera.width,
      camera.height,
      camera.zoom,
      insets,
    );
    camera.scrollX = next.scrollX;
    camera.scrollY = next.scrollY;
  }
}
