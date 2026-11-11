import type { TutorialProgress, TutorialStepId } from "./types";

const STORAGE_KEY = "farming-game-tutorial-v1";

export type TutorialStep = {
  id: TutorialStepId;
  title: string;
  body: string;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "selectHerd",
    title: "Select the herd",
    body: "Tap the cattle once. The bottom strip shows camp, head count, and grass.",
  },
  {
    id: "moveToRestedCamp",
    title: "Move to a rested camp",
    body: "Tap a greener camp and confirm. Grass only grows back in camps that stay empty while the herd is elsewhere.",
  },
  {
    id: "speedUpTime",
    title: "Speed up time",
    body: "Tap Fast on the top bar to advance days while you watch grass change.",
  },
  {
    id: "checkGrass",
    title: "Check grass",
    body: "Open the herd card and watch camp grass %. Move before it turns gold. Occupied camps never recover.",
  },
  {
    id: "sellAtMarket",
    title: "Plan a sale",
    body: "Open the menu on the top right and tap Sell / market. Auction or a private buyer, then confirm.",
  },
  {
    id: "dismissDone",
    title: "You are set",
    body: "Skip any time from the toast. We remember your choice on this browser.",
  },
];

export function loadTutorialProgress(): TutorialProgress {
  if (typeof localStorage === "undefined") return freshTutorial();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshTutorial();
    const data = JSON.parse(raw) as TutorialProgress;
    if (!data || typeof data !== "object") return freshTutorial();
    return {
      completed: Boolean(data.completed),
      skipped: Boolean(data.skipped),
      currentStepId: data.currentStepId ?? null,
      finishedStepIds: Array.isArray(data.finishedStepIds) ? data.finishedStepIds : [],
    };
  } catch {
    return freshTutorial();
  }
}

export function saveTutorialProgress(progress: TutorialProgress): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function freshTutorial(): TutorialProgress {
  return {
    completed: false,
    skipped: false,
    currentStepId: "selectHerd",
    finishedStepIds: [],
  };
}

export function activeStep(progress: TutorialProgress): TutorialStep | null {
  if (progress.completed || progress.skipped) return null;
  const id = progress.currentStepId ?? "selectHerd";
  return TUTORIAL_STEPS.find((s) => s.id === id) ?? null;
}

export function advanceTutorial(
  progress: TutorialProgress,
  action: TutorialStepId | "skip",
): TutorialProgress {
  if (progress.completed || progress.skipped) return progress;
  if (action === "skip") {
    const next = { ...progress, skipped: true, completed: true, currentStepId: null };
    saveTutorialProgress(next);
    return next;
  }
  const order = TUTORIAL_STEPS.map((s) => s.id);
  const idx = order.indexOf(action);
  if (idx < 0) return progress;
  const finished = new Set(progress.finishedStepIds);
  finished.add(action);
  const nextId = order[idx + 1] ?? null;
  const next: TutorialProgress = {
    ...progress,
    finishedStepIds: [...finished],
    currentStepId: nextId,
    completed: nextId === null,
    skipped: false,
  };
  if (next.completed) next.currentStepId = null;
  saveTutorialProgress(next);
  return next;
}

export function tutorialActionForSimEvent(
  event: "herdSelected" | "moveConfirmed" | "speedFast" | "grassChecked" | "salePlanned",
): TutorialStepId | null {
  switch (event) {
    case "herdSelected":
      return "selectHerd";
    case "moveConfirmed":
      return "moveToRestedCamp";
    case "speedFast":
      return "speedUpTime";
    case "grassChecked":
      return "checkGrass";
    case "salePlanned":
      return "sellAtMarket";
    default:
      return null;
  }
}
