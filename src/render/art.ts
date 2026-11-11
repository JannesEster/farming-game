export const ART_ORIGIN = {
  diamond: { x: 0.5, y: 0 },
  cow: { x: 0.5, y: 0.74 },
  tree: { x: 0.5, y: 0.9 },
  bush: { x: 0.5, y: 0.84 },
  house: { x: 0.5, y: 0.9 },
  tower: { x: 0.5, y: 0.94 },
  blades: { x: 0.5, y: 0.5 },
  kraal: { x: 0.5, y: 0.74 },
  reservoir: { x: 0.5, y: 0.55 },
  trough: { x: 0.5, y: 0.78 },
};

const TOWER_HEIGHT = 100;
const TOWER_AXLE_Y = 18;

export const WINDMILL_AXLE_LIFT = ART_ORIGIN.tower.y * TOWER_HEIGHT - TOWER_AXLE_Y;

export type ArtSheet = {
  diamond: HTMLCanvasElement;
  cows: HTMLCanvasElement[];
  tree: HTMLCanvasElement;
  bush: HTMLCanvasElement;
  house: HTMLCanvasElement;
  tower: HTMLCanvasElement;
  blades: HTMLCanvasElement;
  kraal: HTMLCanvasElement;
  reservoir: HTMLCanvasElement;
  trough: HTMLCanvasElement;
};

function canvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const ctx = element.getContext("2d");
  if (!ctx) throw new Error("Could not draw the farm art.");
  draw(ctx);
  return element;
}

export function buildArt(tileWidth: number, tileHeight: number): ArtSheet {
  return {
    diamond: drawDiamond(tileWidth, tileHeight),
    cows: [drawCow("#8c3e22"), drawCow("#a85a34"), drawCow("#6e341c")],
    tree: drawTree(),
    bush: drawBush(),
    house: drawHouse(),
    tower: drawTower(),
    blades: drawBlades(),
    kraal: drawKraal(),
    reservoir: drawReservoir(),
    trough: drawTrough(),
  };
}

function drawDiamond(tileWidth: number, tileHeight: number): HTMLCanvasElement {
  const bleed = 4;
  return canvas(tileWidth + bleed, tileHeight + bleed, (ctx) => {
    const w = tileWidth + bleed;
    const h = tileHeight + bleed;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w, h / 2);
    ctx.lineTo(w / 2, h);
    ctx.lineTo(0, h / 2);
    ctx.closePath();
    ctx.fill();
  });
}

function drawCow(coat: string): HTMLCanvasElement {
  return canvas(52, 40, (ctx) => {
    ctx.fillStyle = "rgba(70, 32, 16, 0.28)";
    ctx.beginPath();
    ctx.ellipse(26, 32, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a2a18";
    for (const [x, y] of [
      [16, 28],
      [22, 31],
      [30, 28],
      [36, 31],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(x, y, 2.2, 3.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.ellipse(24, 22, 14, 9, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.ellipse(38, 18, 6, 4.5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f3e6c8";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(40, 16);
    ctx.lineTo(43, 12);
    ctx.moveTo(36, 15);
    ctx.lineTo(34, 12);
    ctx.stroke();
  });
}

function drawTree(): HTMLCanvasElement {
  return canvas(96, 84, (ctx) => {
    ctx.fillStyle = "rgba(80, 36, 16, 0.25)";
    ctx.beginPath();
    ctx.ellipse(48, 74, 26, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6a4630";
    ctx.fillRect(44, 52, 8, 24);
    ctx.fillStyle = "#2c4e26";
    ctx.beginPath();
    ctx.ellipse(48, 46, 40, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3e6a32";
    ctx.beginPath();
    ctx.ellipse(46, 40, 34, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a8440";
    ctx.beginPath();
    ctx.ellipse(36, 38, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBush(): HTMLCanvasElement {
  return canvas(44, 32, (ctx) => {
    ctx.fillStyle = "rgba(80, 36, 16, 0.22)";
    ctx.beginPath();
    ctx.ellipse(22, 26, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4e5828";
    ctx.beginPath();
    ctx.ellipse(22, 18, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6a7034";
    ctx.beginPath();
    ctx.ellipse(16, 16, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(28, 15, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawHouse(): HTMLCanvasElement {
  return canvas(96, 80, (ctx) => {
    ctx.fillStyle = "rgba(80, 36, 16, 0.25)";
    ctx.beginPath();
    ctx.ellipse(48, 70, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#efe0c4";
    ctx.beginPath();
    ctx.moveTo(18, 42);
    ctx.lineTo(48, 56);
    ctx.lineTo(48, 70);
    ctx.lineTo(18, 56);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d2b48c";
    ctx.beginPath();
    ctx.moveTo(48, 56);
    ctx.lineTo(80, 42);
    ctx.lineTo(80, 56);
    ctx.lineTo(48, 70);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6b4228";
    ctx.beginPath();
    ctx.moveTo(30, 50);
    ctx.lineTo(38, 54);
    ctx.lineTo(38, 64);
    ctx.lineTo(30, 60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9aabaf";
    ctx.beginPath();
    ctx.moveTo(48, 16);
    ctx.lineTo(88, 36);
    ctx.lineTo(48, 54);
    ctx.lineTo(8, 36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#7f9094";
    ctx.beginPath();
    ctx.moveTo(48, 16);
    ctx.lineTo(88, 36);
    ctx.lineTo(48, 34);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#66777c";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(48, 16);
    ctx.lineTo(48, 54);
    ctx.stroke();
  });
}

function drawTower(): HTMLCanvasElement {
  return canvas(40, TOWER_HEIGHT, (ctx) => {
    ctx.fillStyle = "rgba(80, 36, 16, 0.25)";
    ctx.beginPath();
    ctx.ellipse(20, 94, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#6d5338";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 92);
    ctx.lineTo(16, 28);
    ctx.moveTo(28, 92);
    ctx.lineTo(24, 28);
    ctx.moveTo(12, 92);
    ctx.lineTo(24, 28);
    ctx.moveTo(28, 92);
    ctx.lineTo(16, 28);
    ctx.stroke();
    ctx.strokeStyle = "#8a6a48";
    ctx.lineWidth = 1.2;
    for (const y of [40, 55, 70, 84]) {
      ctx.beginPath();
      ctx.moveTo(13, y + 8);
      ctx.lineTo(27, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#5c4632";
    ctx.fillRect(14, 22, 12, 6);
    ctx.fillStyle = "#c2ccd0";
    ctx.beginPath();
    ctx.arc(20, TOWER_AXLE_Y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBlades(): HTMLCanvasElement {
  return canvas(84, 84, (ctx) => {
    const cx = 42;
    const cy = 42;
    ctx.strokeStyle = "#d5dee2";
    ctx.fillStyle = "#e7eef0";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * 36, cy + Math.sin(angle) * 36);
      ctx.stroke();
    }
    ctx.fillStyle = "#f4f7f8";
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8aa0a6";
    ctx.stroke();
  });
}

function drawKraal(): HTMLCanvasElement {
  return canvas(108, 68, (ctx) => {
    ctx.strokeStyle = "#c4a882";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(54, 40, 42, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#8b5a32";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(54, 40, 36, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#5c3a22";
    for (let i = 0; i < 16; i += 1) {
      const angle = (Math.PI * 2 * i) / 16;
      const x = 54 + Math.cos(angle) * 42;
      const y = 40 + Math.sin(angle) * 18;
      ctx.beginPath();
      ctx.arc(x, y, 3.1, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawReservoir(): HTMLCanvasElement {
  return canvas(78, 52, (ctx) => {
    ctx.fillStyle = "#b7aea4";
    ctx.beginPath();
    ctx.ellipse(39, 30, 34, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2f6f72";
    ctx.beginPath();
    ctx.ellipse(39, 28, 28, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8fd0c4";
    ctx.beginPath();
    ctx.ellipse(32, 26, 10, 4, -0.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawTrough(): HTMLCanvasElement {
  return canvas(36, 22, (ctx) => {
    ctx.fillStyle = "#6b4228";
    ctx.beginPath();
    ctx.moveTo(4, 8);
    ctx.lineTo(18, 14);
    ctx.lineTo(32, 8);
    ctx.lineTo(18, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3f8f88";
    ctx.beginPath();
    ctx.moveTo(8, 9);
    ctx.lineTo(18, 13);
    ctx.lineTo(28, 9);
    ctx.lineTo(18, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8b5a32";
    ctx.fillRect(6, 10, 3, 8);
    ctx.fillRect(27, 10, 3, 8);
  });
}
