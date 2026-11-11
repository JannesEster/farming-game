# Integration layer (game flow agent)

This document is the contract between **integration** (`src/integration/**`) and the parallel branches **ART**, **STORY**, and **FARM PICKER**. Phase 1 ships stubs; Phase 2 replaces stubs and wires real data.

## Flow state machine

Phases: `boot` → `start` → `farmPicker` → `playing` → `yearEndReview` → (`playing` | `gameOver`) → `start`.

Implementation: `src/integration/stateMachine.ts`, orchestrated by `GameFlowService`.

| Phase | UI owner | Sim running |
| --- | --- | --- |
| `start` | Integration overlay | Farm scene paused |
| `farmPicker` | Integration (stub offers) | Paused |
| `playing` | ART HUD + map | Active |
| `yearEndReview` | Integration overlay | Paused |
| `gameOver` | Integration overlay | Paused |

## Ports (replace stubs)

### FARM PICKER — `FarmPickerPort`

File: `src/integration/interfaces.ts`  
Stub: `src/integration/stubs/farmOffers.ts`

```ts
listOffers(rollSeed: number): FarmOffer[];
createGameStateFromOffer(offer: FarmOffer): GameState;
```

**Picker (wired in vslice)**

- Start + offer UI: `src/picker/flow.ts` (“Dust & Hooves”).
- On buy: `getGameFlow().pickFarmPurchase(state, offer)` via `PickerFlowHost`.
- `integration/pickerAdapter.ts` remains the typed port for tests/stubs.

### STORY — `StoryEconomyPort` + `StoryEventsPort`

Files: `src/integration/interfaces.ts`  
Stubs: `src/integration/stubs/storyEconomy.ts`, `src/integration/stubs/storyEvents.ts`

**Economy**

```ts
isBankrupt(state): boolean;
isHerdLost(state): boolean;
buildYearEndReport(state, farmYear): YearEndReport; // may delegate to integration/goals.ts
onDayAdvanced?(state, prevCash): { cashDeltaNad; note? };
buildMonthEndSummary?(state): MonthEndSummary;
```

**Events (notification bus)**

Publish via `stubStoryEvents` replacement or directly:

```ts
getGameFlow().bus.toast(message, "warn");
getGameFlow().storyEvents.publish({ kind: "monthEnd", summary });
```

`NotificationBus` lives in `src/integration/events.ts`. STORY should publish drought warnings, auction reminders, and starvation notices here—not call HUD directly.

**STORY branch TODO**

1. Swap `stubStoryEconomy` inside `GameFlowService` for your economy module.
2. Hook `onDayAdvanced` from your calendar/year cycle (after `stepDay`).
3. Emit month-end and story cards through `StoryEventsPort`.
4. Use real bankruptcy / herd-lost rules in `isBankrupt` / `isHerdLost`.

### ART — `ArtTutorialPort` (optional)

No stub required for Phase 1. Farm rendering stays in `src/render/**`.

**ART branch TODO (optional)**

- Implement `highlightCamp(campId)` for tutorial coach marks if toasts are not enough.

## Goals and progression

- First-year goals: `src/integration/goals.ts` (`herdCondition`, `cashOrHead`).
- Milestones: `restCamp`, `sellBeforeDrought`, `keepWaterRunning` (updated from sim hooks; STORY can set additional flags in Phase 2).
- Year-end score/rating: `buildYearEndReport` / `scoreFarm`.

STORY should call `detectMilestones` or set `meta.milestones` when sale/drought/water events fire.

## Tutorial

- Steps: `src/integration/tutorial.ts` (`TUTORIAL_STEPS`).
- Progress key: `localStorage` `farming-game-tutorial-v1` (skippable, remembered).
- FarmScene notifies integration via `getGameFlow().notifySim(...)` on select herd, move, fast speed, expand sheet.

STORY: when sales exist, call `notifySim("salePlanned")` from the sale UI.

## Save slots

- Version **2**, keys `farming-game-slot-{0,1,2}`, active slot `farming-game-active-slot`.
- Migrates legacy `farming-game-v1` into slot 0 automatically (`src/integration/saveSlots.ts`).
- Payload: `{ version, meta: FlowMeta, state: GameState }`.

FarmScene persists through `getGameFlow().persist()` only (not `sim/persist.saveGame`).

## Minimal render hooks (already wired)

| Location | Hook |
| --- | --- |
| `src/main.ts` | `BootScene` + `FarmScene` |
| `src/render/FarmScene.ts` | Load state from flow; `attachFarmHud`; sim notifications; `persist` |
| `src/render/hud.ts` | Optional `onSheetExpanded` |

Do not expand render changes without updating this table.

## Capture / CI artifacts

`npm run capture-artifacts` writes:

- `flow-tutorial-step-1.png` (390×844)
- `flow-year-end-review.png` (390×844)

Query params: `?capture=1&flowCapture=tutorial|yearend`

## Phase 2 merge checklist

1. Replace stub ports in `GameFlowService` constructor or factory.
2. Resolve conflicts: keep flow ownership in `src/integration/**`.
3. Run `npm test` and `npm run capture-artifacts`.
4. Play through start → picker → play → year-end on a 390×844 viewport.
