import { CONFIG, type GameConfig } from "./config";
import { STEP2 } from "./step2Config";
import { farmhandWaterBonus } from "./workers";
import type {
  DailyPlayState,
  FarmhandPresence,
  WorkGrid,
  WorkJobId,
  WorkPriority,
} from "./storyTypes";
import type { GameState, TilePoint } from "./types";
import { findCamp } from "./simulation";

export const WORK_JOB_LABELS: Record<WorkJobId, string> = {
  check_water: "Check water",
  fix_fences: "Fix fences",
  fill_lick: "Fill lick",
  move_herd_help: "Help move herd",
};

export function defaultWorkGrid(): WorkGrid {
  return {
    check_water: 2,
    fix_fences: 1,
    fill_lick: 1,
    move_herd_help: 0,
  };
}

export function freshDailyPlay(): DailyPlayState {
  return {
    goalText: "Keep the herd drinking: run water checks today.",
    goalTarget: "water_check",
    goalProgress: 0,
    goalMet: false,
    morningDecisionId: null,
    morningDecisionAnswered: false,
  };
}

export function setWorkPriority(state: GameState, job: WorkJobId, priority: WorkPriority): void {
  const story = state.story;
  if (!story) return;
  if (!story.workGrid) story.workGrid = defaultWorkGrid();
  story.workGrid[job] = priority;
}

export function pickActiveJob(state: GameState): WorkJobId | null {
  const story = state.story;
  if (!story?.farmhand.hired || !story.workGrid) return null;
  let best: WorkJobId | null = null;
  let bestPri = 0;
  for (const job of Object.keys(story.workGrid) as WorkJobId[]) {
    const pri = story.workGrid[job];
    if (pri > bestPri) {
      bestPri = pri;
      best = job;
    }
  }
  return bestPri > 0 ? best : null;
}

export function jobTargetTile(state: GameState, job: WorkJobId): TilePoint {
  const herdCamp = findCamp(state, state.herd.campId);
  const anchor = herdCamp?.anchor ?? { x: state.width / 2, y: state.height / 2 };
  if (job === "check_water" || job === "fill_lick") {
    const water = state.features.find((f) => f.kind === "trough" || f.kind === "windmill");
    if (water) return { x: water.x, y: water.y };
  }
  if (job === "fix_fences") {
    const worn = state.camps.find((c) => c.restDays < 3 && c.id !== state.herd.campId) ?? herdCamp;
    if (worn) return { ...worn.anchor };
  }
  if (job === "move_herd_help") return { ...anchor };
  return { ...anchor };
}

export function tickFarmhandWorld(state: GameState, config: GameConfig = CONFIG): void {
  const story = state.story;
  if (!story?.farmhand.hired) return;
  if (!story.farmhandPresence) {
    story.farmhandPresence = {
      tileX: state.width / 2,
      tileY: state.height / 2,
      targetTileX: state.width / 2,
      targetTileY: state.height / 2,
      activeJob: null,
      activityLabel: "At the yard",
      walkProgress: 1,
    };
  }
  const presence = story.farmhandPresence;
  const job = pickActiveJob(state);
  presence.activeJob = job;
  if (!job) {
    presence.activityLabel = "Idle at the yard";
    return;
  }
  const target = jobTargetTile(state, job);
  const sameTarget =
    presence.targetTileX === target.x && presence.targetTileY === target.y && presence.walkProgress >= 1;
  if (!sameTarget || presence.targetTileX !== target.x || presence.targetTileY !== target.y) {
    presence.targetTileX = target.x;
    presence.targetTileY = target.y;
    if (presence.tileX !== target.x || presence.tileY !== target.y) {
      presence.walkProgress = Math.max(0, presence.walkProgress - 0.35);
    }
  }
  const dx = target.x - presence.tileX;
  const dy = target.y - presence.tileY;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.08) {
    presence.tileX = target.x;
    presence.tileY = target.y;
    presence.walkProgress = 1;
    presence.activityLabel = `${WORK_JOB_LABELS[job]} at camp`;
    applyJobSiteEffect(state, job, config);
    return;
  }
  const step = Math.min(0.22, dist);
  presence.tileX += (dx / dist) * step;
  presence.tileY += (dy / dist) * step;
  presence.walkProgress = 0.45;
  presence.activityLabel = `Walking to ${WORK_JOB_LABELS[job].toLowerCase()}`;
}

function applyJobSiteEffect(state: GameState, job: WorkJobId, config: GameConfig): void {
  const story = state.story;
  if (!story) return;
  if (job === "check_water" && state.date.day % config.story.farmhandWaterCheckInterval === 0) {
    const bonus = farmhandWaterBonus(state, config);
    if (bonus > 0) {
      state.herd.condition = Math.min(config.herd.conditionMax, state.herd.condition + bonus);
    }
  }
  if (job === "fix_fences" && story.infrastructure) {
    story.infrastructure.fenceWear = Math.max(0, story.infrastructure.fenceWear - STEP2.fenceWearRepairPerDayJob);
  }
  if (job === "fill_lick") {
    state.herd.condition = Math.min(config.herd.conditionMax, state.herd.condition + 0.03);
  }
  if (job === "move_herd_help" && state.herd.condition < config.story.farmhandMoveCondition) {
    story.lastDailyNote = "Farmhand is ready to help move the herd.";
  }
}

export function farmhandWorldPosition(state: GameState): FarmhandPresence | null {
  return state.story?.farmhandPresence ?? null;
}

export function tickDailyGoal(state: GameState, _config: GameConfig = CONFIG): void {
  const play = state.story?.dailyPlay;
  if (!play || play.goalMet) return;
  const job = pickActiveJob(state);
  if (play.goalTarget === "water_check" && job === "check_water") {
    play.goalProgress += 1;
    if (play.goalProgress >= 1) play.goalMet = true;
  }
  if (play.goalTarget === "condition_55" && state.herd.condition >= 55) {
    play.goalMet = true;
    play.goalProgress = 1;
  }
}
