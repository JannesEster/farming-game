/**
 * Step 3c individual animals, escapes, and cut-out drives.
 * Unsourced tunings are marked TODO assumption. Sourced class weights stay in config.cattle.
 */

export const STEP3C = {
  /**
   * A. TODO assumption. Chance per game day that one animal gets out while maintenance is kept up.
   * About one escape every two to three months at the default 3 game days per month.
   */
  escapeDailyChanceMaintain: 0.012,
  /** A. TODO assumption. Daily chance when maintenance is deferred, before fence wear. */
  escapeDailyChanceDefer: 0.038,
  /** A. TODO assumption. Wear is 0 to 1. Multiplies the base chance as (1 + wear * factor). */
  escapeWearFactor: 2.1,
  /** A. TODO assumption. Added chance per month maintenance has been deferred. */
  escapeDeferMonthFactor: 0.01,
  /** A. TODO assumption. Cap so a rough month does not empty a camp. */
  escapeDailyChanceCap: 0.08,
  /** A. TODO assumption. Animals that may be outside the fence at the same time. */
  maxAnimalsOut: 2,
  /** A. TODO assumption. Game hours outside before condition starts to slip. */
  escapeGraceHours: 18,
  /** A. TODO assumption. Condition points lost per game day after the grace period. */
  escapeConditionLossPerDay: 1.35,
  /** A. TODO assumption. Game hours outside before the animal is on a neighbour's land. */
  neighbourHours: 40,
  /** A. TODO assumption. Small neighbour call-out, in N$. Charged once per escape. */
  neighbourCostNad: 450,
  /**
   * A. TODO assumption. Tolly weights are spread across 300 kg so a player can filter
   * "tollies over 300 kg". The class note in cattleClasses still treats a tolly as the
   * young steer band; these individuals can sit a little heavy until the next weigh-in.
   */
  tollyWeightMinKg: 230,
  tollyWeightMaxKg: 348,
  /** A. TODO assumption. Other classes vary this fraction around the class average. */
  weightJitterFraction: 0.07,
  /** A. TODO assumption. How fast an escape walks, in tiles per real second at 1x. */
  wanderTilesPerSecond: 0.16,
  /** A. TODO assumption. How far an escape may drift from the gap it left through. */
  wanderRadiusTiles: 3.4,
  /** A. TODO assumption. Real ms for the herder to reach the cattle, scaled by distance in cutOut.ts. */
  cutOutApproachBaseMs: 4800,
} as const;
