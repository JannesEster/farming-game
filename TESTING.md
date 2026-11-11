# 10 minute phone check

For Jannes. Use the live site on a phone, in Chrome or Safari:

https://jannesester.github.io/farming-game/

The game saves in this browser. Refresh should put you back on the same date, camp, and grass. Tap **New farm** in the top bar to clear the save and open the default seed again.

## 1. Open it (about 1 minute)

The top bar is one slim row: date in August 2026, season icon, N$ 250,000, rain mm, and small pause or play or fast icons. **Home** and **New farm** sit under the three dot menu on the right. Hints flash as a short toast, not a permanent line. On first load the view should centre on the homestead at a readable zoom: cream house, zinc roof, windmill, round reservoir, trough, wooden kraal, shed, bakkie, and garden without pinching in. Around that yard you should see a **large** red ochre ranch: many fenced camps (12 or more), mostly dry gold grass with red sand showing through, and a few greener rested camps. Camelthorn style trees, pale wire fences with dark posts, and dirt tracks from the homestead to camp gates. **120** small Brahman style cattle should be spread across the opening camp, with a **120 head** label. A small camp minimap (about 90 px) sits in a corner and should stay clear of the collapsed herd strip at the bottom.

## 2. Portrait feel, pan, and pinch (about 2 minutes)

Stay in portrait. Drag the land with one finger. When you let go, the map should coast slightly and then stop. Pinch in and out on one spot. The point between your fingers should stay under your fingers and the map should not drift. The top bar, hint, **Home**, and the minimap should stay tappable.

Double tap an open part of the map (not on the cattle). The view should jump back to the homestead, same as **Home**.

Pinch all the way out. The ranch must stay centred on screen (no flat orange field). You should see **at least four camps** and their **two wire** fences with dark posts. Use the minimap to jump elsewhere. After a full pinch-out, a minimap tap should still land on the tapped camp at about zoom 0.53. Cattle should read as small cows at the opening homestead zoom (not grey dots).

## 3. Landscape (about 1 minute)

Turn the phone sideways. Pan and pinch once. Buttons should still be easy to tap. The herd card and minimap should stay in opposite corners with safe areas respected. Turn back to portrait when you are done.

## 4. Select the herd (about 1 minute)

Tap the cattle once. A one line bottom strip appears (herd name, camp, head count, grass percent). Tap the strip to expand details. Tap the cattle again, tap empty ground, press Escape, or tap the X on the strip to deselect. Drag past the cattle without lifting your finger, then release. The herd should not select from that drag.

## 5. Move them (about 2 minutes)

With the herd selected, tap a nearby camp. The card should offer **Move here** and **Cancel** before they leave. Confirm the move. The cattle should walk as a loose mob (not a single file column), bunch slightly at the gate, and spread again after. On Play they should arrive in about 6 to 10 seconds on a nearby camp. A camp across the farm should take at most about 15 seconds. On Fast, the walk should be clearly quicker than Play (several seconds faster on a long move) but never under about 1.5 seconds. The clock on the top bar should gain a few hours during the walk. Pause should freeze the walk and the clock. When they arrive they spread out again. Grazing only resumes after arrival. The card then switches camp and days in this camp goes back to 0.

Tap the homestead. They should stay put, and the hint should say it is not a grazing camp.

## 6. Time, grass, and move warnings (about 3 minutes)

Tap Fast. After they arrive, grass percent should fall on the camp they occupy. Grass colour still follows camp cover (gold to green by grazable fraction). Leave Fast running until the date moves forward two weeks or more in the dry season. The herd card should show a gold **Time to move** line, and a card should pause the clock until you tap OK. Pause. Tap Play. Tap **Main menu**. The start screen comes back and the slot still has the save.

## Desktop, if you are at a computer

Scroll to zoom on the pointer, drag to pan (with a short coast on release), click the cattle, then click a camp. **Home** and double click on open map recentre on the homestead. Space pauses. F is fast. Keys 1, 2, and 3 are pause, play, and fast. Refresh should restore your save. **Main menu** keeps it. **New game** on the start screen replaces the highlighted slot.

## Automated checks (developers)

`npm test` covers pinch centre, zoom scroll clamping, homestead framing, pan friction, chunked ranch zoom limits, fence wire separation, walk duration and game-clock cost, near gate selection, seed 3300 camp sizes, herd deselect and pending move logic, and organic trek offsets. `npm run capture-artifacts` saves headless phone screenshots and HUD height measurements under `/opt/cursor/artifacts`.

## If something is wrong

Note the phone, the browser, portrait or landscape, and what you tapped. Say whether a refresh brought the save back or sent you to 1 August 2026. Mention if the opening view was too zoomed out to see the farmhouse, if pinch zoom drifted off your fingers, or if pinch-out could not show several camps at once.
