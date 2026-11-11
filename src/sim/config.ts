/**
 * Every gameplay number and every feel number for the prototype lives here.
 * S means the figure is sourced from the Namibian farm lessons (sometimes rounded).
 * A means it is an assumption for play. Do not present A numbers as farm facts.
 * Simulation code reads these fields. It does not keep its own copies.
 */

export type GameConfig = {
  worldSeed: number;
  farm: {
    name: string;
    hectares: number;
    homesteadHectares: number;
    hectaresPerLsu: number;
    landValueNadPerHa: number;
    /** Extra water infrastructure beyond the homestead windmill (picker / generator). */
    extraWater?: { boreholes: number; windmills: number; solar: number };
    /** Shown on picker cards; gameplay wear is TODO. */
    fenceCondition?: "good" | "fair" | "poor";
  };
  pasture: {
    lsuLiveweightKg: number;
    dailyIntakeFractionOfLiveweight: number;
    consumableFractionOfStandingDm: number;
    residualDmKgPerHaMin: number;
    residualFractionOfPeak: number;
    activeGrazingFractionOfCamp: number;
    maxGrazingDaysRainySeason: number;
    maxGrazingDaysDrySeason: number;
    moveWarnGrazeableFraction: number;
    peakDmKgPerHa: number;
    forageDmKgPerHaMin: number;
    forageDmKgPerHaMax: number;
    bushyPeakFraction: number;
    fullRestDays: number;
    restGrowthFloor: number;
    occupiedGrowthFactor: number;
    maxDailyGrowthKgPerHa: number;
    startingCoverMin: number;
    startingCoverMax: number;
    initialRestDaysMax: number;
  };
  herd: {
    name: string;
    headCount: number;
    averageLiveweightKg: number;
    startingCondition: number;
    startingDaysInCamp: number;
    conditionMin: number;
    conditionMax: number;
    conditionDropPerDayAtNoFeed: number;
    conditionGainPerDayWhenFed: number;
  };
  economy: {
    startingCashNad: number;
  };
  calendar: {
    seasonStartMonth: number;
    rainyMonths: number[];
    startYear: number;
    startMonth: number;
    startDay: number;
    startHour: number;
  };
  rain: {
    monthlyMeanMm: number[];
    monthlyRainDayChance: number[];
    maxDailyRainMm: number;
    moistureMmForFullGrowth: number;
    moistureRetention: number;
  };
  transit: {
    kmPerTile: number;
    maxSpanKm: number;
    playMsMin: number;
    playMsMax: number;
    fastMsMin: number;
    fastMsMax: number;
    minDistanceKm: number;
    walkSpeedKmH: number;
    fastPlayFraction: number;
  };
  map: {
    tilesX: number;
    tilesY: number;
    borderTiles: number;
    campCountMin: number;
    campCountMax: number;
    centerInset: number;
    campCenterMinDistance: number;
    minCampTiles: number;
    placementAttempts: number;
    homesteadTilesX: number;
    homesteadTilesY: number;
    treeChance: number;
    bushChanceOpen: number;
    bushChanceBushy: number;
    outsidePlantFactor: number;
    treeScaleMin: number;
    treeScaleMax: number;
    bushScaleMin: number;
    bushScaleMax: number;
    yard: {
      house: { x: number; y: number };
      windmill: { x: number; y: number };
      reservoir: { x: number; y: number };
      kraal: { x: number; y: number };
      shed: { x: number; y: number };
    };
  };
  view: {
    tileWidth: number;
    tileHeight: number;
    boundsPadPx: number;
    fitMargin: number;
    secondsPerDayPlay: number;
    secondsPerDayFast: number;
    maxFrameMs: number;
    maxDaysPerFrame: number;
    phoneTilePx: number;
    desktopTilePx: number;
    desktopMinWidthPx: number;
    maxTilePx: number;
    wheelZoomStep: number;
    dragSlopPx: number;
    herdPickTiles: number;
    herdPickMinScreenPx: number;
    grassColourMidpoint: number;
    soilMixAtBare: number;
    tileShadeSpread: number;
    cowBobPx: number;
    fencePostSpacingPx: number;
    terrainChunkTiles: number;
    propCullPadPx: number;
    moveMs: number;
    windmillRadiansPerSecond: number;
    fencePx: number;
    fenceBoundaryPx: number;
    fenceSelectedPx: number;
    ringRx: number;
    ringRy: number;
    ringLinePx: number;
    labelSizePx: number;
    rainDropCap: number;
  };
};

export const CONFIG: GameConfig = {
  // A. The same seed builds the same farm, so a refresh is the same place.
  worldSeed: 3300,

  farm: {
    name: "Otjozondjupa",
    // S: Otjozondjupa average commercial farm is 3,327 ha. Lesson 8.1 rounds the cattle ranch template to 3,300.
    hectares: 3300,
    // A. The yard, windmill and kraal are not grazing land.
    homesteadHectares: 8,
    // S: savanna farms are often quoted at 8 to 10 ha per LSU. A: this prototype uses 10, the lighter end of that quote.
    hectaresPerLsu: 10,
    // S: Otjozondjupa agricultural land, N$1,951 per ha in the 2023 NSA land price index. Not spendable in this prototype.
    landValueNadPerHa: 1951,
  },

  pasture: {
    // S: NAU rangeland manual. One LSU is an ox of 450 kg.
    lsuLiveweightKg: 450,
    // S: Kruger forage budget. Daily demand is 3% of liveweight.
    dailyIntakeFractionOfLiveweight: 0.03,
    // S: Kruger counts half of standing dry matter as consumable in the May forage budget. The rest stays as litter.
    consumableFractionOfStandingDm: 0.5,
    // S: photo guide low end. Ungrazable litter is at least this much dry matter per ha.
    residualDmKgPerHaMin: 30,
    // A: typical litter left after a graze, as a fraction of that camp's own peak. Tuned for this map, not a measured litter curve.
    residualFractionOfPeak: 0.125,
    // A: share of camp hectares actively defoliated before you move the herd. NAU warns that use concentrates near water.
    // Tuned so 120 head on a typical camp needs a move within about two weeks in the dry season.
    activeGrazingFractionOfCamp: 0.22,
    // S: NAU growing season rule, one to two weeks grazing. This build uses fourteen days.
    maxGrazingDaysRainySeason: 14,
    // S: NAU dormant season rule, two weeks to one month. This build uses twenty eight days.
    maxGrazingDaysDrySeason: 28,
    // A: warn when grazable grass in the camp falls below this fraction of the peak band.
    moveWarnGrazeableFraction: 0.35,
    // S: the Namibian photo guide shows thornbush savanna from about 30 to 2,200 kg DM/ha.
    // A: 1,600 is an open-camp peak inside that range, for a fair year.
    peakDmKgPerHa: 1600,
    // S: photo guide low end. Peaks are clamped to this.
    forageDmKgPerHaMin: 30,
    // S: photo guide high end. Peaks are clamped to this.
    forageDmKgPerHaMax: 2200,
    // S: bush encroachment can cut capacity by about 40% in wetter savanna.
    // A: a bushy camp on this farm keeps 60% of the open peak. Camps vary between the two.
    bushyPeakFraction: 0.6,
    // S: NAU. About six weeks of rest in the growing season.
    fullRestDays: 42,
    // A. A camp that cattle have just left still grows. It reaches full speed after fullRestDays.
    restGrowthFloor: 0.7,
    // A. Cattle defoliate the camp they stand in, so regrowth there is only this fraction of a rested camp.
    // The on/off idea follows NAU: rest is what lets the grass recover, and rest without rain does nothing.
    occupiedGrowthFactor: 0.2,
    // A. Tuned so a rested camp can refill across a rainy season, while an occupied camp still declines.
    maxDailyGrowthKgPerHa: 14,
    // A. Starting cover as a fraction of each camp's own peak, so the map opens with green and gold camps.
    startingCoverMin: 0.58,
    startingCoverMax: 0.96,
    // A. Camps the herd is not in have already had some rest when the game opens.
    initialRestDaysMax: 50,
  },

  herd: {
    name: "Cattle herd",
    // A. 120 head is under the farm carrying capacity (3,300 ha / 10 ha per LSU = 330 LSU).
    headCount: 120,
    // S: the 450 kg LSU weight. A: every head in this prototype is treated as one LSU.
    averageLiveweightKg: 450,
    // A. A 0 to 100 game score, not a formal body condition score.
    startingCondition: 76,
    // A. They have already spent a few days in the opening camp.
    startingDaysInCamp: 4,
    conditionMin: 0,
    conditionMax: 100,
    // A. Points lost per day when the herd gets none of its daily demand. Shortfalls scale this down.
    conditionDropPerDayAtNoFeed: 2.2,
    // A. Points gained per day when the herd eats its full demand.
    conditionGainPerDayWhenFed: 0.55,
  },

  economy: {
    // A. Operating cash on hand. Sales, wages and building are out of scope, so this number does not move.
    startingCashNad: 250000,
  },

  calendar: {
    // S: the Atlas of Namibia rainfall season runs 1 July to 30 June. Lesson 8.2 uses the same year.
    seasonStartMonth: 7,
    // A for the label. These are the months that hold most of the rain in the table below, November to April.
    rainyMonths: [11, 12, 1, 2, 3, 4],
    // A. Opening morning, early in the dry season, so grass holds or falls until the rains.
    startYear: 2026,
    startMonth: 8,
    startDay: 1,
    startHour: 6,
  },

  rain: {
    // Index 0 is unused. Months 1 to 12 follow.
    // A for the monthly shape. The months sum to 446 mm.
    // S for the scale: Otjozondjupa census seasons were 548, 287 and 503 mm, so a few hundred millimetres is the right band.
    // S for the pattern: rain belongs in the summer, and this table puts almost all of it in November to April.
    monthlyMeanMm: [0, 95, 90, 70, 30, 5, 0, 0, 1, 5, 15, 55, 80],
    // A. Chance of a rain day. July is dry (mean 0). A wet day draws from an exponential storm so the month still averages the mean above.
    monthlyRainDayChance: [0, 0.4, 0.38, 0.32, 0.18, 0.08, 0.02, 0, 0.03, 0.08, 0.16, 0.3, 0.36],
    // A. Cap on one storm, so a rare exponential tail cannot dump an unreal day of rain.
    maxDailyRainMm: 80,
    // A. Soil moisture (mm of recent rain, decaying) that gives a full day of regrowth.
    moistureMmForFullGrowth: 24,
    // A. Fraction of soil moisture kept overnight. A storm keeps feeding growth for days, then fades.
    moistureRetention: 0.88,
  },

  transit: {
    // A. One tile is about 75 m. 3300 ha is about 5.7 km across, not 10+ km.
    kmPerTile: 0.075,
    maxSpanKm: 5.7,
    playMsMin: 6000,
    playMsMax: 15000,
    fastMsMin: 1500,
    fastMsMax: 4500,
    minDistanceKm: 0.15,
    /** Herd walk speed on farm roads for the game clock. */
    walkSpeedKmH: 3,
    /** Realtime fast mode is this fraction of play duration (never below fastMsMin). */
    fastPlayFraction: 0.22,
  },

  map: {
    // A. Large ranch layout, many fenced camps.
    tilesX: 76,
    tilesY: 76,
    borderTiles: 3,
    campCountMin: 12,
    campCountMax: 18,
    centerInset: 4,
    campCenterMinDistance: 7,
    minCampTiles: 70,
    placementAttempts: 48,
    homesteadTilesX: 7,
    homesteadTilesY: 6,
    treeChance: 0.04,
    bushChanceOpen: 0.03,
    bushChanceBushy: 0.14,
    outsidePlantFactor: 0.4,
    treeScaleMin: 0.85,
    treeScaleMax: 1.15,
    bushScaleMin: 0.8,
    bushScaleMax: 1.2,
    // A. A small yard so the house, windmill, reservoir and kraal read as one homestead. Not a measured plan.
    yard: {
      house: { x: 1, y: 1 },
      windmill: { x: 3, y: 1 },
      reservoir: { x: 4, y: 2 },
      kraal: { x: 1, y: 3 },
      shed: { x: 5, y: 2 },
    },
  },

  view: {
    // A. Classic 2:1 isometric diamond.
    tileWidth: 64,
    tileHeight: 32,
    boundsPadPx: 24,
    fitMargin: 0.92,
    // A. One game day per second at play. Fast is about eight days per second.
    secondsPerDayPlay: 1,
    secondsPerDayFast: 0.12,
    maxFrameMs: 200,
    maxDaysPerFrame: 3,
    phoneTilePx: 34,
    desktopTilePx: 48,
    desktopMinWidthPx: 900,
    maxTilePx: 96,
    wheelZoomStep: 1.12,
    dragSlopPx: 10,
    herdPickTiles: 1.8,
    herdPickMinScreenPx: 56,
    grassColourMidpoint: 0.62,
    soilMixAtBare: 0.55,
    tileShadeSpread: 14,
    cowBobPx: 0.8,
    fencePostSpacingPx: 18,
    terrainChunkTiles: 16,
    propCullPadPx: 96,
    moveMs: 480,
    windmillRadiansPerSecond: 0.8,
    fencePx: 3,
    fenceBoundaryPx: 4.5,
    fenceSelectedPx: 5,
    ringRx: 150,
    ringRy: 78,
    ringLinePx: 3,
    labelSizePx: 20,
    rainDropCap: 40,
  },
};
