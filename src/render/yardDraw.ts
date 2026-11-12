import type { Feature } from "../sim/types";
import { tileCenter, type IsoLayout } from "./iso";

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

function canvas2d(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, width);
  canvas.height = Math.max(2, height);
  const ctx = canvas.getContext("2d");
  return ctx ? { canvas, ctx } : null;
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

function penBoxes(basis: Basis, features: Feature[]): PenBox[] {
  const pens = features
    .filter((feature) => feature.kind === "holding_pen")
    .map((feature) => ({ feature, ...localOf(basis, feature) }))
    .sort((a, b) => a.along - b.along);
  if (pens.length === 0) return [];
  const edges = new Array<number>(pens.length + 1);
  if (pens.length === 1) {
    edges[0] = pens[0].along - 2;
    edges[1] = pens[0].along + 2;
  } else {
    const firstGap = pens[1].along - pens[0].along;
    const lastGap = pens[pens.length - 1].along - pens[pens.length - 2].along;
    edges[0] = pens[0].along - Math.min(2.2, Math.max(1.4, firstGap * 0.55));
    for (let i = 0; i < pens.length - 1; i += 1) {
      edges[i + 1] = (pens[i].along + pens[i + 1].along) / 2;
    }
    edges[pens.length] = pens[pens.length - 1].along + Math.min(1.7, Math.max(1.15, lastGap * 0.48));
  }
  const intoCenter = pens.reduce((sum, pen) => sum + pen.into, 0) / pens.length;
  const intoHalf = 1.7;
  return pens.map((pen, index) => ({
    feature: pen.feature,
    along0: edges[index],
    along1: edges[index + 1],
    into0: intoCenter - intoHalf,
    into1: intoCenter + intoHalf,
  }));
}

function toScreen(basis: Basis, anchor: Local, local: Local): Pt {
  const di = local.into - anchor.into;
  const da = local.along - anchor.along;
  return {
    x: di * basis.intoScreen.x + da * basis.alongScreen.x,
    y: di * basis.intoScreen.y + da * basis.alongScreen.y,
  };
}

function raceLocals(basis: Basis, features: Feature[], boxes: PenBox[]): Local[] {
  const crush = features.find((feature) => feature.kind === "crush");
  const crushLocal = crush ? localOf(basis, crush) : { into: 2, along: 2 };
  const front = boxes.length > 0 ? boxes[0].into0 : crushLocal.into + 1.4;
  const gateAlong = boxes.length > 0 ? boxes[Math.min(1, boxes.length - 1)].along0 : crushLocal.along;
  return [
    { into: front, along: gateAlong },
    { into: (front + crushLocal.into) / 2, along: (gateAlong + crushLocal.along) / 2 + 0.35 },
    crushLocal,
    { into: crushLocal.into * 0.45, along: crushLocal.along * 0.45 },
    { into: 0.85, along: 0.05 },
  ];
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
  const boxes = penBoxes(basis, features);
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
  const race = raceLocals(basis, features, boxes).map((local) => screenOf(basis, local));
  return { pens, race };
}

function steel(ctx: CanvasRenderingContext2D, a: Pt, b: Pt): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  ctx.lineCap = "butt";
  for (let i = 0; i < 4; i += 1) {
    ctx.strokeStyle = i === 3 ? "#f7fafc" : "#c5ced6";
    ctx.lineWidth = i === 3 ? 3.5 : 2.6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - i * 4.5);
    ctx.lineTo(b.x, b.y - i * 4.5);
    ctx.stroke();
  }
  const posts = Math.max(2, Math.round(len / 34));
  for (let i = 0; i <= posts; i += 1) {
    const t = i / posts;
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    ctx.fillStyle = "#8e989f";
    ctx.fillRect(x - 3.5, y - 20, 7, 24);
    ctx.fillStyle = "#e7eef3";
    ctx.fillRect(x - 4.5, y - 22, 9, 4);
  }
}

function railWithGap(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, gap0: number, gap1: number): void {
  const cut = gap1 > gap0;
  const g0 = Math.max(0, Math.min(1, gap0));
  const g1 = Math.max(0, Math.min(1, gap1));
  const at = (t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  if (!cut) {
    steel(ctx, a, b);
    return;
  }
  if (g0 > 0.04) steel(ctx, a, at(g0));
  if (g1 < 0.96) steel(ctx, at(g1), b);
}

function fit(
  points: Pt[],
  draw: (ctx: CanvasRenderingContext2D, map: (p: Pt) => Pt) => void,
): { canvas: HTMLCanvasElement; originX: number; originY: number } | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y - 24);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const pad = 10;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const width = Math.ceil(maxX - minX);
  const height = Math.ceil(maxY - minY);
  const painted = canvas2d(width, height);
  if (!painted) return null;
  const map = (point: Pt) => ({ x: point.x - minX, y: point.y - minY });
  draw(painted.ctx, map);
  return {
    canvas: painted.canvas,
    originX: (0 - minX) / width,
    originY: (0 - minY) / height,
  };
}

function drawDirt(ctx: CanvasRenderingContext2D, corners: Pt[]): void {
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fillStyle = "#4e301c";
  ctx.fill();
  const cx = corners.reduce((sum, point) => sum + point.x, 0) / corners.length;
  const cy = corners.reduce((sum, point) => sum + point.y, 0) / corners.length;
  ctx.beginPath();
  ctx.moveTo(cx + (corners[0].x - cx) * 0.72, cy + (corners[0].y - cy) * 0.72);
  for (let i = 1; i < corners.length; i += 1) {
    ctx.lineTo(cx + (corners[i].x - cx) * 0.72, cy + (corners[i].y - cy) * 0.72);
  }
  ctx.closePath();
  ctx.fillStyle = "#6a4330";
  ctx.fill();
}

export function yardPieceTexture(
  feature: Feature,
  features: Feature[],
  layout: IsoLayout,
  tileW: number,
  tileH: number,
): { canvas: HTMLCanvasElement; originX: number; originY: number } | null {
  const basis = readBasis(features, layout, tileW, tileH);
  if (!basis) return null;
  const boxes = penBoxes(basis, features);
  const anchor = localOf(basis, feature);
  const rel = (local: Local) => toScreen(basis, anchor, local);

  if (feature.kind === "holding_pen") {
    const box = boxes.find((item) => item.feature === feature) ?? boxes.find((item) => item.feature.x === feature.x && item.feature.y === feature.y);
    if (!box) return null;
    const gateAlong = boxes.length > 1 ? boxes[Math.min(1, boxes.length - 1)].along0 : (box.along0 + box.along1) / 2;
    const span = box.along1 - box.along0 || 1;
    const gate0 = (gateAlong - 0.42 - box.along0) / span;
    const gate1 = (gateAlong + 0.42 - box.along0) / span;
    const opens = gateAlong >= box.along0 - 0.05 && gateAlong <= box.along1 + 0.05;
    const a = rel({ into: box.into0, along: box.along0 });
    const b = rel({ into: box.into0, along: box.along1 });
    const c = rel({ into: box.into1, along: box.along1 });
    const d = rel({ into: box.into1, along: box.along0 });
    return fit([a, b, c, d], (ctx, map) => {
      const corners = [a, b, c, d].map(map);
      drawDirt(ctx, corners);
      railWithGap(ctx, corners[0], corners[1], opens ? gate0 : 2, opens ? gate1 : 2);
      steel(ctx, corners[1], corners[2]);
      steel(ctx, corners[2], corners[3]);
      steel(ctx, corners[3], corners[0]);
    });
  }

  if (feature.kind === "race") {
    const locals = raceLocals(basis, features, boxes);
    const points = locals.map(rel);
    return fit(points, (ctx, map) => {
      const mapped = points.map(map);
      const left: Pt[] = [];
      const right: Pt[] = [];
      for (let i = 0; i < mapped.length; i += 1) {
        const prev = mapped[Math.max(0, i - 1)];
        const next = mapped[Math.min(mapped.length - 1, i + 1)];
        const tx = next.x - prev.x;
        const ty = next.y - prev.y;
        const len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len;
        const ny = tx / len;
        left.push({ x: mapped[i].x + nx * 22, y: mapped[i].y + ny * 22 });
        right.push({ x: mapped[i].x - nx * 22, y: mapped[i].y - ny * 22 });
      }
      ctx.beginPath();
      ctx.moveTo(left[0].x, left[0].y);
      for (const point of left) ctx.lineTo(point.x, point.y);
      for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i].x, right[i].y);
      ctx.closePath();
      ctx.fillStyle = "#5a3824";
      ctx.fill();
      for (let i = 0; i < left.length - 1; i += 1) steel(ctx, left[i], left[i + 1]);
      for (let i = 0; i < right.length - 1; i += 1) steel(ctx, right[i], right[i + 1]);
    });
  }

  if (feature.kind === "crush") {
    const here = anchor;
    const a = rel({ into: here.into - 0.85, along: here.along - 0.42 });
    const b = rel({ into: here.into - 0.85, along: here.along + 0.42 });
    const c = rel({ into: here.into + 0.85, along: here.along + 0.42 });
    const d = rel({ into: here.into + 0.85, along: here.along - 0.42 });
    return fit([a, b, c, d], (ctx, map) => {
      const corners = [a, b, c, d].map(map);
      drawDirt(ctx, corners);
      steel(ctx, corners[0], corners[1]);
      steel(ctx, corners[1], corners[2]);
      steel(ctx, corners[2], corners[3]);
      steel(ctx, corners[3], corners[0]);
      ctx.fillStyle = "#d5dde4";
      ctx.fillRect(corners[0].x - 4, corners[0].y - 26, 8, 30);
      ctx.fillRect(corners[1].x - 4, corners[1].y - 26, 8, 30);
    });
  }

  if (feature.kind === "handling_roof") {
    const here = anchor;
    const a = rel({ into: here.into - 1.05, along: here.along - 1.7 });
    const b = rel({ into: here.into - 1.05, along: here.along + 1.7 });
    const c = rel({ into: here.into + 0.85, along: here.along + 1.7 });
    const d = rel({ into: here.into + 0.85, along: here.along - 1.7 });
    const lift = 30;
    return fit([a, b, c, d, { x: a.x, y: a.y - lift }, { x: c.x, y: c.y - lift }], (ctx, map) => {
      const ground = [a, b, c, d].map(map);
      const roof = ground.map((point) => ({ x: point.x, y: point.y - lift }));
      ctx.fillStyle = "#7d868c";
      ctx.fillRect(roof[0].x - 4, roof[0].y, 8, lift);
      ctx.fillRect(roof[1].x - 4, roof[1].y, 8, lift);
      ctx.fillRect(roof[2].x - 4, roof[2].y, 8, lift);
      ctx.fillRect(roof[3].x - 4, roof[3].y, 8, lift);
      ctx.beginPath();
      ctx.moveTo(roof[0].x, roof[0].y);
      ctx.lineTo(roof[1].x, roof[1].y);
      ctx.lineTo(roof[2].x, roof[2].y);
      ctx.lineTo(roof[3].x, roof[3].y);
      ctx.closePath();
      ctx.fillStyle = "#f4f1ea";
      ctx.fill();
      ctx.fillStyle = "#d4cfc4";
      ctx.beginPath();
      ctx.moveTo(roof[1].x, roof[1].y);
      ctx.lineTo(roof[2].x, roof[2].y);
      ctx.lineTo(roof[2].x, roof[2].y + 8);
      ctx.lineTo(roof[1].x, roof[1].y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#2c3440";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(roof[0].x, roof[0].y);
      ctx.lineTo(roof[1].x, roof[1].y);
      ctx.lineTo(roof[2].x, roof[2].y);
      ctx.lineTo(roof[3].x, roof[3].y);
      ctx.closePath();
      ctx.stroke();
    });
  }

  if (feature.kind === "loading_ramp") {
    const a = rel({ into: 1.05, along: -0.5 });
    const b = rel({ into: 1.05, along: 0.5 });
    const c = rel({ into: -0.55, along: 0.85 });
    const d = rel({ into: -0.55, along: -0.85 });
    return fit([a, b, c, d], (ctx, map) => {
      const corners = [a, b, c, d].map(map);
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y + 8);
      corners.forEach((point) => ctx.lineTo(point.x, point.y + 8));
      ctx.closePath();
      ctx.fillStyle = "rgba(36, 22, 12, 0.35)";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      corners.forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.closePath();
      ctx.fillStyle = "#c4b39a";
      ctx.fill();
      ctx.fillStyle = "#6d5e4e";
      ctx.beginPath();
      ctx.moveTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[2].x, corners[2].y + 10);
      ctx.lineTo(corners[1].x, corners[1].y + 8);
      ctx.closePath();
      ctx.fill();
      steel(ctx, corners[0], corners[3]);
      steel(ctx, corners[1], corners[2]);
      ctx.strokeStyle = "#c5ced6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y - 16);
      ctx.lineTo(corners[1].x, corners[1].y - 16);
      ctx.stroke();
    });
  }

  return null;
}
