import { describe, expect, it } from "vitest";
import { generateFarmOffers } from "../picker/generateOffers";
import { stateFromOfferCard } from "../integration/pickerAdapter";
import { CONFIG } from "../sim/config";
import { moveHerd } from "../sim/simulation";
import { TILE_HOMESTEAD, TILE_OUTSIDE } from "../sim/types";
import { trackKeys } from "./colour";
import { isoLayout, tileCenter, worldToTile } from "./iso";
import {
  campLabelTile,
  gateFileWidthPx,
  grazingCenterTile,
  mobSpanPx,
  mobWidthPx,
  offsetsForHerd,
  organicTrekOffsets,
} from "./herdLayout";

const HERD = 120;

describe("organicTrekOffsets", () => {
  it("spreads a 120-head mob over hundreds of world pixels", () => {
    const mid = organicTrekOffsets(HERD, 42, 1, 0, 0.45, 5000);
    const span = mobSpanPx(mid);
    expect(span.width).toBeGreaterThan(200);
    expect(span.height).toBeGreaterThan(120);
    expect(mobWidthPx(mid, 1, 0)).toBeGreaterThan(120);
  });

  it("funnels through the gate in a narrow single or double file", () => {
    const gate = organicTrekOffsets(HERD, 42, 1, 0, 0.5, 5000);
    const open = organicTrekOffsets(HERD, 42, 1, 0, 0.2, 5000);
    expect(gateFileWidthPx(gate, 1, 0, 0.5, HERD, 42, 5000)).toBeLessThan(mobWidthPx(open, 1, 0));
    expect(gateFileWidthPx(gate, 1, 0, 0.5, HERD, 42, 5000)).toBeLessThan(36);
    expect(mobSpanPx(open).width).toBeGreaterThan(200);
    expect(mobSpanPx(gate).width).toBeGreaterThan(140);
  });

  it("lays 120 head out as a loose mob inside the opening camp", () => {
    const card = generateFarmOffers(88001).find((offer) => offer.id === "otjozondjupa-ranch");
    expect(card).toBeTruthy();
    const state = stateFromOfferCard(card!);
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const layout = isoLayout(state.width, state.height, tileW, tileH, CONFIG.view.boundsPadPx);
    const camp = state.camps.find((item) => item.id === state.herd.campId)!;
    const anchor = tileCenter(camp.anchor.x, camp.anchor.y, layout, tileW, tileH);
    const offsets = offsetsForHerd(state, layout, tileW, tileH, false, 0, { x: 1, y: 0 }, 0, anchor.x, anchor.y);
    const span = mobSpanPx(offsets);
    expect(offsets).toHaveLength(120);
    expect(span.width).toBeGreaterThan(tileW * 4);
    expect(span.height).toBeGreaterThan(tileH * 3);
    expect(span.width).toBeLessThan(tileW * 30);
    let onCamp = 0;
    let nearest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < offsets.length; i += 1) {
      const offset = offsets[i];
      const tile = worldToTile(anchor.x + offset.x, anchor.y + offset.y, layout, tileW, tileH);
      const tx = Math.round(tile.x);
      const ty = Math.round(tile.y);
      const id = state.campIds[ty * state.width + tx];
      if (id === camp.id) onCamp += 1;
      expect(id).not.toBe(TILE_HOMESTEAD);
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const px = tx + dx;
          const py = ty + dy;
          if (px < 0 || py < 0 || px >= state.width || py >= state.height) continue;
          expect(state.campIds[py * state.width + px]).not.toBe(TILE_HOMESTEAD);
        }
      }
      for (let j = i + 1; j < offsets.length; j += 1) {
        nearest = Math.min(nearest, Math.hypot(offset.x - offsets[j].x, offset.y - offsets[j].y));
      }
    }
    expect(onCamp).toBe(120);
    expect(nearest).toBeGreaterThan(tileW * 0.4);
  });

  it("files a walking herd along the path and keeps them on camp or track tiles", () => {
    const card = generateFarmOffers(88001).find((offer) => offer.id === "otjozondjupa-ranch");
    const state = stateFromOfferCard(card!);
    const moved = state.camps.some((camp) => moveHerd(state, camp.id).ok);
    expect(moved).toBe(true);
    expect(state.herd.transit).toBeTruthy();
    state.herd.transit!.progress = 0.5;
    const tileW = CONFIG.view.tileWidth;
    const tileH = CONFIG.view.tileHeight;
    const layout = isoLayout(state.width, state.height, tileW, tileH, CONFIG.view.boundsPadPx);
    const here = tileCenter(
      state.herd.transit!.path[0].x,
      state.herd.transit!.path[0].y,
      layout,
      tileW,
      tileH,
    );
    const offsets = offsetsForHerd(
      state,
      layout,
      tileW,
      tileH,
      true,
      0.5,
      { x: 1, y: 0 },
      1000,
      here.x,
      here.y,
    );
    const track = trackKeys(state);
    const fromId = state.herd.campId;
    const destId = state.herd.transit!.toCampId;
    for (const offset of offsets) {
      const tile = worldToTile(here.x + offset.x, here.y + offset.y, layout, tileW, tileH);
      const tx = Math.round(tile.x);
      const ty = Math.round(tile.y);
      const id = state.campIds[ty * state.width + tx];
      const key = `${tx},${ty}`;
      const allowed = id === fromId || id === destId || (id === TILE_OUTSIDE && track.has(key)) || track.has(key);
      expect(allowed).toBe(true);
      expect(id).not.toBe(TILE_HOMESTEAD);
    }
    const span = mobSpanPx(offsets);
    expect(Math.max(span.width, span.height)).toBeGreaterThan(80);
  });

  it("moves the yard camp badge off the homestead", () => {
    const card = generateFarmOffers(88001).find((offer) => offer.id === "otjozondjupa-ranch");
    const state = stateFromOfferCard(card!);
    const camp = state.camps.find((item) => item.id === state.herd.campId)!;
    const tile = campLabelTile(state, camp);
    const id = state.campIds[tile.y * state.width + tile.x];
    expect(id).toBe(camp.id);
    const graze = grazingCenterTile(camp);
    const fromMob = Math.hypot(tile.x - graze.x, tile.y - graze.y);
    expect(fromMob).toBeGreaterThan(4);
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const px = tile.x + dx;
        const py = tile.y + dy;
        if (px < 0 || py < 0 || px >= state.width || py >= state.height) continue;
        expect(state.campIds[py * state.width + px]).not.toBe(TILE_HOMESTEAD);
      }
    }
  });

  it("drifts over time so the mob is not frozen", () => {
    const a = organicTrekOffsets(HERD, 9, 0, 1, 0.5, 1000);
    const b = organicTrekOffsets(HERD, 9, 0, 1, 0.5, 2500);
    const moved = a.some((offset, i) => Math.hypot(offset.x - b[i].x, offset.y - b[i].y) > 0.5);
    expect(moved).toBe(true);
  });
});
