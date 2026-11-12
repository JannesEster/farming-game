import Phaser from "phaser";
import { CONFIG } from "../sim/config";
import { COPY } from "../sim/format";
import { clamp } from "../sim/math";
import { getGameFlow } from "../integration/GameFlowService";
import { hasBlockingCard, popNextCard } from "../sim/story";
import { presentStoryCard } from "./storyPresent";
import { formatClockTime, isDaylightHour, nightOverlayAlpha, realMsPerGameHour, sceneDaylightBlend, tickRanchClock } from "../sim/clock";
import { elementVisible, isSimBlocked as simClockBlocked, speedMultiplier, transitMayAdvance } from "./simGate";
import { syncAlertStrip } from "../integration/notificationHub";
import { bfsCampRoute, campGateBetween } from "../sim/path";
import { campIdAt, moveHerd, stepDay } from "../sim/simulation";
import { defaultWorkGrid, setWorkPriority, tickFarmhandWorld, WORK_JOB_LABELS } from "../sim/workGrid";
import { hireFarmhand } from "../sim/workers";
import type { DayLengthSeconds } from "../sim/clock";
import { herdInTransit, herdMoveActive, herdWorldTile, pathTangent } from "../sim/transit";
import { beginHerdMove, syncHerderOnDrive, tickHerdingRealtime } from "../sim/herding";
import { freeWorkerHouseSlots } from "../sim/housing";
import { ensurePeopleState, tickPeopleSchedule, workerAtHomeAtNight } from "../sim/people";
import { farmerDisplayName, DEFAULT_PLAYER_DISPLAY_NAME } from "../sim/playerName";
import { herdRearPathProgress, herderPathProgressBehindTail } from "../sim/convoy";
import { tickDrinkingRealtime, herdDrinkingAtTrough, campHasWaterAccess } from "../sim/water";
import { roadTileBesideRamp, tileAlongRoad, truckParkTile } from "../sim/yard";
import {
  beginSaleConvoy,
  tickSaleConvoyRealtime,
  saleConvoyActive,
  saleTruckVisible,
  saleTruckDeparting,
} from "../sim/sales";
import { quoteSale } from "../sim/economy";
import { maybeStartBakkieRun, tickBakkieRealtime, bakkieOnRoad } from "../sim/bakkie";
import { STEP3B } from "../sim/step3bConfig";
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
  scrollXForWorldAtScreenX,
  scrollYForWorldAtScreenY,
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
import { layoutAnimals } from "./animalLayout";
import { filterAnimals, TOLLY_OVER_300 } from "../sim/animals";
import { startEscape, tickEscapeWanderRealtime } from "../sim/escapes";
import { cutOutHerderProgress, cutOutRearProgress, escapedAnimalIds, requestCutOut, tickCutOutRealtime } from "../sim/cutOut";
import { boundsVisible, chunkCoordsForTile } from "./terrain";
import { bakeTerrainChunk } from "./groundLayer";
import { placeGateSprites } from "./fenceDecor";
import {
  COW_LOD_ZOOM,
  cattleDisplayScale,
  scaleToSpanMetres,
  cattleSpriteForCoat,
  cattleTextureForView,
  cowPresentationScale,
  ensureCowDotTexture,
  ensureCowViewTextures,
  ensureCattleOctantTextures,
  cattleOctantKey,
  cattleOctantScale,
  cattleCoatIndex,
  cowOctantFromScreen,
  ensureFarmhandTexture,
  ensureFarmerTexture,
  ensureWorkerHouseTexture,
  ensureStep3bPropTextures,
  inferPersonDir,
  personTextureKey,
  SPRITE_KEYS,
  FARMHAND_TEXTURE_HEIGHT,
  maybePaintedTermiteAt,
  maybeRockAt,
  paintedSpritesReady,
  propSpriteForKind,
} from "./sprites";
import {
  BAKKIE_LENGTH_METRES,
  BUSH_DENSE_METRES,
  CAMELTHORN_LARGE_METRES,
  COW_LENGTH_METRES,
  COW_SHOULDER_METRES,
  COTTAGE_WIDTH_METRES,
  FARMHOUSE_WIDTH_METRES,
  GARDEN_WIDTH_METRES,
  KRAAL_WIDTH_METRES,
  personDisplayPx,
  RESERVOIR_DIAMETER_METRES,
  ROCK_CLUSTER_METRES,
  SHED_WIDTH_METRES,
  TERMITE_HEIGHT_METRES,
  TROUGH_LENGTH_METRES,
  WHEEL_DIAMETER_METRES,
  WINDMILL_HEIGHT_METRES,
  uniformScale,
} from "./worldScale";
import {
  homesteadSpritePlacementsFromFeatures,
  workerCottagePlacements,
} from "./homesteadLayout";
import {
  cattlePose,
  ensureSoftShadow,
  personPose,
  placeShadow,
  placeV2Fences,
  placeV2Props,
  preloadV2,
  referencePose,
  roadtrainEndOffsets,
  roadtrainFile,
  v2Ready,
  vehiclePose,
} from "./v2Art";
import { yardGeometry } from "./yardDraw";
import { ensureV2GroundFillTexture, renderFarmRoad, v2GroundReady } from "./v2Ground";

function pointInPolygon(x: number, y: number, corners: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; i += 1) {
    const xi = corners[i].x;
    const yi = corners[i].y;
    const xj = corners[j].x;
    const yj = corners[j].y;
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
    j = i;
  }
  return inside;
}

function clearHerdTransit(state: GameState): void {
  state.herd.transit = null;
}

function clearCutOut(state: GameState): void {
  if (state.story) state.story.cutOut = null;
}

/** Put a capture drive back in the grazing herd so the next shot starts clean. */
function releaseCutOutAnimals(state: GameState): void {
  clearCutOut(state);
  const campId = state.herd.campId;
  for (const animal of state.story?.animals ?? []) {
    if (animal.whereabouts !== "cut_out") continue;
    animal.whereabouts = "in_camp";
    animal.split = false;
    animal.campId = campId;
    animal.activity = "graze";
  }
}

function clearSaleConvoy(state: GameState): void {
  if (state.story) state.story.saleConvoy = null;
}

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
  private chunkRenderTextures = new Map<string, Phaser.GameObjects.RenderTexture | Phaser.GameObjects.Image>();
  private groundFill?: Phaser.GameObjects.TileSprite;
  private roadDecal?: Phaser.GameObjects.Image;
  private fenceArt: Phaser.GameObjects.Image[] = [];
  private fenceSig = "";
  private cowShadows: Phaser.GameObjects.Image[] = [];
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
  private parkedBakkie = { x: 0, y: 0 };
  private captureHerdTile: { x: number; y: number } | null = null;
  private captureDrinkHeads = 0;
  private captureKraalLineup = false;
  private capturePin: { x: number; y: number; zoom: number } | null = null;
  private captureWhy = "";
  private captureHideStaff = false;
  private reviewDriveZoom: number | null = null;
  private captureScaleLineup = false;
  private scaleReferenceSprites: Phaser.GameObjects.Image[] = [];
  private yardBakkie?: Phaser.GameObjects.Image;
  private cattleTruck?: Phaser.GameObjects.Image;
  private bakkieDust?: Phaser.GameObjects.Graphics;
  private workerCottageSprites: Phaser.GameObjects.Image[] = [];
  private workerCottageLights: Phaser.GameObjects.Graphics[] = [];
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
    preloadV2(this.load);
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
    this.paintedSprites = v2Ready(this.textures) || paintedSpritesReady(this.textures);
    ensureCowDotTexture(this);
    ensureSoftShadow(this);
    if (!v2Ready(this.textures)) {
      ensureFarmhandTexture(this);
      ensureFarmerTexture(this);
      ensureWorkerHouseTexture(this);
      ensureStep3bPropTextures(this);
      if (this.paintedSprites) ensureCowViewTextures(this);
      ensureCattleOctantTextures(this);
    }
    initStoryPeople(this.state);
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
      onToggleAnimal: (id) => this.toggleAnimal(id),
      onAnimalFilter: (filter) => this.applyAnimalFilter(filter),
      onCutToCamp: () => this.orderCutToPendingCamp(),
      onCutToKraal: () => this.orderCutToKraal(),
      onRoundUp: () => this.orderRoundUp(),
      onClearAnimalFocus: () => {
        if (this.state.story) this.state.story.focusedAnimalId = null;
        this.syncHud();
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
        this.appendMissingWorkerCottages();
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
    } else {
      this.homesteadGlow.clear();
      if (nightAlpha >= 0.1) {
        const strength = nightAlpha / 0.62;
        const { x, y } = this.homesteadLight;
        this.homesteadGlow.fillStyle(0xffc978, 0.28 * strength);
        this.homesteadGlow.fillCircle(x - 14, y - 22, 10);
        this.homesteadGlow.fillCircle(x + 10, y - 20, 8);
        this.homesteadGlow.fillStyle(0xffe8b8, 0.2 * strength);
        this.homesteadGlow.fillCircle(x - 14, y - 22, 5);
        this.homesteadGlow.fillCircle(x + 10, y - 20, 4);
      }
    }
    this.updateWorkerCottageGlow(nightAlpha);
  }

  private updateWorkerCottageGlow(nightAlpha: number): void {
    for (const glow of this.workerCottageLights) glow.clear();
    if (nightAlpha < 0.12) return;
    const strength = nightAlpha / 0.62;
    this.workerCottageSprites.forEach((sprite, index) => {
      const g = this.workerCottageLights[index];
      if (!g) return;
      const wx = sprite.x - sprite.displayWidth * 0.12;
      const wy = sprite.y - sprite.displayHeight * 0.55;
      g.fillStyle(0xffd89a, 0.35 * strength);
      g.fillCircle(wx, wy, Math.max(6, sprite.displayWidth * 0.06));
      g.fillStyle(0xfff0c8, 0.22 * strength);
      g.fillCircle(wx, wy, Math.max(3, sprite.displayWidth * 0.03));
    });
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

  /** One zoom for the whole drive. Pan so the herder stays in frame behind the moving mob. */
  private frameReviewDrive(zoom: number): Record<string, unknown> {
    this.captureSkipCowCull = true;
    this.captureHideHerdLabel = true;
    this.captureHideStaff = false;
    this.capturePin = null;
    this.syncHerdFromSim();
    this.placeHerd(performance.now());
    this.placeFarmer();
    this.placeFarmhand();
    const camera = this.cameras.main;
    if (this.reviewDriveZoom === null) {
      this.reviewDriveZoom = clampZoom(zoom, this.minZoom, this.maxZoom);
    }
    camera.setZoom(this.reviewDriveZoom);
    if (!this.state.herd.transit) {
      const herdPoints = this.herdOffsets.map((offset) => ({
        x: this.herdVisual.x + offset.x,
        y: this.herdVisual.y + offset.y,
      }));
      if (this.farmerSprite?.visible) {
        herdPoints.push({ x: this.farmerSprite.x, y: this.farmerSprite.y });
        herdPoints.push({ x: this.farmerSprite.x, y: this.farmerSprite.y - 120 });
      }
      const herdBounds = boundsFromPoints(herdPoints, 48);
      if (herdBounds) {
        const fitted = frameWorldRectInClearBand(
          herdBounds,
          camera.width,
          camera.height,
          viewportCameraInsets(),
          this.minZoom,
          this.reviewDriveZoom,
          24,
        );
        camera.setZoom(fitted.zoom);
        camera.scrollX = fitted.scrollX;
        camera.scrollY = fitted.scrollY;
        this.clampScroll();
      }
    }
    const herd = this.movingMobCenter();
    const herderSprite = this.state.herd.transit ? this.herderSpriteForTransit() : this.farmerSprite;
    const herder = herderSprite?.visible ? { x: herderSprite.x, y: herderSprite.y } : herd;
    const viewW = camera.width / camera.zoom;
    const viewH = camera.height / camera.zoom;
    const margin = 0.2;
    let cx = (herd.x + herder.x) / 2;
    let cy = (herd.y + herder.y) / 2;
    const limitX = viewW * (0.5 - margin);
    const limitY = viewH * (0.5 - margin);
    cx = Math.min(herder.x + limitX, Math.max(herder.x - limitX, cx));
    cy = Math.min(herder.y + limitY, Math.max(herder.y - limitY, cy));
    if (this.state.herd.transit) this.jumpCameraTo(cx, cy, false);
    this.placeHerd(performance.now());
    this.placeFarmer();
    this.placeFarmhand();
    const shownHerder = this.state.herd.transit ? this.herderSpriteForTransit() : this.farmerSprite;
    const label = this.state.herd.transit?.herder === "piet" ? this.farmhandNameTag : this.farmerNameTag;
    if (shownHerder?.visible) {
      const labelY = label?.visible ? label.y : shownHerder.y - 48;
      const focusY = Math.min(shownHerder.y, labelY);
      const viewLeft = worldXAtScreenX(camera.scrollX, camera.width, camera.zoom, 48);
      const viewRight = worldXAtScreenX(camera.scrollX, camera.width, camera.zoom, camera.width - 48);
      const viewTop = worldYAtScreenY(camera.scrollY, camera.height, camera.zoom, 88);
      const viewBottom = worldYAtScreenY(camera.scrollY, camera.height, camera.zoom, camera.height - 48);
      let shiftX = 0;
      let shiftY = 0;
      if (shownHerder.x < viewLeft) shiftX = shownHerder.x - viewLeft;
      else if (shownHerder.x > viewRight) shiftX = shownHerder.x - viewRight;
      if (focusY < viewTop) shiftY = focusY - viewTop;
      else if (shownHerder.y > viewBottom) shiftY = shownHerder.y - viewBottom;
      if (shiftX !== 0 || shiftY !== 0) {
        camera.scrollX += shiftX;
        camera.scrollY += shiftY;
        this.clampScroll();
      }
    }
    this.cullProps();
    this.fadeCoveringTrees();
    const inside = (x: number, y: number) =>
      x >= worldXAtScreenX(camera.scrollX, camera.width, camera.zoom, 0) &&
      x <= worldXAtScreenX(camera.scrollX, camera.width, camera.zoom, camera.width) &&
      y >= worldYAtScreenY(camera.scrollY, camera.height, camera.zoom, 0) &&
      y <= worldYAtScreenY(camera.scrollY, camera.height, camera.zoom, camera.height);
    const herderVisible = Boolean(shownHerder?.visible && inside(shownHerder.x, shownHerder.y));
    const labelVisible = Boolean(label?.visible && inside(label.x, label.y));
    const moving = this.herdOffsets.filter((offset) => offset.moving).length;
    return {
      zoom: camera.zoom,
      herderVisible,
      labelVisible,
      label: label?.text ?? "",
      moving,
      x: herder.x,
      y: herder.y,
    };
  }

  /** Wide view of the two-track from the farm gate, past the homestead, to the yard. */
  private prepareRoadWideCapture(): boolean {
    this.capturePin = null;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const tracks = this.state.features.filter((feature) => feature.kind === "track");
    const house = this.state.features.find((feature) => feature.kind === "house");
    if (!house || tracks.length === 0) return false;
    let nearest = tracks[0];
    let nearestDist = Number.POSITIVE_INFINITY;
    for (const tile of tracks) {
      const dist = Math.hypot(tile.x - house.x, tile.y - house.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = tile;
      }
    }
    const vertical = tracks.filter((tile) => tile.x === nearest.x).length;
    const horizontal = tracks.filter((tile) => tile.y === nearest.y).length;
    const spine =
      vertical >= horizontal
        ? tracks.filter((tile) => Math.abs(tile.x - nearest.x) <= 6)
        : tracks.filter((tile) => Math.abs(tile.y - nearest.y) <= 6);
    const points = spine.map((tile) => tileCenter(tile.x, tile.y, this.layout, tileW, tileH));
    const bounds = boundsFromPoints(points, tileW * 1.4);
    if (!bounds) return false;
    const camera = this.cameras.main;
    this.refreshZoomLimits();
    const framed = frameWorldRectInClearBand(
      bounds,
      camera.width,
      camera.height,
      viewportCameraInsets(),
      this.minZoom,
      Math.min(this.maxZoom, 0.72),
      20,
    );
    camera.setZoom(framed.zoom);
    camera.scrollX = framed.scrollX;
    camera.scrollY = framed.scrollY;
    this.clampScroll();
    this.cullProps();
    this.fadeCoveringTrees();
    return true;
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
        this.captureHideStaff = false;
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
      herderBehindHerdOnDrive: () => this.herderBehindHerdOnDrive(),
      workerCottageSpriteBoundsInView: () => this.workerCottageSpriteBoundsInView(),
      getTransitProgress: () => ({
        phase: this.state.herd.transit?.phase,
        progress: this.state.herd.transit?.progress,
        farmer: this.state.story?.farmerPresence,
      }),
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
      frameReviewDrive: (zoom = 0.9) => this.frameReviewDrive(zoom),
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
      driveCaptureStatus: () => {
        const transit = this.state.herd.transit;
        const who = transit?.herder ?? this.state.story?.saleConvoy?.herder ?? "farmer";
        const presence = who === "piet" ? this.state.story?.farmhandPresence : this.state.story?.farmerPresence;
        const dayLength = this.state.clock?.settings.dayLengthSeconds;
        return {
          clock: formatClockTime(this.state.date, this.state.clock?.bankMs ?? 0, dayLength),
          hour: this.state.date.hour,
          day: this.state.date.day,
          phase: transit?.phase ?? null,
          progress: transit?.progress ?? null,
          approach: transit?.approachProgress ?? null,
          campId: this.state.herd.campId,
          cash: this.state.cashNad,
          head: this.state.herd.headCount,
          herderX: presence?.tileX ?? null,
          herderY: presence?.tileY ?? null,
          sale: this.state.story?.saleConvoy?.phase ?? null,
          paid: Boolean(this.state.story?.saleConvoy?.paid),
          heifers: this.state.story?.composition.heifer ?? 0,
          freeze: this.captureFreezeClock,
          speed: this.mode,
          event: elementVisible(document, "event-card"),
          market: elementVisible(document, "market-sheet"),
          picker: elementVisible(document, "picker-root"),
          tutorial: elementVisible(document, "flow-tutorial"),
        };
      },
      refreshCapturePanels: () => {
        this.syncHud();
        this.market.refresh(this.state);
        const paid = this.state.story?.saleConvoy?.paid;
        const quoted = this.state.story?.saleConvoy?.quoted.totalNad;
        const status = document.getElementById("market-status");
        if (paid && status && quoted !== undefined) {
          status.textContent = `Paid N$${Math.round(quoted).toLocaleString("en-ZA")}. Herd and cash are updated.`;
        }
        return this.state.cashNad;
      },
      dismissCaptureBlockers: () => {
        this.captureFreezeClock = false;
        this.captureHoldTransit = false;
        this.setSpeed("x1");
        this.hud.hideEventCard();
        while (popNextCard(this.state)) {
          /* drop cards that would pause the capture clock */
        }
        for (const id of ["picker-root", "flow-tutorial", "flow-yearend", "flow-gameover", "event-card"]) {
          document.getElementById(id)?.setAttribute("hidden", "true");
        }
        return true;
      },
      armDriveCapture: () => {
        this.captureFreezeClock = false;
        this.captureHoldTransit = false;
        this.setSpeed("x1");
        return true;
      },
      startNeighbourDriveCapture: (hour = 10, minute = 0) => {
        this.captureFreezeClock = false;
        this.captureHoldTransit = false;
        this.reviewDriveZoom = null;
        this.setSpeed("x1");
        const dayLength = this.state.clock?.settings.dayLengthSeconds ?? 240;
        this.state.date = { ...this.state.date, hour };
        if (this.state.clock) {
          this.state.clock.bankMs = realMsPerGameHour(hour, dayLength) * (minute / 60);
          this.state.clock.speed = 1;
        }
        const from = this.state.camps.find((camp) => camp.id === this.state.herd.campId);
        let neighbour: (typeof this.state.camps)[number] | undefined;
        let neighbourLength = Number.POSITIVE_INFINITY;
        if (from) {
          for (const camp of this.state.camps) {
            if (camp.id === from.id || !campGateBetween(from, camp)) continue;
            const length = planHerdPath(this.state, from.id, camp.id).length;
            if (length < neighbourLength) {
              neighbourLength = length;
              neighbour = camp;
            }
          }
        }
        const target = neighbour ?? this.state.camps.find((camp) => camp.id !== this.state.herd.campId);
        if (!from || !target) return { ok: false as const };
        this.commitMove(target.id);
        this.frameHerdForCapture(1.05);
        return { ok: true as const, targetId: target.id, shared: Boolean(neighbour) };
      },
      startHeiferSaleCapture: () => {
        this.captureFreezeClock = false;
        this.captureHoldTransit = false;
        this.setSpeed("x1");
        const count = Math.min(3, this.state.story?.composition.heifer ?? 0);
        if (count < 1) return { ok: false as const, message: "No open heifers.", cash: this.state.cashNad };
        const quote = quoteSale(this.state, "heifer", count, "auction");
        if ("reason" in quote) return { ok: false as const, message: quote.reason, cash: this.state.cashNad };
        const begin = beginSaleConvoy(this.state, "heifer", count, "auction", quote);
        this.market.open();
        const status = document.getElementById("market-status");
        if (status) status.textContent = begin.message;
        this.syncHud();
        return { ok: begin.ok, message: begin.message, cash: this.state.cashNad, quote: quote.totalNad, count };
      },
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
      prepareDrinkingCapture: () => this.prepareDrinkingCapture(),
      preparePickerWaterCapture: () => this.preparePickerWaterCapture(),
      prepareNoWaterCampCapture: () => this.prepareNoWaterCampCapture(),
      prepareSaleKraalCapture: () => this.prepareSaleKraalCapture(),
      prepareTruckLeavingCapture: () => this.prepareTruckLeavingCapture(),
      prepareBakkieDustCapture: () => this.prepareBakkieDustCapture(),
      auditKind: (kind: string) => this.auditKind(kind),
      drinkCowsNearTrough: () => this.drinkCowsNearTrough(),
      drinkDebug: () => this.drinkDebug(),
      truckOnRoad: () => this.truckOnRoad(),
      bakkieOnTrack: () => this.bakkieOnTrack(),
      cottageOnYard: () => {
        const cottage = this.state.features.find((f) => f.kind === "worker_house");
        if (!cottage) return false;
        return this.state.campIds[cottage.y * this.state.width + cottage.x] === -1;
      },
      namedSpritesInView: (role: string) => this.namedSpritesInView(role),
      pictureAudit: () => this.pictureAudit(),
      prepareEscapeCapture: () => this.prepareEscapeCapture(),
      prepareAnimalDetailCapture: () => this.prepareAnimalDetailCapture(),
      prepareMultiSelectCapture: () => this.prepareMultiSelectCapture(),
      prepareCutOutCapture: () => this.prepareCutOutCapture(),
      prepareFacingCapture: () => this.prepareFacingCapture(),
      prepareTruckRampCapture: () => this.prepareTruckRampCapture(),
      prepareHandlingCapture: () => this.prepareHandlingCapture(),
      prepareOverviewCapture: () => this.prepareOverviewCapture(),
      prepareHomesteadCapture: () => this.prepareHomesteadCapture(),
      prepareHomesteadAtDefaultZoom: () => this.prepareHomesteadAtDefaultZoom(),
      prepareRoadWideCapture: () => this.prepareRoadWideCapture(),
      prepareHomesteadCloseCapture: () => this.prepareHomesteadCloseCapture(),
      prepareScaleReferenceCapture: () => this.prepareScaleReferenceCapture(),
      v2ArtAudit: () => this.v2ArtAudit(),
      gameFps: () => this.game.loop.actualFps,
      yardCaptureAudit: () => this.yardCaptureAudit(),
      animalDetailText: () => ({
        title: document.getElementById("animal-detail-title")?.textContent ?? "",
        body: document.getElementById("animal-detail-body")?.textContent ?? "",
      }),
      selectedAnimalCount: () => document.querySelectorAll(".animal-row.is-selected").length,
      debugStep3c: () => ({
        head: this.state.herd.headCount,
        animals: this.state.story?.animals?.length ?? 0,
        out: (this.state.story?.animals ?? []).filter((animal) => animal.whereabouts === "escaped" || animal.whereabouts === "neighbour").length,
        heavyTollies: filterAnimals(this.state.story?.animals ?? [], TOLLY_OVER_300).length,
        cutPhase: this.state.story?.cutOut?.phase ?? null,
        cutProgress: this.state.story?.cutOut?.progress ?? null,
        salePhase: this.state.story?.saleConvoy?.phase ?? null,
        captureWhy: this.captureWhy,
        transitPhase: this.state.herd.transit?.phase ?? null,
        transitProgress: this.state.herd.transit?.progress ?? null,
      }),
    };
    const flowBridge = getGameFlow().exposeCaptureApi();
    (window as Window & { __farmCapture?: typeof bridge & Record<string, unknown> }).__farmCapture = {
      ...bridge,
      ...flowBridge,
    };
  }

  update(time: number, delta: number): void {
    if (this.capturePin) this.applyCapturePin();
    this.presentQueuedCard();
    const blocked = this.clockBlocked();
    const driveOn = herdMoveActive(this.state.herd) || Boolean(this.state.story?.returnWalk) || Boolean(this.state.story?.cutOut && this.state.story.cutOut.phase !== "done" && this.state.story.cutOut.phase !== "queued");
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
    if (!this.captureFreezeClock) {
      let catchUp = 0;
      if (this.visibilityCatchMs > 0) {
        catchUp = this.visibilityCatchMs;
        this.visibilityCatchMs = 0;
      }
      const pace = driveOn ? CONFIG.transit.driveClockFactor : 1;
      const tick = tickRanchClock(
        this.state.date,
        this.state.clock,
        (delta + catchUp) * pace,
        blocked,
      );
      this.state.date = tick.date;
      this.bank = tick.bankMs;
      this.state.clock.bankMs = tick.bankMs;
      const timeEl = document.getElementById("stat-time");
      if (timeEl) {
        const dayLength = this.state.clock?.settings.dayLengthSeconds;
        timeEl.textContent = formatClockTime(this.state.date, this.bank, dayLength);
      }
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
    const moveActive = herdMoveActive(this.state.herd) || Boolean(this.state.story?.returnWalk);
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
    const spd = speedMultiplier(this.mode);
    if (!this.captureFreezeClock) {
      tickDrinkingRealtime(this.state, delta, spd);
      tickSaleConvoyRealtime(this.state, delta, spd);
      tickBakkieRealtime(this.state, delta, spd);
      tickCutOutRealtime(this.state, delta, this.mode);
      tickEscapeWanderRealtime(this.state, delta, spd);
    }
    this.showCalmEscapeNote();
    this.syncBakkieVisual();
    this.syncCattleTruckVisual();
    this.placeHerd(time);
    this.placeFarmhand();
    this.placeFarmer();
    this.refreshCampLabelScale();
    this.cullProps();
    this.fadeCoveringTrees();
    this.syncGroundFill();
    this.cullChunks();
    if (this.blades && !this.reduceMotion && !this.paintedSprites) {
      this.blades.rotation += (delta / 1000) * CONFIG.view.windmillRadiansPerSecond;
    }
    this.syncHerdLocator();
    if (this.capturePin) {
      this.applyCapturePin();
      return;
    }
    this.applyPanInertia(delta);
    this.drawRain(time);
    this.drawRing();
  }

  private syncHerdLocator(): void {
    if (this.captureHideStaff) {
      this.hud.setHerdLocator(false, "", "right");
      return;
    }
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
    this.groundFill?.destroy();
    this.groundFill = undefined;
    this.roadDecal?.destroy();
    this.roadDecal = undefined;
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
    if (v2GroundReady(this.textures)) {
      const fillKey = ensureV2GroundFillTexture(this, this.layout);
      if (fillKey) this.groundFill = this.add.tileSprite(0, 0, 64, 64, fillKey).setOrigin(0, 0).setDepth(-2);
      this.roadDecal = renderFarmRoad(this, this.state, this.layout) ?? undefined;
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
    if (v2Ready(this.textures)) {
      const placed = placeV2Props(this, this.state, this.layout);
      this.propSprites.push(...placed.images);
      this.yardBakkie = placed.bakkie;
      if (placed.bakkieParked) this.parkedBakkie = placed.bakkieParked;
      if (placed.homesteadLight) this.homesteadLight = placed.homesteadLight;
      this.workerCottageSprites.push(...placed.cottages);
      for (const cottage of placed.cottages) {
        this.workerCottageLights.push(this.add.graphics().setDepth(cottage.depth - 0.1));
      }
      return;
    }
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
        if (place.key === SPRITE_KEYS.bakkie) {
          this.yardBakkie = image;
          image.setData("featureKind", "bakkie");
          image.setData("tileX", place.tileX);
          image.setData("tileY", place.tileY);
          this.parkedBakkie = { x: footX, y: footY };
        }
        this.propSprites.push(image);
        if (place.key === SPRITE_KEYS.farmhouse) {
          this.homesteadLight = { x: footX, y: footY - tileH * 0.55 };
        }
      }
      for (const place of workerCottagePlacements(this.state.features)) {
        if (!this.textures.exists(place.key)) continue;
        const center = tileCenter(place.tileX, place.tileY, this.layout, tileW, tileH);
        const footX = center.x + place.offsetX;
        const footY = center.y + place.offsetY;
        const image = this.add
          .image(footX, footY, place.key)
          .setOrigin(place.originX, place.originY)
          .setScale(place.scale)
          .setDepth(8.5 + footY * 0.04);
        this.propSprites.push(image);
        this.workerCottageSprites.push(image);
        image.setData("featureKind", "worker_house");
        image.setData("tileX", place.tileX);
        image.setData("tileY", place.tileY);
        const glow = this.add.graphics().setDepth(image.depth - 0.1);
        this.workerCottageLights.push(glow);
      }
      const infraKinds = new Set([
        "windmill",
        "solar_pump",
        "reservoir",
        "trough",
        "lick_feeder",
        "kraal",
        "holding_pen",
        "race",
        "crush",
        "handling_roof",
        "loading_ramp",
      ]);
      for (const feature of this.state.features) {
        if (infraKinds.has(feature.kind)) {
          const def = propSpriteForKind(feature.kind, feature.x, feature.y, feature.scale);
          if (!this.textures.exists(def.key)) continue;
          const center = tileCenter(feature.x, feature.y, this.layout, tileW, tileH);
          const nudge = this.stackedInfraNudge(feature);
          const roofLift = feature.kind === "handling_roof" ? 18 : 0;
          const image = this.add
            .image(center.x + nudge.x, center.y + nudge.y - roofLift, def.key)
            .setOrigin(def.originX, def.originY)
            .setScale(def.scale)
            .setDepth(9 + center.y * 0.04 + (feature.kind === "handling_roof" ? 0.8 : 0));
          image.setData("featureKind", feature.kind);
          image.setData("tileX", feature.x);
          image.setData("tileY", feature.y);
          this.propSprites.push(image);
          continue;
        }
        if (feature.kind === "tree" || feature.kind === "bush") {
          const def = propSpriteForKind(feature.kind, feature.x, feature.y, feature.scale);
          if (!this.textures.exists(def.key)) continue;
          const center = tileCenter(feature.x, feature.y, this.layout, tileW, tileH);
          const image = this.add
            .image(center.x, center.y, def.key)
            .setOrigin(def.originX, def.originY)
            .setScale(def.scale)
            .setDepth(8 + center.y * 0.04);
          image.setData("featureKind", feature.kind);
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
              .setScale(uniformScale(171, TERMITE_HEIGHT_METRES))
              .setDepth(7 + center.y * 0.04);
            this.propSprites.push(termite);
          } else if (maybeRockAt(x, y)) {
            const rock = this.add
              .image(center.x, center.y, SPRITE_KEYS.rockCluster)
              .setOrigin(0.5, 0.88)
              .setScale(uniformScale(160, ROCK_CLUSTER_METRES))
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
        const towerScale = uniformScale(128, WINDMILL_HEIGHT_METRES);
        const tower = this.footImage("tower", center.x, center.y, depth, towerScale);
        this.propSprites.push(tower);
        this.blades = this.add
          .image(center.x, center.y - WINDMILL_AXLE_LIFT * towerScale, "blades")
          .setOrigin(ART_ORIGIN.blades.x, ART_ORIGIN.blades.y)
          .setScale(uniformScale(96, WHEEL_DIAMETER_METRES))
          .setDepth(depth + 0.2);
        this.propSprites.push(this.blades);
        continue;
      }
      let textureKey: string = feature.kind;
      let scale = 1;
      if (feature.kind === "house") scale = uniformScale(152, FARMHOUSE_WIDTH_METRES);
      if (feature.kind === "worker_house") {
        const image = this.add
          .image(center.x, center.y, SPRITE_KEYS.workerHouse)
          .setOrigin(0.5, 0.92)
          .setDepth(depth + 0.3)
          .setScale(uniformScale(128, COTTAGE_WIDTH_METRES));
        this.propSprites.push(image);
        this.workerCottageSprites.push(image);
        continue;
      }
      if (feature.kind === "shed") scale = uniformScale(78, SHED_WIDTH_METRES);
      if (feature.kind === "kraal") scale = uniformScale(136, KRAAL_WIDTH_METRES);
      if (feature.kind === "reservoir") scale = uniformScale(104, RESERVOIR_DIAMETER_METRES);
      if (feature.kind === "trough") scale = uniformScale(48, TROUGH_LENGTH_METRES);
      if (feature.kind === "tree") {
        textureKey = treeDeadAt(feature.x, feature.y) ? "tree-dead" : "tree";
        const jitter = feature.scale > 0 && feature.scale < 3 ? feature.scale : 1;
        scale = uniformScale(108, CAMELTHORN_LARGE_METRES) * jitter;
      } else if (feature.kind === "bush") {
        const jitter = feature.scale > 0 && feature.scale < 3 ? feature.scale : 1;
        scale = uniformScale(44, BUSH_DENSE_METRES) * jitter;
      }
      const image = this.footImage(
        textureKey,
        center.x,
        center.y,
        depth + (feature.kind === "trough" ? 0 : 0.4),
        scale,
      );
      image.setData("featureKind", feature.kind);
      this.propSprites.push(image);
    }

    for (let y = 0; y < this.state.height; y += 1) {
      for (let x = 0; x < this.state.width; x += 1) {
        const id = this.state.campIds[y * this.state.width + x];
        if (id === TILE_HOMESTEAD || id === TILE_OUTSIDE || this.track.has(`${x},${y}`)) continue;
        if (!maybeTermiteAt(x, y)) continue;
        const center = tileCenter(x, y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
        const image = this.footImage("termite", center.x, center.y, 8 + x + y, uniformScale(32, TERMITE_HEIGHT_METRES));
        this.propSprites.push(image);
      }
    }

    const house = this.state.features.find((f) => f.kind === "house");
    if (house) {
      const bakkieCenter = tileCenter(house.x + 2, house.y + 1, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
      const gardenCenter = tileCenter(house.x, house.y + 2, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
      this.yardBakkie = this.footImage("bakkie", bakkieCenter.x, bakkieCenter.y, 12 + house.x + house.y, uniformScale(72, BAKKIE_LENGTH_METRES));
      this.propSprites.push(this.yardBakkie);
      this.bakkieDust = this.add.graphics().setDepth(11);
      this.propSprites.push(this.footImage("garden", gardenCenter.x, gardenCenter.y, 11 + house.x + house.y, uniformScale(56, GARDEN_WIDTH_METRES)));
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
        .setScale(this.paintedSprites ? cattleDisplayScale() : uniformScale(52, COW_LENGTH_METRES));
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
    const herdCamp = this.state.herd.campId;
    this.fenceGates.forEach((gate) => gate.destroy());
    this.fenceGates = [];
    const segments = collectFenceSegments(this.state, this.layout, herdCamp, this.selected);
    if (v2Ready(this.textures)) {
      const sig = `${segments.length}:${herdCamp}:${this.selected ? 1 : 0}`;
      if (sig === this.fenceSig) return;
      this.fenceSig = sig;
      this.fenceArt.forEach((sprite) => sprite.destroy());
      this.fenceArt = placeV2Fences(this, segments);
      this.fences.clear();
      return;
    }
    drawFences(this.fences, segments, this.cameras.main.zoom);
    this.fenceGates = placeGateSprites(this, segments, this.paintedSprites);
  }

  private syncHerdFromSim(): void {
    const tile = this.captureHerdTile ?? herdWorldTile(this.state);
    const point = tileCenter(tile.x, tile.y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
    this.herdVisual.x = point.x;
    this.herdVisual.y = point.y;
    this.refreshHerdLabel();
  }

  private mobCenter(): { x: number; y: number } {
    return this.averageOffsets(this.herdOffsets);
  }

  /** Centre of the animals that are actually walking the route. */
  private movingMobCenter(): { x: number; y: number } {
    const moving = this.herdOffsets.filter((offset) => offset.moving);
    return this.averageOffsets(moving.length > 0 ? moving : this.herdOffsets);
  }

  private averageOffsets(offsets: HerdOffset[]): { x: number; y: number } {
    if (offsets.length === 0) return { x: this.herdVisual.x, y: this.herdVisual.y };
    let x = 0;
    let y = 0;
    for (const offset of offsets) {
      x += offset.x;
      y += offset.y;
    }
    return {
      x: this.herdVisual.x + x / offsets.length,
      y: this.herdVisual.y + y / offsets.length,
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
    return personDisplayPx() / FARMHAND_TEXTURE_HEIGHT;
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
    const v2Person = v2Ready(this.textures) ? personPose(role, dx || 0.2, dy || 0.2, moving) : null;
    if (v2Person && this.textures.exists(v2Person.key)) {
      sprite.setTexture(v2Person.key);
      sprite.setOrigin(v2Person.originX, v2Person.originY);
      sprite.setScale(v2Person.scale);
    } else {
      const dir = inferPersonDir(dx || 0, dy || 0.01);
      const frame = moving ? Math.floor(performance.now() / 180) % 2 : 0;
      const tex = personTextureKey(role, dir, frame);
      if (this.textures.exists(tex)) sprite.setTexture(tex);
      sprite.setScale(scale);
    }
    sprite.setPosition(foot.x, foot.y + bob);
    sprite.setDepth(8 + foot.y * 0.04 + 0.45);
    lastPos.x = foot.x;
    lastPos.y = foot.y;
    return { x: foot.x, y: foot.y, bob, scale };
  }

  private farmerTargetScale(): number {
    return personDisplayPx() / FARMHAND_TEXTURE_HEIGHT;
  }

  private placeFarmer(): void {
    if (this.captureHideStaff) {
      this.farmerSprite?.setVisible(false);
      this.farmerNameTag?.setVisible(false);
      return;
    }
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

  private herdRearFoot(): { x: number; y: number } {
    const transit = this.state.herd.transit;
    if (!transit || transit.path.length < 2) return this.mobCenter();
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const rear = pointOnPath(transit.path, herdRearPathProgress(this.state));
    return tileCenter(rear.x, rear.y, this.layout, tileW, tileH);
  }

  private herderHerdScreenDistancePx(): number {
    const herd = this.herdRearFoot();
    const sprite = this.herderSpriteForTransit();
    if (!sprite?.visible) return 9999;
    return Math.hypot(sprite.x - herd.x, sprite.y - herd.y) * this.cameras.main.zoom;
  }

  private herderBehindHerdOnDrive(): boolean {
    const transit = this.state.herd.transit;
    if (!transit || transit.phase !== "drive") return false;
    const trail = herderPathProgressBehindTail(this.state);
    if (trail >= transit.progress - 0.02) return false;
    const presence = this.state.story?.farmerPresence;
    if (!presence) return false;
    const expected = pointOnPath(transit.path, trail);
    return Math.hypot(presence.tileX - expected.x, presence.tileY - expected.y) <= 0.65;
  }

  private workerHouseInView(): boolean {
    return this.workerCottageSpriteBoundsInView();
  }

  private appendMissingWorkerCottages(): void {
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const placed = new Set(
      this.workerCottageSprites.map((s) => `${Math.round(s.x)}_${Math.round(s.y)}`),
    );
    for (const place of workerCottagePlacements(this.state.features)) {
      const center = tileCenter(place.tileX, place.tileY, this.layout, tileW, tileH);
      const footX = center.x + place.offsetX;
      const footY = center.y + place.offsetY;
      const key = `${Math.round(footX)}_${Math.round(footY)}`;
      if (placed.has(key)) continue;
      if (!this.textures.exists(place.key)) continue;
      const image = this.add
        .image(footX, footY, place.key)
        .setOrigin(place.originX, place.originY)
        .setScale(place.scale)
        .setDepth(8.5 + footY * 0.04);
      this.propSprites.push(image);
      this.workerCottageSprites.push(image);
      const glow = this.add.graphics().setDepth(image.depth - 0.1);
      this.workerCottageLights.push(glow);
      placed.add(key);
    }
  }

  private workerCottageSpriteBoundsInView(): boolean {
    const view = this.cameras.main.worldView;
    const pad = 4;
    for (const sprite of this.workerCottageSprites) {
      if (!sprite.visible) continue;
      const bounds = sprite.getBounds();
      const inView =
        bounds.right >= view.x - pad &&
        bounds.left <= view.right + pad &&
        bounds.bottom >= view.y - pad &&
        bounds.top <= view.bottom + pad;
      if (inView && bounds.width > 8 && bounds.height > 8) return true;
    }
    return false;
  }

  private nightWorkersCaptureMeta(): { hour: number; workerAtHome: boolean; workerHouseVisible: boolean } {
    return {
      hour: this.state.date.hour,
      workerAtHome: workerAtHomeAtNight(this.state),
      workerHouseVisible: this.workerHouseInView(),
    };
  }

  private screenHeightOf(sprite: Phaser.GameObjects.Image): number {
    return sprite.displayHeight * this.cameras.main.zoom;
  }

  private spriteInView(sprite: Phaser.GameObjects.Image): boolean {
    const view = this.cameras.main.worldView;
    const b = sprite.getBounds();
    return b.right >= view.x && b.left <= view.right && b.bottom >= view.y && b.top <= view.bottom;
  }

  /** Sprites tagged with featureKind, measured in screen pixels. */
  private auditKind(kind: string): { count: number; inView: number; maxScreenPx: number } {
    const sprites: Phaser.GameObjects.Image[] = [];
    for (const sprite of this.propSprites) {
      if (sprite.getData("featureKind") === kind || sprite.getData("alsoKind") === kind) sprites.push(sprite);
    }
    if (kind === "cattle_truck" && this.cattleTruck) sprites.push(this.cattleTruck);
    if (kind === "bakkie" && this.yardBakkie && !sprites.includes(this.yardBakkie)) sprites.push(this.yardBakkie);
    let inView = 0;
    let maxScreenPx = 0;
    for (const sprite of sprites) {
      if (!sprite.visible || !this.spriteInView(sprite)) continue;
      inView += 1;
      maxScreenPx = Math.max(maxScreenPx, this.screenHeightOf(sprite));
    }
    return { count: sprites.length, inView, maxScreenPx };
  }

  private frameTiles(tiles: { x: number; y: number }[], zoom: number): void {
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    let sx = 0;
    let sy = 0;
    for (const tile of tiles) {
      const p = tileCenter(tile.x, tile.y, this.layout, tileW, tileH);
      sx += p.x;
      sy += p.y;
    }
    const n = Math.max(1, tiles.length);
    this.pinCapture(sx / n, sy / n, zoom);
  }

  /** Fit a cluster in the clear band, then pin the camera so the next tick does not drift. */
  private frameFeatureCluster(
    tiles: { x: number; y: number }[],
    pad: { x: number; top: number; bottom: number },
    maxZoom: number,
  ): void {
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const tile of tiles) {
      const p = tileCenter(tile.x, tile.y, this.layout, tileW, tileH);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    minX -= pad.x;
    maxX += pad.x;
    minY -= pad.top;
    maxY += pad.bottom;
    const camera = this.cameras.main;
    const insets = viewportCameraInsets();
    const contentW = Math.max(80, camera.width - insets.left - insets.right);
    const contentH = Math.max(80, camera.height - insets.top - insets.bottom);
    const spanW = Math.max(48, maxX - minX);
    const spanH = Math.max(48, maxY - minY);
    const fit = Math.min(contentW / spanW, contentH / spanH);
    const zoom = clampZoom(Math.min(fit, maxZoom), this.minZoom, Math.max(this.maxZoom, maxZoom));
    this.pinCapture((minX + maxX) / 2, (minY + maxY) / 2, zoom);
  }

  private pinCapture(x: number, y: number, zoom: number): void {
    const z = clampZoom(zoom, this.minZoom, Math.max(this.maxZoom, zoom));
    this.capturePin = { x, y, zoom: z };
    this.panVel = null;
    this.applyCapturePin();
  }

  /** Keep a capture frame in the clear band. Phaser scroll is not the top-left of the view. */
  private applyCapturePin(): void {
    const pin = this.capturePin;
    if (!pin) return;
    const camera = this.cameras.main;
    const insets = viewportCameraInsets();
    const contentW = Math.max(80, camera.width - insets.left - insets.right);
    const contentH = Math.max(80, camera.height - insets.top - insets.bottom);
    const screenX = insets.left + contentW / 2;
    const screenY = insets.top + contentH / 2;
    camera.setZoom(pin.zoom);
    camera.scrollX = scrollXForWorldAtScreenX(pin.x, camera.width, pin.zoom, screenX);
    camera.scrollY = scrollYForWorldAtScreenY(pin.y, camera.height, pin.zoom, screenY);
    camera.preRender();
  }

  private setCampLabelsShown(shown: boolean): void {
    for (const label of this.campLabels.values()) label.setVisible(shown);
  }

  /** Shift a trough or lick that shares a tile with its pump so both sprites read. */
  private stackedInfraNudge(feature: { kind: string; x: number; y: number }): { x: number; y: number } {
    if (feature.kind !== "trough" && feature.kind !== "lick_feeder") return { x: 0, y: 0 };
    const stacked = this.state.features.some(
      (other) =>
        other.x === feature.x &&
        other.y === feature.y &&
        (other.kind === "windmill" || other.kind === "solar_pump"),
    );
    if (!stacked) return { x: 0, y: 0 };
    return feature.kind === "trough" ? { x: 30, y: 18 } : { x: -28, y: 14 };
  }

  private clearLogisticsForCapture(): void {
    this.captureHerdTile = null;
    this.captureDrinkHeads = 0;
    this.captureKraalLineup = false;
    this.capturePin = null;
    this.panVel = null;
    this.captureHideHerdLabel = false;
    this.captureHideStaff = false;
    this.setCampLabelsShown(true);
    if (this.state.story?.saleConvoy) this.state.story.saleConvoy.phase = "done";
    if (this.state.story?.bakkieRun) this.state.story.bakkieRun.active = false;
    this.cattleTruck?.setVisible(false);
    this.syncBakkieVisual();
  }

  private prepareDrinkingCapture(): boolean {
    this.clearLogisticsForCapture();
    const inCampPoint = (w: { trough: { x: number; y: number }; pump: string; reservoir: boolean }) => {
      const id = this.state.campIds[w.trough.y * this.state.width + w.trough.x];
      return w.reservoir && id >= 0;
    };
    const wp =
      (this.state.farmWaterPoints ?? []).find((w) => w.pump === "windmill" && inCampPoint(w)) ??
      (this.state.farmWaterPoints ?? []).find((w) => inCampPoint(w));
    const trough = wp?.trough ?? this.state.features.find((f) => f.kind === "trough");
    if (!trough || !this.state.story) return false;
    if (!this.state.story.drinkingTrip) {
      this.state.story.drinkingTrip = {
        active: true,
        troughTile: { x: trough.x, y: trough.y },
        walkProgress: 1,
        drinkingTicks: 3,
        cowsAtTrough: 3,
        lastSatisfiedDayKey: "",
      };
    }
    const trip = this.state.story.drinkingTrip;
    trip.active = true;
    trip.walkProgress = 1;
    trip.drinkingTicks = 3;
    trip.cowsAtTrough = 3;
    trip.troughTile = { x: trough.x, y: trough.y };
    this.captureDrinkHeads = 3;
    this.captureHideHerdLabel = true;
    const campId = this.state.campIds[trough.y * this.state.width + trough.x];
    if (campId >= 0) this.state.herd.campId = campId;
    this.captureHerdTile = { x: trough.x, y: trough.y };
    const cluster = this.state.features.filter(
      (feature) =>
        (feature.kind === "windmill" ||
          feature.kind === "reservoir" ||
          feature.kind === "trough" ||
          feature.kind === "lick_feeder" ||
          feature.kind === "solar_pump") &&
        Math.hypot(feature.x - trough.x, feature.y - trough.y) <= 2,
    );
    const framed = cluster.length > 0 ? cluster : [trough];
    this.frameFeatureCluster(framed, { x: 72, top: 96, bottom: 48 }, 1.8);
    this.syncHerdFromSim();
    this.placeHerd(performance.now());
    this.cullProps();
    return herdDrinkingAtTrough(this.state);
  }

  private preparePickerWaterCapture(): boolean {
    return this.prepareDrinkingCapture();
  }

  private prepareNoWaterCampCapture(): boolean {
    this.clearLogisticsForCapture();
    const campId = 16;
    this.state.farmWaterPoints = (this.state.farmWaterPoints ?? []).map((w) => ({
      ...w,
      servedCampIds: w.servedCampIds.filter((id) => id !== campId),
    }));
    const camp = this.state.camps.find((c) => c.id === campId);
    if (!camp || campHasWaterAccess(this.state, camp)) return false;
    this.syncHud();
    this.refreshCampLabels();
    const labelTile = campLabelTile(this.state, camp);
    this.frameTiles([labelTile, camp.anchor], 1.05);
    const label = this.campLabels.get(campId);
    return Boolean(label && label.text.includes("No water") && label.visible);
  }

  private prepareSaleKraalCapture(): boolean {
    this.clearLogisticsForCapture();
    const kraal =
      this.state.features.find((f) => f.kind === "holding_pen") ??
      this.state.features.find((f) => f.kind === "kraal");
    const ramp = this.state.features.find((f) => f.kind === "loading_ramp");
    const crush = this.state.features.find((f) => f.kind === "crush");
    if (!kraal || !ramp || !crush || !this.state.story) return false;
    const q = quoteSale(this.state, "tolly", 3, "auction");
    if ("reason" in q) return false;
    beginSaleConvoy(this.state, "tolly", 3, "auction", q);
    if (this.state.story.saleConvoy) {
      this.state.story.saleConvoy.phase = "loading";
      this.state.story.saleConvoy.phaseProgress = 0.2;
      this.state.story.saleConvoy.paid = false;
    }
    this.captureHerdTile = { x: kraal.x, y: kraal.y };
    this.captureKraalLineup = true;
    this.captureHideHerdLabel = true;
    this.syncCattleTruckVisual();
    this.syncHerdFromSim();
    this.placeHerd(performance.now());
    const yardKinds = new Set(["holding_pen", "race", "crush", "handling_roof", "loading_ramp", "kraal"]);
    const tiles = this.state.features.filter((feature) => yardKinds.has(feature.kind));
    const bay = truckParkTile(this.state);
    if (bay) tiles.push({ kind: "track", x: bay.x, y: bay.y, scale: 1 });
    this.frameFeatureCluster(tiles.length > 0 ? tiles : [kraal], { x: 110, top: 100, bottom: 48 }, 1.45);
    this.cullProps();
    return saleConvoyActive(this.state) && saleTruckVisible(this.state);
  }

  private prepareTruckLeavingCapture(): boolean {
    if (!this.state.story?.saleConvoy || this.state.story.saleConvoy.phase === "done") {
      this.prepareSaleKraalCapture();
    }
    if (this.state.story?.saleConvoy) {
      this.state.story.saleConvoy.phase = "truck_depart";
      this.state.story.saleConvoy.phaseProgress = 0.72;
      this.state.story.saleConvoy.paid = false;
    }
    this.captureHerdTile = null;
    this.captureKraalLineup = false;
    this.setCampLabelsShown(false);
    this.syncCattleTruckVisual();
    const tile = this.cattleTruck?.getData("tileX")
      ? { x: this.cattleTruck.getData("tileX") as number, y: this.cattleTruck.getData("tileY") as number }
      : tileAlongRoad(this.state, 10);
    this.frameTiles([tile], 1.2);
    this.cullProps();
    return saleTruckDeparting(this.state);
  }

  private prepareBakkieDustCapture(): boolean {
    this.clearLogisticsForCapture();
    hireFarmhand(this.state);
    setWorkPriority(this.state, "fill_lick", 3);
    maybeStartBakkieRun(this.state, "fill_lick");
    const run = this.state.story?.bakkieRun;
    if (run) run.progress = 0.55;
    this.syncBakkieVisual();
    const tile = {
      x: (this.yardBakkie?.getData("tileX") as number) ?? 14,
      y: (this.yardBakkie?.getData("tileY") as number) ?? 24,
    };
    const house = this.state.features.find((f) => f.kind === "house");
    if (house && Math.hypot(tile.x - house.x, tile.y - house.y) < 3) return false;
    this.setCampLabelsShown(false);
    this.frameTiles([tile], 1.65);
    this.cullProps();
    return bakkieOnRoad(this.state);
  }

  private truckOnRoad(): { awayTiles: number; screenPx: number } {
    const ramp = this.state.features.find((f) => f.kind === "loading_ramp");
    const tx = (this.cattleTruck?.getData("tileX") as number) ?? 0;
    const ty = (this.cattleTruck?.getData("tileY") as number) ?? 0;
    const away = ramp ? Math.hypot(tx - ramp.x, ty - ramp.y) : 0;
    const screenPx = this.cattleTruck?.visible ? this.screenHeightOf(this.cattleTruck) : 0;
    return { awayTiles: away, screenPx };
  }

  private bakkieOnTrack(): { tilesFromHouse: number; screenPx: number; dust: boolean } {
    const house = this.state.features.find((f) => f.kind === "house");
    const tx = (this.yardBakkie?.getData("tileX") as number) ?? house?.x ?? 0;
    const ty = (this.yardBakkie?.getData("tileY") as number) ?? house?.y ?? 0;
    const tilesFromHouse = house ? Math.hypot(tx - house.x, ty - house.y) : 0;
    const screenPx = this.yardBakkie?.visible ? this.screenHeightOf(this.yardBakkie) : 0;
    const dust = Boolean(this.bakkieDust?.getData("active"));
    return { tilesFromHouse, screenPx, dust };
  }

  private drinkDebug(): unknown {
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const troughs = this.state.features.filter((f) => f.kind === "trough");
    return {
      heads: this.captureDrinkHeads,
      trip: this.state.story?.drinkingTrip?.troughTile ?? null,
      zoom: this.cameras.main.zoom,
      cows: this.cows.slice(0, 4).map((cow) => {
        const tile = worldToTile(cow.x, cow.y, this.layout, tileW, tileH);
        const near = troughs.some((t) => Math.hypot(tile.x - t.x, tile.y - t.y) <= 2);
        return {
          visible: cow.visible,
          pose: cow.getData("pose"),
          tile,
          near,
          inView: this.spriteInView(cow),
          px: Math.round(this.screenHeightOf(cow)),
        };
      }),
    };
  }

  private drinkCowsNearTrough(): number {
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const troughs = this.state.features.filter((f) => f.kind === "trough");
    let count = 0;
    for (const cow of this.cows) {
      if (!cow.visible || cow.getData("pose") !== "drink") continue;
      const tile = worldToTile(cow.x, cow.y, this.layout, tileW, tileH);
      const near = troughs.some((t) => Math.hypot(tile.x - t.x, tile.y - t.y) <= 2);
      if (near && this.spriteInView(cow) && this.screenHeightOf(cow) >= 20) count += 1;
    }
    return count;
  }

  private frameHomesteadWithWorkerHouse(): boolean {
    this.clearLogisticsForCapture();
    this.panVel = null;
    const house = this.state.features.find((f) => f.kind === "house");
    const cottage = this.propSprites.find((sprite) => sprite.getData("featureKind") === "worker_house");
    if (!house || !cottage) return false;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const main = tileCenter(house.x, house.y, this.layout, tileW, tileH);
    const midX = (main.x + cottage.x) / 2;
    const midY = (main.y + cottage.y) / 2 - 12;
    const camera = this.cameras.main;
    const insets = viewportCameraInsets();
    const contentW = Math.max(80, camera.width - insets.left - insets.right);
    const contentH = Math.max(80, camera.height - insets.top - insets.bottom);
    const span = Math.max(Math.abs(main.x - cottage.x), Math.abs(main.y - cottage.y), 140);
    const zoom = clampZoom((Math.min(contentW, contentH) * 0.62) / span, this.minZoom, this.maxZoom);
    camera.setZoom(zoom);
    this.capturePin = { x: midX, y: midY, zoom };
    camera.scrollX = midX - (insets.left + contentW / 2) / zoom;
    camera.scrollY = midY - (insets.top + contentH / 2) / zoom;
    camera.preRender();
    this.placeFarmer();
    this.cullProps();
    cottage.setVisible(true);
    const seen = this.auditKind("worker_house");
    const farmerH = this.farmerSprite?.visible ? this.screenHeightOf(this.farmerSprite) : 0;
    return seen.inView >= 1 && seen.maxScreenPx >= 20 && this.countFarmerInView() >= 1 && farmerH >= 24;
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

  private namedSpritesInView(role: string): { count: number; maxScreenPx: number; octants: number[]; textureKeys: string[] } {
    const camera = this.cameras.main;
    const view = camera.worldView;
    const sprites: Phaser.GameObjects.Image[] = [];
    if (role === "cattle-truck" && this.cattleTruck?.visible) sprites.push(this.cattleTruck);
    else {
      for (const cow of this.cows) {
        if (!cow.visible) continue;
        if (cow.getData("captureRole") === role || cow.name === role) sprites.push(cow);
      }
    }
    let count = 0;
    let maxScreenPx = 0;
    const octants = new Set<number>();
    for (const sprite of sprites) {
      if (sprite.x < view.x || sprite.x > view.right || sprite.y < view.y || sprite.y > view.bottom) continue;
      count += 1;
      maxScreenPx = Math.max(maxScreenPx, sprite.displayHeight * camera.zoom);
      const octant = sprite.getData("octant");
      if (typeof octant === "number") octants.add(octant);
    }
    const textureKeys = [...new Set(sprites.filter((sprite) => sprite.x >= view.x && sprite.x <= view.right && sprite.y >= view.y && sprite.y <= view.bottom).map((sprite) => sprite.texture.key))];
    return { count, maxScreenPx, octants: [...octants], textureKeys };
  }

  private pictureAudit(): {
    overlapFraction: number;
    herdOverlapFraction: number;
    herdCoversHomestead: boolean;
    cowCount: number;
    herdCount: number;
  } {
    const bodyOf = (sprite: Phaser.GameObjects.Image) => {
      const w = Math.max(8, sprite.displayWidth * 0.42);
      const h = Math.max(8, sprite.displayHeight * 0.36);
      return { x: sprite.x - w * 0.5, y: sprite.y - h * 0.78, w, h };
    };
    const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const fraction = (sprites: Phaser.GameObjects.Image[]) => {
      const bodies = sprites.map(bodyOf);
      const hit = new Set<number>();
      for (let i = 0; i < bodies.length; i += 1) {
        for (let j = i + 1; j < bodies.length; j += 1) {
          if (!overlaps(bodies[i], bodies[j])) continue;
          hit.add(i);
          hit.add(j);
        }
      }
      return bodies.length === 0 ? 0 : hit.size / bodies.length;
    };
    const camera = this.cameras.main;
    const view = camera.worldView;
    const inShot = (sprite: Phaser.GameObjects.Image) =>
      sprite.visible && sprite.x >= view.x && sprite.x <= view.right && sprite.y >= view.y && sprite.y <= view.bottom;
    const visibleCows = this.cows.filter((cow) => inShot(cow) && typeof cow.getData("captureRole") === "string");
    const herd = this.cows.filter((cow) => cow.getData("captureRole") === "herd-animal");
    const house =
      this.propSprites.find((sprite) => sprite.texture.key === SPRITE_KEYS.farmhouse) ??
      this.propSprites.find((sprite) => sprite.getData("featureKind") === "house");
    const cottage = this.workerCottageSprites[0];
    const yard = [house, cottage].filter((sprite): sprite is Phaser.GameObjects.Image => Boolean(sprite));
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const cow of herd) {
      minX = Math.min(minX, cow.x);
      maxX = Math.max(maxX, cow.x);
      minY = Math.min(minY, cow.y);
      maxY = Math.max(maxY, cow.y);
    }
    const herdCoversHomestead = yard.some(
      (building) => building.x >= minX && building.x <= maxX && building.y >= minY && building.y <= maxY,
    );
    return {
      overlapFraction: fraction(visibleCows),
      herdOverlapFraction: fraction(herd),
      herdCoversHomestead,
      cowCount: visibleCows.length,
      herdCount: herd.length,
    };
  }

  private frameWorldPoints(points: { x: number; y: number }[], fill = 0.5, uncapped = false): void {
    if (points.length === 0) return;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    const camera = this.cameras.main;
    const span = Math.max(maxX - minX, (maxY - minY) * 1.4, 96);
    const raw = (Math.min(camera.width, camera.height) * fill) / span;
    const zoom = uncapped ? clamp(raw, this.minZoom, 4) : clampZoom(raw, this.minZoom, this.maxZoom);
    camera.setZoom(zoom);
    this.pinCapture((minX + maxX) / 2, (minY + maxY) / 2, zoom);
    camera.preRender();
  }

  private expandHerdSheet(): void {
    const sheet = document.getElementById("herd-sheet");
    if (sheet?.dataset.expanded === "true") return;
    document.getElementById("sheet-summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  private collapseHerdSheet(): void {
    const sheet = document.getElementById("herd-sheet");
    if (sheet?.dataset.expanded !== "true") return;
    document.getElementById("sheet-summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  private prepareEscapeCapture(): boolean {
    const story = this.state.story;
    if (!story?.animals?.length) return false;
    this.state.date.hour = 10;
    this.captureLightingHour = 10;
    this.collapseHerdSheet();
    const animal = story.animals.find((item) => item.whereabouts === "in_camp" && item.stockClass !== "calf");
    if (!animal || !startEscape(this.state, animal, 3)) return false;
    tickEscapeWanderRealtime(this.state, 1200, 1);
    this.placeIndividualAnimals(performance.now());
    const cow = this.cows.find((sprite) => sprite.getData("animalTag") === animal.tag);
    if (!cow) return false;
    const camp = this.state.camps.find((item) => item.id === animal.campId);
    const outside =
      camp !== undefined && !camp.tiles.some((tile) => tile.x === Math.round(animal.tileX) && tile.y === Math.round(animal.tileY));
    const fence = collectFenceSegments(this.state, this.layout, animal.campId, false);
    let nearFence: { x: number; y: number } | null = null;
    let nearDist = Number.POSITIVE_INFINITY;
    for (const segment of fence) {
      const point = { x: (segment.x1 + segment.x2) / 2, y: (segment.y1 + segment.y2) / 2 };
      const dist = Math.hypot(point.x - cow.x, point.y - cow.y);
      if (dist < nearDist) {
        nearDist = dist;
        nearFence = point;
      }
    }
    const framed = nearFence ? [{ x: cow.x, y: cow.y }, nearFence] : [{ x: cow.x, y: cow.y }];
    this.frameWorldPoints(framed, 0.62);
    this.placeIndividualAnimals(performance.now());
    const seen = this.namedSpritesInView("escaped-animal");
    return outside && seen.count >= 1 && seen.maxScreenPx >= 18;
  }

  private prepareAnimalDetailCapture(): boolean {
    const animal =
      this.state.story?.animals?.find((item) => item.whereabouts === "in_camp" && !item.split) ??
      this.state.story?.animals?.find((item) => item.whereabouts !== "sold");
    if (!animal) return false;
    this.selected = true;
    if (this.state.story) {
      this.state.story.focusedAnimalId = animal.id;
      this.state.story.selectedAnimalIds = [animal.id];
    }
    this.syncHud();
    this.expandHerdSheet();
    this.syncHud();
    this.hud.clearHint();
    const sheet = document.getElementById("sheet-detail");
    if (sheet) sheet.scrollTop = 0;
    this.placeIndividualAnimals(performance.now());
    const cow = this.cows.find((sprite) => sprite.getData("animalTag") === animal.tag);
    if (cow) this.frameWorldPoints([{ x: cow.x, y: cow.y }], 0.38);
    this.placeIndividualAnimals(performance.now());
    const title = document.getElementById("animal-detail-title")?.textContent ?? "";
    const body = document.getElementById("animal-detail-body")?.textContent ?? "";
    const clean = !/\b(id|campId|stockClass)\b/i.test(`${title} ${body}`);
    const role = cow?.getData("captureRole");
    const seen = this.namedSpritesInView(typeof role === "string" ? role : "herd-animal");
    return title.startsWith("Tag ") && body.length > 8 && clean && seen.count >= 1 && seen.maxScreenPx >= 16;
  }

  private prepareMultiSelectCapture(): boolean {
    const story = this.state.story;
    if (!story?.animals) return false;
    const matched = filterAnimals(story.animals, TOLLY_OVER_300).filter((animal) => animal.whereabouts === "in_camp");
    if (matched.length < 2) return false;
    this.selected = true;
    this.syncHud();
    this.expandHerdSheet();
    document.getElementById("animal-filter-tolly300")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    this.hud.clearHint();
    const sheet = document.getElementById("sheet-detail");
    if (sheet) sheet.scrollTop = 0;
    this.placeIndividualAnimals(performance.now());
    const cows = this.cows
      .filter((sprite) => matched.some((animal) => animal.tag === sprite.getData("animalTag")))
      .slice(0, 6);
    this.frameWorldPoints(cows.map((sprite) => ({ x: sprite.x, y: sprite.y })), 0.62);
    this.placeIndividualAnimals(performance.now());
    const rows = document.querySelectorAll(".animal-row.is-selected").length;
    return rows >= 2 && this.namedSpritesInView("herd-animal").count >= 2;
  }

  private prepareCutOutCapture(): boolean {
    const story = this.state.story;
    if (!story) return false;
    hireFarmhand(this.state);
    ensurePeopleState(this.state);
    if (!story.workGrid) story.workGrid = defaultWorkGrid();
    story.workGrid.move_herd_help = 3;
    this.state.date.hour = 10;
    this.captureLightingHour = 10;
    this.collapseHerdSheet();
    this.hud.clearHint();
    clearHerdTransit(this.state);
    releaseCutOutAnimals(this.state);
    const group = filterAnimals(story.animals ?? [], TOLLY_OVER_300).slice(0, 6);
    const use = group.length >= 3 ? group : (story.animals ?? []).filter((animal) => animal.whereabouts === "in_camp").slice(0, 6);
    if (use.length < 3) return false;
    const dest = this.state.camps.find((camp) => camp.id !== this.state.herd.campId);
    if (!dest) return false;
    story.selectedAnimalIds = use.map((animal) => animal.id);
    const result = requestCutOut(this.state, story.selectedAnimalIds, { kind: "camp", campId: dest.id });
    if (!result.ok || result.queued) return false;
    let guard = 0;
    while (guard < 120000 && story.cutOut && story.cutOut.phase !== "drive") {
      tickCutOutRealtime(this.state, 48, "x3");
      guard += 48;
    }
    if (story.cutOut?.phase !== "drive") return false;
    while (guard < 180000 && story.cutOut && story.cutOut.progress < 0.42) {
      tickCutOutRealtime(this.state, 48, "x3");
      guard += 48;
    }
    this.placeIndividualAnimals(performance.now());
    this.placeFarmhand();
    this.placeFarmer();
    const cows = this.cows.filter((sprite) => sprite.getData("captureRole") === "cut-out-animal" && sprite.visible);
    const herder = story.cutOut.herder === "piet" ? this.farmhandSprite : this.farmerSprite;
    const points = cows.map((sprite) => ({ x: sprite.x, y: sprite.y }));
    if (herder) points.push({ x: herder.x, y: herder.y });
    this.frameWorldPoints(points, 0.72, true);
    this.placeIndividualAnimals(performance.now());
    this.placeFarmhand();
    this.placeFarmer();
    const seen = this.namedSpritesInView("cut-out-animal");
    const behind = cutOutHerderProgress(this.state) <= cutOutRearProgress(this.state) + 0.001;
    const workerSeen = story.cutOut.herder === "piet" ? this.countFarmhandInView() >= 1 : this.countFarmerInView() >= 1;
    return seen.count >= 3 && seen.maxScreenPx >= 16 && behind && workerSeen && (story.cutOut.progress ?? 0) > 0.05;
  }

  private prepareFacingCapture(): boolean {
    const story = this.state.story;
    if (!story?.animals) return false;
    this.state.date.hour = 11;
    this.captureLightingHour = 11;
    this.collapseHerdSheet();
    this.hud.clearHint();
    clearHerdTransit(this.state);
    releaseCutOutAnimals(this.state);
    const destId = this.pickCornerHerdDestination();
    const group = story.animals.filter((animal) => animal.whereabouts === "in_camp" && !animal.split && animal.stockClass !== "calf").slice(0, 8);
    if (destId === null || group.length < 8) return false;
    story.selectedAnimalIds = group.map((animal) => animal.id);
    const result = requestCutOut(this.state, story.selectedAnimalIds, { kind: "camp", campId: destId });
    if (!result.ok || result.queued) return false;
    const bend = this.cornerProgress(story.cutOut?.path ?? []);
    let guard = 0;
    while (guard < 220000 && story.cutOut && story.cutOut.phase !== "done") {
      tickCutOutRealtime(this.state, 40, "x3");
      guard += 40;
      const order = story.cutOut;
      if (!order || order.phase !== "drive") continue;
      if (bend !== null && Math.abs(order.progress - bend) > 0.04) {
        if (order.progress > bend + 0.06) break;
        continue;
      }
      if (order.progress < 0.18 || order.progress > 0.8) continue;
      this.placeIndividualAnimals(performance.now());
      const ordered = this.cutOutSpritesInOrder();
      if (ordered.length < 6) continue;
      const framed = ordered;
      if (new Set(framed.map((cow) => cow.getData("octant"))).size < 3) continue;
      this.placeFarmhand();
      this.placeFarmer();
      const herder = story.cutOut?.herder === "piet" ? this.farmhandSprite : this.farmerSprite;
      const points = framed.map((sprite) => ({ x: sprite.x, y: sprite.y }));
      if (herder?.visible) points.push({ x: herder.x, y: herder.y });
      this.frameWorldPoints(points, 0.78);
      this.placeIndividualAnimals(performance.now());
      this.placeFarmhand();
      this.placeFarmer();
      const seen = this.namedSpritesInView("cut-out-animal");
      const workerPx = Math.max(this.farmhandScreenHeightPx(), this.farmerSprite?.visible ? this.farmerSprite.displayHeight * this.cameras.main.zoom : 0);
      const workerIn = story.cutOut?.herder === "piet" ? this.countFarmhandInView() >= 1 : this.countFarmerInView() >= 1;
      if (seen.octants.length >= 3 && seen.count >= 4 && seen.maxScreenPx >= 16 && workerIn && workerPx >= 22) {
        this.collapseHerdSheet();
        this.hud.clearHint();
        return true;
      }
    }
    return false;
  }

  private cornerProgress(path: { x: number; y: number }[]): number | null {
    if (path.length < 6) return null;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const octants: number[] = [];
    for (let index = 1; index < path.length; index += 1) {
      const from = tileCenter(path[index - 1].x, path[index - 1].y, this.layout, tileW, tileH);
      const to = tileCenter(path[index].x, path[index].y, this.layout, tileW, tileH);
      octants.push(cowOctantFromScreen(to.x - from.x, to.y - from.y));
    }
    let bestLength = 99;
    let bestProgress: number | null = null;
    for (let length = 3; length <= 10; length += 1) {
      for (let index = 0; index + length <= octants.length; index += 1) {
        if (new Set(octants.slice(index, index + length)).size < 3) continue;
        const progress = (index + length / 2) / path.length;
        if (progress < 0.4 || progress > 0.72) continue;
        if (length < bestLength) {
          bestLength = length;
          bestProgress = progress;
        }
      }
    }
    return bestProgress;
  }

  private cutOutSpritesInOrder(): Phaser.GameObjects.Image[] {
    const ids = this.state.story?.cutOut?.animalIds ?? [];
    const animals = this.state.story?.animals ?? [];
    const sprites: Phaser.GameObjects.Image[] = [];
    for (const id of ids) {
      const animal = animals.find((item) => item.id === id);
      if (!animal) continue;
      const sprite = this.cows.find((cow) => cow.visible && cow.getData("animalTag") === animal.tag);
      if (sprite) sprites.push(sprite);
    }
    return sprites;
  }

  private pickCornerHerdDestination(): number | null {
    let bestId: number | null = null;
    let bestScore = -1;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    for (const camp of this.state.camps) {
      if (camp.id === this.state.herd.campId) continue;
      const path = planHerdPath(this.state, this.state.herd.campId, camp.id);
      if (path.length < 8) continue;
      const octants = new Set<number>();
      for (let index = 1; index < path.length; index += 1) {
        const from = tileCenter(path[index - 1].x, path[index - 1].y, this.layout, tileW, tileH);
        const to = tileCenter(path[index].x, path[index].y, this.layout, tileW, tileH);
        octants.add(cowOctantFromScreen(to.x - from.x, to.y - from.y));
      }
      const score = octants.size * 100 + path.length;
      if (score > bestScore) {
        bestScore = score;
        bestId = camp.id;
      }
    }
    return bestId ?? this.pickLongHerdMoveDestination();
  }

  private prepareTruckRampCapture(): boolean {
    const story = this.state.story;
    if (!story) return false;
    this.state.date.hour = 11;
    this.captureLightingHour = 11;
    this.captureHideStaff = true;
    this.collapseHerdSheet();
    this.hud.clearHint();
    this.syncHud();
    clearHerdTransit(this.state);
    releaseCutOutAnimals(this.state);
    clearSaleConvoy(this.state);
    const group = filterAnimals(story.animals ?? [], TOLLY_OVER_300).filter((animal) => animal.whereabouts === "in_camp").slice(0, 8);
    const use = group.length >= 5 ? group : (story.animals ?? []).filter((animal) => animal.whereabouts === "in_camp" && animal.stockClass !== "calf").slice(0, 8);
    if (use.length < 2) return false;
    story.selectedAnimalIds = use.map((animal) => animal.id);
    const started = requestCutOut(this.state, story.selectedAnimalIds, { kind: "kraal" });
    if (!started.ok || started.queued) return false;
    let guard = 0;
    while (guard < 240000 && story.cutOut && story.cutOut.phase !== "done") {
      tickCutOutRealtime(this.state, 40, "x3");
      guard += 40;
    }
    if (!story.saleConvoy || story.cutOut?.phase !== "done") return false;
    story.saleConvoy.phase = "ramp";
    story.saleConvoy.phaseProgress = 0.35;
    clearHerdTransit(this.state);
    this.placeIndividualAnimals(performance.now());
    this.syncCattleTruckVisual();
    const ramp = this.state.features.find((feature) => feature.kind === "loading_ramp");
    const truck = this.cattleTruck;
    if (!ramp || !truck?.visible) return false;
    const saleCows = this.cows.filter((sprite) => sprite.visible && sprite.getData("captureRole") === "cut-out-animal");
    const rampPos = tileCenter(ramp.x, ramp.y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
    this.frameWorldPoints(
      this.padYardFrame([
        { x: truck.x, y: truck.y },
        ...this.truckExtentPoints(),
        { x: rampPos.x, y: rampPos.y },
        ...this.handlingPoints(),
        ...saleCows.map((sprite) => ({ x: sprite.x, y: sprite.y })),
      ]),
      0.86,
    );
    this.placeIndividualAnimals(performance.now());
    this.syncCattleTruckVisual();
    this.cullProps();
    this.setCampLabelsShown(false);
    this.placeFarmer();
    this.placeFarmhand();
    this.fadeCoveringTrees();
    const herdOnYard = this.pictureAudit().herdCoversHomestead;
    const yard = this.yardCaptureAudit();
    this.captureWhy = `${truck.name}|herd:${herdOnYard}|px:${yard.truckPx.toFixed(0)}|pens:${yard.pens}|cattle:${yard.cattle}|over:${yard.truckOverlapsPens}`;
    return truck.name === "cattle-truck" && !herdOnYard && yard.truckPx >= 14 && yard.pens >= 3 && yard.cattle >= 5 && !yard.truckOverlapsPens;
  }

  /** Nose and tail of the parked truck, so the frame keeps the whole road train in view. */
  private truckExtentPoints(): { x: number; y: number }[] {
    const truck = this.cattleTruck;
    if (!truck?.visible) return [];
    const rearX = truck.getData("rearX");
    const rearY = truck.getData("rearY");
    const cabX = truck.getData("cabX");
    const cabY = truck.getData("cabY");
    if (typeof rearX === "number" && typeof rearY === "number" && typeof cabX === "number" && typeof cabY === "number") {
      return [
        { x: rearX, y: rearY },
        { x: cabX, y: cabY },
      ];
    }
    const half = truck.displayWidth / 2;
    const alongX = Number(truck.getData("alongX") ?? 1);
    const alongY = Number(truck.getData("alongY") ?? 0);
    const alongLen = Math.hypot(alongX, alongY) || 1;
    const dx = (alongX / alongLen) * half;
    const dy = (alongY / alongLen) * half;
    return [
      { x: truck.x - dx, y: truck.y - dy },
      { x: truck.x + dx, y: truck.y + dy },
    ];
  }

  /** Extra corners so the rails and the truck stay inside the frame, not on the crop. */
  private padYardFrame(points: { x: number; y: number }[]): { x: number; y: number }[] {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    const pad = 48;
    return [
      ...points,
      { x: minX - pad, y: minY - pad },
      { x: maxX + pad, y: maxY + pad },
    ];
  }

  private handlingPoints(): { x: number; y: number }[] {
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const kinds = new Set(["holding_pen", "race", "crush", "loading_ramp", "handling_roof"]);
    return this.state.features
      .filter((feature) => kinds.has(feature.kind))
      .map((feature) => tileCenter(feature.x, feature.y, this.layout, tileW, tileH));
  }

  private prepareHandlingCapture(): boolean {
    if (!this.prepareTruckRampCapture()) return false;
    const saleCows = this.cows.filter((sprite) => sprite.visible && sprite.getData("captureRole") === "cut-out-animal");
    const truck = this.cattleTruck;
    const points = [
      ...this.handlingPoints(),
      ...(truck ? [{ x: truck.x, y: truck.y }, ...this.truckExtentPoints()] : []),
      ...saleCows.map((sprite) => ({ x: sprite.x, y: sprite.y })),
    ];
    this.frameWorldPoints(this.padYardFrame(points), 0.84);
    this.placeIndividualAnimals(performance.now());
    this.syncCattleTruckVisual();
    this.cullProps();
    this.setCampLabelsShown(false);
    const crush = this.auditKind("crush").inView;
    const ramp = this.auditKind("loading_ramp").inView;
    const truckSeen = this.namedSpritesInView("cattle-truck");
    const yard = this.yardCaptureAudit();
    return crush >= 1 && ramp >= 1 && truckSeen.count >= 1 && yard.truckPx >= 14 && yard.pens >= 3 && yard.cattle >= 5 && !yard.truckOverlapsPens;
  }

  /** Pens and sale cattle in frame, and the truck's bounds clear of the pen sprites. */
  private yardCaptureAudit(): { pens: number; cattle: number; truckOverlapsPens: boolean; truckPx: number } {
    const pens = this.propSprites.filter(
      (sprite) => sprite.visible && sprite.getData("featureKind") === "holding_pen" && this.spriteInView(sprite),
    );
    const cattle = this.cows.filter(
      (sprite) => sprite.visible && sprite.getData("captureRole") === "cut-out-animal" && this.spriteInView(sprite),
    );
    const truck = this.cattleTruck;
    let truckOverlapsPens = false;
    let truckPx = 0;
    if (truck?.visible && this.spriteInView(truck)) {
      truckPx = this.screenHeightOf(truck);
      const rearX = Number(truck.getData("rearX") ?? truck.x);
      const rearY = Number(truck.getData("rearY") ?? truck.y);
      const cabX = Number(truck.getData("cabX") ?? truck.x);
      const cabY = Number(truck.getData("cabY") ?? truck.y);
      const geometry = yardGeometry(this.state.features, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
      const penPolys = geometry?.pens.map((pen) => pen.corners) ?? [];
      truckOverlapsPens = penPolys.some((corners) => {
        for (let t = 0; t <= 1; t += 0.1) {
          const x = rearX + (cabX - rearX) * t;
          const y = rearY + (cabY - rearY) * t;
          if (pointInPolygon(x, y, corners)) return true;
        }
        return false;
      });
    }
    return { pens: pens.length, cattle: cattle.length, truckOverlapsPens, truckPx };
  }

  private prepareHomesteadCloseCapture(): boolean {
    this.captureHideStaff = false;
    const house = this.state.features.find((feature) => feature.kind === "house");
    if (!house) return false;
    ensurePeopleState(this.state);
    const farmer = this.state.story?.farmerPresence;
    if (farmer) {
      farmer.tileX = house.x;
      farmer.tileY = Math.min(this.state.height - 1, house.y + 1);
      farmer.targetTileX = farmer.tileX;
      farmer.targetTileY = farmer.tileY;
      farmer.walkProgress = 1;
      farmer.atHome = true;
      farmer.onHerdingDuty = false;
      farmer.activityLabel = "At the main house";
    }
    this.placeFarmer();
    const houseSprite = this.propSprites.find((sprite) => sprite.getData("featureKind") === "house");
    const windmill = this.propSprites
      .filter((sprite) => sprite.getData("featureKind") === "windmill")
      .sort((a, b) => {
        const ax = houseSprite ? a.x - houseSprite.x : 0;
        const ay = houseSprite ? a.y - houseSprite.y : 0;
        const bx = houseSprite ? b.x - houseSprite.x : 0;
        const by = houseSprite ? b.y - houseSprite.y : 0;
        return ax * ax + ay * ay - (bx * bx + by * by);
      })[0];
    const sprites = [houseSprite, windmill, this.farmerSprite, this.yardBakkie].filter(
      (sprite): sprite is Phaser.GameObjects.Image => Boolean(sprite),
    );
    for (const sprite of sprites) sprite.setVisible(true);
    const points = sprites.flatMap((sprite) => [
      { x: sprite.x - sprite.displayWidth * 0.55, y: sprite.y - sprite.displayHeight },
      { x: sprite.x + sprite.displayWidth * 0.55, y: sprite.y + 12 },
    ]);
    this.captureWhy = sprites
      .map((sprite) => `${sprite.getData("featureKind") ?? sprite.name}:${Math.round(sprite.displayWidth)}x${Math.round(sprite.displayHeight)}`)
      .join(" ");
    this.frameWorldPoints(points, 0.82, true);
    this.cullProps();
    return this.auditKind("house").inView >= 1 && Boolean(this.farmerSprite?.visible);
  }

  private prepareScaleReferenceCapture(): boolean {
    for (const sprite of this.scaleReferenceSprites) sprite.destroy();
    this.scaleReferenceSprites = [];
    this.captureScaleLineup = true;
    this.captureHideHerdLabel = true;
    this.captureHideStaff = true;
    this.setCampLabelsShown(false);
    for (const fence of this.fenceArt) fence.setVisible(false);
    this.placeFarmer();
    this.farmhandSprite?.setVisible(false);
    for (const cow of this.cows) cow.setVisible(false);
    for (const prop of this.propSprites) prop.setVisible(false);
    this.cattleTruck?.setVisible(false);
    this.yardBakkie?.setVisible(false);
    const files = [
      "person-farmer-stand-s.png",
      "cattle-bonsmara-e.png",
      "cattle-calf-e.png",
      "vehicle-bakkie-se.png",
      "prop-windmill-reservoir.png",
      "bldg-worker-cottage.png",
      "bldg-farmhouse.png",
      "vehicle-roadtrain-e.png",
    ];
    const house = this.state.features.find((feature) => feature.kind === "house");
    const origin = house
      ? tileCenter(house.x, Math.min(this.state.height - 1, house.y + 2), this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight)
      : { x: 400, y: 300 };
    let cursor = origin.x;
    const groundY = origin.y;
    for (const file of files) {
      const pose = referencePose(file);
      if (!pose || !this.textures.exists(pose.key)) continue;
      const image = this.add
        .image(cursor, groundY, pose.key)
        .setOrigin(pose.originX, pose.originY)
        .setScale(pose.scale)
        .setDepth(40 + groundY);
      this.scaleReferenceSprites.push(image);
      cursor += image.displayWidth + 18;
    }
    if (this.scaleReferenceSprites.length < 6) return false;
    this.frameWorldPoints(
      this.scaleReferenceSprites.flatMap((sprite) => {
        const bounds = sprite.getBounds();
        return [
          { x: bounds.left, y: bounds.top },
          { x: bounds.right, y: bounds.bottom },
        ];
      }),
      0.82,
      true,
    );
    return true;
  }

  private prepareHomesteadAtDefaultZoom(): boolean {
    this.captureHideStaff = false;
    this.capturePin = null;
    this.layoutCamera(true);
    const house = this.state.features.find((feature) => feature.kind === "house");
    if (!house) return false;
    const center = tileCenter(house.x, house.y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
    this.cameras.main.centerOn(center.x, center.y);
    this.clampScroll();
    this.placeFarmer();
    this.cullProps();
    this.fadeCoveringTrees();
    return this.auditKind("house").inView >= 1;
  }

  private prepareHomesteadCapture(): boolean {
    this.captureHideStaff = false;
    const kinds = ["house", "worker_house", "shed", "windmill"] as const;
    const points = kinds
      .map((kind) => this.state.features.find((feature) => feature.kind === kind))
      .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature))
      .map((feature) => tileCenter(feature.x, feature.y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight));
    if (points.length === 0) return false;
    this.frameWorldPoints(points, 0.38);
    this.cullProps();
    return this.auditKind("house").inView >= 1;
  }

  private v2ArtAudit(): { cattle: boolean; yard: boolean; fence: boolean; ground: boolean; building: boolean; sample: string } {
    const cow = this.cows.find((sprite) => sprite.visible && sprite.texture.key.startsWith("v2-cattle"));
    return {
      cattle: Boolean(cow),
      yard: this.propSprites.some((sprite) => sprite.texture.key.startsWith("v2-yard") || sprite.texture.key.startsWith("v2-pen-floor")),
      fence: this.fenceArt.some((sprite) => sprite.texture.key.startsWith("v2-fence")),
      ground: [...this.chunkRenderTextures.values()].some(
        (chunk) => chunk instanceof Phaser.GameObjects.Image && chunk.texture.key.startsWith("v2-ground"),
      ),
      building: this.propSprites.some((sprite) => sprite.texture.key.startsWith("v2-bldg")),
      sample: cow?.texture.key ?? "",
    };
  }

  private prepareOverviewCapture(): boolean {
    this.captureHideStaff = false;
    const house = this.state.features.find((feature) => feature.kind === "house");
    const ramp = this.state.features.find((feature) => feature.kind === "loading_ramp");
    if (!house || !ramp) return false;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const housePos = tileCenter(house.x, house.y, this.layout, tileW, tileH);
    const rampPos = tileCenter(ramp.x, ramp.y, this.layout, tileW, tileH);
    this.frameWorldPoints([housePos, rampPos], 0.2);
    const view = this.cameras.main.worldView;
    const inside = (point: { x: number; y: number }) =>
      point.x >= view.x && point.x <= view.right && point.y >= view.y && point.y <= view.bottom;
    return inside(housePos) && inside(rampPos) && this.auditKind("loading_ramp").inView >= 1;
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
    const gateP = this.gateProgressForCapture();
    const targetProgress = Math.min(0.82, Math.max(0.22, gateP));
    let guard = 0;
    while (guard < 6000) {
      tickHerdingRealtime(this.state, 24, "x3");
      guard += 24;
      const transit = herdState.transit as HerdTransit | null;
      if (!transit) return false;
      if (transit.phase === "drive" && transit.progress >= targetProgress) break;
    }

    const transit = herdState.transit as HerdTransit | null;
    if (!transit || transit.phase !== "drive" || transit.progress < 0.1) return false;
    syncHerderOnDrive(this.state);

    this.syncHerdFromSim();
    this.placeHerd(performance.now());
    this.placeFarmer();
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
    return (
      this.countCattleInView() >= 1 &&
      this.countFarmerInView() >= 1 &&
      dist <= 80 &&
      midMove &&
      this.herderBehindHerdOnDrive()
    );
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

    const wh = this.state.features.find((f) => f.kind === "worker_house");
    const house = this.state.features.find((f) => f.kind === "house");
    if (!wh || !house) return false;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const main = tileCenter(house.x, house.y, this.layout, tileW, tileH);
    const cottageSprite = this.workerCottageSprites[0];
    const worker =
      cottageSprite != null
        ? { x: cottageSprite.x, y: cottageSprite.y - cottageSprite.displayHeight * 0.2 }
        : tileCenter(wh.x, wh.y, this.layout, tileW, tileH);
    const span = Math.max(Math.hypot(main.x - worker.x, main.y - worker.y), 200);
    const camera = this.cameras.main;
    const zoom = clampZoom(Math.min(1.08, 720 / span), this.minZoom, this.maxZoom);
    camera.setZoom(zoom);
    camera.centerOn((main.x + worker.x) / 2, (main.y + worker.y) / 2 - 12);
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
    if (this.captureHideStaff) {
      this.farmhandSprite?.setVisible(false);
      this.farmhandNameTag?.setVisible(false);
      this.farmhandJobTag?.setVisible(false);
      return;
    }
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

  private syncBakkieVisual(): void {
    if (!this.yardBakkie) return;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    if (!bakkieOnRoad(this.state)) {
      this.bakkieDust?.clear();
      this.bakkieDust?.setData("active", false);
      const parked = v2Ready(this.textures) ? vehiclePose("bakkie", 1, 1) : null;
      if (parked && this.textures.exists(parked.key)) {
        this.yardBakkie.setTexture(parked.key).setOrigin(parked.originX, parked.originY).setScale(parked.scale).setAngle(0);
      }
      this.yardBakkie.setPosition(this.parkedBakkie.x, this.parkedBakkie.y).setVisible(true);
      this.yardBakkie.setData("tileX", null);
      return;
    }
    const run = this.state.story?.bakkieRun;
    const steps = Math.max(4, Math.round((run?.progress ?? 0.4) * 14));
    const tile = tileAlongRoad(this.state, steps);
    const pos = tileCenter(tile.x, tile.y, this.layout, tileW, tileH);
    const ahead = tileCenter(tileAlongRoad(this.state, steps + 1).x, tileAlongRoad(this.state, steps + 1).y, this.layout, tileW, tileH);
    const facing = v2Ready(this.textures) ? vehiclePose("bakkie", ahead.x - pos.x, ahead.y - pos.y) : null;
    if (facing && this.textures.exists(facing.key)) {
      this.yardBakkie.setTexture(facing.key).setOrigin(facing.originX, facing.originY).setScale(facing.scale).setAngle(0);
    }
    this.yardBakkie.setPosition(pos.x, pos.y).setVisible(true).setDepth(9.1 + pos.y * 0.04);
    this.yardBakkie.setData("featureKind", "bakkie");
    this.yardBakkie.setData("tileX", tile.x);
    this.yardBakkie.setData("tileY", tile.y);
    const dust = this.bakkieDust ?? this.add.graphics();
    this.bakkieDust = dust;
    dust.clear();
    const house = this.state.features.find((f) => f.kind === "house");
    const home = house
      ? tileCenter(house.x, house.y, this.layout, tileW, tileH)
      : { x: pos.x - 80, y: pos.y - 30 };
    const dx = home.x - pos.x;
    const dy = home.y - pos.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    for (let i = 1; i <= 8; i += 1) {
      dust.fillStyle(i % 2 === 0 ? 0xf4efe4 : 0xe4d2b4, 0.78 - i * 0.06);
      dust.fillEllipse(pos.x + ux * i * 22, pos.y + uy * i * 14, 20 + i * 8, 12 + i * 3);
    }
    dust.setDepth(this.yardBakkie.depth - 0.2);
    dust.setData("active", true);
  }

  /** Screen step along the farm road, so the truck sits parallel to it. */
  private truckRoadScreenStep(
    bay: { x: number; y: number },
    ramp: { x: number; y: number } | undefined,
  ): { x: number; y: number } {
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const tracks = new Set(this.state.features.filter((feature) => feature.kind === "track").map((feature) => `${feature.x},${feature.y}`));
    const intoX = ramp ? ramp.x - bay.x : 0;
    const intoY = ramp ? ramp.y - bay.y : 1;
    const options = [
      { x: bay.x + intoY, y: bay.y - intoX },
      { x: bay.x - intoY, y: bay.y + intoX },
    ];
    const along = options.find((tile) => tracks.has(`${tile.x},${tile.y}`)) ?? options[0];
    const from = tileCenter(bay.x, bay.y, this.layout, tileW, tileH);
    const to = tileCenter(along.x, along.y, this.layout, tileW, tileH);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.hypot(dx, dy) < 1) return { x: tileW / 2, y: tileH / 2 };
    return { x: dx, y: dy };
  }

  private syncCattleTruckVisual(): void {
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const show = saleTruckVisible(this.state);
    if (!show) {
      this.cattleTruck?.setVisible(false);
      return;
    }
    const depart = saleTruckDeparting(this.state);
    const prog = this.state.story?.saleConvoy?.phaseProgress ?? 0;
    const ramp = this.state.features.find((f) => f.kind === "loading_ramp");
    const bay = roadTileBesideRamp(this.state);
    const tile = depart
      ? tileAlongRoad(this.state, 3 + Math.round(prog * 12))
      : bay
        ? bay
        : ramp
          ? { x: ramp.x, y: ramp.y }
          : STEP3B.loadingRampTile;
    const bayPos = tileCenter((bay ?? tile).x, (bay ?? tile).y, this.layout, tileW, tileH);
    const rampPos = ramp ? tileCenter(ramp.x, ramp.y, this.layout, tileW, tileH) : bayPos;
    const awayX = bayPos.x - rampPos.x;
    const awayY = bayPos.y - rampPos.y;
    const awayLen = Math.hypot(awayX, awayY) || 1;
    const along = this.truckRoadScreenStep(bay ?? tile, ramp);
    const train = v2Ready(this.textures) ? vehiclePose("roadtrain", along.x, along.y) : null;
    const truckScale = train?.scale ?? scaleToSpanMetres(640, 22);
    if (!this.cattleTruck) {
      this.cattleTruck = this.add
        .image(0, 0, train?.key ?? SPRITE_KEYS.cattleTruck)
        .setName("cattle-truck");
    }
    if (train && this.textures.exists(train.key)) {
      this.cattleTruck.setTexture(train.key);
      this.cattleTruck.setOrigin(train.originX, train.originY);
      this.cattleTruck.setScale(train.scale);
      this.cattleTruck.setAngle(0);
    } else {
      this.cattleTruck.setOrigin(0.5, 0.72);
      this.cattleTruck.setScale(truckScale);
      this.cattleTruck.setAngle((Math.atan2(along.y, along.x) * 180) / Math.PI);
    }
    const file = roadtrainFile(along.x, along.y);
    const ends = roadtrainEndOffsets(file, this.cattleTruck.scaleX);
    const axle = (shift: number) => ({
      x: rampPos.x + (awayX / awayLen) * shift,
      y: rampPos.y + (awayY / awayLen) * shift * 0.55,
    });
    const parkedAt = (shift: number) => {
      const contact = axle(shift);
      if (!ends) return contact;
      return { x: contact.x - ends.rearX, y: contact.y - ends.rearY };
    };
    let shift = 12;
    let pos = depart ? tileCenter(tile.x, tile.y, this.layout, tileW, tileH) : parkedAt(shift);
    if (!depart && ends) {
      const geometry = yardGeometry(this.state.features, this.layout, tileW, tileH);
      const penPolys = geometry?.pens.map((pen) => pen.corners) ?? [];
      const stepX = awayX / awayLen;
      const stepY = (awayY / awayLen) * 0.55;
      const lean = this.cattleTruck.displayHeight * 0.55;
      const leanX = -stepX * lean;
      const leanY = -stepY * lean;
      const hitsPen = (at: { x: number; y: number }) =>
        penPolys.some((corners) => {
          for (let t = 0; t <= 1; t += 0.12) {
            const x = at.x + ends.rearX + (ends.cabX - ends.rearX) * t;
            const y = at.y + ends.rearY + (ends.cabY - ends.rearY) * t;
            if (pointInPolygon(x, y, corners) || pointInPolygon(x + leanX, y + leanY, corners)) return true;
          }
          return false;
        });
      while (shift < 320 && hitsPen(pos)) {
        shift += 12;
        pos = parkedAt(shift);
      }
    }
    this.cattleTruck.setFlipX(false);
    this.cattleTruck.setPosition(pos.x, pos.y).setVisible(true).setDepth(9.2 + pos.y * 0.04);
    this.cattleTruck.setData("alongX", along.x);
    this.cattleTruck.setData("alongY", along.y);
    this.cattleTruck.setData("rearX", pos.x + (ends?.rearX ?? 0));
    this.cattleTruck.setData("rearY", pos.y + (ends?.rearY ?? 0));
    this.cattleTruck.setData("cabX", pos.x + (ends?.cabX ?? 0));
    this.cattleTruck.setData("cabY", pos.y + (ends?.cabY ?? 0));
    this.cattleTruck.setData("tileX", tile.x);
    this.cattleTruck.setData("tileY", tile.y);
  }

  private ensureCowCount(count: number): void {
    const starter = v2Ready(this.textures) ? "v2-cattle-bonsmara-se" : cattleOctantKey(0, false, 0);
    while (this.cows.length < count) {
      const cow = this.add.image(0, 0, starter).setOrigin(0.5, 0.86);
      this.cows.push(cow);
      this.cowShadows.push(placeShadow(this, 0, 0, 14, 5, 0.14, 1).setVisible(false));
    }
    while (this.cows.length > count) {
      this.cows.pop()?.destroy();
      this.cowShadows.pop()?.destroy();
    }
  }

  private placeIndividualAnimals(time: number): void {
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const placed = layoutAnimals(this.state, this.layout, tileW, tileH, time);
    this.ensureCowCount(placed.length);
    const anchor = tileCenter(
      herdWorldTile(this.state).x,
      herdWorldTile(this.state).y,
      this.layout,
      tileW,
      tileH,
    );
    this.herdVisual.x = anchor.x;
    this.herdVisual.y = anchor.y;
    this.herdOffsets = placed
      .filter((spot) => spot.role === "herd-animal")
      .map((spot) => ({
        x: spot.x - anchor.x,
        y: spot.y - anchor.y,
        flip: false,
        coat: 0,
        scale: 1,
        view: "right" as const,
        octant: spot.octant,
        moving: spot.moving,
      }));
    const zoom = this.cameras.main.zoom;
    const cowLod = this.paintedSprites && zoom <= COW_LOD_ZOOM && !this.captureHideHerdLabel;
    placed.forEach((spot, index) => {
      const cow = this.cows[index];
      if (!cow) return;
      const bob =
        spot.animal.activity === "walk" && !this.reduceMotion ? Math.sin(time / 180 + index) * 1.4 : 0;
      cow.setData("captureRole", spot.role);
      cow.setData("octant", spot.octant);
      cow.setData("animalTag", spot.animal.tag);
      cow.setName(spot.role);
      const shadow = this.cowShadows[index];
      const graze = spot.animal.activity !== "walk";
      const coat = cattleCoatIndex(spot.animal.tag);
      const v2Cow = v2Ready(this.textures) ? cattlePose(spot.octant, spot.calf, coat, graze) : null;
      if (cowLod) {
        cow.setTexture(SPRITE_KEYS.cowDot);
        cow.setScale(uniformScale(8, COW_SHOULDER_METRES));
        shadow?.setVisible(false);
      } else if (v2Cow && this.textures.exists(v2Cow.key)) {
        cow.setTexture(v2Cow.key);
        cow.setOrigin(v2Cow.originX, v2Cow.originY);
        const grown = spot.animal.stockClass === "calf" ? 1 : spot.animal.weightKg > 420 ? 1.06 : 0.96;
        cow.setScale(v2Cow.scale * grown);
        shadow?.setVisible(true).setPosition(spot.x + 6, spot.y + 3).setDepth(7 + spot.y * 0.04);
        shadow?.setScale((cow.displayWidth * 0.42) / 58, (cow.displayWidth * 0.16) / 16);
        shadow?.setAlpha(0.14);
      } else if (this.textures.exists(cattleOctantKey(spot.octant, spot.calf, coat))) {
        cow.setTexture(cattleOctantKey(spot.octant, spot.calf, coat));
        const grown = spot.animal.stockClass === "calf" ? 1 : spot.animal.weightKg > 420 ? 1.06 : 0.96;
        cow.setScale(cattleOctantScale(spot.calf) * grown);
        shadow?.setVisible(false);
      }
      cow.clearTint();
      cow.setFlipX(false);
      cow.setRotation(0);
      cow.setPosition(spot.x, spot.y + bob);
      // Sale animals stand on the yard sprites. Those use the prop depth scale, which
      // sits above the usual cattle depth once the yard is far down the map.
      const onYard = spot.role === "cut-out-animal";
      cow.setDepth(onYard ? 8 + spot.y * 0.04 + 1.1 : 8 + spot.y * 0.04 + 0.25);
      cow.setVisible(true);
      cow.setData("suppress", false);
    });
  }

  private animalAt(worldX: number, worldY: number, radius: number): string | null {
    let best: { id: string; dist: number } | null = null;
    for (const cow of this.cows) {
      if (!cow.visible) continue;
      const id = this.animalIdForSprite(cow);
      if (!id) continue;
      const dist = Math.hypot(worldX - cow.x, worldY - cow.y);
      if (dist > radius) continue;
      if (!best || dist < best.dist) best = { id, dist };
    }
    return best?.id ?? null;
  }

  private animalIdForSprite(cow: Phaser.GameObjects.Image): string | null {
    const tag = cow.getData("animalTag");
    if (typeof tag !== "string") return null;
    return this.state.story?.animals?.find((animal) => animal.tag === tag)?.id ?? null;
  }

  private toggleAnimal(id: string): void {
    const story = this.state.story;
    if (!story) return;
    const selected = new Set(story.selectedAnimalIds ?? []);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    story.selectedAnimalIds = [...selected];
    story.focusedAnimalId = id;
    this.selected = true;
    this.pendingCampId = null;
    this.pendingCampName = "";
    const animal = story.animals?.find((item) => item.id === id);
    if (animal) {
      const label = animal.whereabouts === "escaped" || animal.whereabouts === "neighbour" ? "out" : "in the herd";
      this.hud.setHint(`Tag ${animal.tag}, ${label}.`);
    }
    this.syncHud();
    const summary = document.getElementById("sheet-summary");
    if (document.getElementById("herd-sheet")?.dataset.expanded !== "true") {
      summary?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  }

  private applyAnimalFilter(filter: "all" | "tolly300" | "out"): void {
    const story = this.state.story;
    if (!story?.animals) return;
    if (filter === "all") {
      this.syncHud();
      return;
    }
    const matched =
      filter === "tolly300"
        ? filterAnimals(story.animals, TOLLY_OVER_300)
        : filterAnimals(story.animals, { outOnly: true });
    story.selectedAnimalIds = matched.map((animal) => animal.id);
    story.focusedAnimalId = matched[0]?.id ?? null;
    this.selected = true;
    const count = matched.length;
    this.hud.setHint(
      count === 0 ? "No animals match." : count === 1 ? "1 animal selected." : `${count} animals selected.`,
    );
    this.syncHud();
  }

  private orderCutToPendingCamp(): void {
    if (this.pendingCampId === null) {
      this.hud.setHint("Tap the camp you want, then tap To camp.");
      return;
    }
    const ids = this.state.story?.selectedAnimalIds ?? [];
    const result = requestCutOut(this.state, ids, { kind: "camp", campId: this.pendingCampId });
    this.hud.setHint(result.message);
    this.pendingCampId = null;
    this.pendingCampName = "";
    this.syncHud();
  }

  private orderCutToKraal(): void {
    const ids = this.state.story?.selectedAnimalIds ?? [];
    const result = requestCutOut(this.state, ids, { kind: "kraal" });
    this.hud.setHint(result.message);
    this.syncHud();
  }

  private orderRoundUp(): void {
    const selected = this.state.story?.selectedAnimalIds ?? [];
    const escaped = escapedAnimalIds(this.state);
    const ids = selected.filter((id) => escaped.includes(id));
    const use = ids.length > 0 ? ids : escaped;
    if (use.length === 0) {
      this.hud.setHint("No animals are out.");
      return;
    }
    const result = requestCutOut(this.state, use, { kind: "camp", campId: this.state.herd.campId });
    this.hud.setHint(result.message);
    this.syncHud();
  }

  private showCalmEscapeNote(): void {
    const notes = this.state.notifications?.log ?? [];
    const fresh = notes.find((item) => item.kind === "animal_out" && !item.read);
    if (!fresh) return;
    fresh.read = true;
    this.hud.setHint(fresh.body);
  }

  private placeHerd(time: number): void {
    const special = this.captureDrinkHeads > 0 || this.captureKraalLineup;
    const animals = this.state.story?.animals?.filter((animal) => animal.whereabouts !== "sold") ?? [];
    if (!special && animals.length > 0 && (v2Ready(this.textures) || this.textures.exists(cattleOctantKey(0)))) {
      this.placeIndividualAnimals(time);
      this.refreshHerdLabel();
      return;
    }
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
        cow.setScale(uniformScale(8, COW_SHOULDER_METRES));
        cow.setRotation(0);
        cow.setFlipX(false);
      } else if (this.paintedSprites) {
        const baseKey = cattleTextureForView(offset.coat, offset.view);
        cow.setTexture(baseKey);
        cow.setData("pose", "");
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
        cow.setScale(uniformScale(52, COW_LENGTH_METRES));
        cow.setFlipX(offset.flip);
        cow.setRotation(0);
      }
      const drinkN = this.captureDrinkHeads;
      const trough = this.state.story?.drinkingTrip?.troughTile;
      if (drinkN > 0 && trough) {
        if (index >= drinkN) {
          cow.setData("suppress", true);
          cow.setVisible(false);
          return;
        }
        const spot = tileCenter(trough.x, trough.y, this.layout, CONFIG.view.tileWidth, CONFIG.view.tileHeight);
        const drinking = v2Ready(this.textures) ? cattlePose(1, false, offset.coat ?? 0, true) : null;
        if (drinking && this.textures.exists(drinking.key)) {
          cow.setTexture(drinking.key);
          cow.setOrigin(drinking.originX, drinking.originY);
          cow.setScale(drinking.scale);
        } else {
          cow.setTexture(SPRITE_KEYS.cowDrink);
          cow.setScale(cattleDisplayScale());
        }
        cow.setData("pose", "drink");
        cow.setData("suppress", false);
        cow.setRotation(0);
        cow.setFlipX(false);
        const along = (index - 1) * 16;
        cow.setPosition(spot.x + along, spot.y + 8);
        cow.setDepth(9.6 + (spot.y + 8) * 0.04 + index * 0.01);
        cow.setVisible(true);
        return;
      }
      if (this.captureKraalLineup) {
        if (index >= 9) {
          cow.setData("suppress", true);
          cow.setVisible(false);
          return;
        }
        const col = index % 3;
        const row = Math.floor(index / 3);
        cow.setData("suppress", false);
        cow.setData("pose", "");
        cow.setScale(cattleDisplayScale());
        cow.setPosition(this.herdVisual.x + (col - 1) * 18, this.herdVisual.y + 12 + row * 14);
        cow.setDepth(9.55 + cow.y * 0.04 + index * 0.01);
        cow.setVisible(true);
        return;
      }
      if (this.captureHerdTile && index > 14) {
        cow.setData("suppress", true);
        cow.setVisible(false);
        return;
      }
      cow.setData("suppress", false);
      cow.setPosition(this.herdVisual.x + offset.x, this.herdVisual.y + offset.y + walk);
      cow.setDepth(depth + offset.y * 0.01);
      cow.setVisible(true);
    });
  }

  /** A tree that stands over a person, the herd, a building or the truck drops to 35% alpha. */
  private fadeCoveringTrees(): void {
    const covers: { x: number; y: number; r: number }[] = [];
    const add = (sprite: Phaser.GameObjects.Image | undefined, scale = 0.42) => {
      if (!sprite?.visible) return;
      covers.push({
        x: sprite.x,
        y: sprite.y - sprite.displayHeight * (1 - sprite.originY) * 0.5,
        r: Math.max(16, Math.max(sprite.displayWidth, sprite.displayHeight) * scale),
      });
    };
    add(this.farmerSprite, 0.55);
    add(this.farmhandSprite, 0.55);
    add(this.cattleTruck, 0.48);
    add(this.yardBakkie, 0.48);
    for (const cow of this.cows) add(cow, 0.5);
    for (const prop of this.propSprites) {
      const kind = prop.getData("featureKind");
      if (typeof kind !== "string" || kind === "tree" || kind === "bush") continue;
      add(prop, 0.46);
    }
    for (const prop of this.propSprites) {
      if (prop.getData("featureKind") !== "tree") continue;
      const cx = prop.x;
      const cy = prop.y - prop.displayHeight * (1 - prop.originY) * 0.55;
      const cr = Math.max(20, prop.displayWidth * 0.4);
      let hit = false;
      for (const target of covers) {
        if (Math.hypot(cx - target.x, cy - target.y) < cr + target.r) {
          hit = true;
          break;
        }
      }
      prop.setAlpha(hit ? 0.35 : 1);
    }
  }

  private cullProps(): void {
    const pad = CONFIG.view.propCullPadPx;
    const view = this.cameras.main.worldView;
    for (const sprite of this.propSprites) {
      if (this.captureScaleLineup) {
        sprite.setVisible(false);
        continue;
      }
      sprite.setVisible(
        sprite.x >= view.x - pad &&
          sprite.x <= view.right + pad &&
          sprite.y >= view.y - pad &&
          sprite.y <= view.bottom + pad,
      );
    }
    if (this.captureScaleLineup) {
      this.cattleTruck?.setVisible(false);
      this.yardBakkie?.setVisible(false);
    }
    if (this.captureScaleLineup) {
      for (const cow of this.cows) cow.setVisible(false);
    } else if (!this.captureSkipCowCull) {
      for (let i = 0; i < this.cows.length; i += 1) {
        const cow = this.cows[i];
        const offset = this.herdOffsets[i];
        const cx = this.herdVisual.x + (offset?.x ?? 0);
        const cy = this.herdVisual.y + (offset?.y ?? 0);
        if (cow.getData("suppress")) {
          cow.setVisible(false);
          continue;
        }
        const posed = cow.getData("pose") === "drink" || this.captureKraalLineup || Boolean(cow.getData("captureRole"));
        const px = posed ? cow.x : cx;
        const py = posed ? cow.y : cy;
        const seen =
          px >= view.x - pad - 24 && px <= view.right + pad + 24 && py >= view.y - pad - 24 && py <= view.bottom + pad + 24;
        cow.setVisible(seen);
        this.cowShadows[i]?.setVisible(seen && cow.texture.key.startsWith("v2-"));
      }
    }
  }

  /** Keep a grass tile under the camera so panning or zooming never shows the clear colour. */
  private syncGroundFill(): void {
    const fill = this.groundFill;
    if (!fill) return;
    const view = this.cameras.main.worldView;
    const pad = 48;
    const x = view.x - pad;
    const y = view.y - pad;
    fill.setPosition(x, y);
    fill.setSize(Math.max(8, view.width + pad * 2), Math.max(8, view.height + pad * 2));
    fill.tilePositionX = x;
    fill.tilePositionY = y;
  }

  private cullChunks(): void {
    const camera = this.cameras.main;
    const pad = Math.max(CONFIG.view.propCullPadPx, 96);
    const source = this.paintedSprites ? this.chunkRenderTextures : this.chunkRoots;
    for (const root of source.values()) {
      root.setVisible(boundsVisible(camera, root.getBounds(), pad));
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
    const animalId = this.animalAt(world.x, world.y, radius);
    if (animalId) {
      this.toggleAnimal(animalId);
      return;
    }
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
    const yardKinds = new Set(["house", "windmill", "shed", "kraal", "reservoir", "worker_house"]);
    const house = this.state.features.find((feature) => feature.kind === "house");
    const points: { x: number; y: number }[] = [];
    for (const feature of this.state.features) {
      if (!yardKinds.has(feature.kind)) continue;
      if (house && Math.hypot(feature.x - house.x, feature.y - house.y) > 16) continue;
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
      const readable = readableCampZoom(camera.width, CONFIG.view.tileWidth, this.zoomTargets());
      const zoom = Math.max(framed.zoom, Math.min(readable, Math.min(this.maxZoom, 1.15)));
      camera.setZoom(zoom);
      camera.centerOn((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
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
