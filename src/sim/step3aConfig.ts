/** Step 3a living farm tuning. Costs marked TODO assumption until sourced. */

export const STEP3A = {
  /** A. TODO assumption. Build one more corrugated worker cottage near the yard. */
  workerHouseBuildCostNad: 48_500,
  /** Tile placement for the optional second worker house (homestead grid). */
  /** Beside homestead yard (matches default farm worker_house). */
  workerHouseBuildTile: { x: 17, y: 15 },
  /** Real-time ms to walk from yard to a camp at 1x (scaled by path length). */
  approachBaseMs: 5_500,
  /** Herder tile steps per sim hour while approaching or on chores. */
  walkStepPerHour: 1.8,
  farmhandName: "Piet",
} as const;
