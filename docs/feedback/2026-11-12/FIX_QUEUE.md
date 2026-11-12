# Farming game fix queue (from Jannes, 12 Nov 2026)
1. Cows walk sideways, not forwards: when a herd moves vertically (up/down screen, e.g. through a gate between camps) the sprites stay side-on. Need direction-facing sprites/frames (at least up, down, left, right, ideally diagonals for the isometric view) chosen from movement direction. Screenshot: fix-01-cows-sideways.png
2. Can't tell which camps have good grass on the main map (all camps look the same orange/brown), though the minimap shows it. Main map ground should visibly reflect each camp's grass condition (e.g. greener/denser grass tufts for good, bare dusty ground for grazed out), consistent with minimap colours, readable at normal zoom. Screenshot: fix-02-grass-unreadable.png
3. Too many popup messages (every ~5 seconds: "Late rains", "Drought building" etc.), very hard to play. Only truly important events should pause with a modal; routine info/warnings go to a non-blocking toast or news log (corner feed, auto-fade, click to open history). Add cooldown/dedupe so the same warning doesn't repeat. Screenshots: fix-03a-popups.png, fix-03b-popups.png
4. Cows disappear when moving to a non-adjacent/opposite camp: herd walks partway then vanishes (and reappears) instead of walking all the way. Need real pathfinding through gates (via lanes or intermediate camps) so the whole herd visibly walks the full route. Screenshot: fix-04-cows-vanish.png
5. Game speed too fast: UPDATED 11:14: a day at normal (1x) speed should last 3 to 5 real minutes (Jannes). Add day/night cycle: night is about a half to a third of a day's length. Keep fast-forward options (scale them accordingly). Jannes thinks this will also help with popup frequency.
   2b (same issue, more evidence). Zoomed fully out, every camp is the same colour; grass condition must be readable at whole-farm zoom too (camp-wide tint/texture, not just tufts). Screenshot: fix-02b-grass-zoomed-out.png
6. Farmhand does nothing: costs wages but has no visible or gameplay effect. Give him real jobs grounded in Reuben's material (e.g. checking water points/troughs, fence repair, herding moves, counting/tagging), with a visible worker walking the farm, and make his effect on the sim clear (e.g. fewer losses, faster moves). Keep it simple.
   1b (part of fix 1). Cows also walk backwards: sprite facing is flipped relative to travel direction on some segments. Facing must always match movement direction. Screenshot: fix-01b-cows-backwards.png
7. "The game is so so boring" (Jannes, 10:36). Proposed fun pass (awaiting his OK): daily hands-on jobs (check waterpoints, fix fences, tag calves, pick cattle to sell), short goals (e.g. sell 20 oxen before dry season), events you can act on (broken windmill, jackal taking calves, buyer offer), and farm upgrades (waterpoints, fences, kraal). Realism underneath. See sim-game-fun-and-ethical-retention skill.
8. Bills (labour, lick, diesel, repairs...) come out but you can't see what causes them or reduce them. Each cost line should show its driver (e.g. diesel = water runs/vehicle trips, lick = herd size x rate, repairs = fence/windmill wear) and give player levers to cut it (fewer trips, cheaper/seasonal lick choice, solar pump upgrade vs diesel, maintenance vs repair). Ground in NAU budget/Reuben figures; mark assumptions TODO. Ties into fun pass (#7). Screenshot: fix-08-costs-opaque.png
9. Land scale wrong: farm is meant to be 3,300 ha (~5.7 x 5.7 km) but looks ~200 x 200 m. Cows, trees, buildings are far too big relative to camps (camp 8 = 154 ha). Shrink sprite scale relative to land, much more bush/space/terrain variety, add a scale bar (e.g. 1 km). Keep animals readable via zoom (close-up detail) and herd marker/label at far zoom. Screenshot: fix-09-scale.png

NOTE (design direction, not a fix): future goal is for farming app users to visualise/play their own farm. Keep map, camps (polygons, ha), waterpoints, scale and herd as data-driven farm definitions loadable from external data later; real metres-to-tile scale (ties to fix 9).

10. LIVING FARM (big feature, Jannes 10:54, "all we have is time, decent base now"):
   - Workers visibly move around the farm doing jobs (extends fix 6).
   - Animals act as individuals (own position/behaviour); one could technically escape a camp (e.g. via broken fence/open gate).
   - Selling: worker walks to the camp, rounds up the sold animals, drives them to the loading station/kraal, they're loaded onto a truck that drives off.
   - Select and separate specific animals within a herd; workers round them up and move them to another camp/area.
   - Bakkie/vehicle drives around when appropriate (water checks, lick delivery, trips) to show diesel use (ties to fix 8).
   - Camps show their infrastructure: water sources (windmill/borehole, solar pump, reservoir, troughs), lick troughs/feeders etc. NOT every camp has it; layout realistic.
   - More detail: close up you can almost see a cow drinking from a trough.
   - Research first: ask Teacher Bot about Namibian farm infrastructure, water trough/waterpoint placement, lick placement, kraals/loading ramps.

11. PEOPLE & HORSES (Jannes 11:14, part of living farm step 3+):
   - Workers must have their own houses (can't hire without one); workers walk home at night.
   - Player avatar = the farmer, lives in the main house.
   - Herds never move by themselves: the farmer or workers must physically drive them between camps.
   - Buy horses for workers to reach camps faster.
   - Later: buy animals at the market, delivered by truck; e.g. buy 5 horses, keep in own camp, a worker tames one, it gets a saddle and becomes his transport.

12. NEW ART NEEDED (Jannes 11:21): trucks (cattle truck, delivery), bakkie, horses (wild + saddled), workers + farmer avatar (walk cycles all directions), worker houses, windmills/boreholes, solar pumps, reservoirs, detailed water troughs (cows drinking), lick feeders, kraal, crush, loading ramp; cows with directional walk/graze/drink animations. Include art approach in the plan.
