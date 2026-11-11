import type { FlowMeta, MilestoneProgress, TutorialProgress } from "./types";
import { freshTutorial, loadTutorialProgress } from "./tutorial";

export function defaultMilestones(): MilestoneProgress {
  return {
    restCamp: false,
    sellBeforeDrought: false,
    keepWaterRunning: false,
  };
}

export function defaultFlowMeta(): FlowMeta {
  const tutorial: TutorialProgress = loadTutorialProgress();
  return {
    farmOfferId: null,
    yearBaseline: null,
    farmYear: 1,
    tutorial: tutorial.completed || tutorial.skipped ? tutorial : freshTutorial(),
    milestones: defaultMilestones(),
    gameOverReason: null,
  };
}
