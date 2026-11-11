# Story / economy rules (STORY agent)

Numbers are defined in `src/sim/config.ts` unless computed in `economy.ts`. **S** = sourced in upload research; **A** = tunable placeholder (search `TODO` in config).

## Starvation and consequences (`consequences.ts`, `config.story`)

| Rule | Value | Source |
|---|---|---|
| Poor-feed intake ratio | 0.18 | A — `config.story.poorFeedIntakeRatio` |
| Poor-feed grazable fraction | 0.08 | A |
| Warning ladder (days) | 5 / 12 / 21 | A — telegraphed per retention lesson |
| Weight loss starts (day) | 8 | A |
| Daily weight loss (kg) | 1.2 | A |
| Min average liveweight | 320 kg | A |
| Breeding min / resume condition | 45 / 55 | A |
| Deaths start (day) | 28 | A |
| Death max condition | 12 | A |
| Daily death rate at critical | 0.012 of herd | A — TODO tune against NSA starvation share |

Effects: condition loss (existing `pasture.nextCondition`), weight loss, breeding pause, auction discount via `conditionPriceFactor`, deaths, weekly/monthly cards.

## Year cycle (`seasonCycle.ts`, `config.calendar`)

| Rule | Value | Source |
|---|---|---|
| Season year start | 1 Jul | S — Atlas / lesson §5 (`seasonStartMonth: 7`) |
| Rain months | Nov–Apr | A label — matches rain table |
| Calving months | Sep–Oct | S — namibian-livestock §4.5 |
| Weaning month | May | S — namibian-livestock §4.5 |
| Weaner sale months | Apr–Jun | S — Agra weaner season / §4.5 |
| Monthly calving fraction | 0.12 of cows | A |
| Weaning fraction | 0.85 of calves | A |

Month-end: operating costs, income/expense summary card.

## Prices and sales (`economy.ts`, `config.economy`)

| Rule | Value | Source |
|---|---|---|
| Weaner auction | N$31.47/kg live | S — farm-life-lesson §5.2 (LLPBN 2025) |
| Slaughter ox | N$35.91/kg live | S — LABTA Jun 2026 |
| Lean cow | N$23.95/kg live | S — LABTA Jun 2026 |
| Calf out of hand | N$28/kg | **TODO** placeholder |
| Bull | N$28.92/kg | **TODO** (SA proxy) |
| Default weaner weight | 220 kg | A — lesson §8.5 |
| LLPBN levy | 0.6% | S — levy schedule 2025/26 |
| Auction commission | 8% | A — Farmer's Weekly 2021 (SA) |
| Live export levy | 1.0% | S |
| Feedlot factor | 1.03 | A |
| Condition price factor | 1 → 0.55 by condition | A gameplay curve |

Channels: auction, speculator (−6%), feedlot (levy 1%).

## Monthly costs (`config.economy`)

| Rule | Value | Source |
|---|---|---|
| Farmhand cash wage | N$2,730/mo | S — farm-life-lesson §1.4 / §8.3 |
| Licks | N$4,500/mo | **TODO** |
| Vet | N$1,200/mo | **TODO** |
| Diesel | N$2,800/mo | **TODO** |

Housing for farmhand is assumed provided (S — compulsory), not modeled as cash.

## Drought (`drought.ts`, `config.story`)

| Rule | Value | Source |
|---|---|---|
| Watch window | Nov–Apr | A aligned to rain season |
| Deficit warn | 25 mm below expected cumulative | A |
| Choice score threshold | 0.45 | A |
| Choice month | February | A |
| Forage multiplier cut (max) | 55% | A |
| Quick sell weaners | 8 head @ N$27/kg | A — distressed sale |
| Supplement bundle | N$18,000 / 30 days | **TODO** |

Early warning card references 2026/27 dry outlook (S — Windhoek Observer in uploads).

## Farmhand (`workers.ts`)

| Rule | Value | Source |
|---|---|---|
| Hire wage | N$2,730/mo cash | S |
| Jobs | check water / help move | A — §1.3 daily jobs |
| Water check interval | every 3 days | A |
| Tiny condition bonus on water job | +0.08/day | A |

## Save migration

- Key: `farming-game-v2`; migrates `farming-game-v1` by adding `story` and composition.

## Tests

`consequences.test.ts`, `economy.test.ts`, `seasonCycle.test.ts`, `drought.test.ts`, `persist.test.ts`.

## Phone screenshots (390×844)

Captured via `npm run capture-artifacts`: `story-phone-feed-warning.png`, `story-phone-market-sale.png`, `story-phone-month-summary.png`, `story-phone-drought-choice.png` (under artifacts dir on CI/agent runs).
