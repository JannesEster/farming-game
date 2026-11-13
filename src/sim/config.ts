/**
 * Every gameplay number and every feel number for the prototype lives here.
 * S means the figure is sourced from the Namibian farm lessons (sometimes rounded).
 * A means it is an assumption for play. Do not present A numbers as farm facts.
 * Simulation code reads these fields. It does not keep its own copies.
 */

/** Side length, in tiles, of the ranch before the property area was tripled. */
export const PREVIOUS_MAP_TILES = 76;
/** Property area is 3 times that ranch. Each side grows by about 1.73. */
export const FARM_AREA_SCALE = 3;
/** 76 * sqrt(3), rounded. (132 / 76) squared is about 3.02, close to 3. */
export const FARM_MAP_TILES = Math.round(PREVIOUS_MAP_TILES * Math.sqrt(FARM_AREA_SCALE));
/**
 * Multiply an old per-tile chance by this to keep about the same count
 * on the larger map. 76 squared over 132 squared.
 */
export const VEGETATION_COUNT_SCALE =
  (PREVIOUS_MAP_TILES * PREVIOUS_MAP_TILES) / (FARM_MAP_TILES * FARM_MAP_TILES);
/**
 * Bushes share the tree random stream, so a pure area scale left too many bushes.
 * 0.62 was tuned with the tree chances below. Assumption.
 */
export const BUSH_COUNT_TRIM = 0.62;

function tilesFromPrevious(previous: number): number {
  return Math.max(1, Math.round((previous * FARM_MAP_TILES) / PREVIOUS_MAP_TILES));
}

export type GameConfig = {
  worldSeed: number;
  farm: {
    name: string;
    hectares: number;
    homesteadHectares: number;
    hectaresPerLsu: number;
    landValueNadPerHa: number;
    extraWater?: { boreholes: number; windmills: number; solar: number };
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
    /** A. TODO gameplay tuning. Extra DM kg/ha/day from trampling at guide stocking (1 LSU per hectaresPerLsu). */
    tramplingDmKgPerHaPerDayAtNominalStocking: number;
    maxDailyGrowthKgPerHa: number;
    startingCoverMin: number;
    startingCoverMax: number;
    initialRestDaysMax: number;
    /** A. TODO tune. Opening camp is topped up to about this many days of grass when the camp can hold it. */
    openingMinGrassDays: number;
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
    farmhandMonthlyCashNad: number;
    payrollIntervalDays: number;
    defaultWeanerLiveKg: number;
    /** Reuben farm anchor: 13,000 ha, 500 head, N$90k/month running costs (Nov 2026). */
    operatingCostAnchorHectares: number;
    operatingCostAnchorHead: number;
    operatingCostAnchorMonthlyNad: number;
    /**
     * A. TODO: not a published NAU formula. Sub-linear fit so a smaller starter ranch
     * is not charged as if it were 13,000 ha and 500 head.
     */
    operatingCostHaExponent: number;
    operatingCostHeadExponent: number;
    operatingCostShareLabour: number;
    operatingCostShareLick: number;
    operatingCostShareDiesel: number;
    operatingCostShareRepairs: number;
    operatingCostShareOther: number;
    /** A. TODO tune. Game over when cash is at or below this. */
    bankruptFloorNad: number;
    dieselNadPerLitre: number;
    stateVetAdminNadPerMonth: number;
    vaccineNadPerHeadPerYear: number;
    lickNadPerHeadPerMonth: number;
    llpbnLevyRate: number;
    auctionCommissionRate: number;
    ncaGradingNadPerHead: number;
    liveExportLevyRate: number;
    feedlotPriceFactor: number;
    droughtQuickSaleNadPerKg: number;
  };
  cattle: {
    tollyWeightMinKg: number;
    tollyWeightMaxKg: number;
    stoorWeightMinKg: number;
    stoorWeightMaxKg: number;
    oxWeightMinKg: number;
    /** S: Jannes and Reuben, farm data, 12 Nov 2026. Open heifer slaughter. */
    /**
     * Prices below are market-driven stand-ins. In the real app farmers enter
     * their own prices per kg or per head.
     */
    heiferOpenNadPerKgLive: number;
    /** S: Jannes and Reuben, farm data, 12 Nov 2026. Pregnant heifer slaughter. */
    heiferPregnantNadPerKgLive: number;
    /** S: Jannes tollies band. TODO confirm with Reuben: wet Dec to Apr mapped to high end N$38. */
    tollyNadPerKgWetSeason: number;
  /** S: Jannes tollies band. TODO confirm with Reuben: dry months mapped to low end N$32. */
    tollyNadPerKgDrySeason: number;
    /** Months that use tollyNadPerKgWetSeason (Dec to Apr). */
    tollyWetPriceMonths: number[];
    /** TODO confirm with Reuben. Midpoint between tolly and ox live prices. */
    stoorNadPerKgLive: number;
    /** S: Jannes and Reuben, farm data, 12 Nov 2026. Finished oxen. */
    oxNadPerKgLive: number;
    /** A. kg/day liveweight gain for heifers and steers under 250 kg when intake is adequate. */
    dailyYoungstockGainKg: number;
    /** S: Reuben, 12 Nov 2026. Healthy cattle of 250 kg and over gain about 600 g/day in good conditions. */
    gainKgPerDayFrom250: number;
    /** Liveweight where Reuben's 600 g/day figure starts. */
    gainFromKg: number;
    /** A. Month before calving when open heifers are marked pregnant. */
    heiferBreedingMonth: number;
    /** A. Fraction of open heifers marked pregnant each season. */
    heiferPregnancyFraction: number;
    /** A. Fraction of pregnant heifers that calve and join as cows. */
    heiferCalvingFraction: number;
  };
  calendar: {
    seasonStartMonth: number;
    rainyMonths: number[];
    calvingMonths: number[];
    weaningMonths: number[];
    weanerSaleMonths: number[];
    startYear: number;
    startMonth: number;
    startDay: number;
    startHour: number;
    /** Game days in one calendar month at default speed. FS style setting. */
    daysPerMonthDefault: number;
    daysPerMonthMin: number;
    daysPerMonthMax: number;
    daysPerMonthRealism: number;
    /** A. TODO: ecology was tuned for about this many steps per month. */
    ecologyReferenceDaysPerMonth: number;
  };
  story: {
    poorFeedIntakeRatio: number;
    poorFeedGrazeable: number;
    warnPoorFeedDays1: number;
    warnPoorFeedDays2: number;
    warnPoorFeedDays3: number;
    weightLossStartsDay: number;
    dailyWeightLossKg: number;
    minAverageLiveweightKg: number;
    breedingMinCondition: number;
    breedingResumeCondition: number;
    deathStartsDay: number;
    deathMaxCondition: number;
    dailyDeathRateAtZeroCondition: number;
    monthlyCalvingFraction: number;
    weaningFraction: number;
    bullFraction: number;
    oxFraction: number;
    weanerFraction: number;
    calfFraction: number;
    droughtWatchStartMonth: number;
    droughtDeficitWarnMm: number;
    droughtWatchThreshold: number;
    droughtForageCutMax: number;
    droughtWarnMonth: number;
    droughtChoiceScore: number;
    droughtChoiceMonth: number;
    droughtSellTollies: number;
    droughtSupplementDays: number;
    /** Boskos drought feed, kg per head per day (Reuben: cattle 150 to 250 g/day). */
    droughtBoskosKgPerHeadDay: number;
    /** Reuben lick N$5,000 to 7,000/t as proxy until boskos cash price is sourced (TODO). */
    droughtBoskosNadPerKg: number;
    droughtCamelthornPodsKgPerHeadDay: number;
    supplementConditionPerDay: number;
    farmhandWaterCheckInterval: number;
    farmhandWaterConditionBonus: number;
    farmhandMoveCondition: number;
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
    /** Cattle walk. Assumption: 3.5 km/h, inside the 3 to 4 km/h range. */
    cattleWalkKmH: number;
    /** Farmer or herder walking to the herd, and walking home. */
    herderWalkKmH: number;
    /** Daylight clock rate while a drive is on. 0.5 is a tuning value. */
    driveClockFactor: number;
    /** Grazing drift after a herd arrives. */
    grazeWalkKmH: number;
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
    /** Place the opening herd in the grazing camp beside the homestead yard. */
    herdStartNearYard?: boolean;
  };
  time: {
    dayLengthSecondsDefault: number;
    dayLengthOptions: number[];
    daylightSeconds: number;
    nightSeconds: number;
    catchUpCapMs: number;
    fixedSimTickMs: number;
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
    // S: Otjozondjupa census average is 3,327 ha. The first playable ranch was 3,300 ha.
    // A: listed area is 29,700 ha, three times the previous 9,900 ha listing.
    // The outline is a rough rectangle, 20 km by 14.85 km, not a square.
    hectares: 29_700,
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
    // The same 120 head on a camp about 3 times the area remove about a third as much dry matter per hectare,
    // so a camp lasts longer. The 14 and 28 day move limits still apply.
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
    // S: Reuben (Namibian farmer). Grass only recovers while a camp rests empty. Cattle in camp plough the veld.
    // A. TODO gameplay tuning. Trampling scales with LSU/ha above this rate at guide stocking (hectaresPerLsu).
    tramplingDmKgPerHaPerDayAtNominalStocking: 0.65,
    // A. Tuned so a rested camp can refill across a rainy season.
    maxDailyGrowthKgPerHa: 14,
    // A. Starting cover as a fraction of each camp's own peak, so the map opens with green and gold camps.
    startingCoverMin: 0.58,
    startingCoverMax: 0.96,
    // A. Camps the herd is not in have already had some rest when the game opens.
    initialRestDaysMax: 50,
    // A. TODO tune. Enough opening grass that the first days are a choice, not a crisis.
    openingMinGrassDays: 18,
  },

  herd: {
    name: "Cattle herd",
    // A. The playable mob stays 120 head. Capacity is 29,700 ha / 10 ha per LSU = 2,970 LSU.
    // Stocking is now about 248 ha per head, against the guide of 10 ha per LSU.
    // Assumption: one mob is what the yard and the phone show. The herd was not scaled with the land.
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
    // A. Operating cash on hand at game start.
    startingCashNad: 250000,
    // S: NAU Ox Production 2025 permanent salary N$2,168.62/worker/month (Reuben may pay more; not modeled).
    farmhandMonthlyCashNad: 2168.62,
    payrollIntervalDays: 30,
    defaultWeanerLiveKg: 220,
    operatingCostAnchorHectares: 13000,
    operatingCostAnchorHead: 500,
    operatingCostAnchorMonthlyNad: 90000,
    // A. TODO: exponents are a fit, not a published NAU formula. See the type comment.
    operatingCostHaExponent: 0.52,
    operatingCostHeadExponent: 0.62,
    // S-ish: Ox Production 2025 cost mix (labour, feeds, fuel, repairs, other).
    operatingCostShareLabour: 0.16,
    operatingCostShareLick: 0.2,
    operatingCostShareDiesel: 0.18,
    operatingCostShareRepairs: 0.1,
    operatingCostShareOther: 0.36,
    // A. TODO tune. Cash at or under this ends the run.
    bankruptFloorNad: -20000,
    // S: Reuben Nov 2026 ~N$30/L diesel (NAU sheet: N$21.36/L).
    dieselNadPerLitre: 30,
    // S-ish: Reuben state vets, admin only; NAU cites N$9,815/yr private visit on 488 head.
    stateVetAdminNadPerMonth: 150,
    // S: NAU Medicine & Veterinary N$75,876/yr ÷ 488 head.
    vaccineNadPerHeadPerYear: 155.5,
    // S: NAU feeds N$183,036/yr ÷ 488 head ÷ 12.
    lickNadPerHeadPerMonth: 31.25,
    // S: NAU Meat Board levy 0.7% (LLPBN schedule also cites 0.6%; game uses NAU).
    llpbnLevyRate: 0.007,
    // S: NAU Marketing Commission 6%.
    auctionCommissionRate: 0.06,
    // S: NAU NCA grading & inspection N$16.85/head.
    ncaGradingNadPerHead: 16.85,
    liveExportLevyRate: 0.01,
    feedlotPriceFactor: 1.03,
    // S-ish: NAU lean cows live N$27.90/kg distressed band.
    droughtQuickSaleNadPerKg: 27.9,
  },

  cattle: {
    tollyWeightMinKg: 180,
    tollyWeightMaxKg: 299,
    stoorWeightMinKg: 300,
    stoorWeightMaxKg: 399,
    oxWeightMinKg: 400,
    heiferOpenNadPerKgLive: 28,
    heiferPregnantNadPerKgLive: 34,
    tollyNadPerKgWetSeason: 38,
    tollyNadPerKgDrySeason: 32,
    tollyWetPriceMonths: [12, 1, 2, 3, 4],
    stoorNadPerKgLive: 37,
    oxNadPerKgLive: 40,
    dailyYoungstockGainKg: 0.45,
    gainKgPerDayFrom250: 0.6,
    gainFromKg: 250,
    heiferBreedingMonth: 8,
    heiferPregnancyFraction: 0.35,
    heiferCalvingFraction: 0.9,
  },

  calendar: {
    // S: the Atlas of Namibia rainfall season runs 1 July to 30 June. Lesson 8.2 uses the same year.
    seasonStartMonth: 7,
    // A for the label. These are the months that hold most of the rain in the table below, November to April.
    rainyMonths: [11, 12, 1, 2, 3, 4],
    // S: calving ~Oct after Jan/Feb mating in south (namibian-livestock §2.2, seasonal calendar Sep to Oct).
    calvingMonths: [9, 10],
    // S: wean early calves in May (namibian-livestock §4.5).
    weaningMonths: [5],
    // S: weaner sales Apr to Jun (namibian-livestock §4.5; Agra weaner championship H2).
    weanerSaleMonths: [4, 5, 6],
    // A. Opening morning, early in the dry season, so grass holds or falls until the rains.
    startYear: 2026,
    startMonth: 8,
    startDay: 1,
    startHour: 6,
    daysPerMonthDefault: 3,
    daysPerMonthMin: 1,
    daysPerMonthMax: 7,
    daysPerMonthRealism: 28,
    ecologyReferenceDaysPerMonth: 30,
  },

  time: {
    dayLengthSecondsDefault: 240,
    dayLengthOptions: [180, 240, 300],
    daylightSeconds: 160,
    nightSeconds: 80,
    catchUpCapMs: 8000,
    fixedSimTickMs: 50,
  },

  story: {
    // A: intake below this counts as starvation stress.
    poorFeedIntakeRatio: 0.18,
    poorFeedGrazeable: 0.08,
    // A: warned and recoverable ladder (fun-and-retention §4.2 telegraph negatives).
    warnPoorFeedDays1: 5,
    warnPoorFeedDays2: 12,
    warnPoorFeedDays3: 21,
    weightLossStartsDay: 8,
    // A: kg liveweight lost per poor-feed day once weight loss starts.
    dailyWeightLossKg: 1.2,
    minAverageLiveweightKg: 320,
    breedingMinCondition: 45,
    breedingResumeCondition: 55,
    deathStartsDay: 28,
    deathMaxCondition: 12,
    // A: share of herd lost per day at critical condition on bare veld.
    dailyDeathRateAtZeroCondition: 0.012,
    // A: monthly calving as fraction of cows in calving season.
    monthlyCalvingFraction: 0.12,
    weaningFraction: 0.85,
    bullFraction: 0.03,
    oxFraction: 0.05,
    weanerFraction: 0.08,
    calfFraction: 0.12,
    droughtWatchStartMonth: 11,
    // A: mm below expected when drought watch begins.
    droughtDeficitWarnMm: 25,
    droughtWatchThreshold: 0.2,
    // A: max cut to regrowth when drought score is 1.
    droughtForageCutMax: 0.55,
    droughtWarnMonth: 1,
    droughtChoiceScore: 0.45,
    droughtChoiceMonth: 2,
    /** Young steers sold in drought quick down (was weaners). */
    droughtSellTollies: 8,
    droughtSupplementDays: 30,
    droughtBoskosKgPerHeadDay: 0.2,
    droughtBoskosNadPerKg: 5.5,
    droughtCamelthornPodsKgPerHeadDay: 0.03,
    supplementConditionPerDay: 0.25,
    farmhandWaterCheckInterval: 3,
    farmhandWaterConditionBonus: 0.08,
    farmhandMoveCondition: 50,
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
    // One coordinate unit is one metre, the same metre as the cow. 0.001 km per unit.
    kmPerTile: 0.001,
    maxSpanKm: 9.9,
    playMsMin: 6000,
    playMsMax: 15000,
    fastMsMin: 1500,
    fastMsMax: 4500,
    minDistanceKm: 0.15,
    /**
     * Cattle walking a drive. Assumption: Jannes said cattle walk about 3 to 4 km/h.
     * 3.5 is the middle of that band.
     */
    cattleWalkKmH: 3.5,
    /** Kept for older call sites. Same figure as cattleWalkKmH. */
    walkSpeedKmH: 3.5,
    /** Herder walking to the herd, and home again. A normal walking pace. */
    herderWalkKmH: 5,
    /**
     * Tuning value for Jannes. While a drive or the walk out to the herd is on,
     * the ranch clock runs at this fraction of its usual speed. 0.5 makes a
     * daylight hour about 27 real seconds at 1x, so a 1 km neighbour move is
     * about 8 seconds. Pause, x2 and x3 still scale everything together.
     */
    driveClockFactor: 0.5,
    /** Drift onto the new camp after a drive. About a slow graze. */
    grazeWalkKmH: 0.4,
    /** Realtime fast mode is this fraction of play duration (never below fastMsMin). */
    fastPlayFraction: 0.22,
  },

  map: {
    // A. Eight to ten camps. The metre map picks 8, 9, or 10 from the seed, not this range.
    tilesX: FARM_MAP_TILES,
    tilesY: FARM_MAP_TILES,
    borderTiles: tilesFromPrevious(3),
    campCountMin: 8,
    campCountMax: 10,
    centerInset: tilesFromPrevious(4),
    campCenterMinDistance: tilesFromPrevious(7),
    minCampTiles: Math.round(70 * (FARM_MAP_TILES / PREVIOUS_MAP_TILES) ** 2),
    placementAttempts: 48,
    homesteadTilesX: 7,
    homesteadTilesY: 6,
    // Tuned so seed 3300 still plants about 162 trees (the shipped default farm).
    treeChance: 0.0106,
    bushChanceOpen: 0.12 * VEGETATION_COUNT_SCALE * BUSH_COUNT_TRIM,
    bushChanceBushy: 0.3 * VEGETATION_COUNT_SCALE * BUSH_COUNT_TRIM,
    outsidePlantFactor: 0.4,
    treeScaleMin: 0.85,
    treeScaleMax: 1.15,
    bushScaleMin: 0.8,
    bushScaleMax: 1.2,
    // Fallback offsets. generateFarm places the live yard from the road in waterLayout.ts.
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
    /** Legacy fallbacks; the ranch clock uses config.time day length instead. */
    secondsPerDayPlay: 240,
    secondsPerDayFast: 80,
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
    tileShadeSpread: 6,
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
