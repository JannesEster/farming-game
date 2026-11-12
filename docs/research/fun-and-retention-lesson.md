# Making a calm farm strategy sim fun, sticky and fair: a lesson for Farming Game

Prepared by Teacher Bot for the Farming Game bot, 11 Nov 2026 (Australia/Perth). Builds on `farm-life-lesson.md` (section 8 game design notes) and does not repeat it.

**How to read this lesson**

* Every key point carries a source tag like **[S12]**. The full list is in section 11, with dates.
* **UNVERIFIED** means I could not confirm it from a primary source this session (for example a talk I saw only through a summary, or a figure seen only in a secondary compilation).
* **OPINION** means design judgement, mine or a named designer's, not research.
* **SUGGESTION** (section 8) means a concrete idea for our game. It is not a fact.
* Platform rules and laws move. Every rule here is dated to the page I read. Re-read the official page before launch in each market.
* Benchmarks are never invented. Where a genre number is not published, I say so.

**The ten lines to remember**

1. Fun in a sim is mastery of a system: Koster's "fun is just another word for learning" [S38]. Players stay while there is still something to understand.
2. Build nested loops. Do a job, see the result, update your mental model, choose again; then repeat at the day, season and multi-year scale [S37][S33].
3. The "one more day" pull comes from short days with open threads. Stardew's day lasts about 17 real minutes, and the game was tuned so you always felt you had time for one more [S41].
4. Show causes, hide formulas. Frostpunk turns 13 to 14 needs per citizen into one Hope bar and one Discontent bar [S45].
5. Players judge randomness by feel, not maths. Sid Meier's testers rejected losing at good odds, so his team bent the outcomes toward expectation [S40].
6. A storyteller system paces disasters: tension, then breathing room. RimWorld ships three such presets and lets you change them mid-game at no penalty [S43].
7. Mobile simulation sessions are short. The 2024 median simulation session was 3.9 to 4.3 minutes, with 3.6 to 3.7 sessions a day [S32]. PC sessions run about 18 minutes at the median [S34].
8. Players leave over pay-to-win (77.18%), too many ads (71.85%) and misleading ads (66.17%) (Mistplay survey, 2024) [S31].
9. Since 2024 to 2026 the rules have tightened. Paid random items now mean at least M in Australia (from 22 Sep 2024) [S8] and PEGI 16 by default (from June 2026) [S11]. Rewards for coming back daily mean PEGI 7, and punishing players for not coming back means PEGI 12 [S11].
10. Steam does not accept ad-funded business models at all [S4]. Plan "free with extras" per store, not as one model.

---

## 1. Core loop design

### 1.1 What a loop is

* **Dan Cook's loop.** The player starts with a mental model, applies an action to the game system, receives feedback, and updates the model. Loops are "fractal and occur at multiple levels and frequencies". **Arcs** are one-off experiences, like a cutscene, that you consume and leave. Cook argues long-lived games are built mostly from loops [S37].
* **Koster's view of fun.** "Fun in games arises out of mastery. It arises out of comprehension... With games, learning is the drug." Boredom arrives when there is nothing left to learn [S38].
* **Sid Meier's view of choices.** "Games are a series of interesting decisions" (GDC 2012) [S39]. His decision types include trade-offs, risk versus reward, short versus long term, and choices that express play style [S39].
* **Jesse Schell** frames design as a set of "lenses" (questions) and an interest curve across a session (*The Art of Game Design: A Book of Lenses*) [S59]. I did not reopen the book this session, so no page claims are made.

### 1.2 Short, medium and long goals

The 2026 GameAnalytics report quotes Oxana Fomina (Gradient Universe) [S33]. Her advice is to build three layers of loop:

* one loop that fits the average session;
* a second loop completed across several sessions in a day;
* a third spanning days or weeks.

This "layered system of engagement loops" creates natural reasons to return [S33]. OPINION: this maps cleanly onto a farm sim:

| Layer | Real time | In our game (SUGGESTION, details in section 8) | Feedback the player sees |
|---|---|---|---|
| Short | 30 seconds to 5 minutes | One job: water round, herd count, dose at the crush, list a lot at auction | Water level rises, count ticks up, tally |
| Medium | 1 to 3 sessions | One game week or month: move herds between camps, prepare for auction day, fix the windmill | Camp grass bars, cash after sale |
| Long | Weeks | The season year (July to June, from `farm-life-lesson.md` 8.2), surviving a drought, buying the neighbouring farm | Herd grows, veld recovers, new farm on the map |

### 1.3 How the reference games do it

* **Stardew Valley.**
  * A day is about 17 minutes, deliberately kept short. GQ reports that this made it "always felt like you had time for 'one more day'" [S41].
  * The game had sold 50 million copies by its 10 year anniversary post (Feb 2026) [S42].
  * Energy and the clock bound each day. Sleeping saves the game and acts as a natural stop. Crops and machines left running pull you back the next day [S41]. (The detail of the mechanics is common knowledge from play and was not re-sourced.)
* **RimWorld.**
  * Tynan Sylvester designed it as a "story generator" rather than a conventional game, relying on apophenia: players read meaning into sparse, simple events (GDC 2017 talk, seen through summaries, UNVERIFIED wording) [S44].
  * The long goal is optional. The real loop is crisis, recovery and the story you tell about it [S43][S44].
* **Farming Simulator.**
  * The loop is a deep, realistic machinery and field cycle.
  * GIANTS made it approachable for FS25 with a "redesigned tutorial system", "customizable difficulty settings and many options", advice-giving NPCs next to the help menu, and a "more intuitive user interface" (Martin Rabl interview, Dec 2024) [S48].
  * Lesson: keep the realism, but let players switch systems off.
* **Frostpunk.**
  * Each citizen has "about 13-14" needs. These are averaged into the Discontent bar, and Hope works the same way. Those bars "inform what events the player will encounter" [S45].
  * The law and narrative systems introduce harsh policies gradually, exploring the "boiling frog" of creeping authoritarianism (designer Marta Fijak) [S45].
  * The medium loop is choosing laws. The long loop is surviving to the end of the storm.
* **Banished.**
  * Luke Hodorowicz: "You just build what you want, as you want it... The only requirements are the resources to build it." There is "no perfect town" [S46].
  * Survival in winter grew naturally out of the first prototype: "People have to survive the winter, and depend on a mix of rain and sun to make the crops grow" [S46].
  * This is close to our drought and forage budget.
* **Factorio.**
  * The loop is automate, expand and optimise.
  * Wube found that new players needed a tutorial of "about 30-45 minutes to get to automation, which is what the game is about", and treated this as a problem to fix (Friday Facts #241, 4 May 2018) [S47].
  * Wube also sets a fixed price with no sales: "When it costs 20, we don't want to make it feel like 10" (FFF #140) [S47b].
* **Kairosoft games (Game Dev Story and others).**
  * PC Gamer calls them "irresistible sim-lite games" (4 Mar 2022) [S49].
  * Their pattern is often described as hire staff, pick a theme or genre combination, release, and level up. The combination-discovery mechanic is UNVERIFIED from a primary source this session.
  * OPINION: Kairosoft shows that a management sim can be tiny, cute and readable and still deep enough for 10+ hours.

### 1.4 The "one more day" recipe (OPINION, built from the sources above)

1. **A natural stopping point.** End of day or end of week, with a summary screen [S41].
2. **An open thread at that stop.** Auction tomorrow, the borehole repair finishing, a heifer due to calve [S37].
3. **A short next unit.** It must feel affordable. Stardew's 17 minutes on PC [S41]; on phones, shorter (section 5).
4. **A visible long goal.** For example "Buy the Kalahari farm: 62% saved".
5. **Respect.** The stop must be a real stop. Never punish leaving (see PEGI's play-by-appointment rule, section 6) [S11].

---

## 2. Progression, unlocks, mastery and the first 10 minutes

### 2.1 Principles

* **Unlock through the system, not arbitrary gates.**
  * Factorio's redesign goal: "Every recipe has to be obtained through a technology", so "the player triggers recipe progression and gets them as a reward" [S47].
  * Their other goals: teach by experimentation, let players solve puzzles their own way, and cut competing information channels [S47].
* **Learning by doing beats text tutorials.** Celia Hodent (GDC 2016, *The Gamer's Brain* part 2) argues for active, contextual onboarding with low cognitive load and a meaningful goal. She splits UX into usability and "engage-ability" [S52]. (Talk page read; full video not watched.)
* **Freedom of order.**
  * Banished lets players build in any order, limited only by resources [S46].
  * OPINION: for a farm, gate by money, season and land, not by level numbers.
* **Mastery needs readable cause and effect.** A loop only teaches if the feedback is clear [S37].
* **Choose the gate type carefully.**
  * Time-gated progress that is sold as "free" can be ruled misleading. The UK ASA found a 2014 Dungeon Keeper ad misleading on this basis [S26].
  * Time gates with a pay-to-skip are what Zagal, Björk and Lewis call temporal and monetary dark patterns [S30].

### 2.2 The first 10 minutes (FTUE)

* **Install day is usually one session.** Adjust's 2026 report gives the average day-zero session count as 1.65 in 2025, "steady across nearly all genres" [S35]. That session has to hook.
* **The first session is what moves D1.** GameAnalytics treats D1 as the onboarding signal, D7 as core gameplay appeal, and D28 as content pacing [S32].
* **Factorio's list of tutorial failures** [S47] works as a checklist of things to avoid:
  * a first level that is not representative of the game;
  * key concepts held back;
  * actions so constrained that players learn the tutorial, not the game;
  * grind tasks with no purpose;
  * information spread over three competing channels.
* **Players will forgive a slow start only if the core fantasy shows up early** (OPINION).

FTUE skeleton for a farm sim (OPINION):

| Minute | Player does | Player learns | Reward |
|---|---|---|---|
| 0 to 1 | Arrive at the farm gate; one tap to walk to the windmill | Movement and selection | Pretty sunrise, a sound cue |
| 1 to 3 | Fix the windmill; water flows into the trough | Water drives everything | Cattle walk in to drink (juice) |
| 3 to 5 | Move a small herd to a greener camp | Camps, grass bars, moving animals | Grass bar fills, animals settle |
| 5 to 8 | Pick 5 weaners and send them to the auction | Selling and prices | Gavel, cash number counts up |
| 8 to 10 | Spend the money on one choice: fence repair or lick | First real trade-off [S39] | Day summary and a tease: "Clouds building in the east" |

Leave paperwork, disease, predators and workers' personalities for days 2 to 5 of game time.

### 2.3 Pacing beyond the first session

* Introduce one new system per game week or month for the first season. Hold back the hard events until the player has the tools to respond (RimWorld's "intro threats" are a separate, toggleable layer [S43]).
* Use difficulty presets that change the economy and threats separately. RimWorld does this with harvest yield, threat scale and adaptation [S43].
* RimWorld's "adaptation" setting raises difficulty "when you're doing well" and knocks it down "when you take damage" [S43]. This is rubber banding: use it, but show it honestly.

---

## 3. Making realism fun

### 3.1 Hide complexity behind simple choices

* **Aggregate.** Frostpunk's two bars sit on top of many needs per citizen [S45]. Farm equivalent (OPINION): each camp has a grass bar and a water icon. The herd has a condition score. The farm has a "can we last till April?" meter, built on the forage budget logic in our earlier lesson.
* **Let players see the individual, but decide at group level.** Frostpunk lets you click a citizen to see their home, job, family and health [S45]. We can show one cow's story while the player manages herds.
* **Toggle realism.** FS25 offers customisable difficulty and "many options" [S48]. Our NamLITS paperwork, tag deadlines and levies from `farm-life-lesson.md` should be an optional "Real Namibia" mode, not a gate (SUGGESTION).
* **Let the imagination fill gaps.**
  * Sid Meier: "We don't have to literally show players everything cool... Let them fill in the holes for themselves" (GDC 2010, as reported by Kotaku) [S40].
  * Sylvester's apophenia point applies too [S44].

### 3.2 Readable feedback

* **Every action needs a visible and audible response within a moment.** That is the core of the "juice" talks [S50][S51].
* **Show cause and effect on the map.** Examples: bush encroachment as thickening grey bush sprites; overgrazing as bare red soil.
* **Fairness through foresight.** Into the Breach removed hit chance and random damage, and telegraphed every enemy attack (GDC 2019 postmortem by Matthew Davis) [S54]. Our version: a drought should be forecast (a late rain, a falling dam level) before it hurts. UNVERIFIED wording; I relied on talk summaries.

### 3.3 Juice, sound and visuals

* **"Juice It or Lose It"** by Martin Jonasson and Petri Purho (Nordic Game Indie Night and GDC Europe 2012). It turns a dull Breakout clone into a satisfying one with tweening, particles, sound and screen shake [S50].
* **"The Art of Screenshake"** by Jan Willem Nijman (Vlambeer, INDIGO 2013). It shows about 30 small feel improvements to a shooter [S51].
* **Calm-game translation (OPINION):** no screen shake in a calm sim. Use soft equivalents instead:
  * animals walking over;
  * dust from a bakkie;
  * rain sound on a tin roof;
  * a rising dam level;
  * the auctioneer's patter;
  * a cash counter that ticks;
  * birdsong returning after rain.
* Give the farm a sound map, with one signature sound per system.

### 3.4 Reference: what to simulate deeply versus shallowly (OPINION)

| Simulate deeply (the player plays with it) | Simulate shallowly (flavour, or a single number) |
|---|---|
| Grass by camp, water points, herd size and condition, cash | Individual animal genetics |
| Rain and season | Daily weather detail beyond rain |
| Worker skill, mood and housing | Full payroll and tax detail |
| Auction price swings | Every levy line (fold them into one "costs of selling" line, with detail on tap) |

---

## 4. Events and emergent stories

### 4.1 Storyteller systems

* **RimWorld's three storytellers** [S43]:
  * **Cassandra Classic:** "a classic increasing curve of challenge and tension... push you with dangerous events, then give breathing room".
  * **Phoebe Chillax:** "lots of time between disasters".
  * **Randy Random:** "doesn't follow rules... will sometimes send extremely difficult or unfair groups of events".
* **What the storyteller reacts to:** colony wealth, building wealth, colonist count, animal count, recent deaths or injuries, and time since the last major event [S43].
* **Difficulty is set separately** from the storyteller. Both "are changeable mid-game... with no downside or penalty" [S43].
* **Difficulty names set expectations.**
  * "Losing is fun" warns it is "designed to be unfair" [S43].
  * "Peaceful" and "Community builder" are recommended for "Players who want to relax" [S43].
  * That is honest labelling, and it fits a calm game.
* **Exact cycle lengths are UNVERIFIED.** A third-party design site gives cycle lengths for each storyteller (for example a 10.6 day Cassandra cycle). I could not confirm them on the wiki page I read.

### 4.2 Avoiding unfair randomness

* **Perceived fairness matters more than true odds.**
  * In Civilization Revolution, players lost at 2 to 1 odds and accepted it. When the numbers were scaled up to 20 to 10, they no longer accepted the loss [S40].
  * Meier said players feel the computer is "out to get them" [S40b].
* **Practical rules (OPINION, consistent with [S40][S43][S54]):**
  1. Telegraph big negatives: a forecast, a sign or a warning.
  2. Cap stacking. No two catastrophes in the same month unless the player chose a "harsh" teller.
  3. Correlate events for realism, but show the link. For example, our event table already raises the drought chance after a dry year (`farm-life-lesson.md` 8.6).
  4. Give a response to every event, so it becomes a decision and not just a loss.
  5. After a big loss, offer a recovery opportunity, as Phoebe sends helpful traders after a hard raid [S43].
  6. Let the player pick the teller and change it later without penalty [S43].

### 4.3 Named workers with personalities

* RimWorld's colonists are the template: few traits, strong needs, visible moods [S43][S44]. Frostpunk shows that the individual is viewable while doing a task, which "translate[s] those needs into actions" [S45].
* OPINION: give each worker a name, two traits, a home, family ties, a skill that grows, and one small wish. Stories emerge from colliding needs. For example, a herder who is great with cattle but wants to visit family during auction week.
* **Sensitivity (OPINION):** farmworkers in Namibia and South Africa carry real histories of labour and land. Avoid comic stereotypes and paternalistic framing. Have Namibian reviewers read worker dialogue before release.

### 4.4 Event design pattern (OPINION)

Each event card has five parts:

* **trigger:** systemic, from the state of the farm;
* **warning:** where possible;
* **choice:** 2 or 3 options with visible trade-offs [S39];
* **consequence:** shown on the map;
* **story line:** written to the farm diary.

The diary is how emergent stories get retold. Players share them, which is free marketing.

---

## 5. Session design: phones versus PC

### 5.1 What the numbers say

**Mobile, 2024 data** (GameAnalytics 2025 report, median by genre, monthly cohorts across 2024) [S32]:

| Genre | Session length | Sessions per day | Daily playtime |
|---|---|---|---|
| Simulation | 3.9 to 4.3 min | 3.58 to 3.73 | 14.1 to 15.0 min |
| Strategy | 5.3 to 5.6 min | 4.21 to 4.36 | 22.2 to 24.8 min |
| Casual | 3.5 to 4.0 min | 3.86 to 4.13 | 12.7 to 14.3 min |

**Mobile, 2025 data, all genres** (GameAnalytics 2026 report, via summaries) [S33][S34]:

* Median session 3.1 to 3.5 minutes, median daily playtime about 12 minutes, about 3.8 to 3.9 sessions a day.
* The top 1% reach about 22 minutes a session.

**PC, 2025 data** (GameAnalytics 2026, 3,582 games) [S34]:

* Median session about 18 minutes, median daily playtime 32 to 33 minutes, 1.65 to 1.7 sessions a day.
* The top 25% often exceed 30 minutes a session.

**Different definitions.** Adjust reports much longer "session length" numbers for 2025, for example 37.51 minutes for strategy [S35]. Their definitions differ from GameAnalytics. Compare like with like and never mix sources in one target.

### 5.2 Design implications (OPINION)

* **Phone:**
  * One meaningful unit of play should fit in 3 to 5 minutes.
  * Autosave constantly and resume instantly.
  * Use portrait-friendly menus and one-thumb actions.
* **PC:**
  * Support long sessions with deeper planning views: camp map overlays, spreadsheets for herd records, and a speed control.
  * The same save should work across devices.
* **Browser:**
  * Fast first load matters more than anything else (UNVERIFIED as a benchmark; no dated source found).
  * Offer a no-install demo farm.

### 5.3 Offline progress: yes or no?

* **The idle-game view.** Anthony Pecorella (Kongregate, GDC Europe 2016, "Quest for Progress") said of Egg Inc.'s "2 hour limit on offline earning": "I think this was a mistake, I churned out myself largely because of this" [S55]. Idle players expect generous offline gains.
* **Calm sims are not idle games** (OPINION). If the farm runs while away, animals can starve while you sleep, which is a punishment for not returning. PEGI now rates mechanics that "punish players for not returning (e.g. by losing content or reducing progress)" at PEGI 12 [S11].
* **Recommended default (SUGGESTION, also in section 8):**
  * Game time passes only while playing.
  * An optional "foreman mode" lets the farm tick slowly while away with only positive or neutral outcomes: grass grows, calves are born, and nothing dies.

### 5.4 Notifications done respectfully

* **Apple, Guideline 4.5.4:**
  * push must not be required for the app to work;
  * promotional push needs explicit opt-in "via consent language displayed in your app's UI" and an in-app opt-out [S1].
* **Android 13 and later:** notifications need the runtime `POST_NOTIFICATIONS` permission. Google suggests asking in context, for example "wait until the third or fourth time the user launches your app" [S56].
* **iOS web apps:** Web Push works for Home Screen web apps from iOS 16.4. The permission request must come from "direct user interaction", such as tapping a subscribe button (WebKit, 16 Feb 2023) [S57].
* **Rules for us (OPINION):**
  * Only send notifications the player asked for (for example "Auction day you booked is tomorrow").
  * At most one a day.
  * No guilt, no fake urgency.

---

## 6. Ethical retention and monetisation for "free with extras"

### 6.1 What players accept and what triggers backlash

**Survey evidence**

* **Mistplay Mobile Gaming Growth Report 2024** (3,000 Mistplay users in the US, Canada and UK, Q2 2024; note the sample is reward-app users) [S31]:
  * Reasons players stay after the first session: enjoying the mechanics (69.2%), a strong sense of progression and rewards (67.1%).
  * Reasons players leave: pay-to-win (77.18%), too many ads (71.85%), misleading ad creatives (66.17%).
* **Petrovskaya and Zendle (2021, *Journal of Business Ethics*)** surveyed 1,104 players and catalogued 35 practices players see as unfair, misleading or aggressive. They grouped them into eight domains, including pay-to-win, monetising basic quality of life, in-game currency, and predatory advertising [S29].
* **Zagal, Björk and Lewis (FDG 2013)** define game dark patterns as designs that work against the player's interests. They group them as temporal (for example grinding, playing by appointment), monetary (for example pay-to-skip) and social capital [S30].

**Backlash cases**

* **Star Wars Battlefront II (2017).** EA's Reddit reply defending the unlock design ("sense of pride and accomplishment") became the most downvoted Reddit comment ever. EA then pulled microtransactions before launch [S27].
* **Diablo Immortal (2022).**
  * It did not launch in Belgium or the Netherlands because of loot box laws [S28].
  * Players criticised its paid odds boosters as close to pay-to-win (PC Gamer coverage, via search summary, UNVERIFIED wording).
* **Dungeon Keeper (2014).** The UK ASA ruled an ad calling the game free was misleading because timers pushed players to buy gems [S26].
* **Fortnite (2022).** The FTC alleged dark patterns that caused unintended purchases. Epic paid US$245m in refunds and US$275m for COPPA violations, US$520m in total [S23]. Since the settlement Epic uses "hold-to-purchase" confirmation, instant cancellation and self-service refunds [S23].
* **Genshin Impact (Jan 2025).** The FTC settled with Cognosphere for US$20m. The terms [S24]:
  * no loot boxes for under 16s without a parent's affirmative express consent;
  * loot boxes must also be buyable directly with real money;
  * odds and virtual currency exchange rates must be disclosed;
  * no misrepresenting odds or prices.

**Models that sit on the "accepted" side** (these examples come from the sources; whether each counts as accepted is my OPINION)

* **Premium price with honest, fixed pricing:** Factorio's no-sale stance [S47b], and Stardew as a one-off purchase [S42].
* **Big paid expansions.** Factorio: Space Age launched Oct 2024 at the same price as the base game (per a search summary of FFF #418, UNVERIFIED detail).
* **Cosmetics that do not change power.** Supported by the pay-to-win findings [S29][S31].
* **"Remove ads" and supporter packs.** These are common. I found no dated, primary acceptance survey for them (UNVERIFIED).

**Genre warning: Hay Day** uses a dual currency: coins, plus diamonds that cost real money. Storage fills up "unless you use diamonds or spend time" (Game Developer analysis, 2013) [S58]. That model works commercially, but it sits on the temporal and monetary dark pattern line [S30]. It now also affects age ratings if timed offers or paid random items are added [S11].

### 6.2 Platform rules (read Nov 2026)

| Platform | Rule | Source and date |
|---|---|---|
| Apple App Store | 3.1.1: unlocking features or content (including "in-game currencies, game levels") must use in-app purchase. Purchased currencies "may not expire". Offer a restore mechanism. Loot boxes "must disclose the odds of receiving each type of item to customers prior to purchase". | [S1], last updated 16 Oct 2026 |
| Apple App Store | 3.1.1(a) and the US storefront: outside the US, no buttons or links to other purchase methods unless you hold an entitlement. US storefront apps may include such links. | [S1] |
| Apple App Store | 1.3 Kids Category: no purchasing or links out "unless reserved for a designated area behind a parental gate". 5.1.4: care with kids' data (COPPA, GDPR), and no third-party analytics or ads in kids apps. | [S1] |
| Apple App Store | 4.2: a wrapped website must be "beyond a repackaged website". Matters if we ship the browser build as an app. 4.5.4: rules for push (see 5.4). | [S1] |
| Apple App Store | New age ratings 4+, 9+, 13+, 16+, 18+. New questionnaire covering in-app controls and capabilities. Answers were due by 31 Jan 2026. | [S2], 24 Jul 2025 |
| Google Play | Use Play Billing for in-app digital items, including "virtual currencies, extra lives, additional playtime". Paid randomised items "must clearly disclose the odds... in advance of, and in close and timely proximity to, that purchase". Virtual currency only in the title it was bought for. Prices must match the Play billing UI. Alternative billing only in eligible regions under the programmes. | [S3], page read Nov 2026 |
| Steam | Not accepted: "Applications with advertising-based business models", and blockchain apps that issue or trade crypto or NFTs. | [S4], read Nov 2026 |
| Steam | All in-game purchases must use the Steam Wallet through the microtransaction API. DLC is the alternative, and both "must use Steam Wallet". Valve warns about fraud in tradeable economies. | [S5][S6] |
| Steam | Steam Playtest is a free feature for running sign-up playtests. | [S7] |

**Steam has no published loot box odds rule.** I found no Steam-specific odds disclosure requirement in the pages I read. UNVERIFIED; check the Steamworks documentation and distribution agreement.

### 6.3 Laws and regulators on loot boxes and dark patterns

* **Australia (from 22 Sep 2024)** [S8][S9][S10]:
  * Games with "in-game purchases linked to elements of chance", such as paid loot boxes, get a mandatory minimum of M (not recommended under 15).
  * Simulated gambling gets R 18+ (legally restricted to adults).
  * The FAQ says chance-based rewards count even if they can also be earned in play, as long as they can be bought "directly or indirectly". It also says a battle pass with randomised items "will likely be captured" [S9].
  * Simulated gambling needs all of: interactivity, a gambling-like environment, a stake, a random outcome, and possible loss of the stake [S9].
  * The changes are not retrospective unless a game is significantly modified [S10].
  * Classification can be done through approved tools such as IARC [S10].
* **PEGI (Europe)** [S11][S12]:
  * From June 2026, new submissions are rated on "interactive risk" criteria:
    * time-limited or quantity-limited offers: PEGI 12;
    * NFTs or blockchain: PEGI 18;
    * paid random items: PEGI 16 by default, sometimes 18;
    * daily quests that reward returning: PEGI 7;
    * mechanics that punish not returning: PEGI 12;
    * unrestricted chat with no block or report: PEGI 18.
  * From Oct 2026, existing digital-only games rated 3, 7 or 12 that have paid random items are being re-rated to PEGI 16 [S12].
* **ESRB (North America)** added the "In-Game Purchases (Includes Random Items)" notice on 13 Apr 2020 [S13].
* **IARC:**
  * One questionnaire gives ratings for participating storefronts, including Google Play, Microsoft and the Nintendo eShop. It is free to developers [S14].
  * Apple runs its own ratings [S2].
  * Steam's use of IARC is UNVERIFIED.
* **Belgium.**
  * In 2018 the Gaming Commission found paid loot boxes in some games to be illegal gambling [S15].
  * Enforcement has been weak: Leon Xiao found 82 of the 100 top-grossing iPhone games in Belgium still had paid random items [S16].
* **Netherlands.** The Council of State ruled on 9 Mar 2022 that FIFA packs were not a separate game of chance, and overturned the fine [S17].
* **UK.**
  * There is no loot box law. Industry principles were agreed in July 2023 (Ukie) [S18].
  * DCMS commissioned research on whether the principles work. As of Jan 2026 the government said findings and next steps would be published in 2026 [S19].
  * Current status is UNVERIFIED.
* **Brazil.**
  * Law 15.211/2025 (the "ECA Digital") took effect in March 2026. Article 20 bans paid loot boxes ("caixas de recompensa") in games aimed at or likely to be accessed by minors. It also requires real age verification, not self-declaration [S20][S21].
  * I could not load the law text (the gov.br server timed out), so details come from Estadão reporting, 18 Mar 2026 [S21].
* **EU Digital Fairness Act.**
  * A leaked draft was reported on 10 Nov 2026. The European Commission planned to publish the proposal on 11 Nov 2026, which is today [S22].
  * Draft articles: show the real-money value of virtual currency items; paid virtual currencies "disabled by default" for minors unless a parent approves; no paid variable rewards or pay-to-win for minors; odds and an off switch for everyone; a ban on manipulative interfaces; an off switch for features that "encourage compulsive or excessive use".
  * **Not law. UNVERIFIED until the official text is read.**
* **USA (FTC):**
  * The Epic (2022) and Genshin (2025) settlements set expectations: clear purchase confirmation, easy refunds, odds and exchange rate disclosure, and parental consent for young teens [S23][S24].
  * The amended COPPA Rule took effect 23 Jun 2025, with full compliance due by 22 Apr 2026 [S25].
  * Epic's own takeaway: teen or mature rated games "can no longer assume" they will not be treated as directed to children [S23].

### 6.4 The fair "free with extras" model, in one table (OPINION, rule-checked)

| Item | Player acceptance | Rating impact | Store fit |
|---|---|---|---|
| Free first farm or first season, then a one-off unlock | High (premium-like) | None | Fits all stores; on mobile it must be in-app purchase [S1][S3] |
| Expansions (new region, new species) | High | None | Fits all stores |
| Cosmetics: bakkie paint, homestead style, farm dog breed | Accepted [S29][S31] | None if not random or time-limited | Fits all stores |
| Supporter pack (soundtrack, art book) | Likely accepted (UNVERIFIED) | None | Fits all stores |
| Opt-in rewarded ads (mobile only) | Mixed; "too many ads" is a top quit reason [S31] | None | Not on Steam [S4] |
| Daily login rewards | Neutral | PEGI 7 [S11] | Fits, but adds a rating step |
| Penalty for not logging in | Dark pattern [S30] | PEGI 12 [S11] | Avoid |
| Timed shop offers | Seen as pressure [S29] | PEGI 12 [S11] | Avoid |
| Paid loot boxes or gacha | Backlash [S27][S28] | PEGI 16 [S11], AU M [S8], banned for minors in Brazil [S21] | Avoid |
| Pay to skip drought or timers | Pay-to-win and dark pattern [S29][S30][S31] | Possibly a future EU ban for minors [S22] | Avoid |

---

## 7. Playtesting and metrics

### 7.1 Playtesting for fun

* **Run the session as an observer** (Tracy Fullerton, *Game Design Workshop*, playtesting chapter) [S53]. Summary seen via search; chapter not reopened, so the method below is UNVERIFIED wording.
  * Explain that you are testing the game, not the player.
  * Ask them to think aloud.
  * Answer questions with "what do you think you should do?".
  * Do not defend or explain the design.
  * Ask open questions afterwards.
* **Small rounds, often.** Nielsen (NN/g, 18 Mar 2000): "The best results come from testing no more than 5 users and running as many small tests as you can afford" [S60]. That was written for usability, so use it for FTUE clarity. Fun still needs longer play diaries.
* **Watch real newcomers.** Factorio's educator watched new players for hours and redesigned around what confused them [S47].
* **Steam Playtest** gives free sign-up playtests before release [S7].
* **What to log in every test (OPINION):**
  * time to first sale;
  * where players stop or quit;
  * which tooltips they open;
  * whether they can explain why the grass fell;
  * the moment they smile or swear;
  * whether they say "one more day".

### 7.2 Metrics and definitions

* **Retention:** the share of a day-0 cohort who return on day N. GameAnalytics reports D1, D7 and D28 [S32]; others report D30.
* **What each D-number tells you** [S32]:
  * D1 reflects onboarding;
  * D7 reflects core appeal;
  * D28 reflects content pacing.
* **Engagement:** session length, sessions per day, daily playtime, and DAU/MAU (stickiness).
* **Monetisation:** conversion (payers ÷ players, per a stated window), ARPDAU, ARPPU and LTV. Always state the window and the denominator. A compilation of published figures shows that sources disagree mostly because of definitions [S36].

### 7.3 Benchmarks (dated, named, never mixed)

**GameAnalytics 2025 Mobile Gaming Benchmarks** [S32]:

* **Data:** calendar 2024, 11,600 games, 1.48bn average MAU, median by genre.
* **Simulation:**
  * D1 16.77% to 17.28%;
  * D7 2.22% to 2.56%;
  * D28 0.45% to 0.53%.
* **Strategy:**
  * D1 19.00% to 20.65%;
  * D7 3.18% to 3.58%;
  * D28 0.66% to 0.77%.
* **Casual:**
  * D1 20.02% to 21.11%;
  * D7 3.14% to 3.46%;
  * D28 0.65% to 0.75%.
* **All genres, 2024:**
  * top 25% of games had D1 of 26.48% to 27.69%;
  * top 25% iOS D1 was 31% to 33%, Android 25% to 27%;
  * median D7 was 3.42% to 3.94%, and the top 25% reached 7% to 8%;
  * 75% of games did not exceed 3% at D28.
* **Engagement:** median session 5 to 6 minutes (top 25%: 8 to 9), median 4 sessions a day.
* **Genre top quartiles are not published** in the free report. They need the paid tool.

**GameAnalytics 2026 Mobile and PC Benchmarks** [S33][S34]:

* **Data:** 2025, more than 16,000 mobile games with at least 1,000 MAU; 3,582 PC games. Read through two summaries, not the PDF.
* **Mobile:**
  * median D1 about 22%, top 25% just above 30%, top 10% about 40%, top 1% 64% to 68%;
  * median D7 just under 4%, top 25% 6% to 7%;
  * median D30 0.69% to 0.79%, top 25% 1.6% to 1.8%.
* **PC:**
  * median D1 about 9%, D7 about 1.7% to 1.8%, D30 about 0.3%;
  * top 25% D1 15% to 16%;
  * DAU/MAU median 4% to 5%.

**Adjust Gaming App Insights 2026** (via summary) [S35]:

* **Data:** Jan 2024 to Jan 2026.
* All-genre D1 was 27% in 2025, measured on Adjust's dataset (which skews to larger apps running paid user acquisition).
* Simulator session counts grew 18% in 2025.

**Conversion to paying:** I found no primary, dated, genre-specific figure.

* A compilation attributes "fewer than 5% of users make any purchase" to AppsFlyer's 2024 State of Gaming App Marketing [S36]. Primary not opened: UNVERIFIED.
* Treat 1% to 5% payer share as folklore until we measure our own.

**Caveats**

* The samples are biased. GameAnalytics leans to small studios and hyper-casual games; Adjust leans to apps running ad campaigns.
* A calm premium-style sim with a strong PC audience may look very different.
* Set targets against the simulation row and our own cohorts, not against the top 1%.

---

## 8. Concrete design suggestions for our game

All of these are SUGGESTIONS. Numbers marked A are assumptions to test, not facts.

1. **SUGGESTION: Three loop sizes.**
   * **Short:** one job, under 1 minute.
   * **Medium:** one game week, about 4 minutes on phone (A), sized to the simulation median session of 3.9 to 4.3 minutes [S32].
   * **Long:** the July to June season year.
   * End every week with a farm diary summary and one open thread ("Auction at Gobabis on Thursday").
2. **SUGGESTION: Morning radio.** Each game morning, a short farm radio message lists today's 3 suggested jobs, the rain forecast and the auction prices. The player picks one main job: one decision, one screen.
3. **SUGGESTION: FTUE in 10 minutes.**
   * Start in late summer rains: windmill fix, then water, then move the herd, then sell 5 weaners, then the first trade-off (section 2.2).
   * The first sale happens before minute 10.
   * NamLITS paperwork, disease and predators unlock in weeks 2 to 6.
4. **SUGGESTION: Three "seasons storytellers".**
   * "Good Years" (Phoebe-like): long calm, droughts mild.
   * "Real Namibia" (Cassandra-like): the correlated drought logic from `farm-life-lesson.md` 8.6.
   * "Wild Veld" (Randy-like): clearly labelled as unfair.
   * Changeable any time with no penalty [S43].
5. **SUGGESTION: Telegraph every big hit.**
   * Drought: forecast plus a late-rain warning plus a falling dam level, 1 to 2 game months ahead.
   * FMD: radio news before movement bans.
   * Never stack two disasters in one month on the gentle teller [S40][S54].
6. **SUGGESTION: Readable veld.**
   * Each camp shows a grass bar, a water icon and a "lasts until" date.
   * The farm shows one "Will we make it to April?" meter, based on the forage budget.
   * Formulas live in a details panel for the spreadsheet players.
7. **SUGGESTION: Named workers.**
   * Each worker has a name, two traits, a home and family, a growing skill, and one wish.
   * Housing is required: a worker without housing leaves (`farm-life-lesson.md` 8.3).
   * Diary entries tell their stories. Namibian reviewers check the dialogue.
8. **SUGGESTION: Calm juice.**
   * the auctioneer's patter and a gavel tap;
   * rain on a zinc roof;
   * the dam level rising;
   * weaners trotting up the loading ramp;
   * a cash counter;
   * guinea fowl calling after rain.
   * No screen shake.
9. **SUGGESTION: Time only passes while playing (default).**
   * Optional "foreman mode": the farm ticks slowly while away, with only good or neutral outcomes.
   * No losses from absence, which avoids the PEGI 12 trigger [S11].
10. **SUGGESTION: Notifications only on request.**
    * Ask after the third session [S56].
    * Only player-booked reminders (auction day, vet visit), at most one a day.
    * No marketing push without opt-in [S1].
11. **SUGGESTION: The monetisation stack.**
    * Free first farm and first season, then a one-off "Full Farm Life" unlock.
    * Paid expansions: Limpopo game ranch, Kunene communal grazing.
    * Cosmetics, plus a supporter pack.
    * **Never:** loot boxes, energy, paid skips, timed offers, or ads on Steam [S4][S8][S11].
    * This keeps us aiming for PEGI 3 or 7 and Australian G or PG. Our own rating answers decide the final rating. UNVERIFIED until we file the IARC and Apple questionnaires.
12. **SUGGESTION: Same game, fair price on every store.**
    * Premium on Steam: full unlock price, with the same content as the mobile unlock.
    * Cross-save between browser, phone and PC.
    * Show prices in real money only. Use no virtual currency at all, which also future-proofs against the EU draft [S22].
13. **SUGGESTION: A realism toggle.**
    * "Real Namibia paperwork": tag deadlines, permits and levies from `farm-life-lesson.md`.
    * Off by default, as in FS25's options approach [S48].
14. **SUGGESTION: A playtest cadence.**
    * Five new players per build, using the think-aloud method [S53][S60].
    * Log time to first sale, the quit point, and whether they can explain why the grass fell.
    * Track D1, D7 and D28 against the GameAnalytics simulation medians: D1 about 17%, D7 about 2.4%, D28 about 0.5% [S32].
    * Stretch goal: the all-genre top quartile D1 of 26% to 28% [S32] (A).

---

## 9. Common mistakes

1. Teaching with text walls instead of doing [S52][S47].
2. Holding the core fantasy back too long. Factorio's old tutorial took 30 to 45 minutes to reach automation [S47].
3. Simulating everything at the same depth and showing every number.
4. Unforecast disasters that wipe out an hour of play [S40][S54].
5. Randomness with no response option.
6. Punishing players for leaving (dying crops, spoiled stock). PEGI 12 risk [S11], and a dark pattern [S30].
7. Calling a game "free" when timers make it pay-to-progress (ASA, Dungeon Keeper) [S26].
8. Adding loot boxes or "mystery crates" late, which silently moves the rating to PEGI 16 or AU M [S8][S11][S12].
9. Planning ad revenue for the Steam version [S4].
10. Multi-tier currencies that hide real prices (FTC, Genshin) [S24]. This is also targeted by the EU draft [S22].
11. One-tap purchases with no confirmation or refund path (FTC, Epic) [S23].
12. Comparing your D1 with a different vendor's definition or with the top 1% [S32][S35].
13. Testing only with friends who already know the game.
14. Stereotyped worker characters in a real, sensitive setting (OPINION).

## 10. Checklist before each milestone

**Loop and pacing**

* [ ] A short, medium and long goal is visible on screen at all times.
* [ ] Every day or week ends with a summary and one open thread.
* [ ] The first sale happens within 10 minutes; a newcomer reaches it without help.
* [ ] Each new system is introduced by doing, with one goal.

**Simulation and events**

* [ ] Each big system has one bar or meter, with detail on tap.
* [ ] Every negative event has a warning, a choice and a recovery path.
* [ ] Storyteller presets are clearly named and changeable with no penalty.

**Sessions**

* [ ] A phone session unit takes 5 minutes or less, with instant resume.
* [ ] No loss happens while the player is away.
* [ ] Notifications are opt-in, in context, and player-booked only.

**Monetisation and compliance**

* [ ] No paid random items, energy, timed offers or pay-to-skip.
* [ ] Mobile purchases use Apple in-app purchase and Google Play Billing; Steam purchases use Steam Wallet.
* [ ] Purchase confirmation and a refund path are in place; there are no expiring purchases [S1].
* [ ] Ratings questionnaires (IARC and Apple) are answered honestly, and re-answered after any monetisation change.
* [ ] Children's privacy: no third-party ads or analytics if we target kids; COPPA check if US children are likely [S1][S25].
* [ ] The EU Digital Fairness Act and UK DCMS status are rechecked before launch [S19][S22].

**Testing**

* [ ] Five-player think-aloud test done on this build.
* [ ] Analytics events are live for the FTUE steps, the quit point, and session start and end.
* [ ] D1, D7 and D28 are compared only with the GameAnalytics simulation row.

---

## 11. Sources (all accessed 11 Nov 2026 unless noted)

**Platform rules and law**

* [S1] Apple, App Store Review Guidelines, last updated 16 Oct 2026. https://developer.apple.com/app-store/review/guidelines/
* [S2] Apple Developer News, "Updated age ratings in App Store Connect", 24 Jul 2025. https://developer.apple.com/news/?id=ks775ehf
* [S3] Google Play Console Help, Payments policy. https://support.google.com/googleplay/android-developer/answer/9858738
* [S4] Steamworks, Onboarding (content not accepted). https://partner.steamgames.com/doc/gettingstarted/onboarding
* [S5] Steamworks, Microtransactions. https://partner.steamgames.com/doc/features/microtransactions
* [S6] Steamworks, Free to Play. https://partner.steamgames.com/doc/store/freetoplay
* [S7] Steamworks, Steam Playtest. https://partner.steamgames.com/doc/features/playtest
* [S8] Australian Classification, "New classifications for gambling-like content in video games" (changes from 22 Sep 2024). https://www.classification.gov.au/classification-ratings/new-classifications-for-gambling-content-video-games
* [S9] Australian Classification, FAQ on mandatory classifications for gambling-like content (PDF). https://www.classification.gov.au/sites/default/files/documents/game-guidelines-for-gambling-like-content-faq.pdf
* [S10] Legal 500, "Mandatory minimum classifications for computer games with gambling-like content". https://www.legal500.com/intelligence/australia/media-telecoms-it-entertainment/mandatory-minimum-classifications-for-computer-games-with-gambling-like-content
* [S11] PEGI, "PEGI expands age rating criteria with interactive risk categories", 12 Mar 2026. https://pegi.info/news/pegi-expands-age-rating-criteria-interactive-risk-categories
* [S12] PEGI, "PEGI Updates Age Ratings of Existing Games with Paid Random Items", 2026. https://pegi.info/news/pegi-updates-age-ratings-existing-games-paid-random-items
* [S13] ESRB, "Introducing a New Interactive Element: In-Game Purchases (Includes Random Items)", 13 Apr 2020. https://www.esrb.org/blog/in-game-purchases-includes-random-items/
* [S14] IARC, FAQ. https://globalratings.com/faq/ (read through a search summary)
* [S15] BBC News, "Video game loot boxes declared illegal under Belgium gambling laws", 25 Apr 2018. https://www.bbc.com/news/technology-43906306
* [S16] Leon Y. Xiao, "Breaking Ban: Belgium's Ineffective Gambling Law Regulation of Video Game Loot Boxes", *Collabra: Psychology* 9(1), 2023. https://online.ucpress.edu/collabra/article/9/1/57641/195100/Breaking-Ban-Belgium-s-Ineffective-Gambling-Law
* [S17] Raad van State (Dutch Council of State), FIFA 22 loot box ruling, 9 Mar 2022. https://www.raadvanstate.nl/actueel/nieuws/@130206/dwangsom-onterecht-opgelegd-loot-boxes
* [S18] Ukie, "New loot box principles agreed by industry", Jul 2023. https://ukie.org.uk/news/new-loot-box-principles-agreed-by-industry
* [S19] UK Parliament written question and answer, 14 Jan 2026. https://questions-statements.parliament.uk/written-questions/detail/2026-01-14/106013 (through a search summary)
* [S20] Brazil, Lei 15.211/2025 (ECA Digital). https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm (server timed out; not read directly)
* [S21] Estadão / TecMundo Voxel, "ECA Digital não proíbe jogos, apenas loot boxes...", 18 Mar 2026. https://www.estadao.com.br/tecmundo/voxel/503815-eca-digital-nao-proibe-jogos-apenas-loot-boxes-que-sao-caca-niqueis-diz-governo/
* [S22] Mobilegamer.biz, "EU's draft Digital Fairness Act takes aim at loot boxes, virtual currencies and pay-to-win", 10 Nov 2026 (leaked draft). https://mobilegamer.biz/eus-draft-digital-fairness-act-takes-aim-at-loot-boxes-virtual-currencies-and-pay-to-win/
* [S23] Epic Games, "Epic FTC Settlement and moving beyond long-standing industry practices", 19 Dec 2022, https://www.epicgames.com/site/en-US/news/epic-ftc-settlement-and-moving-beyond-long-standing-industry-practices ; FTC International Monthly, Jan 2023, https://content.govdelivery.com/accounts/USFTC/bulletins/343e198
* [S24] Polygon, "Genshin Impact developer to pay $20M fine to US FTC", 17 Jan 2025, https://www.polygon.com/news/511171/genshin-impact-ftc-settlement-gacha/ ; FTC proposed order (PDF), https://search.ftc.gov/system/files/ftc_gov/pdf/Cognosphere-Attachment3-3.pdf (PDF not opened)
* [S25] Federal Register, COPPA Rule final amendments, 22 Apr 2025 (effective 23 Jun 2025; compliance by 22 Apr 2026). https://www.govinfo.gov/content/pkg/FR-2025-04-22/html/2025-05904.htm
* [S26] UK ASA, Ruling on Electronic Arts Ltd (Dungeon Keeper), 2 Jul 2014. https://www.asa.org.uk/rulings/electronic-arts-ltd-a14-258907.html

**Player attitudes and backlash cases**

* [S27] Kotaku, "EA Defense Of Star Wars Battlefront II Becomes Most Downvoted Reddit Comment Ever", Nov 2017. https://kotaku.com/ea-defense-of-star-wars-battlefront-ii-becomes-most-dow-1820396527
* [S28] Ars Technica, "Two European countries won't get Diablo Immortal because of loot box laws", May 2022. https://arstechnica.com/gaming/2022/05/loot-box-laws-block-diablo-immortal-launch-in-some-european-countries/
* [S29] Petrovskaya and Zendle, "Predatory Monetisation?", *Journal of Business Ethics*, 2021. https://link.springer.com/article/10.1007/s10551-021-04970-6
* [S30] Zagal, Björk and Lewis, "Dark Patterns in the Design of Games", FDG 2013. http://fdg2013.org/program/papers/paper06_zagal_etal.pdf
* [S31] Mistplay Mobile Gaming Growth Report 2024, through GameDevReports, 31 Oct 2024. https://gamedevreports.substack.com/p/mistplay-mobile-gaming-growth-report

**Benchmarks**

* [S32] GameAnalytics, 2025 Mobile Gaming Benchmarks (2024 data; PDF mirror). https://investgame.net/wp-content/uploads/2025/02/2025-GameAnalytics-Mobile-Gaming-Benchmarks.pdf
* [S33] Gamigion, "2026 Mobile & PC Gaming Benchmarks Report by GameAnalytics", Jan 2026. https://www.gamigion.com/2026-mobile-pc-gaming-benchmarks-report-by-gameanalytics/
* [S34] GameDevReports, "GameAnalytics: Mobile and PC Game Benchmarks in 2026", 4 Jun 2026. https://gamedevreports.substack.com/p/gameanalytics-mobile-and-pc-game
* [S35] GameDevReports, "Adjust: Gaming App Insights Report 2026", 15 Apr 2026. https://gamedevreports.substack.com/p/adjust-gaming-app-insights-report
* [S36] Luca Barberis, Operator Atlas, "Paying user share" (a compilation that cites AppsFlyer, Mistplay and others). https://lucabarberis.com/operator-atlas/free-to-play-gaming/paying-user-share/

**Design theory, talks and reference games**

* [S37] Daniel Cook, "Loops and Arcs", Lost Garden, 30 Apr 2012. https://lostgarden.com/2012/04/30/loops-and-arcs/
* [S38] Raph Koster, "Theory of Fun: 10 Years Later" (slides, PDF). https://www.raphkoster.com/wp-content/uploads/2026/07/Theory-of-Fun-10-Years-Later.pdf ; also the book *A Theory of Fun for Game Design* (2004)
* [S39] Game Developer, "GDC 2012: Sid Meier on how to see games as sets of interesting decisions", 7 Mar 2012. https://www.gamedeveloper.com/design/gdc-2012-sid-meier-on-how-to-see-games-as-sets-of-interesting-decisions
* [S40] Game Informer, "Sid Meier: Gamers Aren't Logical", 12 Mar 2010. https://gameinformer.com/b/news/archive/2010/03/12/sid-meier-gamers-arent-logical
* [S40b] Kotaku, "Civilization Creator Explains Why Everything Game Devs Know Is Wrong", 2010. https://kotaku.com/civilization-creator-explains-why-everything-game-devs-5492078
* [S41] GQ, "Valley Forged: How One Man Made the Indie Video Game Sensation Stardew Valley". https://www.gq.com/story/stardew-valley-eric-barone-profile
* [S42] ConcernedApe, "Stardew Valley 10-year Anniversary", Feb 2026. https://www.stardewvalley.net/stardew-valley-10-year-anniversary/
* [S43] RimWorld Wiki, "AI Storytellers". https://rimworldwiki.com/wiki/AI_Storytellers
* [S44] GDC Vault, Tynan Sylvester, "RimWorld: Contrarian, Ridiculous, and Impossible Game Design Methods", GDC 2017. https://gdcvault.com/play/1024232/-RimWorld-Contrarian-Ridiculous-and (content through summaries)
* [S45] Game Developer, "Making Frostpunk grim without descending to dark comedy". https://www.gamedeveloper.com/design/making-i-frostpunk-i-grim-without-descending-to-dark-comedy
* [S46] Game Developer, "Banished's 'build what you want, when you want it' game design", 30 Dec 2013. https://www.gamedeveloper.com/business/-i-banished-i-s-build-what-you-want-when-you-want-it-game-design
* [S47] Factorio, Friday Facts #241 "New player experience", 4 May 2018. https://factorio.com/blog/post/fff-241
* [S47b] Factorio, Friday Facts #140 (no sales). https://www.factorio.com/blog/post/fff-140
* [S48] UnGeek, interview with GIANTS Software's Martin Rabl on Farming Simulator 25, Dec 2024. https://www.ungeek.ph/2024/12/interview-giants-softwares-martin-rabl-on-the-stand-out-features-of-farming-simulator-25-and-more/
* [S49] PC Gamer, "Game Dev Story leads Kairosoft's irresistible sim-lite games onto Steam", 4 Mar 2022. https://www.pcgamer.com/game-dev-story-leads-kairosofts-irresistible-sim-lite-games-onto-steam/
* [S50] Jonasson and Purho, "Juice it or lose it", 2012. https://www.youtube.com/watch?v=Fy0aCDmgnxg ; GDC Vault https://www.gdcvault.com/play/1016487/juice-it-or-lose
* [S51] Jan Willem Nijman, "The art of screenshake", INDIGO Classes 2013. https://www.youtube.com/watch?v=AJdEqssNZ-U
* [S52] Celia Hodent, "The Gamer's Brain, Part 2: UX of Onboarding and Player Engagement" (GDC 2016). https://celiahodent.com/gamers-brain-ux-onboarding/
* [S53] Tracy Fullerton, *Game Design Workshop*, chapter "Playtesting". https://www.taylorfrancis.com/chapters/mono/10.1201/9781003460268-11/playtesting-tracy-fullerton
* [S54] Matthew Davis, "Into the Breach Design Postmortem", GDC 2019. https://www.youtube.com/watch?v=s_I07Iq_2XM (through summaries)
* [S55] Anthony Pecorella, "Quest for Progress: The Math and Design of Idle Games", GDC Europe 2016 (slides). https://media.gdcvault.com/gdceurope2016/presentations/Pecorella_Anthony_Quest%20for%20Progress.pdf
* [S56] Android Developers, "Notification runtime permission". https://developer.android.com/develop/ui/views/notifications/notification-permission
* [S57] WebKit, "Web Push for Web Apps on iOS and iPadOS", 16 Feb 2023. https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
* [S58] Game Developer (blog), "Game monetization design: Analysis of Hay Day". https://www.gamedeveloper.com/business/game-monetization-design-analysis-of-hay-day
* [S59] Jesse Schell, *The Art of Game Design: A Book of Lenses* (CRC Press, 3rd ed. 2019). Not reopened this session.
* [S60] Jakob Nielsen, "Why You Only Need to Test with 5 Users", NN/g, 18 Mar 2000. https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/

## 12. Gaps and UNVERIFIED items

1. **No published genre top quartiles.** The free GameAnalytics report gives medians only by genre. Top quartiles for simulation need the paid benchmark tool.
2. **No primary payer conversion benchmark.** "Fewer than 5% pay" (AppsFlyer 2024) was seen only in a compilation [S36].
3. **GameAnalytics 2026 figures** come from two summaries, not the PDF [S33][S34].
4. **Adjust figures** come from a summary [S35], and their session definitions differ from GameAnalytics.
5. **No Steam loot box odds rule found.** Steam's use of IARC is also not confirmed.
6. **EU Digital Fairness Act** is a leaked draft only. Publication was planned for 11 Nov 2026 [S22].
7. **UK DCMS** loot box research outcome and next steps: status after Jan 2026 not confirmed [S19].
8. **Brazil:** law text not read directly. Details come from Estadão [S21].
9. **Talks seen only through summaries:** the RimWorld GDC 2017 wording [S44], the Into the Breach postmortem [S54], and the Fullerton playtest method [S53].
10. **RimWorld storyteller cycle lengths** (for example a 10.6 day Cassandra cycle) come from a third-party site, not confirmed.
11. **Kairosoft's combination formula** is not confirmed from a primary source.
12. **Factorio: Space Age price parity** with the base game came from a search summary only.
13. **No player-acceptance surveys found** for "remove ads" and supporter packs.
14. **Browser game load time benchmarks:** none found.
15. **Our own age rating outcome** cannot be known until we file the IARC and Apple questionnaires.
16. **Stardew mechanics** (energy, sleep as the save point) come from play knowledge, not re-sourced. Only the 17 minute day and the "one more day" quote are sourced [S41].
