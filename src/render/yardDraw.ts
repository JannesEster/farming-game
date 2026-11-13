import type { Feature } from "../sim/types";
import { tileCenter, type IsoLayout } from "./iso";
import { PEN_DEPTH_METRES, metresPerTile, projectsMetres } from "./worldScale";

/**
 * Iso cattle yard drawn to match docs/reference/cattle-yards/yards-aerial.png:
 * adjoining steel pens with bare dirt, a curved race, a crush under a roof,
 * and a ramp at the road. Pieces share edges so the yard reads as one footprint.
 */

type Pt = { x: number; y: number };
type Local = { into: number; along: number };

type Basis = {
  ramp: Feature;
  ix: number;
  iy: number;
  ax: number;
  ay: number;
  intoScreen: Pt;
  alongScreen: Pt;
  rampScreen: Pt;
};

type PenBox = {
  feature: Feature;
  into0: number;
  into1: number;
  along0: number;
  along1: number;
};

export type YardSlots = {
  pens: {
    x: number;
    y: number;
    halfAlong: number;
    halfInto: number;
    alongX: number;
    alongY: number;
    intoX: number;
    intoY: number;
  }[];
  race: Pt[];
};

const YARD_KINDS = new Set(["holding_pen", "race", "crush", "handling_roof", "loading_ramp"]);

export function isYardFeature(kind: string): boolean {
  return YARD_KINDS.has(kind);
}

function readBasis(features: Feature[], layout: IsoLayout, tileW: number, tileH: number): Basis | null {
  const ramp = features.find((feature) => feature.kind === "loading_ramp");
  const pens = features.filter((feature) => feature.kind === "holding_pen");
  if (!ramp || pens.length === 0) return null;
  const tracks = new Set(features.filter((feature) => feature.kind === "track").map((feature) => `${feature.x},${feature.y}`));
  const neighbors = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ].filter((step) => tracks.has(`${ramp.x + step.x},${ramp.y + step.y}`));
  const road = neighbors[0];
  if (!road) return null;
  // `road` steps from the ramp back onto the track, so into steps the other way, into the camp.
  const intoX = -road.x;
  const intoY = -road.y;
  let ax = -intoY;
  let ay = intoX;
  const avgX = pens.reduce((sum, pen) => sum + pen.x, 0) / pens.length;
  const avgY = pens.reduce((sum, pen) => sum + pen.y, 0) / pens.length;
  const alongDot = (avgX - ramp.x) * ax + (avgY - ramp.y) * ay;
  if (alongDot < 0) {
    ax = -ax;
    ay = -ay;
  }
  const rampScreen = tileCenter(ramp.x, ramp.y, layout, tileW, tileH);
  const intoScreen = {
    x: tileCenter(ramp.x + intoX, ramp.y + intoY, layout, tileW, tileH).x - rampScreen.x,
    y: tileCenter(ramp.x + intoX, ramp.y + intoY, layout, tileW, tileH).y - rampScreen.y,
  };
  const alongScreen = {
    x: tileCenter(ramp.x + ax, ramp.y + ay, layout, tileW, tileH).x - rampScreen.x,
    y: tileCenter(ramp.x + ax, ramp.y + ay, layout, tileW, tileH).y - rampScreen.y,
  };
  return { ramp, ix: intoX, iy: intoY, ax, ay, intoScreen, alongScreen, rampScreen };
}

function localOf(basis: Basis, feature: Feature): Local {
  const dx = feature.x - basis.ramp.x;
  const dy = feature.y - basis.ramp.y;
  return { into: dx * basis.ix + dy * basis.iy, along: dx * basis.ax + dy * basis.ay };
}

function penBoxes(basis: Basis, features: Feature[], tileW: number): PenBox[] {
  const pens = features
    .filter((feature) => feature.kind === "holding_pen")
    .map((feature) => ({ feature, ...localOf(basis, feature) }))
    .sort((a, b) => a.along - b.along);
  if (pens.length === 0) return [];
  const tileMetres = projectsMetres(tileW) ? 1 : metresPerTile();
  const halfInto = PEN_DEPTH_METRES / 2 / tileMetres;
  return pens.map((pen) => {
    const alongMetres = pen.feature.scale >= 3 ? pen.feature.scale : 11;
    const halfAlong = alongMetres / 2 / tileMetres;
    return {
      feature: pen.feature,
      along0: pen.along - halfAlong,
      along1: pen.along + halfAlong,
      into0: pen.into - halfInto,
      into1: pen.into + halfInto,
    };
  });
}

function arcPoints(a: Pt, b: Pt, bend: number, steps: number): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = (a.x + b.x) / 2 + (-dy / len) * bend;
  const cy = (a.y + b.y) / 2 + (dx / len) * bend;
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    out.push({
      x: u * u * a.x + 2 * u * t * cx + t * t * b.x,
      y: u * u * a.y + 2 * u * t * cy + t * t * b.y,
    });
  }
  return out;
}

/** Screen path of the race: a bend out of the pens, through the crush, and into the ramp. */
function raceScreen(basis: Basis, features: Feature[], boxes: PenBox[], tileW: number): Pt[] {
  const crush = features.find((feature) => feature.kind === "crush");
  const crushLocal = crush ? localOf(basis, crush) : { into: 2, along: 2 };
  const front = boxes.length > 0 ? boxes[0].into0 : crushLocal.into + 1.4;
  const gateAlong = boxes.length > 0 ? boxes[Math.min(1, boxes.length - 1)].along0 : crushLocal.along;
  const start = screenOf(basis, { into: front, along: gateAlong });
  const crushPt = screenOf(basis, crushLocal);
  const rampPt = { x: basis.rampScreen.x, y: basis.rampScreen.y };
  const unit = projectsMetres(tileW) ? 1 : metresPerTile();
  const depthPx = Math.hypot(basis.intoScreen.x, basis.intoScreen.y) * (PEN_DEPTH_METRES / unit);
  const bend = Math.max(16, depthPx * 0.45);
  const intoCrush = arcPoints(start, crushPt, bend, 8);
  const intoRamp = arcPoints(crushPt, rampPt, bend * 0.8, 7);
  return [...intoCrush, ...intoRamp.slice(1)];
}

function screenOf(basis: Basis, local: Local): Pt {
  return {
    x: basis.rampScreen.x + local.into * basis.intoScreen.x + local.along * basis.alongScreen.x,
    y: basis.rampScreen.y + local.into * basis.intoScreen.y + local.along * basis.alongScreen.y,
  };
}

export function yardSlots(features: Feature[], layout: IsoLayout, tileW: number, tileH: number): YardSlots | null {
  const basis = readBasis(features, layout, tileW, tileH);
  if (!basis) return null;
  const boxes = penBoxes(basis, features, tileW);
  const pens = boxes.map((box) => {
    const center = screenOf(basis, {
      into: (box.into0 + box.into1) / 2,
      along: (box.along0 + box.along1) / 2,
    });
    return {
      x: center.x,
      y: center.y,
      halfAlong: (box.along1 - box.along0) / 2,
      halfInto: (box.into1 - box.into0) / 2,
      alongX: basis.alongScreen.x,
      alongY: basis.alongScreen.y,
      intoX: basis.intoScreen.x,
      intoY: basis.intoScreen.y,
    };
  });
  const race = raceScreen(basis, features, boxes, tileW);
  return { pens, race };
}


export type YardEdge = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  gate: boolean;
  tileX: number;
  tileY: number;
};

export type YardGeometry = {
  edges: YardEdge[];
  corners: { x: number; y: number }[];
  race: { x: number; y: number }[];
  crush: { x: number; y: number; tileX: number; tileY: number } | null;
  ramp: { x: number; y: number; tileX: number; tileY: number; intoX: number; intoY: number } | null;
  pens: { tileX: number; tileY: number; corners: { x: number; y: number }[] }[];
};

/** Screen footprint of the handling yard, for the v2 rails, race, crush, and ramp. */
export function yardGeometry(
  features: Feature[],
  layout: IsoLayout,
  tileW: number,
  tileH: number,
): YardGeometry | null {
  const basis = readBasis(features, layout, tileW, tileH);
  if (!basis) return null;
  const boxes = penBoxes(basis, features, tileW);
  if (boxes.length === 0) return null;
  const gateAlong = boxes[Math.min(1, boxes.length - 1)].along0;
  const edges: YardEdge[] = [];
  const pens = boxes.map((box, index) => {
    const corners = [
      screenOf(basis, { into: box.into0, along: box.along0 }),
      screenOf(basis, { into: box.into0, along: box.along1 }),
      screenOf(basis, { into: box.into1, along: box.along1 }),
      screenOf(basis, { into: box.into1, along: box.along0 }),
    ];
    const opens = gateAlong >= box.along0 - 0.05 && gateAlong <= box.along1 + 0.05;
    const push = (a: { x: number; y: number }, b: { x: number; y: number }, gate: boolean) => {
      edges.push({
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        gate,
        tileX: box.feature.x,
        tileY: box.feature.y,
      });
    };
    push(corners[0], corners[1], opens);
    push(corners[3], corners[2], false);
    if (index === 0) push(corners[0], corners[3], false);
    push(corners[1], corners[2], false);
    return { tileX: box.feature.x, tileY: box.feature.y, corners };
  });
  const first = pens[0].corners;
  const last = pens[pens.length - 1].corners;
  const crushFeature = features.find((feature) => feature.kind === "crush");
  const crushLocal = crushFeature ? localOf(basis, crushFeature) : null;
  return {
    edges,
    corners: [first[0], first[3], last[1], last[2]],
    race: raceScreen(basis, features, boxes, tileW),
    crush: crushLocal
      ? {
          ...screenOf(basis, crushLocal),
          tileX: crushFeature?.x ?? basis.ramp.x,
          tileY: crushFeature?.y ?? basis.ramp.y,
        }
      : null,
    ramp: {
      x: basis.rampScreen.x,
      y: basis.rampScreen.y,
      tileX: basis.ramp.x,
      tileY: basis.ramp.y,
      intoX: basis.intoScreen.x,
      intoY: basis.intoScreen.y,
    },
    pens,
  };
}
