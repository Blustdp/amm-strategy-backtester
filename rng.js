/**
 * Deterministic PRNG (mulberry32) so simulations are reproducible
 * when a seed is provided. Falls back to Math.random-based seed
 * if none is given.
 */
export function createRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max) using an injected rng */
export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

/** Random integer in [min, max] inclusive */
export function randInt(rng, min, max) {
  return Math.floor(randRange(rng, min, max + 1));
}

/** Weighted pick from an array of {weight, value} items */
export function weightedPick(rng, items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    if (r < item.weight) return item.value;
    r -= item.weight;
  }
  return items[items.length - 1].value;
}

/** Sample from a normal-ish distribution via averaged uniforms (Irwin-Hall approx) */
export function randNormal(rng, mean = 0, stdDev = 1) {
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += rng();
  const std = (sum - 3) / 3; // approx N(0,1)
  return mean + std * stdDev;
}
