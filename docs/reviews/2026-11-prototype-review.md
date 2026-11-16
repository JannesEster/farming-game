# Prototype review, 11 November 2026

Reviewed commit `a6ee555` on main, the Otjozondjupa prototype from PR 1. The comparison texts are the Namibian livestock lesson, the farm life lesson, the fun and retention lesson, and the visual blueprint. Farm life section 8 and fun lesson section 8 are design notes, not farm facts. Where a source is silent, this review says so. Game code was not changed. `npm test` passed in this review: 19 tests in 2 files. Default farm figures below are from running seed 3300.

The visual blueprint is a records app, not this screen. This review uses it for camps and rain gauges. The screen plan checked here is a top bar (date, season, N$, rain, speed), one selection card, a small build menu, and a minimap.

## Must fix before vertical slice

1. Pinch zoom and the mouse wheel let the farm slide vertically away from the pointer. Horizontal scroll is corrected after the zoom, and the vertical line adds the new vertical position minus that same position, so the fix is always zero (`src/render/FarmScene.ts`, line 553).

2. Grazable grass hits zero at half of the camp peak, and condition starts falling on that line. Kruger counts half of the dry matter actually standing, once, at the end of the growing season (livestock lesson, lines 87 to 92), so the default opening camp is called empty on 4 August 2027 at 727.5 kg/ha, when half of that standing grass would still be about 364 kg/ha.

3. The grazing decision never uses the cited rhythm of 1 to 2 weeks grazing and about 6 weeks rest in the growing season, or a withdrawal of at least six weeks after rain (livestock lesson, lines 45 to 46). Left in the opening camp, condition stays at 100 until 4 August 2027 (day 368), so the first season does not punish standing still.

## Should fix

1. Daily intake is 3% of liveweight, which is Kruger's planning figure (livestock lesson, line 89), and the same lesson says cattle may eat only 2.19 to 2.34% (line 94). The herd therefore uses the higher planning figure with no cattle note, and the 270 day budget to about February (lines 90 to 91) is missing, so nothing asks whether the whole farm lasts to the next green season.

2. A rested camp grows at 70% of full speed the day the cattle leave when soil moisture is at the 24 mm full mark, so the sourced six weeks only fill in the last 30%. The sources are silent on daily regrowth kilograms, so 14 kg/ha, the 0.2 factor while occupied, and that 0.7 floor are assumptions.

3. Carrying capacity is fixed at 10 ha per LSU on all 3,300 ha, so the 8 ha yard still counts, and the player never sees it. Ten hectares is the top of an indicative 8 to 10 quote (livestock lesson, line 34), that lesson says not to hardcode a regional capacity (line 35), and the farm life lesson has no official Otjozondjupa figure (lines 316 and 773).

4. The condition and grass bars stay hidden until the cattle are tapped, and on this seed condition is already 100 by 1 November 2026 and stays there until 4 August 2027 if the herd is not moved. The days left line and the "Condition is falling" line are in the `extra` class, which is hidden at a viewport height of 340 px or less, and the rain pill shows only millimetres, with "since 1 July" stored in a title attribute.

5. A minimap tap always takes the move path. If the herd is not selected, the camera still recentres and the hint becomes "Tap the herd first."

6. Seeds 7, 20, and 38 each produced one camp in two pieces in a check of seeds 1 to 40, because the homestead is stamped on as a rectangle and camps are not rejoined, and the layout tests do not check this. Seed 3300, the farm the game opens, has eight camps and each is one piece.

7. There is no save, so a refresh returns to 1 August 2026, which the README already says. The fun lesson treats instant resume as a phone design opinion (lines 257 to 261), not as a measured fact.

8. The screen plan is a top bar with date, season, N$, rain, and speed, one selection card, a small build menu, and a minimap. This build has that top bar, plus the farm name on wide screens and a hint line, one herd card, and a minimap, and it has no build menu, while cash stays at N$ 250,000 because the config puts sales, wages, and building out of scope.

9. Tests cover intake, the litter floor, growth, condition clamps, the 1 July rain reset, rain shape over 12 years, moves, determinism for seeds 1 to 12, and a check that the sim folder does not mention Phaser. They do not cover seed 3300, split camps, soil moisture, the yearly rain total, condition recovery after a move, or zoom.

10. At one game day per second, the fun lesson's median simulation session of 3.9 to 4.3 minutes (line 241) is roughly 240 to 260 game days, and on this seed day 220 (9 March 2027) still has condition at 100 and opening camp grass at 35.7%, down from 81% on 1 August. A move onto a rested camp followed by 10 dry days raised condition from 98.5 to 100, and there is still no sale, no week summary, and no goal on screen (fun lesson section 8, marked there as suggestions).

## Later

1. The pasture sim is plain TypeScript, it does not import Phaser, and the tests check that boundary. `GameState` is plain data with one herd object, one cash number, and no event list, worker, species, or save version, so more herds, sheep, shocks, hiring, and old saves need a change to the day step and the types, not only a new config field.

2. Liveweight is stored and LSU is head times kilograms divided by 450, which follows the livestock lesson, line 31. There are no herd classes and no second species, and the 6 small stock units per LSU note on line 30 is unused, which matches a cattle only prototype and is the gap when sheep are added.

3. Weight never changes, so the 500 g per day gain inside the LSU definition (livestock lesson, line 30) is missing, and so is the note that visible condition loss already means about 70 kg (line 95). The sources are silent on a 0 to 100 score, so the starting 76, the 2.2 point drop, and the 0.55 point gain are assumptions.

4. Bush is a once off peak cut down to 60% of 1,600 kg/ha, the mild end of the 40 to 50% wetter area loss in the livestock lesson, line 101, and it never gets worse. The 1 to 2% yearly creep in farm life section 8.6 is marked there as an assumption, and the sources give no Otjozondjupa percent of its own.

5. The windmill, reservoir, and troughs are drawn and never limit grazing. The lessons describe where water should sit and do not give a drinking volume, so a litres rule would be an assumption.

6. On a full moisture day an occupied camp grows 2.8 kg/ha, and the two largest default camps only need 2.58 and 2.68 kg/ha to feed this herd, so they can gain grass while the cattle stand there. Under the default rain, camp 2 still fell from 907 to 611 kg/ha in the first 181 days, and 60 days of forced 30 mm rain raised it only from 907 to 921.

7. The opening card says 4 days in the camp, those days were not simulated, and the rain repeats one monthly climate instead of the below normal 2026/27 outlook (livestock lesson, line 20). The fun lesson's suggested diary, storytellers, named workers, and sound are absent, while time already moves only while the tab runs, which matches its suggestion that being away should not kill stock (lines 529 to 531).

8. 3,650 daily steps took 7.6 ms in this environment, and the default scene is 1,156 tile sprites, 21 trees, 52 bushes, and 6 cattle, with a catch-up cap of 200 ms and 3 days per frame. This Phaser bundle stores the device pixel ratio and does not read it again, the game does not set a canvas resolution, and this review did not measure a frame time on a mid range phone.

## Sim numbers

Each line is a number or rule the sim runs. The verdict is sourced, assumption, or wrong or missing.

1. **Sourced.** One LSU is 450 kg (livestock lesson, line 30). The model divides total liveweight by 450, which is what line 31 asks.

2. **Missing.** That same LSU definition gains 500 g per day (livestock lesson, line 30). Every head stays at 450 kg for the whole run.

3. **Assumption.** Treating all 120 head as 450 kg animals is marked as an assumption in config. The sources are silent on this herd size.

4. **Sourced figure, cattle range unused.** Demand is 3% of liveweight per day, 1,620 kg for this herd (livestock lesson, line 89). Line 94 says cattle may eat 2.19 to 2.34%, so 3% is a high planning figure for cattle, and the game does not say that.

5. **Wrong.** The 0.5 fraction is sourced (livestock lesson, line 88), but Kruger applies it once to standing dry matter in a May budget (lines 86 to 92), and the game instead keeps a permanent floor at half of each camp's peak every day.

6. **Missing.** The same budget plans at least 270 days, about nine months, to February (livestock lesson, lines 90 to 91). The card only counts days left in the current camp above the floor.

7. **Sourced number, assumption in use.** Six weeks is 42 days (livestock lesson, line 45), and the code uses those 42 days as a ramp that already runs at 70% on the day rest starts. The 0.7 floor, the 0.2 occupied factor, and 14 kg/ha per day are assumptions, and the sources are silent on those three.

8. **Sourced principle, partly present.** Line 60 says a six week rest is of no use if no rain fell. Growth is zero when soil moisture is zero, and moisture kept overnight can still grow grass on a later dry day, which the source does not describe.

9. **Missing.** The growing season rule is 1 to 2 weeks of grazing, and animals should be withdrawn for at least six weeks after rain (livestock lesson, lines 45 to 46). Days in camp are shown and never warned on.

10. **Sourced range, assumption inside it.** The photo guide runs from about 30 to 2,200 kg dry matter per ha (livestock lesson, line 93), the game clamps to that range, and the open peak of 1,600 plus a starting cover of 58% to 96% are assumptions inside it.

11. **Sourced range, assumption in use.** Encroachment cuts capacity by 40 to 50% in wetter areas and 70 to 90% in arid areas (livestock lesson, line 101), and a bushy camp keeps 60% of the open peak, the mild end of the wetter range, with no per camp formula in the sources.

12. **Assumption.** Monthly rain is a made up shape summing to 446 mm, inside the Otjozondjupa census seasons of 548, 287, and 503 mm (farm life lesson, line 316) and matching none of them, and the sources are silent on a monthly split. A 400 year draw averaged 439 mm, and the highest day was 76.5 mm, under the assumed 80 mm cap.

13. **Assumption.** Rain day chances, the 24 mm moisture target, and keeping 88% of soil moisture overnight are not in the sources. June has a 0.02 rain day chance and a 0 mm mean, so June never rains.

14. **Sourced.** The rainfall season runs 1 July to 30 June (livestock lesson, line 314). The total resets on 1 July, and that day's rain joins the new season.

15. **Assumption.** The rainy label is November to April, which farm life design note 8.2 states and marks as an assumption (line 571), while the livestock lesson says most rain falls September to April and also says May to September is dry (line 314). September and October are labeled dry here and still have 5 mm and 15 mm in the table.

16. **Assumption.** The game starts on 1 August 2026, the sources are silent on a start date, and the fun lesson suggests opening in the late summer rains (line 501), which this build does not do.

17. **Missing.** The blueprint allows up to 10 rain gauges (line 74), this farm has one rain total for every camp, and the sources are silent on a spatial rain formula.

18. **Assumption.** Condition is a 0 to 100 score, starting at 76, losing 2.2 points on a day with no feed and gaining 0.55 when the day is fully fed. The sources are silent on any such scale.

19. **Sourced, rounded.** The farm is 3,300 ha. The census average for Otjozondjupa commercial farms is 3,327 ha (farm life lesson, line 316), and design note 8.1 rounds the cattle template to 3,300.

20. **Assumption, official figure missing.** Choosing 10 ha per LSU takes the top of an indicative 8 to 10 quote that the livestock lesson says not to hardcode (lines 34 to 35), and farm life lines 316 and 773 have no official Otjozondjupa table.

21. **Assumption.** The yard is 8 ha, the sources are silent on a homestead area, grazing land on this farm is 3,292 ha, and carrying capacity still divides 3,300 by 10.

22. **Assumption.** 120 head at 450 kg is 16.4 kg of liveweight per grazing hectare, lighter than the cited average of about 25 kg per ha (livestock lesson, line 38), and the sources do not prescribe 120 head. That stocking is 27.4 ha per LSU against the 10 ha per LSU figure above.

23. **Sourced, unused in play.** Otjozondjupa agricultural land was N$1,951.17 per ha in the 2023 index (farm life lesson, line 511). The config rounds to 1,951 and does not spend it.

24. **Assumption.** Opening cash is N$ 250,000 and never changes, and the sources are silent on a starting cash float. A note that a 5,000 ha cattle farm grossed about N$400,000 a year at the manual's prices (livestock lesson, line 327) is not cash on hand.

25. **Sourced direction, assumption on the roll.** NAU recommends at least six camps per herd (livestock lesson, line 58) and the blueprint says not to hard code an eight camp plan (line 109), while this farm rolls 6, 7, or 8, which the sources do not specify. Seed 3300 rolled 8.

26. **Missing from the model, sources not silent.** Births, deaths, sales, classes, licks, and the May destock decision are in the livestock lesson and are not simulated. The README says selling, wages, events, and saving are out of scope for this build.
