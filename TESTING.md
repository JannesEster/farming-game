# 10 minute phone check

For Jannes. Use the live site on a phone, in Chrome or Safari:

https://jannesester.github.io/farming-game/

The game saves in this browser. Refresh should put you back on the same date, camp, and grass. Tap **New farm** in the top bar to clear the save and open the default seed again.

## 1. Open it (about 1 minute)

The top bar shows a date in August 2026, Dry season, N$ 250,000, rainfall in mm, speed buttons, **Home**, and **New farm**. On first load the view should centre on the homestead: you should clearly see the house, kraal, windmill, and water point at a readable size without pinching in. Red sand, gold and green camps, and camelthorn style trees sit around that yard. A small group of cattle stands in a grazing camp elsewhere on the farm. A camp minimap sits in a corner and should not cover the herd card when the herd is selected.

## 2. Portrait feel, pan, and pinch (about 2 minutes)

Stay in portrait. Drag the land with one finger. When you let go, the map should coast slightly and then stop. Pinch in and out on one spot. The point between your fingers should stay under your fingers and the map should not drift. The top bar, hint, **Home**, and the minimap should stay tappable.

Double tap an open part of the map (not on the cattle). The view should jump back to the homestead, same as **Home**.

## 3. Landscape (about 1 minute)

Turn the phone sideways. Pan and pinch once. Buttons should still be easy to tap. The herd card and minimap should stay in opposite corners with safe areas respected. Turn back to portrait when you are done.

## 4. Select the herd (about 1 minute)

Tap the cattle once. A card appears with the head count (120), condition, grass in the current camp, and days in this camp. Drag past the cattle without lifting your finger, then release. The herd should not select from that drag.

## 5. Move them (about 2 minutes)

Tap a different camp, either on the land or on the minimap. The cattle walk there. The card switches to that camp, and days in this camp goes back to 0.

Tap the homestead. They should stay put, and the hint should say it is not a grazing camp.

## 6. Time, grass, and move warnings (about 3 minutes)

Tap Fast. After about twenty seconds the grass percent should fall on the camp they occupy. Leave Fast running until the date moves forward two weeks or more in the dry season. The herd card should show a gold **Time to move** line and a short note that a rested camp helps them recover. The camp number on the map where they stand should show **Move** under it.

Pause. Tap Play. Tap **New farm**, confirm the date returns to 1 August 2026 and progress is cleared.

If you have time, move them to a greener camp before grass runs out, or after the warning. Condition should climb again over several rainy days.

## Desktop, if you are at a computer

Scroll to zoom on the pointer, drag to pan (with a short coast on release), click the cattle, then click a camp. **Home** and double click on open map recentre on the homestead. Space pauses. F is fast. Keys 1, 2, and 3 are pause, play, and fast. Refresh should restore your save. **New farm** clears it.

## Automated checks (developers)

`npm test` includes unit tests for pinch centre, pinch zoom clamps, zoom scroll correction, homestead framing zoom, and pan friction.

## If something is wrong

Note the phone, the browser, portrait or landscape, and what you tapped. Say whether a refresh brought the save back or sent you to 1 August 2026. Mention if the opening view was too zoomed out to see the farmhouse, or if pinch zoom drifted off your fingers.
