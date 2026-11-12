import { isDaylightHour } from "./clock";
import { CONFIG, type GameConfig } from "./config";
import { activeHerder } from "./herding";
import { defaultFarmerPresence } from "./herding";
import { mainHouseTile, workerHouseForFarmhand } from "./housing";
import { STEP3A } from "./step3aConfig";
import type { GameState } from "./types";

export function ensurePeopleState(state: GameState): void {
  const story = state.story;
  if (!story) return;
  if (!story.farmerPresence) story.farmerPresence = defaultFarmerPresence(state);
  if (story.farmhand.hired && !story.farmhandPresence) {
    const home = workerHouseForFarmhand(state) ?? mainHouseTile(state);
    story.farmhandPresence = {
      tileX: home.x,
      tileY: home.y,
      targetTileX: home.x,
      targetTileY: home.y,
      activeJob: null,
      activityLabel: "At the yard",
      walkProgress: 1,
      atHome: true,
    };
  }
}

export function tickPeopleSchedule(state: GameState, _config: GameConfig = CONFIG): void {
  ensurePeopleState(state);
  const story = state.story;
  if (!story) return;
  const hour = state.date.hour;
  const daylight = isDaylightHour(hour);
  const farmer = story.farmerPresence;
  if (farmer && !farmer.onHerdingDuty && activeHerder(state) !== "farmer") {
    const home = mainHouseTile(state);
    if (!daylight) {
      farmer.tileX = home.x;
      farmer.tileY = home.y;
      farmer.targetTileX = home.x;
      farmer.targetTileY = home.y;
      farmer.walkProgress = 1;
      farmer.atHome = true;
      farmer.activityLabel = "At the main house";
    } else if (farmer.atHome) {
      farmer.activityLabel = "At the main house";
    }
  }
  const piet = story.farmhandPresence;
  if (piet && story.farmhand.hired) {
    const home = workerHouseForFarmhand(state) ?? mainHouseTile(state);
    const onDuty = piet.onHerdingDuty || activeHerder(state) === "piet";
    if (!daylight && !onDuty) {
      const door = workerHouseForFarmhand(state) ?? home;
      piet.tileX = door.x;
      piet.tileY = door.y;
      piet.targetTileX = door.x;
      piet.targetTileY = door.y;
      piet.walkProgress = 1;
      piet.atHome = true;
      piet.activeJob = null;
      piet.activityLabel = `At ${STEP3A.farmhandName}'s house`;
    } else if (daylight && !onDuty) {
      piet.atHome = false;
    }
  }
}

/** For tests and capture: worker must be within one tile of their house at night. */
export function workerAtHomeAtNight(state: GameState): boolean {
  const story = state.story;
  if (!story?.farmhand.hired || !story.farmhandPresence) return true;
  const hour = state.date.hour;
  if (hour >= 6 && hour < 18) return true;
  const door = workerHouseForFarmhand(state);
  if (!door) return false;
  const p = story.farmhandPresence;
  return Math.hypot(p.tileX - door.x, p.tileY - door.y) <= 1.05;
}
