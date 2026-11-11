/** Double-tap recenters on the homestead only when the tap missed the herd. */
export function doubleTapGoesHome(hitHerd: boolean): boolean {
  return !hitHerd;
}
