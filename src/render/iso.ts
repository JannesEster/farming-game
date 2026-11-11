export type IsoLayout = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export function isoLayout(
  mapW: number,
  mapH: number,
  tileW: number,
  tileH: number,
  pad: number,
): IsoLayout {
  const originX = pad + mapH * (tileW / 2);
  const originY = pad;
  const width = (mapW + mapH) * (tileW / 2) + pad * 2;
  const height = (mapW + mapH) * (tileH / 2) + pad * 2;
  return { originX, originY, width, height };
}

export function tileTop(
  x: number,
  y: number,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
): { x: number; y: number } {
  return {
    x: layout.originX + (x - y) * (tileW / 2),
    y: layout.originY + (x + y) * (tileH / 2),
  };
}

export function tileCenter(
  x: number,
  y: number,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
): { x: number; y: number } {
  const top = tileTop(x, y, layout, tileW, tileH);
  return { x: top.x, y: top.y + tileH / 2 };
}

export function worldToTile(
  wx: number,
  wy: number,
  layout: IsoLayout,
  tileW: number,
  tileH: number,
): { x: number; y: number } {
  const lx = wx - layout.originX;
  const ly = wy - layout.originY;
  const tx = (lx / (tileW / 2) + ly / (tileH / 2)) / 2;
  const ty = (ly / (tileH / 2) - lx / (tileW / 2)) / 2;
  return { x: Math.floor(tx + 1e-6), y: Math.floor(ty + 1e-6) };
}
