# Story / economy rules (STORY agent)

Numbers are defined in `src/sim/config.ts` unless computed in `economy.ts`. **S** = sourced from NAU Enterprise Budgets 2025 or Reuben (12 Nov 2026). **A** = gameplay assumption. **TODO** = not yet sourced.

## Sources index

| Item | Value | Source |
|------|-------|--------|
| Farm hand salary | N$2,168.62/mo | NAU Ox Production 2025, permanent employee salary |
| Diesel (game) | N$30/L | Reuben Nov 2026 (~N$18k/mo for 600 L); NAU sheet N$21.36/L |
| Summer lick blend | N$7.68/kg | NAU Ox, Futterfos+salt; intake 120 g/head/day, 5 mo |
| Winter lick blend | N$5.51/kg | NAU Ox, Beesmix+urea+salt; intake 200 g/head/day, 7 mo |
| Lick $/head/mo (scaled) | N$31.25 | NAU feeds N$183,036/yr ÷ 488 ÷ 12 |
| Vaccines $/head/yr | N$155.5 | NAU Medicine & Veterinary N$75,876/yr ÷ 488 |
| State vet admin | N$150/mo | Reuben: state vets; NAU private visit N$9,815/yr as ceiling |
| Meat Board levy | 0.7% | NAU marketing Meat Board levy |
| LLPBN schedule (ref) | 0.6% | Prior lesson; retained in docs only |
| Auction commission | 6% | NAU marketing commission |
| NCA grading | N$16.85/head | NAU grading & inspection |
| Weaner auction | N$33.32/kg live | NAU 2025 band N$32.81 to 34.83/kg live (mid) |
| Ox 401–600 kg | N$40.17/kg live | NAU live marketing |
| Lean cow 301–500 kg | N$27.90/kg live | NAU live marketing |
| Calf 1–350 kg | N$33.50/kg live | NAU live marketing |
| Bull 501–600 kg | N$33.93/kg live | NAU live marketing |
| Running cost anchor | N$90,000/mo | Reuben: ~N$90k/mo, 13,000 ha, ~500 head |
| Ox enterprise total | N$896,656/yr | NAU 7,500 ha, 488 cattle |
| Insurance (farm) | N$37,585/yr | NAU Insurance & Licenses |
| Reuben diesel use | 600 L/mo | Reuben estimate (two farms) |
| Boskos cash price | **TODO** | Proxy N$5.5/kg from Reuben lick N$5,000–7,000/t |
| Camelthorn pods price | **TODO** | Gathered; modelled at zero cash |
| Transport loaded km | N$49–51/km | NAU abattoir transport lines |
| Carcass A/AB/B | N$61.86–62.43/kg | NAU abattoir (not used; game sells live) |

## Starvation and consequences (`consequences.ts`, `config.story`)

| Rule | Value | Source |
|---|---|---|
| Poor-feed intake ratio | 0.18 | A |
| Poor-feed grazable fraction | 0.08 | A |
| Warning ladder (days) | 5 / 12 / 21 | A |
| Weight loss starts (day) | 8 | A |
| Daily weight loss (kg) | 1.2 | A |
| Min average liveweight | 320 kg | A |
| Breeding min / resume condition | 45 / 55 | A |
| Deaths start (day) | 28 | A |
| Death max condition | 12 | A |
| Daily death rate at critical | 0.012 of herd | A, TODO vs NSA starvation share |

## Year cycle (`seasonCycle.ts`, `config.calendar`)

| Rule | Value | Source |
|---|---|---|
| Season year start | 1 Jul | S, Atlas |
| Rain months | Nov to Apr | A label |
| Calving months | Sep to Oct | S, namibian-livestock |
| Weaning month | May | S |
| Weaner sale months | Apr to Jun | S |
| Monthly calving fraction | 0.12 of cows | A |

Month-end card lists labour, lick, diesel, repairs, other (from `economy.monthlyOperatingCosts`).

## Prices and sales (`economy.ts`, `config.economy`)

| Rule | Value | Source |
|---|---|---|
| Weaner auction | N$33.32/kg live | S, NAU mid-band |
| Slaughter ox (live auction class) | N$40.17/kg live | S, NAU |
| Lean cow | N$27.90/kg live | S, NAU |
| Calf out of hand | N$33.50/kg live | S, NAU calves |
| Bull | N$33.93/kg live | S, NAU bulls |
| Default weaner weight | 220 kg | A |
| Meat Board levy | 0.7% | S, NAU |
| Auction commission | 6% | S, NAU |
| NCA grading fee | N$16.85/head | S, NAU |
| Live export levy | 1.0% | S, LLPBN schedule |
| Feedlot factor | 1.03 | A |
| Condition price factor | 1 to 0.55 | A gameplay curve |

## Monthly costs (`economy.ts`)

Scaled from Reuben anchor (N$90,000/mo at 13,000 ha and 500 head) using:

`scale = (ha/13000)^0.52 × (head/500)^0.62`

Shares follow NAU Ox Production cost mix (labour 16%, lick 20%, diesel 18%, repairs 10%, other 36%). Other includes state vet admin plus vaccines per head. Optional farmhand wage adds to labour on hire.

| Example | Monthly total (approx) | Source |
|---|---|---|
| 13,000 ha, 500 head | N$90,000 | Reuben anchor |
| 3,300 ha, 120 head | N$15,000 to N$22,000 | Scaled (plausible starter) |
| 7,500 ha, 488 head (NAU) | N$75,000/yr÷12 ≈ N$75,000 | NAU reference (not anchor) |

Housing for farmhand is provided (S), not modeled as cash.

## Drought (`drought.ts`, `config.story`)

| Rule | Value | Source |
|---|---|---|
| Watch window | Nov to Apr | A |
| Deficit warn | 25 mm below expected cumulative | A |
| Choice month | February | A |
| Quick sell weaners | 8 head @ N$27.90/kg | S-ish, NAU lean cow live |
| Boskos intake | 0.2 kg/head/day | Reuben cattle 150 to 250 g/day |
| Camelthorn pods | 0.03 kg/head/day | Reuben drought practice; **TODO** price |
| Boskos cost | head × days × kg × N$5.5/kg | **TODO** boskos price; Reuben lick/t proxy |
| Supplement days | 30 | A |

## Farmhand (`workers.ts`)

| Rule | Value | Source |
|---|---|---|
| Hire wage | N$2,168.62/mo cash | S, NAU salary line |
| Jobs | check water / help move | A |
| Water check interval | every 3 days | A |

## Tests

`economy.test.ts` (scale + prices), `yearPlay.test.ts` (year 1 break-even band), `consequences.test.ts`, `seasonCycle.test.ts`, `drought.test.ts`, `persist.test.ts`.

## Phone screenshots

Captured via `npm run capture-artifacts`: story-phone month/drought/market cards (CI/agent runs).
