import { CONFIG, type GameConfig } from "./config";
import { STEP3B } from "./step3bConfig";
import { homesteadYardTile } from "./yard";
import { jobTargetTile } from "./workGrid";
import type { BakkieRunState, WorkJobId } from "./storyTypes";
import type { GameState } from "./types";

const BAKKIE_JOBS = new Set<WorkJobId>(["check_water", "fill_lick", "fix_fences"]);

export function defaultBakkieRun(): BakkieRunState {
  return { active: false, job: null, progress: 1, dieselLitres: 0, fromTile: null, toTile: null };
}

export function maybeStartBakkieRun(state: GameState, job: WorkJobId | null): void {
  if (!state.story || !job || !BAKKIE_JOBS.has(job)) return;
  const run = state.story.bakkieRun ?? defaultBakkieRun();
  if (run.active) return;
  const from = homesteadYardTile(state);
  const to = jobTargetTile(state, job);
  state.story.bakkieRun = {
    active: true,
    job,
    progress: 0,
    dieselLitres: 0,
    fromTile: { ...from },
    toTile: { ...to },
  };
}

export function tickBakkieRealtime(state: GameState, deltaMs: number, speed: number, _config: GameConfig = CONFIG): void {
  const run = state.story?.bakkieRun;
  if (!run?.active || !run.fromTile || !run.toTile) return;
  // A. 5.2 s covered a short yard run of about 18 tiles. Longer roads take longer, capped so a trip still finishes.
  const tiles = Math.hypot(run.toTile.x - run.fromTile.x, run.toTile.y - run.fromTile.y);
  const legMs = Math.min(14000, Math.max(5200, 5200 * (tiles / 18)));
  run.progress += (deltaMs * speed) / legMs;
  if (run.progress < 1) return;
  if (run.dieselLitres <= 0) {
    run.dieselLitres = STEP3B.dieselLitresPerVisibleRun;
    run.progress = 0;
    run.fromTile = { ...run.toTile };
    run.toTile = { ...homesteadYardTile(state) };
    return;
  }
  run.active = false;
  run.progress = 1;
  state.story!.bakkieDieselLitresMonth = (state.story!.bakkieDieselLitresMonth ?? 0) + run.dieselLitres;
}

export function bakkieOnRoad(state: GameState): boolean {
  const run = state.story?.bakkieRun;
  return Boolean(run?.active && run.progress < 1);
}

export function bakkieDustTrail(state: GameState): { x: number; y: number; strength: number } | null {
  const run = state.story?.bakkieRun;
  if (!run?.active || !run.fromTile || !run.toTile) return null;
  const t = run.progress;
  return {
    x: run.fromTile.x + (run.toTile.x - run.fromTile.x) * t,
    y: run.fromTile.y + (run.toTile.y - run.fromTile.y) * t,
    strength: 0.55 + 0.35 * Math.sin(t * Math.PI),
  };
}
