# Roadmap: from prototype to living farm (12 Nov 2026)

Source: Jannes's play test feedback (docs/feedback/2026-11-12/FIX_QUEUE.md with screenshots) plus Teacher Bot lessons in docs/research/:
- camps-water-infrastructure-lesson.md (Namibian camps, water, lick, kraal, ramp; S/A tagged)
- sim-systems-precedents-lesson.md (time, workers, avatar, herding, logistics, notifications, fun, performance)
- fun-and-retention-lesson.md, farm-life-lesson.md

Rule: realistic underneath (Reuben + sourced research, assumptions tagged TODO/A), simple and fun on the surface. Farm must be data driven (camps, ha, waterpoints, herd) so farming app users can later load their own farm.

## Step 1: Foundations and fixes (this PR)
1. Time: default 4 real min per game day at 1x (06:00 to 18:00 daylight 160 s, night 80 s); options 3 and 5 min. Pause/1x/2x/3x. Visible day/night lighting. Clock shown in HUD. Days per month setting (default 3). Grass/rain/weight update per month fraction so balance holds. Sim catches up from elapsed time (hidden tab throttling), fixed sim tick separate from render.
2. Notifications: 4 tiers per sim-systems lesson section 6. Critical (pause, centre) only for true emergencies (first death risk, drought decision). Letters stack in a corner until read. Messages fade and are logged (capped log, about 200). Alerts are a persistent state list with counts (e.g. "Camp 8 worn"). Per type cooldown and dedupe. No more modal every few seconds.
3. Grass readable on main map at every zoom: camp ground tint/texture and tuft density driven by grass condition, consistent with minimap colours. Camp panel shows grazing grown vs eaten.
4. Scale: farm is 3,300 ha (about 5.7 x 5.7 km). Real metres per tile in farm data. Shrink cows, trees, buildings relative to land; more bush and terrain variety; scale bar (e.g. 500 m / 1 km). Far zoom shows herd marker + count; near zoom shows animals in detail.
5. Cows face their direction of travel (8 directions or at least 4 + mirroring done correctly), never sideways or backwards. Walk/graze/idle frames.
6. Herd moves walk the full route via gates and lanes (pathfinding on camp/gate graph, flow field per destination gate is fine). No vanishing between non adjacent camps.
7. Costs explain themselves: each month cost line shows its driver and a hint how to reduce it (prep for step 2 levers).
8. Farm data model: move map, camps (polygon, ha), gates, lanes, waterpoints, infrastructure per camp into a FarmDefinition JSON; current map becomes the default farm. Not every camp has water or lick.

## Step 2: Things to do (next PR)
Cost levers (lick type by season P6/P12 vs protein/urea, diesel vs solar vs windmill, fewer bakkie runs, maintenance vs repair), farmhand visible jobs with a simple work grid (Off/1/2/3), short daily goal + one morning decision, events you can act on (windmill fault, jackal, buyer offer), end of month diary.

## Step 3: Living farm (later PRs)
Farmer avatar living in main house; workers need houses and go home at night; herds only move when farmer or worker drives them (shepherd model); individual animals inside herds, can escape via broken fence/open gate; select a subset and have workers separate it; sales: round up, drive to kraal, crush, ramp, truck loads and leaves; buyer trucks on seeded dates; bakkie drives lick/water runs and burns diesel; windmills, reservoirs, troughs (cows drinking), lick feeders only where a camp has them; horses for workers. Later: buy animals at market delivered by truck, tame and saddle a horse.

## Art
New sprites: cattle truck, delivery truck, bakkie, horses (wild/saddled), workers + farmer (8 dir walk), worker houses, windmill, solar pump, reservoir, troughs, lick feeder, kraal, crush, loading ramp; cows 8 dir walk/graze/drink. Match the isometric RTS reference in docs/ (art-refs). Approach decided per step.
