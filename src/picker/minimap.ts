import { TILE_HOMESTEAD, TILE_OUTSIDE, type GameState } from "../sim/types";

const COLORS = {
  sand: "#c56a32",
  homestead: "#9a5028",
  camp: ["#b87840", "#a86a38", "#986238", "#8a5a34", "#7c5230", "#6e4a2c"],
  outside: "#7a441e",
};

function idx(x: number, y: number, width: number): number {
  return y * width + x;
}

/** Simple top-down minimap for picker cards (not the in-game isometric minimap). */
export function drawOfferMinimap(
  canvas: HTMLCanvasElement,
  state: GameState,
  dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
): void {
  const size = Math.min(canvas.clientWidth || 160, canvas.clientHeight || 120);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = state.width;
  const h = state.height;
  const scale = size / Math.max(w, h);
  const offX = (size - w * scale) / 2;
  const offY = (size - h * scale) / 2;

  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(0, 0, size, size);

  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const id = state.campIds[idx(x, y, w)];
      const p = (y * w + x) * 4;
      let hex = COLORS.sand;
      if (id === TILE_OUTSIDE) hex = COLORS.outside;
      else if (id === TILE_HOMESTEAD) hex = COLORS.homestead;
      else hex = COLORS.camp[id % COLORS.camp.length] ?? COLORS.camp[0];
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      img.data[p] = r;
      img.data[p + 1] = g;
      img.data[p + 2] = b;
      img.data[p + 3] = 255;
    }
  }
  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const sctx = scratch.getContext("2d");
  if (!sctx) return;
  sctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scratch, offX, offY, w * scale, h * scale);

  const house = state.features.find((f) => f.kind === "house");
  if (house) {
    ctx.fillStyle = "#f6efe2";
    ctx.fillRect(offX + house.x * scale - 1, offY + house.y * scale - 1, 3, 3);
  }
}
