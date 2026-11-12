/** Step 3b water, sales, and bakkie tuning. Numbers marked TODO assumption cite research lesson. */

export const STEP3B = {
  /** S: adult cattle about 50 L/day [camps-water lesson §1.3]. A: one condition point per dry day without trough access. */
  thirstConditionLossPerDay: 0.35,
  /** S: ProAgri walk preferably under 1000 m, up to 2000 m [lesson §1.5 table]. A: sim tiles use camp anchor distance. */
  waterWalkComfortMetres: 1000,
  waterWalkMaxMetres: 2000,
  /** S: MLA about 80% grazing within 2 km of water [lesson §1.5]. A: grazable fraction multiplier by distance band. */
  grazeFullWithinMetres: 500,
  grazeHalfBeyondMetres: 1500,
  grazeRemoteFraction: 0.72,
  /** A: herd must return to trough every other day when camp has shared water off camp. */
  drinkTripIntervalGameDays: 2,
  /** A: real-time ms for cows drinking at trough (a few head at a time). */
  drinkPoseMsPerSlot: 2800,
  drinkSlotsPerTrip: 3,
  /** A: litres diesel per visible bakkie run (not a market price). */
  dieselLitresPerVisibleRun: 4.5,
  /** A: sale convoy ms per phase at 1x render speed. */
  saleGatherMs: 3500,
  saleDriveMsPerKm: 4200,
  saleKraalMs: 4000,
  saleCrushMs: 3500,
  saleLoadMs: 5500,
  saleTruckDepartMs: 4500,
  homesteadKraalTile: { x: 11, y: 15 },
  crushTile: { x: 13, y: 15 },
  loadingRampTile: { x: 14, y: 16 },
  truckArrivalTile: { x: 14, y: 18 },
} as const;
