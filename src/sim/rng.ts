export type Rng = {
  next(): number;
  getState(): number;
};

function mulberry(initial: number): Rng {
  let a = initial | 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    getState() {
      return a >>> 0;
    },
  };
}

export function createRng(seed: number): Rng {
  return mulberry(seed);
}

export function rngFromState(state: number): Rng {
  return mulberry(state);
}
