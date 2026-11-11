/** Scroll correction so zoom stays anchored on a screen point. */
export function zoomScrollDelta(
  beforeX: number,
  beforeY: number,
  afterX: number,
  afterY: number,
): { scrollX: number; scrollY: number } {
  return { scrollX: beforeX - afterX, scrollY: beforeY - afterY };
}
