# How RTS, colony and farm sims handle our core systems: a lesson for Farming Game

Prepared by Teacher Bot, 12 Nov 2026 (Perth). Builds on `fun-and-retention-lesson.md`, `farm-life-lesson.md` and `camps-water-infrastructure-lesson.md`. Does not repeat them.

**How to read this**

* **[n]** points to the numbered sources in section 11. Every key number has one.
* **UNVERIFIED** means I could not confirm it on a primary or wiki page this session (for example, only a search summary, a forum post, or a page that blocked my fetch).
* Each section ends with **Recommendation for our game**. Each proposal is tagged:
  * **S** = sourced precedent (another game or a paper does this, cited);
  * **A** = our assumption or design judgement, to be playtested.
* Wikis describe game versions that change. Re-check a number before you copy it into a spec.

---

## 0. Summary table: top recommendations

| # | Topic | Recommendation | Tag |
|---|---|---|---|
| 1 | Time | Default day of 4 real minutes at 1x: 160 s daylight, 80 s night (night = 1/3 of real time, 1/2 of game hours). Options for 3 and 5 minutes. | A, built on S [1][3][5][6] |
| 2 | Time | Pause, 1x, 2x, 3x. Auto drop to 1x and pause on critical events, with a setting to turn that off. | S [3][5][18][46] |
| 3 | Time | Year = 12 months x "days per month" setting (default 3, range 1 to 7, plus 28 for realism). Grass, rain and weight update per month fraction, jobs per day. | S [14][16][17] + A |
| 4 | Workers | Work grid: rows = workers, columns = job types, cells Off / 1 / 2 / 3. Left to right breaks ties. Right click to "do this now". | S [19][21] |
| 5 | Workers | Simple schedule strip per worker (Sleep, Work, Free) and needs that override work only below thresholds. | S [5][20] |
| 6 | Avatar | The player is the farmer on the map and works faster than workers; workers are assigned to places, not micro managed. | S [24][26][27] |
| 7 | Herding | The herd is the unit; animals are individuals inside it. Select a herd by camp, order "move to camp X", a herder drives it. | S [31][33][35][36] + A |
| 8 | Herding | Camp panel shows grazing grown vs eaten (like RimWorld's pen marker Food tab). Open gates let animals spread. | S [33] |
| 9 | Logistics | Buyers' trucks come on seeded dates at least 6 days apart, stay a limited time, carry a limited budget. | S [37] |
| 10 | Logistics | Bakkie and truck fuel in litres per hour, shown on a gauge; refuel at the yard tank. | S [42] |
| 11 | Notifications | Four tiers: Critical (pause, centre), Letter (colour coded, stacks until read), Message (fades, logged), Alert (persistent state list with counts). | S [4][20][43][45][46] |
| 12 | Fun | Short goal per day, decision per morning, storyteller presets, end of month diary. See `fun-and-retention-lesson.md`. | S (earlier lesson) |
| 13 | Performance | Fixed sim tick separate from render; tick far or calm animals rarely; flow fields per gate or trough; spatial hash; sim in a Web Worker if needed; Phaser 4 WebGL with GPU layers. | S [7][51][52][55][57][58][60][61][62] |

---

## 1. Time

### 1.1 What the games actually do (sourced numbers)

| Game | Real time per in-game day at 1x | Day and night split | Speeds | Year or season | Source |
|---|---|---|---|---|---|
| Stardew Valley | 14 min for the playable 6am to 2am (0.7 s per game minute; 7 s per 10 minutes; 42 s per hour). GQ quotes "about 17 minutes" (likely with pauses; **UNVERIFIED** why they differ) | Dark from 8pm (spring, summer), 7pm (fall), 6pm (winter). 2am to 6am is skipped by sleeping | No speed control; time pauses in menus and dialogue in single player | Week 1 h 38 min, season (28 days) 6 h 32 min, year 26 h 8 min | [1][2] |
| RimWorld | 16 min 40 s (60,000 ticks at 60 ticks/s; 2,500 ticks per game hour, about 42 s) | Light follows season and latitude; plants grow 06:00 to 19:12 | Pause; speed 1 = x1, 2 = x3, 3 = x6; speed 4 = x15 (dev mode only). The UI page instead says "normal, 3x, 5x": the two wiki pages disagree, **UNVERIFIED** which is current | Quadrum 15 days (4 h 10 min), year 60 days (16 h 40 min at x1) | [3][4] |
| Oxygen Not Included | 600 s (10 min) per cycle | 525 s day, 75 s night (night 12.5%) | 1x, 2x, 3x (debug 10x). Engine about 5 ticks per second (wiki, from experiments) | No seasons; cycles only | [5] |
| Factorio (Nauvis) | 25,200 ticks = 7 min | Day 210 s, sunset 84 s, night 42 s, sunrise 84 s (full dark only 10%) | Normal speed 60 ticks per second | None | [6] |
| Minecraft | 20 min | Day 10 min, sunset 50 s, night 8 min 20 s, sunrise 50 s (night about 42%) | None | Lunar cycle 8 days | [8] |
| Don't Starve | 8 min, sixteen 30 s segments | Day, dusk, night segments shift with season; in winter night is "about 1/3 of the clock" | n/a | Seasons cycle 36 days in the base game | [9] |
| Dwarf Fortress (fortress mode) | 1,200 ticks; at 100 FPS a day is 12 s | n/a | Speed = frame rate; capped at 100 FPS by default | Year 403,200 ticks; about 1 h 7 min at 100 FPS, 1 h 52 min at 60 FPS | [7] |
| Banished | Not published as day length | n/a | 1x up to 10x | "A year in game will pass in about an hour" at normal speed (fandom wiki); a player measured about 25 min (forum, **UNVERIFIED**); about 10 min at 10x (Banished Wiki). 12 seasons per year | [10][11][12] |
| Against the Storm | n/a (no day) | n/a | Speed controls exist (not re-sourced) | Drizzle 4:00, Clearance 4:00, Storm 2:00 (4:00 at Prestige 2+): a year is 10 or 12 minutes. Traders do not arrive during Storm | [13] |
| Farming Simulator 25 | At 1x, 24 h (real time). Options 0.5x, 1x, 2x, 3x, 5x, 6x, 10x, 15x, 30x, 60x, 120x, 240x, 360x. At 120x a day is about 12 min | Realistic | Sleep in the farmhouse to skip to a chosen hour | "Days per month" 1 to 28; crops advance a growth stage when the month ends | [14][15][16][17] |

Notes:

* The 5x FS default sometimes quoted applies to dedicated servers; one guide says "The default is 5x" there [15]. Single player default is **UNVERIFIED**.
* RimWorld forces the game to slow down in combat. Players asked for an off switch; one reply in that thread (attributed to Tynan Sylvester in search results, author header not captured, so attribution **UNVERIFIED**) says: "I've observed people consistently screw themselves over when given the chance to skip through battles. And, they miss interesting story points" [18].
* Dwarf Fortress lets players choose which announcement types pause and recentre the game [46].

### 1.2 Patterns worth copying

1. **Fixed ticks, displayed as a clock.** RimWorld, Factorio and DF all count ticks and derive the calendar; speed changes the tick rate, not the rules [3][6][7]. RimWorld also has "rare" ticks every 250 ticks (4.16 s) and "long" ticks every 2,000 ticks (33.3 s) for slow processes [3].
2. **Short, uneven nights.** ONI's night is 12.5% of the cycle and Factorio's full dark is 10% [5][6]. Minecraft's night is about 42% [8]. Stardew skips 2am to 6am entirely, and counts each of those hours as 100 minutes for machines [1].
3. **Season length as a setting.** FS lets players pick 1 to 28 days per month [14][16]. FS advances crop growth at the end of the month, so fewer days per month just means fewer working days per month [17].
4. **The day as a stopping point.** Stardew saves only when you sleep [1]. The earlier lesson covers why a short day helps "one more day" [2].
5. **Very short years work for session based games.** Against the Storm's 10 to 12 minute year fits a whole season cycle into one sitting [13].

### 1.3 Concrete options for 3 to 5 real minutes per day, with night 1/3 to 1/2

Definitions: C = real seconds per 24 game hours at 1x. f = share of C that is night. Constraints from Jannes: 180 s ≤ C ≤ 300 s and 1/3 ≤ f ≤ 1/2. So night lasts between 60 s (C = 180, f = 1/3) and 150 s (C = 300, f = 1/2) of real time.

I use daylight 06:00 to 18:00 (12 game hours) and night 18:00 to 06:00 (12 game hours) for clean math. Running night hours at a faster rate (like Stardew's 2am to 6am trick [1]) lets night be half the clock but only a third of real time.

| Option | C | Daylight (real) | Night (real) | f | Seconds per game hour, day / night | Time scale vs real life |
|---|---|---|---|---|---|---|
| A. Even 4 | 240 s | 120 s | 120 s | 1/2 | 10 / 10 | 86,400 / 240 = 360x |
| **B. Short night 4 (proposed default)** | 240 s | 160 s | 80 s | 1/3 | 13.33 / 6.67 | 360x on average |
| C. Quick 3 | 180 s | 120 s | 60 s | 1/3 | 10 / 5 | 480x |
| D. Relaxed 5 | 300 s | 200 s | 100 s | 1/3 | 16.67 / 8.33 | 288x |
| E. Relaxed 5, longer night | 300 s | 180 s | 120 s | 2/5 | 15 / 10 | 288x |

Check for B: 12 h x 13.33 s = 160 s; 12 h x 6.67 s = 80 s; 160 + 80 = 240 s = 4 min; 80 / 240 = 1/3.

With speed buttons (A, following ONI's 1x/2x/3x [5]):

| Option | 1x day | 2x day | 3x day |
|---|---|---|---|
| B (4 min) | 240 s | 120 s | 80 s |
| C (3 min) | 180 s | 90 s | 60 s |
| D (5 min) | 300 s | 150 s | 100 s |

Year length at 1x with option B (C = 240 s), year = 12 months x days per month (dpm):

| dpm | Days per year | Real time per year at 1x | At 3x |
|---|---|---|---|
| 1 | 12 | 48 min | 16 min |
| 2 | 24 | 1 h 36 min | 32 min |
| **3 (proposed default)** | 36 | 2 h 24 min | 48 min |
| 4 | 48 | 3 h 12 min | 1 h 4 min |
| 7 | 84 | 5 h 36 min | 1 h 52 min |
| 28 (FS maximum, "realism") | 336 | 22 h 24 min | 7 h 28 min |

For comparison at 1x: Stardew year 26 h 8 min [1]; RimWorld 16 h 40 min (5 h 33 min at x3, 2 h 47 min at x6) [3]; DF about 1 h 7 min at 100 FPS [7]; Banished about 1 h (fandom) [10]; Against the Storm 10 to 12 min [13].

**Conflict to resolve with the earlier lesson.** `fun-and-retention-lesson.md` suggested "one game week, about 4 minutes on phone". Jannes now wants 3 to 5 minutes per day. Option B makes **one game day** the 4 minute phone unit (matching the 3.9 to 4.3 min simulation session median cited there). The weekly diary becomes an end of month diary (every 3 days at dpm 3, about 12 minutes).

**Ecology vs calendar (A, built on FS [17] and the camps lesson [67]).** At dpm 3, one game day stands for about 10 farm days. So:
* daily jobs (water round, lick check, counting) run once per game day;
* slow processes (grass growth, weight gain, rain totals, camp rest periods from the camps lesson) run per month fraction, so each game day applies 1/dpm of a month.
This keeps the real rotation numbers (for example 4 to 6 days per camp in the growing season) true at any dpm, by converting them to "share of a month".

### Recommendation for our game (time)

1. **A:** Default option B: 4 real minutes per day, 160 s daylight, 80 s night. Offer C (3 min) and D (5 min) as "Day length" settings.
2. **S:** Pause, 1x, 2x, 3x, with keys Space, 1, 2, 3 (ONI 1x/2x/3x [5]; RimWorld Space to pause [3]).
3. **S:** Auto slow to 1x on a red event (RimWorld [18]); let players choose per event type whether it also pauses or recentres (DF [46]). Players complained about forced slowdown in long sieges [18], so the setting matters.
4. **S + A:** "Days per month" setting, default 3, range 1 to 7, plus 28 [14][16]. Slow processes scale per month [17].
5. **A:** Night fast forward: when the farmer is in bed and every worker is asleep, offer "Sleep till dawn" that runs night at 6x behind a short summary card. Stardew style save on sleep [1].
6. **S:** Fixed tick clock with rare and long ticks for slow systems [3].
7. **A:** Season daylight drift is optional polish (Stardew moves nightfall by season [1]); keep 12/12 for the first build.

---

## 2. Workers and pawns

### 2.1 Job queues and priorities

* **RimWorld work tab** [19]:
  * Standard mode: tick boxes; columns on the left are more important than columns on the right.
  * Manual mode: each colonist and work type gets 1 (highest) to 4 (lowest); blank means never. Same number: leftmost column first.
  * "All available work of one priority will be done before the next priority." Hauling at 1 means hauling everything, even across the map, "They have no regard for efficiency."
  * Cell outline shows skill (red to white to yellow), flames show passion; a "crunch" sound warns when you assign someone bad at it.
  * Direct order: select a colonist, right click a target, choose; Shift queues several. Only work types they are assigned to.
  * Colonists only work in their allowed area.
* **Oxygen Not Included** [21][22] (wiki excerpts via search; the wiki blocked direct fetch):
  * Per duplicant category priority: Very High, High, Standard, Low, Very Low, Disabled.
  * Per task sub priority 1 to 9 (default always 5). Category always beats sub priority.
  * Ties use hidden priorities, or the closest task if "Enable Proximity" is on ("better for larger colonies").
  * Personal needs (bathroom, eating, sleeping) always win unless Red or Yellow Alert is on.
  * "A busy Duplicant will continue to work on their current errand until it's complete, even if a higher priority errand becomes available."
* **Banished professions** [23]:
  * You set how many citizens do each profession; unassigned citizens are laborers.
  * When a professional has nothing to do (farmers in winter, builders with no queue) they do laborer work, then switch back.
* **Stronghold** [24]: placing a woodcutter's hut turns a peasant into a woodcutter. Peasants wait at the campfire for jobs; the campfire holds a limited number, so new peasants stop coming until you create jobs.
* **Medieval Dynasty** [26]: villagers are assigned to a building and a task, with an "intensity" percentage (the guide's example: a cook at 45% makes about 13.5 meat a day). Red icons flag no worker, no task, or no resources.

### 2.2 Needs, housing and sleep

* **RimWorld schedule** [20]: per colonist, per hour: Anything, Work, Recreation, Sleep (Meditate with DLC).
  * Under "Anything" they work unless recreation < 35%, food < 30%, rest < 30%.
  * Under "Sleep" they still work unless food < 30% or rest < 75%.
  * Pawns finish the current task before checking schedule. Permanent work "has a high chance of mental breaks".
* **ONI schedule** [5]: 24 blocks of 25 s. Default: 1 Bathtime, 18 Work, 2 Downtime, 3 Bedtime. Each extra Downtime block adds +1 Morale up to +4.
* **Stronghold** [24]: housing (hovels) caps population; popularity under 50 shows red and people leave.

### 2.3 Showing what they are doing

* RimWorld: inspect pane bottom left when selected; colonist bar at the top with "names, appearance, and status icons"; queued jobs shown in the inspect pane [4][19].
* Medieval Dynasty: red icons on buildings for missing worker, task, or resources [26].
* Factorio puts warning icons directly on the entity (no fuel, no power, no ammo) [45]. Workers in our game can borrow this: an icon over the worker's head when blocked.

### Recommendation for our game (workers)

1. **S:** Work grid like RimWorld manual mode but smaller: 3 levels (1, 2, 3) plus Off; left to right tie break [19]. Job types: Water round, Lick, Fences, Herding, Repairs, Hauling, Building, Vet care (A).
2. **S:** "Do this now": select a worker, right click a target (a broken trough, a gate) [19]. Shift to queue.
3. **S:** Finish current task before switching, as both RimWorld and ONI do [20][22]. Show "will switch after this" text (A).
4. **S:** Idle specialists fall back to general work, like Banished laborers [23].
5. **S:** Schedule strip per worker with Sleep, Work, Free; needs override at thresholds [5][20]. Default: sleep through the 80 s night (A).
6. **S:** Housing caps worker count; unhoused workers leave (Stronghold housing and popularity [24]; also `farm-life-lesson.md`).
7. **S + A:** Each worker shows a one line status ("Checking trough, Camp 7") plus an icon above the head when blocked (no diesel, no lick in store) [4][45].
8. **A:** Proximity tie break on by default (ONI says it suits larger colonies [21]) because farm distances are large.

---

## 3. Player avatar plus workers on one map

| Game | Avatar? | Workers? | How they combine | Source |
|---|---|---|---|---|
| Stardew Valley | Yes, the farmer | No hired workers (Junimo huts exist; not re-sourced, **UNVERIFIED** detail) | The day is bounded by energy and the clock | [1] |
| Medieval Dynasty | Yes, first person | Villagers assigned to buildings via a Management menu | Player can do almost every job and "will always work quickly and more efficiently than a villager"; but the Animal Breeder job cannot be done by the player | [26] |
| Graveyard Keeper | Yes | Zombies assigned to stations | Zombie efficiency rises with "white skulls"; max 40% | [27] |
| Stronghold | The Lord is a unit on the map | Peasants auto assigned when you place a workplace | Player manages from above; the Lord matters as a unit | [24] |
| Ranch Simulator | Yes, first person | No hired workers found this session (**UNVERIFIED**) | Player does everything: whistle (H) at an animal to make it follow; Ctrl+H to release | [28][29] |
| RimWorld | No avatar | Colonists are all workers | "Draft" gives direct control, but drafted colonists only take combat actions and "they'll starve and become unhappy" if left drafted | [25] |
| Kenshi, Going Medieval, Farm Together, Sons of the Forest | Not verified this session | | | gap |

Patterns:

1. **The avatar is the best worker but cannot be everywhere.** Medieval Dynasty states this outright [26]. This is the reason to hire.
2. **Workers are assigned to places, not steered.** Medieval Dynasty (building plus task) [26], Graveyard Keeper (station) [27], Stronghold (workplace) [24].
3. **Some jobs only workers do.** Medieval Dynasty's Animal Breeder [26] makes workers essential, not just faster.
4. **Direct control is a mode with costs.** RimWorld drafting stops normal needs care [25].

### Recommendation for our game (avatar plus workers)

1. **S:** The farmer is on the map, does any job, and does it faster than a worker [26]. Workers are 50 to 80% as fast at first and improve with skill (numbers A).
2. **S:** Workers are assigned to a job type and an area (camp group or yard), not walked around by hand [19][26].
3. **A:** Give the farmer jobs only the farmer can do: buying and selling at the auction, talking to the vet and neighbours, signing movement permits (fits `farm-life-lesson.md` paperwork). Give workers jobs the farmer is bad at, such as tracking (if a worker trait).
4. **S:** "Take over" mode: the farmer can ride along with a worker or call one to follow, like Ranch Simulator's whistle [28][29], but followers stop their own needs care while following (RimWorld drafting cost [25]).
5. **A:** On phone, the avatar is optional: tapping a job can send the nearest worker or the farmer.

---

## 4. Herding and animals

### 4.1 Individuals vs herds

* **RimWorld** keeps every animal individual, with names when bonded [31][32].
  * Animals are managed by "allowed areas"; most ungulates instead must be "roped" by a handler into a **pen** defined by a pen marker inside fences [31][33].
  * The pen marker has an **Animals** tab (which animals belong), a **Food** tab showing grazing nutrition grown vs consumed, and an **Auto cut** tab [33]. "If the nutrition grown is less than the nutrition consumed then animal starvation is inevitable" [33].
  * Pens expand if a gate or door is "held open" [33]. Tamed pen animals "will occasionally attempt to leave the map if not in a pen or if a pen door is left open" (roaming) [31].
  * The Animals tab has bulk checkbox columns: Slaughter, and each training skill (Tame, Guard, Rescue, Attack, Haul) [31].
* **Taming and handling (RimWorld)** [32]:
  * Tame chance depends on handler skill and animal wildness: factor 2 x (1 minus wildness), so 0% wildness doubles the chance and 100% cannot be tamed.
  * After a failed attempt, 30,000 ticks (12 game hours) cooldown, and a chance of revenge.
  * Minimum handling skill per species; up to 10 in core (14 with DLC).
  * Training decays over 12 game days (0% wildness) to 6 days (100%); pen animals never lose tameness.
* **Stardew**: farm animals leave the barn on sunny days if the door is open, try to go back at 5pm, sleep from 7pm, stop moving at 8pm [1].
* **Ranch Simulator**: "All animals will attempt to escape any open door or gate"; they sleep about 21:00 to 8:00 [28]. Large animals can be told to follow or get into a vehicle with E [30].
* **Banished** has a Herdsman profession for pastures [23] (no further detail sourced).
* **Red Dead Redemption 2** herding seems to be mission based rather than a ranch system (search summary only, **UNVERIFIED**).

### 4.2 Moving groups: steering and flocking

* **Boids** (Reynolds 1987): three local rules, separation (avoid crowding), alignment (match heading), cohesion (move toward neighbours), give flock or herd motion without a leader [34] (paper seen via abstract and summaries).
* **Steering behaviours** (Reynolds, GDC 1999): motion in three layers, action selection (goals), steering, locomotion; combinable behaviours such as seek, flee, arrival, wander, path following, leader following, flocking [35].
* **Sheepdog heuristic** (Strömbom et al. 2014): a shepherd switches between **collecting** (go behind the animal furthest from the group centre and push it in) and **driving** (once the group is tight, get behind it relative to the target and push) [36] (seen via abstract and summary).

### 4.3 Selecting subsets

* RimWorld uses checkbox columns and per pen animal lists, plus male/female filters on the pen marker [31][33].
* No game this session showed a drag select for a herd subset with a sourced UI. Our design is A.

### Recommendation for our game (herding)

1. **S + A:** Herd is the unit of orders; animals are individuals inside it (RimWorld individuals [31] plus our herd layer A). Herds belong to a camp, like RimWorld's pen marker assignment [33].
2. **S:** Camp panel copies the pen marker: Animals (which herd), Grazing (grown vs eaten, with "lasts until" date), and Water status [33]. Ties straight into the forage budget from earlier lessons.
3. **S:** Gates: a gate left open joins two camps, as RimWorld pens expand through held open gates [33]. Animals near a broken fence roam out over time (roaming [31]; Ranch Sim escapes [28]). Escapes are telegraphed by a "fence damaged" alert first (A).
4. **S + A:** Movement: order "Move Herd 2 to Camp 9". A herder (worker on horse or motorbike, or the farmer) runs the Strömbom collect and drive loop [36]; animals use boids separation and cohesion plus a flow field toward the gate (section 8) [34][52].
5. **A:** Cattle follow water: move orders are easiest at the midday water window noted in the camps lesson [67].
6. **A:** Subset selection: filter chips (cows, heifers, weaners, bulls, calves) on the herd panel, then "Split to new herd" and "Load selected onto truck". RimWorld style bulk columns for marking [31] (S for the column idea).
7. **S:** Handling skill matters: a worker's Animals skill speeds herding and lowers stress; low skill risks a break away (RimWorld minimum handling skill and revenge chance [32]). Taming wild game is out of scope at first (A).
8. **A:** Riding: the farmer and herders can ride horses or a motorbike for speed. No mount system was verified this session (RimWorld mounts are a mod, **UNVERIFIED**).

---

## 5. Logistics: traders, trucks, loading, fuel

### 5.1 Traders arriving

* **RimWorld** [37]:
  * Visiting caravans walk in; the lead trader has a yellow "?"; you send a colonist with good Social skill (Trade Price Improvement) to trade.
  * "All traders carry a limited amount of silver"; anything beyond that is given away free.
  * Purchased items drop where the trader stood and must be hauled.
  * Under Cassandra and Phoebe, **five possible trade caravan dates per 60 day year**, seeded, none in the first 5 days, **at least 6 days apart**; a faction relations check gives 60% to 100% visit chance.
  * Orbital traders: one possible arrival per 15 days (four per year), stay **40,000 ticks (16 game hours)**; need a comms console to hear and a trade beacon to trade goods in range. A blue notification announces them.
  * You can call an allied caravan for 15 goodwill, once every 4 days per faction.
  * Randy does not use the fixed schedule.
* **Banished** [39][40]: merchants arrive by boat at a Trading Post; limited stock "only what they could carry in their boat"; types specialise; you can **request** goods, which cost more and arrive with the same trader's next visit. Arrival intervals by population and the 3 month stay come only from a search summary (**UNVERIFIED**).
* **Against the Storm**: "Traders will not arrive" during Storm season [13].

### 5.2 Selling points and prices

* **Farming Simulator 25**: crops have a base price per litre (wheat 0.337 per litre times an economy difficulty factor); "Prices will change based on the demand of a crop"; "Great demand can offer higher price then normal"; store in a silo to wait; some maps pay more by train [41]. Economy difficulty Easy, Medium, Hard [16].

### 5.3 Loading and caravans

* **RimWorld caravans** [38]: forming a caravan with pack animals has a **loading phase** where colonists load each animal, which "can take a long time"; capacity = body size x 35 kg; the screen shows mass vs capacity with "take max" arrows.

### 5.4 Vehicles and fuel

* **Farming Simulator** (GIANTS script docs; older Motorized script, version **UNVERIFIED** for FS25): each vehicle has `fuelUsage` per hour; if not set, default is capacity / 5, commented "full->empty: 5h" [42]. The HUD has a fuel usage display hook [42].
* FS also lets you sleep or skip time; rented vehicles charge at day change (Eurogamer.pl) [17].

### Recommendation for our game (logistics)

1. **S:** Buyers (speculator truck, auction lorry, feedlot buyer) arrive on seeded dates: about 5 per year, at least 6 days apart, none in the first days, as RimWorld does [37]. With dpm 3 (36 days a year) use "at least 2 days apart" (scaled, A).
2. **S:** Each buyer has a budget cap and a type (weaners, culls, breeding stock) [37][39]. Offers shown with a trend arrow and an occasional "great demand" [41].
3. **S:** A buyer stays a limited time (RimWorld orbital traders: 16 game hours [37]); at our scale "until 14:00 tomorrow" (A).
4. **S + A:** Loading is a job: workers herd the selected animals up the loading ramp; a progress bar shows loaded vs truck capacity (RimWorld mass vs capacity bar [38]). Truck capacity per head is our assumption until sourced.
5. **S:** Request system: ask a supplier for lick or diesel; it costs more and comes on the next run (Banished requests [39]).
6. **S:** Bakkie and truck fuel in litres per hour, tank gauge on the vehicle panel; default rule of thumb from FS code is a full tank lasting 5 working hours [42]; our real numbers must come from a Namibian source (gap).
7. **A:** Auction day is an event the farmer attends (avatar only job, section 3), with the sale result in a Letter.
8. **S:** Weather can block arrivals (Against the Storm blocks traders in Storm [13]); for us, heavy rain closes a gravel road for a day (A).

---

## 6. Notifications without spam

### 6.1 How the games tier them

* **RimWorld** has three surfaces:
  * **Letters**: envelope icons stacking on the right; blue good, grey neutral, yellow bad, red direct threat; click to read, right click to dismiss. Some events instead pause and pop a choice window [43].
  * **Messages**: transient text at the top left; click to centre the camera on the subject [25].
  * **Alerts**: persistent list at the top right ("colonists are about to go insane, or if they need rescue") plus tips [4][25].
  * History tab keeps "the last 200 messages and letters", and you can pin them [20].
  * A third party code analysis counts 12 message types, 5 core letter types (about 16 special), and 132 alert classes in 1.6 at three priorities (Medium, High, Critical) [44] (not an official source, **UNVERIFIED**).
* **Factorio alerts** [45]: aggregated text with counts ("X objects are being damaged", "X objects are missing the material for construction"); each type has a display duration (5, 10 or 30 s); every type can be toggled and muted from a button above the minimap. Separate **warning icons** sit on the entity itself (no fuel, no power, no ammo).
* **Factorio tutorial lesson**: three competing message channels confused new players (FFF #241, see earlier lesson) [47].
* **Dwarf Fortress announcements** [46]: each type has options Popup, Pause, Recenter, Alert, editable in settings or `announcements.txt` (for example `[MIGRANT_ARRIVAL:A_D:D_D:P:R]` pauses and recentres). "Minor" announcements flicker past quickly. Job cancellation spam has a filter (none, some, most, all; default some).
* **Oxygen Not Included**: red bad, yellow warning, white neutral (search summary only, **UNVERIFIED**) [48]. Red Alert overrides needs [21].

### 6.2 Rules that come out of this

1. Separate **events** (something happened) from **states** (something is wrong right now). RimWorld letters vs alerts [4][43]; Factorio alerts vs entity icons [45].
2. **Aggregate** states with counts rather than one popup per object [45].
3. **Colour codes severity** consistently [43].
4. **Let players tune** each type: mute, pause, recentre [45][46].
5. **Keep a log** with a cap and pins [20].
6. **Only critical things stop time** [18][46].
7. **One channel per job**; do not add a third or fourth channel [47].

### Recommendation for our game (notifications)

| Tier | Example | Behaviour | Tag |
|---|---|---|---|
| Critical | Fire on the veld, animal down in a trough, predator attack in progress | Drops to 1x and pauses (configurable), centres camera, red | S [18][43][46] |
| Letter | Buyer arrived, calf born to a named cow, rain 32 mm, auction result | Colour coded card stacks on the right until read; tap to centre | S [43] |
| Message | "Mpho finished the water round", "Lick topped up at Camp 4" | Fades after a few seconds; logged; tap to centre | S [25][20] |
| Alert | "3 troughs low", "2 workers have no bed", "Bakkie fuel 10%" | Persistent list on the right with counts, clears itself when fixed | S [4][45] |
| Entity icon | Windmill not turning, trough empty | Icon on the object on the map | S [45] |

Plus (A unless tagged):
* Settings screen listing every type with Mute, Pause, Centre toggles (S [45][46]).
* Farm diary log of the last 200 entries with pins (S [20]).
* On phone: at most one Letter shown at a time; others collapse into a badge.
* Never more than one pausing event per game day on the gentle storyteller (ties to the earlier lesson's "cap stacked disasters").

---

## 7. Making slow sims fun (brief; full detail in `fun-and-retention-lesson.md` [49])

What this lesson adds to the earlier one:

* **Short goals per unit of time.** Stardew's day ends with a save and profit breakdown [1]; Against the Storm fits a whole year in 10 to 12 minutes with a different task set per season (plant, harvest, plough) [13]. Our 4 minute day should have one clear goal and end on a summary.
* **Meaningful choices from scarcity.** Banished: "The only requirements are the resources to build it" [50]. Stronghold's campfire cap forces you to create jobs before more people come [24].
* **Events with a schedule players can learn.** RimWorld's seeded trade dates [37] and Against the Storm's predictable storm [13] give anticipation without randomness overload.
* **Upgrade loops.** Graveyard Keeper improves workers step by step (skulls, up to 40% efficiency) [27]; Medieval Dynasty's intensity slider trades output for resources [26].

### Recommendation for our game (fun)

1. **S:** Each day: one morning decision, one main job, one end of day line; end of month diary (earlier lesson, items 1 and 2).
2. **S:** Seasons with a different job mix (rains: move herds and fix washed roads; dry season: lick and water; late dry: sell or buy feed), like Against the Storm's season tasks [13].
3. **S:** Worker upgrade path (skills, housing, tools) as the medium loop [26][27].
4. **S:** Storyteller presets as in the earlier lesson.

---

## 8. Performance for a Phaser 4 browser game with hundreds of animals

### 8.1 What Phaser 4 actually is (checked)

* Phaser v4.0.0 was released on 10 Apr 2026 [61]. npm shows latest **4.2.1** (9 Jul 2026) [63].
* The WebGL renderer was rebuilt with a **RenderNode** architecture replacing v3 pipelines; context restoration is built in [61][62].
* Sprite quads use index buffers: 4 vertices per sprite instead of 6, "a third less data every single frame" [62].
* **SpriteGPULayer**: "Render a million sprites in a single draw call, up to 100x faster than standard rendering", with GPU driven animation of position, rotation, scale, alpha, tint, frame [61]. (Vendor claim, not independently tested.)
* **TilemapGPULayer**: a tilemap layer as a single quad, up to 4096 x 4096 tiles [61].
* Canvas renderer is "officially deprecated"; new features are WebGL only; WebGL2 supported [62].
* `roundPixels` is now false by default; new `smoothPixelArt` option for pixel art that scales or rotates [62].
* Phaser 4 ships 28 "AI agent skill" files in the repo, including a v3 to v4 migration skill [61]. Worth pointing your coding agent at.

### 8.2 Separate simulation from rendering

* Fixed time step loop: accumulate elapsed time, run `update()` in fixed steps, render as often as possible [60].
* ONI's engine runs about 5 ticks per second (wiki estimate) [5]; RimWorld 60 per second at 1x with rare (250) and long (2,000) ticks [3]. Dwarf Fortress staggers work: job checks every 100 ticks, stockpiles and buildings every 50 ticks on staggered ticks, item rot every 100 ticks [7].
* **Factorio sleep**: "Most entities will 'go to sleep' when they have nothing to do, consuming zero processing time when asleep" [57]. Inserters were changed to sleep until woken by a state change; with other changes, update time dropped "from roughly 30 milliseconds per 1 update to about 10" in big factories [56].
* **Factorio belts**: merged into segments so items move by changing one offset rather than each item [57].

### 8.3 Pathfinding for hundreds of animals

* **A\*** is the standard single path search; Factorio's units use it with a straight line heuristic [55].
* **Jump Point Search** (Harabor and Grastien 2011): for uniform cost grids, optimal, no preprocessing or memory overhead, "can speed up A* by an order of magnitude and more" [53]. Not for weighted terrain costs (it is for uniform cost grids [53]).
* **Hierarchical**: HPA* clusters the grid and searches an abstract graph; the paper reports up to 10x faster than optimised A* with paths within 1% of optimal after smoothing (via abstract summary, **UNVERIFIED** exact figures) [54].
* **Factorio FFF #317**: chunks of 32 x 32 tiles split into connected components; an abstract search (Reverse Resumable A*) provides the heuristic for the normal A*; entities are ignored in the abstraction so placing buildings does not force recomputation [55].
* **Flow fields** (Emerson, Supreme Commander 2, Game AI Pro ch. 23) [51]:
  * Map split into 10 x 10 m sectors of 1 x 1 m cells, linked by portals; A* over portals first, then flow fields only for sectors on the route.
  * Three fields: cost (8 bit, 0 to 255, 255 = wall), integration (24 bit), flow (8 bit, direction index plus flags such as line of sight).
  * Clear sectors share one global "clear" cost field to save memory.
  * Units in line of sight of the goal steer straight to it.
  * Designed for "hundreds to thousands of individual agents across massive maps".
* **Red Blob Games**: when many units share one destination, one Breadth First Search or Dijkstra from the goal gives every tile a direction (a flow field, the negative gradient of the distance field); this replaces running A* per unit [52].

### 8.4 Neighbour queries and memory

* **Spatial partition**: a fixed grid of cells holding unit lists turns all pairs checks from O(n²) toward O(n) [58]. Needed for boids neighbour lookups.
* **Object pool**: reuse objects to avoid allocation churn and fragmentation [59]. In JavaScript, the goal is fewer garbage collection pauses (A; Nystrom writes from a C++ angle).

### 8.5 Browser specifics

* **Hidden tabs**: Chrome checks timers in hidden pages once per second, and after 5 minutes hidden (chained timers, silent page) once per minute; `requestAnimationFrame` waits until the page is visible [66]. A sim driven by rAF stops when the tab is hidden, which matches the earlier lesson's "time passes only while playing".
* **Web Workers**: `SharedArrayBuffer` needs cross origin isolation (COOP `same-origin`, COEP `require-corp`); `ArrayBuffer`s can be transferred to a worker without copying (MDN, via search summary) [64][65].

### 8.6 Scale check for our map (A)

* 13,000 ha = 130 km², about 11.4 km x 11.4 km. At 10 m per tile that is about 1,140 x 1,140 tiles (1.3 million). TilemapGPULayer handles up to 4096 x 4096 tiles per layer [61], so drawing is not the blocker; simulation and pathfinding are.
* Animals spend most time grazing inside one camp. They do not need global paths; only herd moves do.

### Recommendation for our game (performance)

1. **S:** Fixed sim tick, separate from rendering [60]. Proposal: 10 sim ticks per real second at 1x (A); rare tick every 25 ticks for needs, long tick every 200 for grass and weight (pattern from RimWorld [3]).
2. **S:** Level of detail for simulation (A built on Factorio sleep [56][57] and DF staggering [7]):
   * **On screen herds:** full boids every tick for animals in view.
   * **Off screen herds:** one herd object with a centroid and count, updated on rare ticks; individuals "sleep" and are re expanded when the camera arrives.
   * **Calm herds:** grazing animals wander with cheap random steps inside the camp polygon; no pathfinding.
3. **S:** Flow fields per destination, not A* per animal: one field per gate, trough and loading ramp, cached and rebuilt only when a fence or gate changes [51][52].
4. **S:** For long trips (herder to far camp, bakkie on roads), hierarchical search over camps and gates (each camp a node, gates as portals), like Factorio chunks [55] or HPA* [54]. Roads as a separate graph (A).
5. **S:** JPS only for uniform cost local grids (the farmyard) [53].
6. **S:** Spatial hash grid for neighbour lookups (cell size about 2x the separation radius, A) [58].
7. **S:** Pool sprites and particles [59]; use SpriteGPULayer for big static or GPU animated sets (grass tufts, distant cattle dots) [61]; normal sprites for animals the player interacts with.
8. **S:** Use rAF driven sim time and accept that hidden tabs pause [66]. Save on visibility change (A).
9. **S + A:** Move the sim to a Web Worker only after profiling shows the main thread is busy; pass state with transferable `ArrayBuffer`s, and avoid `SharedArrayBuffer` unless hosting can set COOP and COEP headers [64][65].
10. **A:** Budget target to test on a mid range Android phone: 300 animals simulated, 60 visible, 60 FPS. These numbers are assumptions; profile early.

---

## 9. Checklist before building each system

* [ ] Day length, night share and speeds written as numbers with the math (section 1.3).
* [ ] Every slow process expressed per month, so "days per month" can change safely.
* [ ] Work grid has at most 4 levels and a visible tie break rule.
* [ ] Every worker can show a one line status and a blocked icon.
* [ ] The farmer has at least two jobs only the farmer can do, and workers at least one.
* [ ] Herd orders work at herd level; individuals exist but are not micro managed.
* [ ] Camp panel shows grazing grown vs eaten and water.
* [ ] Buyers have seeded dates, a budget cap and a time limit.
* [ ] Notification types are each assigned exactly one tier, and each can be muted.
* [ ] Only critical events pause; a setting can turn that off.
* [ ] Off screen herds are aggregated; profiling done on a real phone.

## 9b. Common mistakes seen in these games

* Priority systems where one "1" swallows everything (RimWorld hauling at 1 hauls across the whole map [19]).
* Forced slowdowns with no off switch for long events [18].
* Several message channels competing [47].
* One popup per object instead of a counted alert [45].
* Year lengths measured in tens of hours for a session based phone game (Stardew 26 h at 1x [1] is fine on PC, heavy on phone, A).
* Per unit A* for many units going to the same place [52].
* Simulating every animal at full rate everywhere (contrast Factorio sleep [57]).

---

## 10. Gaps and UNVERIFIED items

1. Stardew day: the wiki's 14 minutes vs GQ's "about 17 minutes" are not reconciled [1][2].
2. RimWorld speed multipliers: Time page says x1, x3, x6 (x15 dev); UI page says normal, 3x, 5x [3][4].
3. RimWorld forum quote about skipping battles: author header not captured; attributed to Tynan only by search [18].
4. Banished year length: fandom "about an hour" vs a player's "about 25 minutes" at 1x; trading post arrival intervals and 3 month stay are search summary only [10][12][40].
5. ONI priority, errand and notification colour details come from search excerpts; wiki.gg blocked direct fetch [21][22][48].
6. FS25 single player default time scale not confirmed; fuel default (tank empties in 5 h) is from older GIANTS script docs [15][42].
7. Boids (1987) and Strömbom (2014) papers were seen via abstracts and summaries, not read in full [34][36].
8. HPA* "10x faster, within 1%" seen via abstract summary only [54].
9. RimWorld letter, message and alert counts come from a third party code analysis [44].
10. Not verified this session: Going Medieval day length (a search summary gave an implausible figure; ignored), Kenshi, Farm Together, Sons of the Forest, Prison Architect, Foundation, Anno, Frostpunk notifications, Red Dead herding controls, RimWorld mount mods, Junimo huts in Stardew.
11. Ranch Simulator facts come from a Steam community guide and discussions, not official docs [28][29][30].
12. No sourced numbers for Namibian bakkie fuel use, truck capacity per head, or loading time. Needed before tuning section 5.
13. Phaser SpriteGPULayer "million sprites" and "100x" are vendor claims, not benchmarked by us [61].
14. All performance budgets in 8 (ticks per second, 300 animals, cell size) are assumptions to profile.

---

## 11. Sources (accessed 12 Nov 2026 unless noted)

1. Stardew Valley Wiki, "Day Cycle". https://stardewvalleywiki.com/Day_Cycle
2. GQ, "Valley Forged: How One Man Made the Indie Video Game Sensation Stardew Valley" (via earlier lesson). https://www.gq.com/story/stardew-valley-eric-barone-profile
3. RimWorld Wiki, "Time". https://rimworldwiki.com/wiki/Time
4. RimWorld Wiki, "User interface". https://www.rimworldwiki.com/wiki/User_interface
5. Oxygen Not Included Wiki, "Cycles". https://oxygennotincluded.wiki.gg/wiki/Cycle
6. Factorio Wiki, "Time". https://wiki.factorio.com/Game-tick
7. Dwarf Fortress Wiki, "Time". https://dwarffortresswiki.org/index.php/Time
8. Minecraft Wiki, "Daylight cycle". https://minecraft.wiki/w/Daylight_cycle
9. Don't Starve Wiki, "Day-Night Cycle". https://dontstarve.wiki.gg/wiki/Day-Night_Cycle
10. Banished Wiki (fandom), "Simulation speed". https://banished.fandom.com/wiki/Simulation_speed
11. Banished Wiki, "Seasons". https://www.banished-wiki.com/wiki/Winter
12. Steam Community, "How many minutes for 1 year?" (Banished), Nov 2015. https://steamcommunity.com/app/242920/discussions/0/490125737479022592/
13. Against the Storm Official Wiki, "Seasons". https://wiki.hoodedhorse.com/Against_the_Storm/Seasons
14. YouTube, "How To Speed Up & Slow down Time in Farming Simulator 25" (transcript). https://www.youtube.com/watch?v=0rC7QwPQ2es
15. Agrarchaoten, "FS25 Server Settings Explained". https://agrarchaoten.com/en/guides/ls25-server-einstellungen
16. FS25 Planet, "Settings Menu in Farming Simulator 25". https://fs25planet.com/guides/settings-menu-in-farming-simulator-25-detailed-guide.html
17. Eurogamer.pl, "Farming Simulator 25: upływ i przewijanie czasu, prognoza pogody". https://www.eurogamer.pl/farming-simulator-25-upyw-i-przewijanie-czasu-prognoza-pogody
18. Ludeon Forums, "Combat Slow-down", Sep 2014. https://ludeon.com/forums/index.php?topic=6018.0
19. RimWorld Wiki, "Work". https://rimworldwiki.com/wiki/Work
20. RimWorld Wiki, "Menus" (Schedule; History, Messages). https://rimworldwiki.com/wiki/Menus
21. Oxygen Not Included Wiki, "Priority" (search excerpt). https://oxygennotincluded.wiki.gg/wiki/Priority
22. Oxygen Not Included Wiki, "Errand" (search excerpt). https://oxygennotincluded.wiki.gg/wiki/Errand
23. Banished Wiki, "Professions". https://www.banished-wiki.com/wiki/Professions
24. Firefly Studios, Stronghold: Definitive Edition manual v1.01 (Steam). https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2140020/manuals/Stronghold_Definitive_Edition_Manual_-_English_v1.01.pdf
25. RimWorld Wiki, "Learning helper". https://rimworldwiki.com/wiki/Learning_helper
26. TheGamer, "How To Assign Villager Jobs In Medieval Dynasty", updated 3 Feb 2024. https://www.thegamer.com/medieval-dynasty-how-to-manage-villager-jobs/
27. The Lost Noob, "Zombie guide: Graveyard Keeper", 1 Jan 2023. https://www.lostnoob.com/graveyard-keeper/zombie/
28. Steam Community guide, "Ranch Sim Complete Guide". https://steamcommunity.com/sharedfiles/filedetails/?id=2499983183
29. Steam Community, Ranch Simulator whistle discussion. https://steamcommunity.com/app/1119730/discussions/0/599656129730986918/
30. Magic Game World, "Ranch Simulator: Animals Guide". https://www.magicgameworld.com/ranch-simulator-animals-guide/
31. RimWorld Wiki, "Animals". https://rimworldwiki.com/wiki/Animals
32. RimWorld Wiki, "Taming". https://rimworldwiki.com/wiki/Taming
33. RimWorld Wiki, "Pen marker". https://rimworldwiki.com/wiki/Pen_marker
34. Reynolds, C. (1987) "Flocks, Herds, and Schools: A Distributed Behavioral Model", SIGGRAPH (abstract and summaries). https://doi.org/10.1145/37402.37406
35. Reynolds, C. (1999) "Steering Behaviors For Autonomous Characters", GDC 1999. https://www.red3d.com/cwr/steer/gdc99/
36. Strömbom, D. et al. (2014) "Solving the shepherding problem: heuristics for herding autonomous, interacting agents", J. R. Soc. Interface (abstract and summaries). https://pubmed.ncbi.nlm.nih.gov/25165603/
37. RimWorld Wiki, "Trade". https://rimworldwiki.com/wiki/Trade
38. RimWorld Wiki, "Caravan". https://rimworldwiki.com/wiki/Caravan
39. Banished Wiki, "Trade". https://banished-wiki.com/wiki/Trade
40. Banished Wiki (fandom), "Trading post" (search summary). https://banished.fandom.com/wiki/Trading_post
41. Farming Simulator Wiki, "Wheat: Farming Simulator 25". https://farmingsimulator.wiki.gg/wiki/Wheat/Farming_Simulator_25
42. GIANTS Developer Network, Motorized script documentation (older version). https://gdn.giants-software.com/documentation_scripting.php?category=70&class=3493&version=script
43. RimWorld Wiki, "Events" (search excerpt). https://rimworldwiki.com/wiki/Events
44. Game Design Lab (teemo.dev), "UX, UI and Accessibility: RimWorld systems" (third party). https://teemo.dev/game-design/rimworld/systems/ux-ui-and-accessibility/
45. Factorio Wiki, "Alerts". https://wiki.factorio.com/Alerts
46. Dwarf Fortress Wiki, "Announcement". https://dwarffortresswiki.org/index.php/Announcement
47. Factorio, Friday Facts #241 "New player experience", 4 May 2018 (via earlier lesson). https://factorio.com/blog/post/fff-241
48. Oxygen Not Included Wiki, "Red Alert" and notification colours (search summary). https://oxygennotincluded.wiki.gg/wiki/Red_Alert
49. Teacher Bot, `fun-and-retention-lesson.md` (internal). /workspace/farming-game/research/fun-and-retention-lesson.md
50. Game Developer, "Banished's 'build what you want, when you want it' game design", 30 Dec 2013. https://www.gamedeveloper.com/business/-i-banished-i-s-build-what-you-want-when-you-want-it-game-design
51. Emerson, E., "Crowd Pathfinding and Steering Using Flow Field Tiles", Game AI Pro, ch. 23. https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter23_Crowd_Pathfinding_and_Steering_Using_Flow_Field_Tiles.pdf
52. Red Blob Games (Amit Patel), "Flow Field Pathfinding for Tower Defense". https://www.redblobgames.com/pathfinding/tower-defense/
53. Harabor, D. and Grastien, A. (2011) "Online Graph Pruning for Pathfinding on Grid Maps", AAAI. https://harabor.net/data/papers/harabor-grastien-aaai11.pdf
54. Botea, A., Müller, M. and Schaeffer, J. (2004) "Near Optimal Hierarchical Path-Finding" (abstract via Semantic Scholar; method summary at usask.ca). https://www.semanticscholar.org/paper/Near-Optimal-Hierarchical-Path-Finding-Botea-M%C3%BCller/b0f0432ba69e4d730b93a75e3d19c8e9d811efac and https://www.cs.usask.ca/ftp/pub/horsch/hpa.pdf
55. Factorio, Friday Facts #317 "New pathfinding algorithm", 18 Oct 2019. https://factorio.com/blog/post/fff-317
56. Factorio, Friday Facts #18. https://factorio.com/blog/post/fff-18
57. Factorio, Friday Facts #148 "Optimizations for 0.14". https://www.factorio.com/blog/post/fff-148
58. Nystrom, R., Game Programming Patterns, "Spatial Partition". https://gameprogrammingpatterns.com/spatial-partition.html
59. Nystrom, R., Game Programming Patterns, "Object Pool". https://gameprogrammingpatterns.com/object-pool.html
60. Nystrom, R., Game Programming Patterns, "Game Loop". https://gameprogrammingpatterns.com/game-loop.html
61. Phaser, GitHub release v4.0.0, 10 Apr 2026. https://github.com/phaserjs/phaser/releases/tag/v4.0.0
62. Phaser, "Phaser 4 Renderer: Faster, Cleaner, and Built for Modern Games", 23 Apr 2026. https://phaser.io/news/2026/04/phaser-4-renderer-faster-cleaner-and-built-for-modern-games
63. npm registry, package "phaser" (dist tags: latest 4.2.1, published 9 Jul 2026). https://registry.npmjs.org/phaser
64. MDN, "SharedArrayBuffer" (search summary). https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
65. MDN, "Transferable objects" (search summary). https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
66. Chrome for Developers (Jake Archibald), "Heavy throttling of chained JS timers beginning in Chrome 88". https://developer.chrome.com/blog/timer-throttling-in-chrome-88
67. Teacher Bot, `camps-water-infrastructure-lesson.md` (internal). /workspace/farming-game/research/camps-water-infrastructure-lesson.md
