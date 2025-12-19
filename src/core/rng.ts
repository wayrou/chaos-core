// ============================================================================
// CHAOS CORE - SEEDED RANDOM NUMBER GENERATOR
// Deterministic RNG for procedural generation
// ============================================================================

/**
 * Mulberry32 - Fast, simple seeded RNG
 * Returns a function that generates random numbers between 0 and 1
 */
export function createSeededRNG(seed: number): () => number {
  let state = seed;
  return function() {
    let t = state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Generate a random seed (timestamp + random)
 */
export function generateSeed(): number {
  return Date.now() + Math.floor(Math.random() * 1000000);
}

/**
 * Derive a new seed from a base seed with a salt
 * Useful for creating independent random streams from the same base seed
 */
export function deriveSeed(baseSeed: number, salt: string | number): number {
  const saltHash = typeof salt === "string" 
    ? salt.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    : salt;
  return (baseSeed ^ saltHash) >>> 0;
}

/**
 * Get random integer in range [min, max] (inclusive)
 */
export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Get random float in range [min, max)
 */
export function randomFloat(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}

/**
 * Weighted random selection
 * Returns index of selected item based on weights
 */
export function weightedRandom<T>(
  rng: () => number,
  items: T[],
  weights: number[]
): number {
  if (items.length !== weights.length) {
    throw new Error("Items and weights arrays must have same length");
  }
  
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) {
    throw new Error("Total weight must be positive");
  }
  
  let random = rng() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return i;
    }
  }
  
  // Fallback (shouldn't happen)
  return items.length - 1;
}

