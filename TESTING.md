# 10 minute phone check

For Jannes. Use the live site on a phone, in Chrome or Safari:

https://jannesester.github.io/farming-game/

The game saves in this browser. Refresh should put you back on the same date, camp, and grass. Tap **New farm** in the top bar to clear the save and open the default seed again.

## 1. Open it (about 1 minute)

The top bar shows a date in August 2026, Dry season, N$ 250,000, rainfall in mm, speed buttons, and **New farm**. You should see a **large** red ochre ranch: many fenced camps (12 or more), mostly dry gold grass with red sand showing through, and a few greener rested camps. Camelthorn style trees, pale wire fences with dark posts, and dirt tracks from the homestead to camp gates. The homestead has a cream house with a grey zinc roof, windmill, round reservoir, trough, wooden kraal, corrugated shed, white bakkie, and a small vegetable garden. **120** small Brahman style cattle should be spread across the opening camp, with a **120 head** label. A camp minimap sits in a corner.

## 2. Portrait feel and pinch zoom (about 2 minutes)

Stay in portrait. Drag the land around. Pinch out and back in on one spot on the map. The farm should stay under your fingers and not drift up or down. The top bar, the hint, and the minimap should stay usable.

## 3. Landscape (about 1 minute)

Turn the phone sideways. Pan and pinch once. The buttons should still be easy to tap. Turn it back to portrait when you are done.

## 4. Select the herd (about 1 minute)

Tap the cattle. A card appears with the head count (120), condition, grass in the current camp, and days in this camp.

## 5. Move them (about 2 minutes)

Tap a nearby camp. The cattle should tighten into a column, leave through the gate on the shared fence, and walk there in about 6 to 10 seconds on Play. A camp across the farm should take at most about 15 seconds. On Fast, the walk should take at least about 1.5 seconds. Pause should freeze the walk. When they arrive they spread out again. Grazing only resumes after arrival. The card then switches camp and days in this camp goes back to 0.

Tap the homestead. They should stay put, and the hint should say it is not a grazing camp.

## 6. Time, grass, and move warnings (about 3 minutes)

Tap Fast. After they arrive, grass percent should fall on the camp they occupy. Grass colour still follows camp cover (gold to green by grazable fraction). Leave Fast running until the date moves forward two weeks or more in the dry season. The herd card should show a gold **Time to move** line. Pause. Tap Play. Tap **New farm**, confirm the date returns to 1 August 2026.

## Desktop, if you are at a computer

Scroll to zoom on the pointer, drag to pan, click the cattle, then click a camp. Space pauses. F is fast. Keys 1, 2, and 3 are pause, play, and fast.

## Automated checks (developers)

`npm test` covers near gate selection, walk duration bounds, single-point transit advance, and seed 3300 camp sizes.

## If something is wrong

Note the phone, the browser, portrait or landscape, and what you tapped.
