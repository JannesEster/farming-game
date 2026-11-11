# 10 minute phone check

For Jannes. Use the live site on a phone, in Chrome or Safari:

https://jannesester.github.io/farming-game/

The game saves in this browser. Refresh should put you back on the same date, camp, and grass. Tap **New farm** in the top bar to clear the save and open the default seed again.

## 1. Open it (about 1 minute)

The top bar shows a date in August 2026, Dry season, N$ 250,000, rainfall in mm, speed buttons, and **New farm**. You should see a **large** red ochre ranch: many fenced camps (12 or more), gold and green grass variation, camelthorn style trees, dirt tracks from the homestead to camp gates, wire fences with posts, and a homestead with a large farmhouse, windmill, round reservoir, kraal, and shed. Up to 72 small cattle should read as a herd with a **120 head** label. A camp minimap sits in a corner.

## 2. Portrait feel and pinch zoom (about 2 minutes)

Stay in portrait. Drag the land around. Pinch out and back in on one spot on the map. The farm should stay under your fingers and not drift up or down. The top bar, the hint, and the minimap should stay usable. Off screen camps should still pan smoothly (chunk culling).

## 3. Landscape (about 1 minute)

Turn the phone sideways. Pan and pinch once. The buttons should still be easy to tap. Turn it back to portrait when you are done.

## 4. Select the herd (about 1 minute)

Tap the cattle cluster. A card appears with the head count (120), condition, grass in the **current** grazing camp, and days in this camp.

## 5. Move them (about 2 minutes)

Tap a different camp, either on the land or on the minimap. The cattle should **walk** along the track or gate line toward that camp. The hint should say they are walking. The herd label shows an arrow toward the destination. They should not count as grazing the new camp until they arrive. After arrival, the card switches camp and days in this camp goes back to 0.

Tap the homestead. They should stay put, and the hint should say it is not a grazing camp.

Try tapping another camp while they walk. The hint should ask you to wait.

## 6. Time, grass, and move warnings (about 3 minutes)

Tap Fast. While the herd is walking, grass in the camp they left should stop dropping from grazing. After they arrive, grass percent should fall on the camp they occupy. Leave Fast running until the date moves forward two weeks or more in the dry season. The herd card should show a gold **Time to move** line and a short note that a rested camp helps them recover. The camp number on the map where they stand should show **Move** under it.

Pause. Tap Play. Tap **New farm**, confirm the date returns to 1 August 2026 and progress is cleared.

If you have time, move them to a greener camp before grass runs out, or after the warning. Condition should climb again over several rainy days.

## Desktop, if you are at a computer

Scroll to zoom on the pointer, drag to pan, click the cattle, then click a camp. Space pauses. F is fast. Keys 1, 2, and 3 are pause, play, and fast. Refresh should restore your save. **New farm** clears it.

## Automated checks (developers)

`npm test` covers pasture maths, map generation on the 76 by 76 layout, herd path planning, and transit (herd stays in the source camp until the walk finishes).

## If something is wrong

Note the phone, the browser, portrait or landscape, and what you tapped. Say whether a refresh brought the save back or sent you to 1 August 2026.
