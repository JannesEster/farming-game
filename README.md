# Otjozondjupa ranch

A small browser strategy prototype: one Namibian cattle ranch, one herd, and the grass under their feet. The pasture maths sit in plain TypeScript so they can be tested on their own, and later wrapped for a phone app or Steam. Phaser 4 only draws the farm.

Live build: https://jannesester.github.io/farming-game/

The page updates when `main` is updated. GitHub Actions runs the tests, builds the site, and deploys it.

## Run it locally

You need Node 22.

```bash
npm install
npm test
npm run dev
```

Open http://localhost:5173/farming-game/

`npm run build` then `npm run preview` serves the production build at http://localhost:4173/farming-game/

The game saves in this browser, in three slots. A new game replaces the highlighted slot.

## How to play

Tap or click the cattle, then tap a camp to move them. Drag to pan. Pinch, or use the scroll wheel, to zoom. Pause, play, and fast are in the top bar. On a desktop keyboard, Space pauses, F is fast, and 1, 2, 3 pick pause, play, and fast.

The animals on the map are a marker for the whole herd, not one picture per head. The card shows the real head count.

## What is simulated

You buy a farm from the menu, then run one cattle herd. The classic offer is an Otjozondjupa ranch of about 3,300 ha, split into 12 or more camps, with a homestead, windmill, reservoir, and kraal. The herd is 120 head at 450 kg, under a savanna guide of 10 ha per large stock unit.

Each day the camp they stand in loses dry matter at 3% of liveweight, down to a litter floor. Stocking pressure also tramples that camp. Grass does not regrow while cattle are in it. Empty camps recover only when they rest and the soil is moist. No rain, no growth.

The season year runs 1 July to 30 June. Rain is rare in the dry months and common from November to April. The top bar shows the total since 1 July. Sales, lick, diesel, and other running costs move the cash. Costs scale with farm size and herd size from a Reuben benchmark of about N$90,000 a month on 13,000 ha with 500 head.

Every gameplay number, and the speeds and zoom, live in `src/sim/config.ts`. Each one is marked S (sourced) or A (an assumption for play). The simulation code in `src/sim` does not import Phaser.

## Assumptions worth knowing

- Monthly rainfall is an assumed shape that adds up to about 446 mm, inside the range of Otjozondjupa census seasons. Storms are random, but a given seed always plays the same.
- Regrowth speed is assumed. Reuben's rule: grass only recovers in empty camps. Rest without rain does nothing.
- The 50% consumable figure is sourced. Using it as a daily floor under the peak, rather than a once off May budget, is an assumption.
- Camp colour follows how much grazable grass is left, so a camp at the litter floor reads as brown.
- The opening date, the 120 head, the purchase purse, and the map dressing (tree spacing, yard layout, speeds) are assumptions.

Time pauses while a tutorial tip, story card, market sheet, or year end screen is open, then continues at the speed you had selected.

## Tests and deploy

`npm test` covers the pasture maths, the rain season, camp moves, and the rule that the simulation folder does not import Phaser.

`.github/workflows/pages.yml` runs those tests and the production build on pull requests and on `main`. A push to `main` also deploys to GitHub Pages.
