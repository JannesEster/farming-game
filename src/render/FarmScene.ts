import Phaser from "phaser";
import { CONFIG } from "../sim/config";
import { COPY } from "../sim/format";
import { clamp } from "../sim/math";
import { getGameFlow } from "../integration/GameFlowService";
import { hasBlockingCard, popNextCard } from "../sim/story";
import { presentStoryCard } from "./storyPresent";
import { isDaylightHour, nightOverlayAlpha, sceneDaylightBlend, tickRanchClock } from "../sim/clock";
import { elementVisible, isSimBlocked as simClockBlocked, speedMultiplier, transitMayAdvance } from "./simGate";
import { syncAlertStrip } from "../integration/notificationHub";
import { bfsCampRoute } from "../sim/path";
import { campIdAt, moveHerd, stepDay } from "../sim/simulation";
import { defaultWorkGrid, setWorkPriority, tickFarmhandWorld, WORK_JOB_LABELS } from "../sim/workGrid";
import { hireFarmhand } from "../sim/workers";
import type { DayLengthSeconds } from "../sim/clock";
import { herdInTransit, herdMoveActive, herdWorldTile, pathTangent } from "../sim/transit";
import { beginHerdMove, syncHerderOnDrive, tickHerdingRealtime } from "../sim/herding";
import { freeWorkerHouseSlots } from "../sim/housing";
import { ensurePeopleState, tickPeopleSchedule, workerAtHomeAtNight } from "../sim/people";
import { farmerDisplayName, DEFAULT_PLAYER_DISPLAY_NAME } from "../sim/playerName";
import { planHerdPath, pointOnPath } from "../sim/path";
import { initStoryPeople } from "../sim/story";
import {
  PAN_INERTIA,
  applyPanFriction,
  boundsFromPoints,
  clampCameraScrollWithInsets,
  frameWorldRectInClearBand,
  homesteadBoundsPad,
  openingFrameBounds,
  scrollToLayoutTip,
  worldXAtScreenX,
  worldYAtScreenY,
  type LayoutTip,
  clampZoom,
  computeZoomLimits,
  maxOnScreenTileBudget,
  minimapTileFromNormalized,
  pinchCenter,
  pinchZoom,
  boundsContainsPoint,
  readableCampZoom,
  visibleContentBounds,
  zoomScrollDelta,
  type ZoomTargets,
} from "./camera";
import { grazeableFraction } from "../sim/pasture";
import { TILE_HOMESTEAD, TILE_OUTSIDE, type GameState, type HerdTransit } from "../sim/types";
import {
  ART_ORIGIN,
  buildArt,
  cowTextureKey,
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
import { mountOpsSheet, type OpsSheet } from "./opsSheet";
import { doubleTapGoesHome } from "./tap";
import { resolveGroundTap, resolveHerdTap } from "./selection";
import { isoLayout, tileCenter, tileTop, worldToTile, type IsoLayout } from "./iso";
import { palette } from "./palette";
import { campLabelTile, offsetsForHerd } from "./herdLayout";
import { boundsVisible, chunkCoordsForTile } from "./terrain";
import { bakeTerrainChunk } from "./groundLayer";
import { placeGateSprites } from "./fenceDecor";
import {
  COW_LOD_ZOOM,
  cattleDisplayScale,
  cattleSpriteForCoat,
  cattleTextureForView,
  cowPresentationScale,
  ensureCowDotTexture,
  ensureCowViewTextures,
  ensureFarmhandTexture,
  ensureFarmerTexture,
  ensureWorkerHouseTexture,
  inferPersonDir,
  personTextureKey,
  SPRITE_KEYS,
  FARMHAND_TEXTURE_HEIGHT,
  maybePaintedTermiteAt,
  maybeRockAt,
  paintedSpritesReady,
  preloadPaintedSprites,
  propSpriteForKind,
} from "./sprites";
import { HOMESTEAD_FEATURE_KINDS, homesteadSpritePlacementsFromFeatures } from "./homesteadLayout";

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
  private ops!: OpsSheet;
  private farmhandSprite?: Phaser.GameObjects.Image;
  private farmerSprite?: Phaser.GameObjects.Image;
  private farmerNameTag?: Phaser.GameObjects.Text;
  private farmhandLastPos = { x: 0, y: 0 };
  private farmerLastPos = { x: 0, y: 0 };
  private farmhandNameTag?: Phaser.GameObjects.Text;
  private farmhandJobTag?: Phaser.GameObjects.Text;
  private mode: SpeedMode = "x1";
  private nightOverlay?: Phaser.GameObjects.Rectangle;
  private homesteadGlow?: Phaser.GameObjects.Graphics;
  private homesteadLight?: { x: number; y: number };
  private captureHideHerdLabel = false;
  private captureLightingHour: number | null = null;
  private captureFreezeClock = false;
  private captureSkipCowCull = false;
  private captureHoldTransit = false;
  private selected = false;
  private pendingCampId: number | null = null;
  private pendingCampName = "";
  private bank = 0;
  private minZoom = 0.2;
  private maxZoom = 2;
  private track = new Set<string>();
  private tileSprites: Phaser.GameObjects.Image[] = [];
  private chunkRoots = new Map<string, Phaser.GameObjects.Container>();
  private chunkRenderTextures = new Map<string, Phaser.GameObjects.RenderTexture>();
  private paintedSprites = false;
  private fenceGates: Phaser.GameObjects.Image[] = [];
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
  private herdLabel?: Phaser.GameObjects.Text;
  private herdVisual = { x: 0, y: 0 };
  private campLabels = new Map<number, Phaser.GameObjects.Text>();
  private hiddenSinceMs = 0;
  private visibilityCatchMs = 0;
  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.hiddenSinceMs = performance.now();
      return;
    }
    if (this.hiddenSinceMs <= 0) return;
    const cap = this.state.clock?.settings.catchUpCapMs ?? CONFIG.time.catchUpCapMs;
    this.visibilityCatchMs += Math.min(cap, performance.now() - this.hiddenSinceMs);
    this.hiddenSinceMs = 0;
  };

  constructor() {
    super("farm");
  }

  preload(): void {
    preloadPaintedSprites(this.load);
  }

  create(): void {
    this.cows = [];
    this.propSprites = [];
    this.tileSprites = [];
    this.fenceGates = [];
    this.herdOffsets = [];
    this.campLabels = new Map();
    this.chunkRoots = new Map();
    this.chunkRenderTextures = new Map();
    this.shownPct = new Map();
    this.pointers = new Map();
    this.blades = undefined;
    this.herdLabel = undefined;
    const flow = getGameFlow();
    const data = this.sys.settings.data as { flowState?: GameState } | undefined;
    const loaded = data?.flowState ?? flow.consumeGameStateForScene();
    if (!loaded) throw new Error("FarmScene requires flow state after farm purchase.");
    this.state = loaded;
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    this.layout = isoLayout(this.state.width, this.state.height, tileW, tileH, CONFIG.view.boundsPadPx);
    this.track = trackKeys(this.state);
    this.paintedSprites = paintedSpritesReady(this.textures);
    ensureCowDotTexture(this);
    ensureFarmhandTexture(this);
    ensureFarmerTexture(this);
    ensureWorkerHouseTexture(this);
    initStoryPeople(this.state);
    if (this.paintedSprites) ensureCowViewTextures(this);
    this.buildProceduralFallback();
    if (this.paintedSprites) {
      this.bakeAllTerrain();
    } else {
      this.paintGroundProcedural();
    }
    this.paintProps();
    this.paintLabels();
    this.fences = this.add.graphics().setDepth(2);
    this.redrawFences();
    this.ring = this.add.graphics().setDepth(9);
    this.rain = this.add.graphics().setScrollFactor(0).setDepth(30000);
    this.nightOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x081830, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(25000);
    this.homesteadGlow = this.add.graphics().setDepth(25002);
    this.syncHerdFromSim();
    this.spawnCows();
    this.herdLabel = this.add
      .text(this.herdVisual.x, this.herdVisual.y - 42, "", {
        fontFamily: "Segoe UI, Helvetica Neue, sans-serif",
        fontSize: "11px",
        color: "#f4eadc",
        fontStyle: "600",
        backgroundColor: "rgba(28, 18, 12, 0.82)",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 1)
      .setDepth(20001)
      .setResolution(2);
    this.refreshHerdLabel();
    this.layoutCamera(true);
    this.bindInput();
    this.hud = mountHud({
      onSpeed: (mode) => this.setSpeed(mode),
      onMinimap: (nx, ny) => this.onMinimap(nx, ny),
      onNewFarm: () => this.startNewFarm(),
      onHome: () => this.goHome(),
      onDeselect: () => this.deselectHerd(),
      onConfirmMove: () => this.confirmPendingMove(),
      onCancelMove: () => this.cancelPendingMove(),
      onOpenMarket: () => this.market.open(),
      onOpenOps: () => this.ops.open(),
      onDayLength: (seconds) => this.setDayLength(seconds),
      onFarmerName: (name) => {
        if (!this.state.story) return;
        this.state.story.playerDisplayName = name;
        this.placeFarmer();
        this.syncHud();
        this.persist();
      },
      onSheetExpanded: (expanded) => {
        getGameFlow().setHudPanel("herdSheet", Boolean(expanded));
        if (expanded) getGameFlow().notifySim("grassChecked");
      },
      onHerdLocator: () => {
        const center = this.mobCenter();
        this.jumpCameraTo(center.x, center.y, true);
      },
    });
    this.market = mountMarketSheet({
      getState: () => this.state,
      onChange: () => {
        this.syncHud();
        this.persist();
        getGameFlow().notifySim("salePlanned");
      },
      onToast: (text) => this.hud.setHint(text),
      onOpen: () => getGameFlow().setHudPanel("market", true),
      onClose: () => getGameFlow().setHudPanel("market", false),
    });
    this.ops = mountOpsSheet({
      getState: () => this.state,
      onChange: () => {
        this.syncHud();
        this.ops.refresh(this.state);
        this.persist();
      },
      onToast: (text) => this.hud.setHint(text),
      onCritical: (title, body) => this.hud.showEventCard(title, body),
      onOpen: () => getGameFlow().setHudPanel("market", true),
      onClose: () => getGameFlow().setHudPanel("market", false),
    });
    this.farmhandSprite = this.add.image(0, 0, SPRITE_KEYS.farmhand);
    this.farmhandSprite.setOrigin(0.5, 0.92);
    this.farmhandSprite.setVisible(false);
    this.farmhandNameTag = this.add
      .text(0, 0, "Piet", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#fff6e8",
        backgroundColor: "#1a3550cc",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setVisible(false)
      .setDepth(26000);
    this.farmhandJobTag = this.add
      .text(0, 0, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: "#2b2118",
        backgroundColor: "#ffcc66ee",
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setVisible(false)
      .setDepth(26000);
    this.farmerSprite = this.add.image(0, 0, SPRITE_KEYS.farmer);
    this.farmerSprite.setOrigin(0.5, 0.92);
    this.farmerNameTag = this.add
      .text(0, 0, DEFAULT_PLAYER_DISPLAY_NAME, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#fff6e8",
        backgroundColor: "#1a4d3acc",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setDepth(26000);
    flow.attachFarmHud(this.hud);
    this.hud.setSpeed(this.mode);
    if (!flow.getTutorialStep()) this.hud.setHint(COPY.hintStart);
    this.syncHud();
    const onResize = () => {
      if (!this.sys?.isActive()) return;
      this.fitNightOverlay();
      this.layoutCamera(false);
    };
    this.scale.on("resize", onResize);
    const refit = requestAnimationFrame(() => {
      if (!this.sys?.isActive()) return;
      this.layoutCamera(true);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      cancelAnimationFrame(refit);
      this.scale.off("resize", onResize);
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
      this.hud?.destroy();
      this.market?.destroy();
      this.ops?.destroy();
    });
    const canvas = this.game.canvas;
    canvas.style.touchAction = "none";
    if (canvas.dataset.farmGuards !== "1") {
      canvas.dataset.farmGuards = "1";
      canvas.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
      canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    }
    this.installCaptureBridge();
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  private applyRanchLighting(): void {
    const hour = this.captureLightingHour ?? this.state.date.hour;
    const blend = sceneDaylightBlend(hour);
    const night = nightOverlayAlpha(hour);
    this.hud.setDaylight(blend);
    this.hud.setNightChrome(night > 0.35);
    this.fitNightOverlay();
    if (this.nightOverlay) this.nightOverlay.setAlpha(night);
    const veil = document.getElementById("night-veil");
    if (veil) veil.style.opacity = String(night);
    this.updateHomesteadGlow(night);
  }

  private fitNightOverlay(): void {
    if (!this.nightOverlay) return;
    const cam = this.cameras.main;
    this.nightOverlay.setPosition(0, 0);
    this.nightOverlay.setSize(Math.ceil(cam.width), Math.ceil(cam.height));
  }

  private updateHomesteadGlow(nightAlpha: number): void {
    if (!this.homesteadGlow || !this.homesteadLight) {
      this.homesteadGlow?.clear();
      return;
    }
    this.homesteadGlow.clear();
    if (nightAlpha < 0.1) return;
    const strength = nightAlpha / 0.62;
    const { x, y } = this.homesteadLight;
    this.homesteadGlow.fillStyle(0xffc978, 0.28 * strength);
    this.homesteadGlow.fillCircle(x - 14, y - 22, 10);
    this.homesteadGlow.fillCircle(x + 10, y - 20, 8);
    this.homesteadGlow.fillStyle(0xffe8b8, 0.2 * strength);
    this.homesteadGlow.fillCircle(x - 14, y - 22, 5);
    this.homesteadGlow.fillCircle(x + 10, y - 20, 4);
  }

  private setDayLength(seconds: DayLengthSeconds): void {
    if (!this.state.clock) return;
    this.state.clock.settings.dayLengthSeconds = seconds;
    this.persist();
  }

  private captureDiagnostics(): Record<string, unknown> {
    const cam = this.cameras.main;
    const center = this.mobCenter();
    const night = nightOverlayAlpha(this.captureLightingHour ?? this.state.date.hour);
    return {
      hour: this.state.date.hour,
      hudTime: document.getElementById("stat-time")?.textContent ?? "",
      nightOverlay: this.nightOverlay?.alpha ?? 0,
      nightAlpha: night,
      daylightBlend: sceneDaylightBlend(this.captureLightingHour ?? this.state.date.hour),
      inTransit: herdInTransit(this.state.herd),
      transitProgress: this.state.herd.transit?.progress ?? 0,
      cattleInView: this.countCattleInView(),
      mobCenter: center,
      cameraCenter: {
        x: cam.scrollX + cam.width / (2 * cam.zoom),
        y: cam.scrollY + cam.height / (2 * cam.zoom),
      },
      zoom: cam.zoom,
      canvasLuminance: this.canvasMeanLuminance(),
    };
  }

  private canvasMeanLuminance(): number {
    if (typeof document === "undefined") return 0;
    const canvas = document.querySelector<HTMLCanvasElement>("#game canvas");
    if (!canvas) return 0;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || canvas.width < 8 || canvas.height < 8) return 0;
    const sampleW = Math.min(320, canvas.width);
    const sampleH = Math.min(240, canvas.height);
    const ox = Math.floor((canvas.width - sampleW) / 2);
    const oy = Math.floor((canvas.height - sampleH) / 2);
    const data = ctx.getImageData(ox, oy, sampleW, sampleH).data;
    let sum = 0;
    const pixels = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    }
    return sum / pixels;
  }

  private countCattleInView(): number {
    const view = this.cameras.main.worldView;
    let count = 0;
    for (let i = 0; i < this.cows.length; i += 1) {
      const cow = this.cows[i];
      if (!cow.visible) continue;
      if (view.contains(cow.x, cow.y)) count += 1;
    }
    return count;
  }

  private holdTransitProgress(progress?: number): boolean {
    if (!herdInTransit(this.state.herd)) return false;
    this.captureHoldTransit = true;
    this.captureFreezeClock = true;
    this.setSpeed("pause");
    if (typeof progress === "number" && this.state.herd.transit) {
      this.state.herd.transit.progress = Math.max(0.05, Math.min(0.95, progress));
    }
    this.syncHerdFromSim();
    this.placeHerd(performance.now());
    return true;
  }

  private bumpHerdCaptureZoom(zoom: number): Record<string, unknown> {
    this.captureSkipCowCull = true;
    this.captureHideHerdLabel = true;
    this.hud.setHerdLocator(false, "", "right");
    const camera = this.cameras.main;
    camera.setZoom(clampZoom(zoom, this.minZoom, this.maxZoom));
    this.placeHerd(performance.now());
    for (const cow of this.cows) cow.setVisible(true);
    return this.captureDiagnostics();
  }

  private frameHerdForCapture(zoom: number): Record<string, unknown> {
    this.captureSkipCowCull = true;
    this.captureHideHerdLabel = true;
    this.hud.setHerdLocator(false, "", "right");
    this.syncHerdFromSim();
    this.placeHerd(performance.now());
    const camera = this.cameras.main;
    camera.setZoom(clampZoom(zoom, this.minZoom, this.maxZoom));
    const center = this.mobCenter();
    this.jumpCameraTo(center.x, center.y, false);
    this.placeHerd(performance.now());
    const refined = this.mobCenter();
    camera.centerOn(refined.x, refined.y);
    this.clampScroll();
    this.placeHerd(performance.now());
    for (const cow of this.cows) cow.setVisible(true);
    return this.captureDiagnostics();
  }

  private pickDistantMoveCamp(): number | null {
    const from = this.state.herd.campId;
    let best: { id: number; hops: number } | null = null;
    for (const camp of this.state.camps) {
      if (camp.id === from) continue;
      const route = bfsCampRoute(this.state, from, camp.id);
      if (!route || route.length < 3) continue;
      const hops = route.length - 1;
      if (!best || hops > best.hops) best = { id: camp.id, hops };
    }
    return best?.id ?? null;
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
        const center = this.mobCenter();
        this.cameras.main.centerOn(center.x, center.y);
        this.clampScroll();
      },
      setZoom: (zoom: number) => {
        this.cameras.main.setZoom(clampZoom(zoom, this.minZoom, this.maxZoom));
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
      gateProgress: () => {
        const path = this.state.herd.transit?.path ?? [];
        if (path.length < 2) return 0.5;
        const tileW = CONFIG.view.tileWidth;
        const tileH = CONFIG.view.tileHeight;
        const segments = collectFenceSegments(this.state, this.layout, this.state.herd.campId, false);
        const gates = segments.filter((segment) => segment.gate);
        if (gates.length === 0) return 0.5;
        let bestIndex = 0;
        let bestDist = Number.POSITIVE_INFINITY;
        path.forEach((tile, index) => {
          const point = tileCenter(tile.x, tile.y, this.layout, tileW, tileH);
          for (const gate of gates) {
            const dist = Math.hypot(point.x - (gate.x1 + gate.x2) / 2, point.y - (gate.y1 + gate.y2) / 2);
            if (dist < bestDist) {
              bestDist = dist;
              bestIndex = index;
            }
          }
        });
        return bestIndex / (path.length - 1);
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
      frameHomestead: (_close = false) => {
        this.panVel = null;
        const camera = this.cameras.main;
        this.refreshZoomLimits();
        const tileW = CONFIG.view.tileWidth;
        const tileH = CONFIG.view.tileHeight;
        const house = this.state.features.find((f) => f.kind === "house");
        const housePt = house
          ? tileCenter(house.x + 0.5, house.y + 0.5, this.layout, tileW, tileH)
          : { x: this.herdVisual.x, y: this.herdVisual.y };

        const yardZoom = 1.15;
        camera.setZoom(clampZoom(yardZoom, this.minZoom, this.maxZoom));
        camera.centerOn(housePt.x, housePt.y);
        this.clampScroll();
        this.placeHerd(performance.now());
        const insets = viewportCameraInsets();
        const view = visibleContentBounds(
          camera.scrollX,
          camera.scrollY,
          camera.width,
          camera.height,
          camera.zoom,
          insets,
        );
        const spritePad = tileW * 1.1;
        const herdPad = tileW * 2.4;
        const herdInView = this.cows.some((_, index) => {
          const offset = this.herdOffsets[index];
          const hx = this.herdVisual.x + (offset?.x ?? 0);
          const hy = this.herdVisual.y + (offset?.y ?? 0);
          return boundsContainsPoint(view, hx, hy, tileW * 0.45);
        });
        return {
          zoom: camera.zoom,
          scrollX: camera.scrollX,
          scrollY: camera.scrollY,
          farmhouseInView: boundsContainsPoint(view, housePt.x, housePt.y, spritePad),
          herdInView: herdInView || boundsContainsPoint(view, this.herdVisual.x, this.herdVisual.y, herdPad),
        };
      },
      prepareForScreenshot: () => {
        this.captureFreezeClock = true;
        this.captureLightingHour = null;
        this.captureSkipCowCull = false;
        this.captureHoldTransit = false;
        this.setSpeed("pause");
        this.hud.hideEventCard();
        this.hud.clearHint();
        const toast = document.getElementById("flow-toast");
        if (toast) toast.hidden = true;
        return true;
      },
      diagnoseGround: () => {
        const keys = [
          SPRITE_KEYS.tileDryGrass,
          SPRITE_KEYS.tileGreenGrass,
          SPRITE_KEYS.tileSand,
          SPRITE_KEYS.farmhouse,
        ];
        const textures = keys.map((key) => ({ key, ok: this.textures.exists(key) }));
        return {
          paintedSprites: this.paintedSprites,
          terrainChunks: this.chunkRenderTextures.size,
          textures,
          anyMissing: textures.some((row) => !row.ok),
        };
      },
      zoomFar: () => {
        const camera = this.cameras.main;
        camera.setZoom(clampZoom(this.minZoom, this.minZoom, this.maxZoom));
        this.layoutCamera(false);
        this.clampScroll();
        return camera.zoom;
      },
      herdTransitProgress: () => this.state.herd.transit?.progress ?? 0,
      sampleFps: async (frames = 90) => {
        const samples: number[] = [];
        for (let i = 0; i < frames; i += 1) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          samples.push(this.game.loop.actualFps);
        }
        const sum = samples.reduce((acc, value) => acc + value, 0);
        return {
          avg: Math.round((sum / samples.length) * 10) / 10,
          min: Math.round(Math.min(...samples) * 10) / 10,
          max: Math.round(Math.max(...samples) * 10) / 10,
          frames: samples.length,
        };
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
      showMonthSummaryDemo: () => {
        const body = [
          "Income N$0. Expenses N$8,500.",
          "Labour N$2,400. Driven by ranch size and head count share (No farmhand on payroll.). Hint: one farmhand is enough at this herd size until you split camps.",
          "Lick N$1,800. 120 head on summer phosphate P12. Change lick in Ranch ops to match the season.",
        ].join("\n");
        this.hud.showEventCard("Month in review", body);
        return true;
      },
      setNightForCapture: () => {
        this.captureLightingHour = 22;
        this.state.date.hour = 22;
        this.applyRanchLighting();
        this.syncHud();
        return this.captureDiagnostics();
      },
      resetDaylightForCapture: () => {
        this.captureLightingHour = 11;
        this.state.date.hour = 11;
        this.applyRanchLighting();
        this.syncHud();
        return this.captureDiagnostics();
      },
      captureDiagnostics: () => this.captureDiagnostics(),
      canvasMeanLuminance: () => this.canvasMeanLuminance(),
      countCattleInView: () => this.countCattleInView(),
      countFarmhandInView: () => this.countFarmhandInView(),
      farmhandScreenHeightPx: () => this.farmhandScreenHeightPx(),
      farmerScreenHeightPx: () =>
        this.farmerSprite?.visible ? this.farmerSprite.displayHeight * this.cameras.main.zoom : 0,
      countFarmerInView: () => this.countFarmerInView(),
      frameFarmerAtHouse: () => this.frameHomesteadWithWorkerHouse(),
      prepareHerdDriveCapture: () => this.prepareHerdDriveCapture(),
      herderHerdScreenDistancePx: () => this.herderHerdScreenDistancePx(),
      nightWorkersCaptureMeta: () => this.nightWorkersCaptureMeta(),
      workerHouseInView: () => this.workerHouseInView(),
      prepareNightWorkersHomeCapture: () => this.prepareNightWorkersHomeCapture(),
      prepareHireBlockedCapture: () => {
        this.state.features = this.state.features.filter((f) => f.kind !== "worker_house");
        this.ops.open("default");
        this.ops.refresh(this.state);
        return freeWorkerHouseSlots(this.state) < 1;
      },
      openOps: () => {
        this.ops.open("default");
        return true;
      },
      frameFarmhandForCapture: () => this.frameFarmhandForCapture(),
      prepareFarmhandWalkCapture: () => {
        hireFarmhand(this.state);
        setWorkPriority(this.state, "check_water", 3);
        for (let i = 0; i < 8; i += 1) tickFarmhandWorld(this.state);
        this.placeFarmhand();
        return this.frameFarmhandForCapture();
      },
      queueDemoPlayerEvent: () => {
        if (this.state.story) {
          this.state.story.pendingPlayerEvent = {
            id: "demo-event",
            kind: "pump_fault",
            title: "Pump fault",
            body: "Water pressure dropped at the main windmill. Fix it today or risk an emergency callout.",
            ignoreConsequence: "Emergency repair about N$8,500 if you wait.",
            critical: false,
            actions: [
              { id: "repair_now", label: "Repair now (N$1,200)", costNad: 1200 },
              { id: "defer_fix", label: "Ignore for now", costNad: 0 },
            ],
          };
        }
        this.ops.open("event");
        this.ops.refresh(this.state);
        return true;
      },
      openOpsLeversCapture: () => {
        this.ops.open("levers");
        this.ops.refresh(this.state);
        return true;
      },
      openOpsWorkGridCapture: () => {
        this.ops.open("grid");
        this.ops.refresh(this.state);
        return true;
      },
      showMonthDiaryDemo: () => {
        const body = [
          "What happened",
          "Jackal scare: night guard posted.",
          "Cash move: income N$0, spend N$9,200.",
          "Why the bills moved",
          "Diesel N$1,450. About 120 L from 6 bakkie runs and windmill.",
        ].join("\n");
        this.hud.showEventCard("Farm diary", body);
        return true;
      },
      herdInTransit: () => herdInTransit(this.state.herd),
      frameHerdForCapture: (zoom = 1.05) => this.frameHerdForCapture(zoom),
      setSpeed: (mode: SpeedMode) => {
        this.setSpeed(mode);
        return true;
      },
      zoomGrassNearCapture: () => {
        const camera = this.cameras.main;
        camera.setZoom(clampZoom(0.92, this.minZoom, this.maxZoom));
        this.jumpCameraTo(this.herdVisual.x, this.herdVisual.y, false);
        this.clampScroll();
        return camera.zoom;
      },
      zoomGrassFarCapture: () => {
        const camera = this.cameras.main;
        camera.setZoom(clampZoom(this.minZoom, this.minZoom, this.maxZoom));
        this.layoutCamera(false);
        this.clampScroll();
        this.redrawFences();
        return camera.zoom;
      },
      zoomHerdWalkCapture: () => this.frameHerdForCapture(1.05),
      zoomHerdCloseupCapture: () => this.bumpHerdCaptureZoom(1.16),
      bumpHerdCaptureZoom: (zoom: number) => this.bumpHerdCaptureZoom(zoom),
      holdTransitProgress: (progress?: number) => this.holdTransitProgress(progress),
      pickDistantMoveCamp: () => this.pickDistantMoveCamp(),
      triggerHerdMoveDemo: () => {
        this.captureFreezeClock = false;
        const targetId = this.pickDistantMoveCamp();
        const target =
          (targetId !== null && this.state.camps.find((c) => c.id === targetId)) ??
          this.state.camps.find((c) => c.id !== this.state.herd.campId);
        if (target) this.commitMove(target.id);
        this.setSpeed("x3");
        return { started: Boolean(target), targetId: target ? target.id : null };
      },
      openNotificationsDemo: () => {
        this.hud.pushLetter({
          id: "demo-letter",
          tier: "letter",
          kind: "drought_watch",
          title: "Late rains",
          body: "Season rain is 42 mm, below a normal start.",
          priority: 2,
          at: { ...this.state.date },
          read: false,
        });
        this.hud.syncAlerts(["Camp 8 worn", "Camp 3 no trough"]);
        this.hud.pushNewsLog([
          "Late rains: Season rain is 42 mm, below a normal start.",
          "Month in review: Labour and lick costs posted.",
        ]);
        document.getElementById("news-log")?.removeAttribute("hidden");
        document.getElementById("letter-stack")?.removeAttribute("hidden");
        document.getElementById("alert-strip")?.removeAttribute("hidden");
        document.getElementById("news-log-open")?.removeAttribute("hidden");
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
    const flowBridge = getGameFlow().exposeCaptureApi();
    (window as Window & { __farmCapture?: typeof bridge & Record<string, unknown> }).__farmCapture = {
      ...bridge,
      ...flowBridge,
    };
  }

  update(time: number, delta: number): void {
    this.presentQueuedCard();
    const blocked = this.clockBlocked();
    const walking = herdInTransit(this.state.herd);
    if (!this.state.clock) {
      this.state.clock = {
        settings: {
          dayLengthSeconds: CONFIG.time.dayLengthSecondsDefault as 180 | 240 | 300,
          daysPerMonth: CONFIG.calendar.daysPerMonthDefault,
          catchUpCapMs: CONFIG.time.catchUpCapMs,
        },
        bankMs: this.bank,
        speed: speedMultiplier(this.mode),
      };
    }
    this.state.clock.speed = speedMultiplier(this.mode);
    let steps = 0;
    if (this.captureLightingHour !== null) {
      this.state.date.hour = this.captureLightingHour;
    }
    if (!walking && !this.captureFreezeClock) {
      let catchUp = 0;
      if (this.visibilityCatchMs > 0) {
        catchUp = this.visibilityCatchMs;
        this.visibilityCatchMs = 0;
      }
      const tick = tickRanchClock(
        this.state.date,
        this.state.clock,
        delta + catchUp,
        blocked,
      );
      this.state.date = tick.date;
      this.bank = tick.bankMs;
      this.state.clock.bankMs = tick.bankMs;
      for (let i = 0; i < tick.daySteps && i < CONFIG.view.maxDaysPerFrame; i += 1) {
        stepDay(this.state);
        steps += 1;
        if (hasBlockingCard(this.state)) break;
      }
    }
    if (steps > 0) {
      this.refreshGrass();
      this.syncHud();
      this.market.refresh(this.state);
      this.ops.refresh(this.state);
      this.persist();
      getGameFlow().onSimDayAdvanced(this.state);
    }
    if (!isDaylightHour(this.state.date.hour)) {
      tickPeopleSchedule(this.state);
    }
    this.applyRanchLighting();
    this.updateScaleBar();
    syncAlertStrip(this.state, {
      pushMessage: (t) => this.hud.setHint(t),
      pushLetter: (item) => this.hud.pushLetter(item),
      pushCritical: (title, body) => this.hud.showEventCard(title, body),
      syncAlerts: (labels) => this.hud.syncAlerts(labels),
    });
    const moveActive = herdMoveActive(this.state.herd);
    if (moveActive && transitMayAdvance(blocked, this.mode) && !this.captureFreezeClock && !this.captureHoldTransit) {
      const was = this.state.herd.transit?.progress ?? 0;
      tickHerdingRealtime(this.state, delta, this.mode);
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
    this.placeFarmhand();
    this.placeFarmer();
    this.refreshCampLabelScale();
    this.cullProps();
    this.cullChunks();
    if (this.blades && !this.reduceMotion && !this.paintedSprites) {
      this.blades.rotation += (delta / 1000) * CONFIG.view.windmillRadiansPerSecond;
    }
    this.syncHerdLocator();
    this.applyPanInertia(delta);
    this.drawRain(time);
    this.drawRing();
  }

  private syncHerdLocator(): void {
    const camera = this.cameras.main;
    const insets = viewportCameraInsets();
    const view = visibleContentBounds(
      camera.scrollX,
      camera.scrollY,
      camera.width,
      camera.height,
      camera.zoom,
      insets,
    );
    const tileW = CONFIG.view.tileWidth;
    const herdSeen = boundsContainsPoint(view, this.herdVisual.x, this.herdVisual.y, tileW * 2.2);
    if (herdSeen) {
      this.hud.setHerdLocator(false, "", "right");
      return;
    }
    let edge: "left" | "right" | "top" | "bottom" = "right";
    if (this.herdVisual.x < view.minX) edge = "left";
    else if (this.herdVisual.x > view.maxX) edge = "right";
    else if (this.herdVisual.y < view.minY) edge = "top";
    else if (this.herdVisual.y > view.maxY) edge = "bottom";
    const arrow = edge === "left" ? "← Herd" : "→ Herd";
    this.hud.setHerdLocator(true, arrow, edge);
  }

  private clockBlocked(): boolean {
    const flow = getGameFlow();
    return simClockBlocked({
      tutorialHolding: flow.isTutorialHoldingSim() || elementVisible(document, "flow-tutorial"),
      eventCard: elementVisible(document, "event-card"),
      yearEnd: elementVisible(document, "flow-yearend"),
      gameOver: elementVisible(document, "flow-gameover"),
      market: elementVisible(document, "market-sheet"),
      startOrPicker: elementVisible(document, "picker-root"),
    });
  }

  /** Show one queued card before the clock moves, so reading it cannot cost a day. */
  private presentQueuedCard(): void {
    if (this.clockBlocked()) return;
    const card = popNextCard(this.state);
    if (!card) return;
    presentStoryCard(this.state, card, this.hud);
    if (this.state.notifications?.log.length) {
      this.hud.pushNewsLog(
        this.state.notifications.log.slice(0, 3).map((item) => `${item.title}: ${item.body}`),
      );
    }
  }

  private setSpeed(mode: SpeedMode): void {
    this.mode = mode;
    if (mode === "pause") this.bank = 0;
    this.hud.setSpeed(mode);
    if (mode === "x3") getGameFlow().notifySim("speedFast");
    if (this.state.clock) this.state.clock.speed = speedMultiplier(mode);
  }

  private updateScaleBar(): void {
    const zoom = this.cameras.main.zoom;
    const tileW = CONFIG.view.tileWidth * zoom;
    const metresPerTile = CONFIG.transit.kmPerTile * 1000;
    const barPx = 120;
    const metres = (barPx / tileW) * metresPerTile;
    const label = metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres / 50) * 50} m`;
    this.hud.setScaleBar(label);
  }

  private buildProceduralFallback(): void {
    const art = buildArt(CONFIG.view.tileWidth, CONFIG.view.tileHeight);
    (Object.keys(art.grounds) as (keyof typeof art.grounds)[]).forEach((kind) => {
      art.grounds[kind].forEach((sheet, variant) => this.addCanvas(groundTextureKey(kind, variant), sheet));
    });
    art.cows.forEach((breed, coat) => {
      breed.walk.forEach((sheet, frame) => this.addCanvas(cowTextureKey(coat, true, frame), sheet));
      breed.graze.forEach((sheet, frame) => this.addCanvas(cowTextureKey(coat, false, frame), sheet));
    });
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

  private bakeAllTerrain(): void {
    for (const rt of this.chunkRenderTextures.values()) rt.destroy();
    this.chunkRenderTextures.clear();
  this.chunkRoots.forEach((root) => root.destroy());
    this.chunkRoots.clear();
    const size = CONFIG.view.terrainChunkTiles;
    for (let cy = 0; cy * size < this.state.height; cy += 1) {
      for (let cx = 0; cx * size < this.state.width; cx += 1) {
        this.rebakeChunk(cx, cy);
      }
    }
    for (const camp of this.state.camps) {
      this.shownPct.set(camp.id, Math.round(grazeableFraction(camp) * 100));
    }
  }

  private rebakeChunk(cx: number, cy: number): void {
    const chunkKey = `${cx},${cy}`;
    const existing = this.chunkRenderTextures.get(chunkKey);
    existing?.destroy();
    const baked = bakeTerrainChunk(
      this,
      this.state,
      this.layout,
      cx,
      cy,
      this.track,
      this.paintedSprites,
    );
    this.chunkRenderTextures.set(chunkKey, baked.rt);
  }

  private paintGroundProcedural(): void {
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
    if (this.paintedSprites) {
      const tileW = CONFIG.view.tileWidth;
      const tileH = CONFIG.view.tileHeight;
      for (const place of homesteadSpritePlacementsFromFeatures(this.state.features)) {
        if (!this.textures.exists(place.key)) continue;
        const center = tileCenter(place.tileX, place.tileY, this.layout, tileW, tileH);
        const footX = center.x + place.offsetX;
        const footY = center.y + place.offsetY;
        const image = this.add
          .image(footX, footY, place.key)
          .setOrigin(place.originX, place.originY)
          .setScale(place.scale)
          .setDepth(8 + footY * 0.04);
        this.propSprites.push(image);
        if (place.key === SPRITE_KEYS.farmhouse) {
          this.homesteadLight = { x: footX, y: footY - tileH * 0.55 };
        }
      }
      for (const feature of this.state.features) {
        if (HOMESTEAD_FEATURE_KINDS.has(feature.kind)) continue;
        if (feature.kind === "tree" || feature.kind === "bush") {
          const def = propSpriteForKind(feature.kind, feature.x, feature.y, feature.scale);
          if (!this.textures.exists(def.key)) continue;
          const center = tileCenter(feature.x, feature.y, this.layout, tileW, tileH);
          const image = this.add
            .image(center.x, center.y, def.key)
            .setOrigin(def.originX, def.originY)
            .setScale(def.scale)
            .setDepth(8 + center.y * 0.04);
          this.propSprites.push(image);
        }
      }
      for (let y = 0; y < this.state.height; y += 1) {
        for (let x = 0; x < this.state.width; x += 1) {
          const id = this.state.campIds[y * this.state.width + x];
          if (id === TILE_HOMESTEAD || id === TILE_OUTSIDE || this.track.has(`${x},${y}`)) continue;
          const center = tileCenter(x, y, this.layout, tileW, tileH);
          if (maybePaintedTermiteAt(x, y)) {
            const termite = this.add
              .image(center.x, center.y, SPRITE_KEYS.termiteMound)
              .setOrigin(0.5, 0.92)
              .setScale((tileW * 0.28) / 171)
              .setDepth(7 + center.y * 0.04);
            this.propSprites.push(termite);
          } else if (maybeRockAt(x, y)) {
            const rock = this.add
              .image(center.x, center.y, SPRITE_KEYS.rockCluster)
              .setOrigin(0.5, 0.88)
              .setScale((tileW * 0.45) / 160)
              .setDepth(7 + center.y * 0.04);
            this.propSprites.push(rock);
          }
        }
      }
      return;
    }

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
      if (feature.kind === "worker_house") {
        const image = this.add
          .image(center.x, center.y, SPRITE_KEYS.workerHouse)
          .setOrigin(0.5, 0.92)
          .setDepth(depth + 0.3)
          .setScale(cattleDisplayScale(1) * 2.05);
        this.propSprites.push(image);
        continue;
      }
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
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    for (const camp of this.state.camps) {
      const onHomestead = camp.tiles.every(
        (tile) => this.state.campIds[tile.y * this.state.width + tile.x] === TILE_HOMESTEAD,
      );
      if (onHomestead) continue;

      const labelTile = campLabelTile(this.state, camp);
      const point = tileCenter(labelTile.x, labelTile.y, this.layout, tileW, tileH);
      const label = this.add
        .text(point.x, point.y - 6, String(camp.id + 1), {
          fontFamily: "Segoe UI, Helvetica Neue, sans-serif",
          fontSize: "11px",
          color: "#f8f2e4",
          stroke: "#2a1c12",
          strokeThickness: 2,
          fontStyle: "600",
          backgroundColor: "rgba(32, 20, 12, 0.55)",
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5, 0.5)
        .setDepth(20000 + point.y * 0.01)
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
    this.refreshCampLabelScale();
  }

  private refreshCampLabelScale(): void {
    const zoom = Math.max(this.cameras.main.zoom, 0.08);
    const boost = Math.min(2.8, Math.max(1, 0.58 / zoom));
    for (const label of this.campLabels.values()) {
      label.setScale(boost);
    }
  }

  private startNewFarm(): void {
    this.persist();
    getGameFlow().returnToStart();
  }

  private persist(): void {
    const flow = getGameFlow();
    flow.runtimePatchState(this.state);
    flow.persist();
  }

  private spawnCows(): void {
    const count = this.state.herd.headCount;
    for (let i = 0; i < count; i += 1) {
      const tex = this.paintedSprites ? cattleSpriteForCoat(0) : cowTextureKey(0, false, 0);
      const cow = this.add
        .image(0, 0, tex)
        .setOrigin(ART_ORIGIN.cow.x, ART_ORIGIN.cow.y)
        .setScale(this.paintedSprites ? cattleDisplayScale() : 0.36);
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
      this.herdVisual.x,
      this.herdVisual.y,
    );
    if (this.state.herd.campId !== this.lastHerdCampId) this.lastHerdCampId = this.state.herd.campId;
  }

  private refreshGrass(): void {
    const dirtyChunks = new Set<string>();
    for (const camp of this.state.camps) {
      const pct = Math.round(grazeableFraction(camp) * 100);
      if (this.shownPct.get(camp.id) === pct) continue;
      this.shownPct.set(camp.id, pct);
      for (const tile of camp.tiles) {
        if (this.track.has(`${tile.x},${tile.y}`)) continue;
        if (this.paintedSprites) {
          const { cx, cy } = chunkCoordsForTile(tile.x, tile.y);
          dirtyChunks.add(`${cx},${cy}`);
        } else {
          const sprite = this.tileSprites[tile.y * this.state.width + tile.x];
          sprite.setTint(tileTint(this.state, tile.x, tile.y, this.track));
        }
      }
    }
    if (this.paintedSprites) {
      for (const key of dirtyChunks) {
        const [cx, cy] = key.split(",").map(Number);
        this.rebakeChunk(cx, cy);
      }
    }
  }

  private redrawFences(): void {
    const herdCamp =
      this.state.herd.transit?.toCampId !== undefined && herdInTransit(this.state.herd)
        ? this.state.herd.campId
        : this.state.herd.campId;
    this.fenceGates.forEach((gate) => gate.destroy());
    this.fenceGates = [];
    const segments = collectFenceSegments(this.state, this.layout, herdCamp, this.selected);
    drawFences(this.fences, segments, this.cameras.main.zoom);
    this.fenceGates = placeGateSprites(this, segments, this.paintedSprites);
  }

  private syncHerdFromSim(): void {
    const tile = herdWorldTile(this.state);
    const point = tileCenter(tile.x, tile.y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
    this.herdVisual.x = point.x;
    this.herdVisual.y = point.y;
    this.refreshHerdLabel();
  }

  private mobCenter(): { x: number; y: number } {
    if (this.herdOffsets.length === 0) return { x: this.herdVisual.x, y: this.herdVisual.y };
    let x = 0;
    let y = 0;
    for (const offset of this.herdOffsets) {
      x += offset.x;
      y += offset.y;
    }
    return {
      x: this.herdVisual.x + x / this.herdOffsets.length,
      y: this.herdVisual.y + y / this.herdOffsets.length,
    };
  }

  private pointerHitsHerd(worldX: number, worldY: number, radius: number): boolean {
    if (Math.hypot(worldX - this.herdVisual.x, worldY - this.herdVisual.y) <= radius) return true;
    const cowRadius = Math.max(radius * 0.72, 18);
    for (const offset of this.herdOffsets) {
      const dx = worldX - (this.herdVisual.x + offset.x);
      const dy = worldY - (this.herdVisual.y + offset.y);
      if (dx * dx + dy * dy <= cowRadius * cowRadius) return true;
    }
    return false;
  }

  private refreshHerdLabel(): void {
    if (!this.herdLabel) return;
    this.herdLabel.setText(`${this.state.herd.headCount} head`);
    this.herdLabel.setVisible(!this.selected && !this.captureHideHerdLabel);
    let top = this.herdVisual.y;
    for (const offset of this.herdOffsets) top = Math.min(top, this.herdVisual.y + offset.y);
    const center = this.mobCenter();
    this.herdLabel.setPosition(center.x, top - 16);
    const tile = worldToTile(
      this.herdVisual.x,
      this.herdVisual.y,
      this.layout,
      CONFIG.view.tileWidth,
      CONFIG.view.tileHeight,
    );
    this.herdLabel.setDepth(20000 + tile.x + tile.y);
  }

  private frameFarmhandForCapture(): boolean {
    const presence = this.state.story?.farmhandPresence;
    if (!presence) return false;
    const foot = tileCenter(
      presence.tileX,
      presence.tileY,
      this.layout,
      CONFIG.view.tileWidth,
      CONFIG.view.tileHeight,
    );
    this.jumpCameraTo(foot.x, foot.y, true);
    const camera = this.cameras.main;
    const targetScreenPx = 46;
    const worldH = FARMHAND_TEXTURE_HEIGHT * this.farmhandTargetScale();
    const zoom = clampZoom(targetScreenPx / Math.max(8, worldH), this.minZoom, this.maxZoom);
    camera.setZoom(zoom);
    camera.centerOn(foot.x, foot.y - 8);
    this.clampScroll();
    this.placeFarmhand();
    return this.countFarmhandInView() >= 1 && this.farmhandScreenHeightPx() >= 30;
  }

  private farmhandTargetScale(): number {
    const cowScale = cattleDisplayScale(1);
    return cowScale * 2.85;
  }

  private farmhandScreenHeightPx(): number {
    if (!this.farmhandSprite?.visible) return 0;
    return this.farmhandSprite.displayHeight * this.cameras.main.zoom;
  }

  private placePersonSprite(
    sprite: Phaser.GameObjects.Image,
    presence: { tileX: number; tileY: number; walkProgress: number },
    role: "farmer" | "farmhand",
    lastPos: { x: number; y: number },
  ): { x: number; y: number; bob: number; scale: number } {
    const foot = tileCenter(
      presence.tileX,
      presence.tileY,
      this.layout,
      CONFIG.view.tileWidth,
      CONFIG.view.tileHeight,
    );
    const bob =
      presence.walkProgress < 1 && !this.reduceMotion ? Math.sin(performance.now() / 200) * 2 : 0;
    const scale = role === "farmer" ? this.farmerTargetScale() : this.farmhandTargetScale();
    const dx = foot.x - lastPos.x;
    const dy = foot.y - lastPos.y;
    const moving = Math.hypot(dx, dy) > 0.4 || presence.walkProgress < 0.95;
    const dir = inferPersonDir(dx || 0, dy || 0.01);
  const frame = moving ? Math.floor(performance.now() / 180) % 2 : 0;
    const tex = personTextureKey(role, dir, frame);
    if (this.textures.exists(tex)) sprite.setTexture(tex);
    sprite.setPosition(foot.x, foot.y + bob);
    sprite.setScale(scale);
    sprite.setDepth(20000 + presence.tileX + presence.tileY);
    lastPos.x = foot.x;
    lastPos.y = foot.y;
    return { x: foot.x, y: foot.y, bob, scale };
  }

  private farmerTargetScale(): number {
    return cattleDisplayScale(1) * 2.85;
  }

  private placeFarmer(): void {
    if (!this.farmerSprite) return;
    const presence = this.state.story?.farmerPresence;
    if (!presence) {
      this.farmerSprite.setVisible(false);
      this.farmerNameTag?.setVisible(false);
      return;
    }
    const placed = this.placePersonSprite(this.farmerSprite, presence, "farmer", this.farmerLastPos);
    this.farmerSprite.setVisible(true);
    if (this.farmerNameTag) {
      this.farmerNameTag.setText(farmerDisplayName(this.state));
      this.farmerNameTag.setPosition(
        placed.x,
        placed.y - this.farmerSprite.displayHeight - 6 + placed.bob,
      );
      this.farmerNameTag.setDepth(this.farmerSprite.depth + 2);
      this.farmerNameTag.setVisible(true);
    }
  }

  private herderSpriteForTransit(): Phaser.GameObjects.Image | undefined {
    const herder = this.state.herd.transit?.herder;
    if (herder === "piet" && this.farmhandSprite?.visible) return this.farmhandSprite;
    return this.farmerSprite;
  }

  private herderHerdScreenDistancePx(): number {
    const herd = this.mobCenter();
    const sprite = this.herderSpriteForTransit();
    if (!sprite?.visible) return 9999;
    return Math.hypot(sprite.x - herd.x, sprite.y - herd.y) * this.cameras.main.zoom;
  }

  private nudgeHerderBesideHerdCenter(maxPx: number): void {
    const presence = this.state.story?.farmerPresence;
    if (!presence) return;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const tan = pathTangent(this.state);
    for (let pass = 0; pass < 24; pass += 1) {
      const center = this.mobCenter();
      const behindPx = Math.max(18, 64 - pass * 2);
      const footX = center.x - tan.x * behindPx;
      const footY = center.y - tan.y * behindPx;
      const tile = worldToTile(footX, footY, this.layout, tileW, tileH);
      presence.tileX = tile.x;
      presence.tileY = tile.y;
      this.placeFarmer();
      if (this.herderHerdScreenDistancePx() <= maxPx) return;
    }
  }

  private workerHouseInView(): boolean {
    const wh = this.state.features.find((f) => f.kind === "worker_house");
    if (!wh) return false;
    const foot = tileCenter(wh.x, wh.y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
    return this.cameras.main.worldView.contains(foot.x, foot.y);
  }

  private nightWorkersCaptureMeta(): { hour: number; workerAtHome: boolean; workerHouseVisible: boolean } {
    return {
      hour: this.state.date.hour,
      workerAtHome: workerAtHomeAtNight(this.state),
      workerHouseVisible: this.workerHouseInView(),
    };
  }

  private frameHomesteadWithWorkerHouse(): boolean {
    this.panVel = null;
    const house = this.state.features.find((f) => f.kind === "house");
    const workerHouse = this.state.features.find((f) => f.kind === "worker_house");
    if (!house) return false;
  const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const main = tileCenter(house.x, house.y, this.layout, tileW, tileH);
    const pts = [main];
    if (workerHouse) pts.push(tileCenter(workerHouse.x, workerHouse.y, this.layout, tileW, tileH));
    let minX = pts[0].x;
    let maxX = pts[0].x;
    let minY = pts[0].y;
    let maxY = pts[0].y;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const span = Math.max(maxX - minX, maxY - minY, 160);
    const camera = this.cameras.main;
    const phone = camera.width < 500;
    const zoom = clampZoom(phone ? Math.min(1.05, 520 / span) : Math.min(1.2, 640 / span), this.minZoom, this.maxZoom);
    camera.setZoom(zoom);
    camera.centerOn((minX + maxX) / 2, (minY + maxY) / 2 - 14);
    this.clampScroll();
    this.placeFarmer();
    const h = this.farmerSprite?.visible ? this.farmerSprite.displayHeight * camera.zoom : 0;
    return this.countFarmerInView() >= 1 && h >= 30 && (workerHouse ? this.workerHouseInView() : true);
  }

  private pickLongHerdMoveDestination(): number | null {
    let bestId: number | null = null;
    let bestLen = 0;
    for (const camp of this.state.camps) {
      if (camp.id === this.state.herd.campId) continue;
      const path = planHerdPath(this.state, this.state.herd.campId, camp.id);
      if (path.length > bestLen) {
        bestLen = path.length;
        bestId = camp.id;
      }
    }
    return bestId;
  }

  private gateProgressForCapture(): number {
    const path = this.state.herd.transit?.path ?? [];
    if (path.length < 2) return 0.5;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const segments = collectFenceSegments(this.state, this.layout, this.state.herd.campId, false);
    const gates = segments.filter((segment) => segment.gate);
    if (gates.length === 0) return 0.5;
    let bestIndex = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    path.forEach((tile, index) => {
      const point = tileCenter(tile.x, tile.y, this.layout, tileW, tileH);
      for (const gate of gates) {
        const dist = Math.hypot(point.x - (gate.x1 + gate.x2) / 2, point.y - (gate.y1 + gate.y2) / 2);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = index;
        }
      }
    });
    return bestIndex / (path.length - 1);
  }

  private prepareHerdDriveCapture(): boolean {
    const story = this.state.story;
    if (!story) return false;
    story.herdMoveQueue = null;
    const herdState = this.state.herd;
    herdState.transit = null;
    ensurePeopleState(this.state);
    if (!story.workGrid) story.workGrid = defaultWorkGrid();
    story.workGrid.move_herd_help = 0;
    if (story.farmhandPresence) {
      story.farmhandPresence.onHerdingDuty = false;
      story.farmhandPresence.activeJob = null;
    }
    if (story.farmerPresence) story.farmerPresence.onHerdingDuty = false;

    const destId = this.pickLongHerdMoveDestination();
    if (destId === null) return false;

    this.state.date.hour = 11;
    this.captureLightingHour = 11;
    if (!beginHerdMove(this.state, destId)) return false;
    const transit = herdState.transit as HerdTransit | null;
    if (!transit || transit.path.length < 2) return false;
    transit.phase = "drive";
    transit.approachProgress = 1;
    transit.herder = "farmer";
    const gateP = this.gateProgressForCapture();
    transit.progress = Math.min(0.88, Math.max(0.15, gateP));
    syncHerderOnDrive(this.state);
    if (story.farmerPresence) {
      const herdTile = pointOnPath(transit.path, transit.progress);
      const tan = pathTangent(this.state);
      story.farmerPresence.tileX = herdTile.x - tan.x * 0.22;
      story.farmerPresence.tileY = herdTile.y - tan.y * 0.22;
      story.farmerPresence.onHerdingDuty = true;
    }

    this.syncHerdFromSim();
    this.placeHerd(performance.now());
    this.nudgeHerderBesideHerdCenter(80);
    this.placeFarmhand();
    this.redrawFences();

    const herdCenter = this.mobCenter();
    const herderSprite = this.herderSpriteForTransit();
    const hx = herderSprite?.x ?? herdCenter.x;
    const hy = herderSprite?.y ?? herdCenter.y;
    const camera = this.cameras.main;
    const phone = camera.width < 500;
    camera.setZoom(clampZoom(phone ? 0.95 : 1.08, this.minZoom, this.maxZoom));
    camera.centerOn((herdCenter.x + hx) / 2, (herdCenter.y + hy) / 2 - (phone ? 6 : 16));
    this.clampScroll();

    const dist = this.herderHerdScreenDistancePx();
    const midMove = transit.progress > 0.08 && transit.progress < 0.95;
    return this.countCattleInView() >= 1 && this.countFarmerInView() >= 1 && dist <= 80 && midMove;
  }

  private prepareNightWorkersHomeCapture(): boolean {
    this.state.herd.transit = null;
    if (this.state.story) this.state.story.herdMoveQueue = null;
    hireFarmhand(this.state);
    ensurePeopleState(this.state);
    const story = this.state.story;
    if (story?.farmerPresence) story.farmerPresence.onHerdingDuty = false;
    if (story?.farmhandPresence) {
      story.farmhandPresence.onHerdingDuty = false;
      story.farmhandPresence.activeJob = null;
    }
    this.state.date.hour = 21;
    this.captureLightingHour = 21;
    tickPeopleSchedule(this.state);
    for (let i = 0; i < 4; i += 1) tickFarmhandWorld(this.state);
    this.applyRanchLighting();
    this.syncHud();

    const house = this.state.features.find((f) => f.kind === "house");
    const wh = this.state.features.find((f) => f.kind === "worker_house");
    if (!wh || !house) return false;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const main = tileCenter(house.x, house.y, this.layout, tileW, tileH);
    const worker = tileCenter(wh.x, wh.y, this.layout, tileW, tileH);
    const span = Math.max(Math.hypot(main.x - worker.x, main.y - worker.y), 180);
    const camera = this.cameras.main;
    const zoom = clampZoom(Math.min(1.12, 700 / span), this.minZoom, this.maxZoom);
    camera.setZoom(zoom);
    camera.centerOn((main.x + worker.x) / 2, (main.y + worker.y) / 2 - 10);
    this.clampScroll();
    this.placeFarmhand();
    this.placeFarmer();

    const hourOk = this.state.date.hour >= 19 || this.state.date.hour <= 5;
    return (
      this.countFarmhandInView() >= 1 &&
      this.workerHouseInView() &&
      workerAtHomeAtNight(this.state) &&
      hourOk
    );
  }

  private placeFarmhand(): void {
    if (!this.farmhandSprite) return;
    const hired = this.state.story?.farmhand.hired;
    const presence = this.state.story?.farmhandPresence;
    if (!hired || !presence) {
      this.farmhandSprite.setVisible(false);
      this.farmhandNameTag?.setVisible(false);
      this.farmhandJobTag?.setVisible(false);
      return;
    }
    const placed = this.placePersonSprite(
      this.farmhandSprite,
      presence,
      "farmhand",
      this.farmhandLastPos,
    );
    this.farmhandSprite.setVisible(true);
    const jobShort =
      presence.activeJob && WORK_JOB_LABELS[presence.activeJob]
        ? WORK_JOB_LABELS[presence.activeJob]
        : presence.activityLabel?.trim() || "On duty";
    if (this.farmhandNameTag) {
      this.farmhandNameTag.setPosition(
        placed.x,
        placed.y - this.farmhandSprite.displayHeight - 6 + placed.bob,
      );
      this.farmhandNameTag.setDepth(this.farmhandSprite.depth + 2);
      this.farmhandNameTag.setVisible(true);
    }
    if (this.farmhandJobTag) {
      this.farmhandJobTag.setText(jobShort);
      this.farmhandJobTag.setPosition(
        placed.x,
        placed.y - this.farmhandSprite.displayHeight - 28 + placed.bob,
      );
      this.farmhandJobTag.setDepth(this.farmhandSprite.depth + 2);
      this.farmhandJobTag.setVisible(true);
    }
  }

  private countFarmerInView(): number {
    if (!this.farmerSprite?.visible) return 0;
    const view = this.cameras.main.worldView;
    const pad = 8;
    const x = this.farmerSprite.x;
    const y = this.farmerSprite.y;
    return x >= view.x - pad && x <= view.right + pad && y >= view.y - pad && y <= view.bottom + pad ? 1 : 0;
  }

  private countFarmhandInView(): number {
    if (!this.farmhandSprite?.visible) return 0;
    const view = this.cameras.main.worldView;
  const pad = 8;
    const x = this.farmhandSprite.x;
    const y = this.farmhandSprite.y;
    return x >= view.x - pad && x <= view.right + pad && y >= view.y - pad && y <= view.bottom + pad
      ? 1
      : 0;
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
    const walking = herdInTransit(this.state.herd);
    const zoom = this.cameras.main.zoom;
    const cowLod = this.paintedSprites && zoom <= COW_LOD_ZOOM && !this.captureHideHerdLabel;
    this.cows.forEach((cow, index) => {
      const offset = this.herdOffsets[index] ?? {
        x: 0,
        y: 0,
        flip: false,
        coat: 0,
        scale: 0.5,
        view: "right" as const,
      };
      const walk =
        walking && !this.reduceMotion
          ? Math.sin(time / 220 + index * 0.7) * 1.6
          : Math.sin(time / 280 + index) * bobAmp;
      if (cowLod) {
        cow.setTexture(SPRITE_KEYS.cowDot);
        cow.setScale(1.15);
        cow.setRotation(0);
        cow.setFlipX(false);
      } else if (this.paintedSprites) {
        cow.setTexture(cattleTextureForView(offset.coat, offset.view));
        const base = cattleDisplayScale(offset.scale / 0.82);
        const squash = walking && !this.reduceMotion ? 1 + Math.sin(time / 170 + index * 0.9) * 0.03 : 1;
        const face = cowPresentationScale(offset.view, base);
        cow.setScale(face.x, face.y * squash);
        cow.setFlipX(false);
        cow.setRotation(0);
      } else {
        const animFrame = walking
          ? Math.floor(time / 160 + index * 0.15) % 3
          : Math.floor(time / 420 + index * 0.2) % 2;
        cow.setTexture(cowTextureKey(offset.coat, walking, animFrame));
        cow.setScale(offset.scale);
        cow.setFlipX(offset.flip);
        cow.setRotation(0);
      }
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
    if (!this.captureSkipCowCull) {
      for (let i = 0; i < this.cows.length; i += 1) {
        const cow = this.cows[i];
        const offset = this.herdOffsets[i];
        const cx = this.herdVisual.x + (offset?.x ?? 0);
        const cy = this.herdVisual.y + (offset?.y ?? 0);
        cow.setVisible(
          cx >= view.x - pad - 24 && cx <= view.right + pad + 24 && cy >= view.y - pad - 24 && cy <= view.bottom + pad + 24,
        );
      }
    }
  }

  private cullChunks(): void {
    const camera = this.cameras.main;
    const pad = CONFIG.view.propCullPadPx;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const source = this.paintedSprites ? this.chunkRenderTextures : this.chunkRoots;
    for (const [key, root] of source) {
      const [cx, cy] = key.split(",").map(Number);
      const sample = tileTop(cx * CONFIG.view.terrainChunkTiles, cy * CONFIG.view.terrainChunkTiles, this.layout, tileW, tileH);
      const bounds = new Phaser.Geom.Rectangle(sample.x - tileW * 8, sample.y - tileH * 2, tileW * 16, tileH * 16);
      const visible = boundsVisible(camera, bounds, pad);
      if (root instanceof Phaser.GameObjects.Container) root.setVisible(visible);
      else root.setVisible(visible);
    }
  }

  private drawRing(): void {
    this.ring.clear();
    if (!this.selected) return;
    const center = this.mobCenter();
    let spanX = CONFIG.view.ringRx;
    let spanY = CONFIG.view.ringRy;
    for (const offset of this.herdOffsets) {
      spanX = Math.max(spanX, Math.abs(this.herdVisual.x + offset.x - center.x) * 2 + 36);
      spanY = Math.max(spanY, Math.abs(this.herdVisual.y + offset.y - center.y) * 2 + 24);
    }
    this.ring.lineStyle(CONFIG.view.ringLinePx, palette.fenceSelected, 0.95);
    this.ring.strokeEllipse(center.x, center.y + 4, spanX, spanY);
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
    this.refreshHerdLabel();
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
        const hitHerd = this.pointerHitsHerd(world.x, world.y, radius);
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
      this.setSpeed(this.mode === "pause" ? "x1" : "pause");
    });
    this.input.keyboard?.on("keydown-ONE", () => this.setSpeed("pause"));
    this.input.keyboard?.on("keydown-TWO", () => this.setSpeed("x1"));
    this.input.keyboard?.on("keydown-THREE", () => this.setSpeed("x2"));
    this.input.keyboard?.on("keydown-FOUR", () => this.setSpeed("x3"));
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
    if (this.pointerHitsHerd(world.x, world.y, radius)) {
      const action = resolveHerdTap(this.selected);
      if (action === "deselect") {
        this.deselectHerd();
        return;
      }
      this.selected = true;
      this.pendingCampId = null;
      this.pendingCampName = "";
      this.hud.setHint(COPY.hintSelected);
      getGameFlow().notifySim("herdSelected");
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
    if (result.queued) {
      const msg =
        result.queueReason === "night"
          ? `Move to ${result.campName} queued until morning.`
          : `Move to ${result.campName} queued. No herder free yet.`;
      this.hud.setHint(msg);
    } else {
      this.hud.setHint(`Herder heading to ${result.campName}. The herd follows when they arrive at the camp.`);
    }
    getGameFlow().notifySim("moveConfirmed");
    this.redrawFences();
    this.syncHud();
    this.persist();
  }

  private openingViewBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const pad = homesteadBoundsPad(tileW, tileH);
    const yardKinds = new Set(["house", "windmill", "shed", "kraal", "reservoir"]);
    const points: { x: number; y: number }[] = [];
    for (const feature of this.state.features) {
      if (!yardKinds.has(feature.kind)) continue;
      const pt = tileCenter(feature.x + 0.5, feature.y + 0.5, this.layout, tileW, tileH);
      const spritePad =
        feature.kind === "windmill" ? tileW * 2.2 : feature.kind === "shed" ? tileW * 1.9 : tileW * 1.15;
      points.push(
        { x: pt.x - spritePad, y: pt.y - tileH * 2.4 },
        { x: pt.x + spritePad, y: pt.y + tileH * 1.6 },
      );
    }
    const cowPad = tileW * 0.65;
    for (const offset of this.herdOffsets) {
      points.push({
        x: this.herdVisual.x + offset.x - cowPad,
        y: this.herdVisual.y + offset.y - cowPad,
      });
      points.push({
        x: this.herdVisual.x + offset.x + cowPad,
        y: this.herdVisual.y + offset.y + cowPad,
      });
    }
    if (this.herdOffsets.length === 0) {
      points.push(
        { x: this.herdVisual.x - cowPad, y: this.herdVisual.y - cowPad },
        { x: this.herdVisual.x + cowPad, y: this.herdVisual.y + cowPad },
      );
    }
    const homestead =
      boundsFromPoints(points, pad * 0.25) ??
      boundsFromPoints(
        [
          { x: this.herdVisual.x - pad, y: this.herdVisual.y - pad },
          { x: this.herdVisual.x + pad, y: this.herdVisual.y + pad },
        ],
        pad * 0.25,
      )!;
    return openingFrameBounds(homestead, this.herdVisual.x, this.herdVisual.y, pad * 0.35);
  }

  private layoutCamera(resetView: boolean): void {
    const camera = this.cameras.main;
    this.refreshZoomLimits();
    if (resetView) {
      const bounds = this.openingViewBounds();
      const framed = frameWorldRectInClearBand(
        bounds,
        camera.width,
        camera.height,
        viewportCameraInsets(),
        this.minZoom,
        Math.min(this.maxZoom, 1.15),
        16,
      );
      camera.setZoom(framed.zoom);
      camera.scrollX = framed.scrollX;
      camera.scrollY = framed.scrollY;
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
