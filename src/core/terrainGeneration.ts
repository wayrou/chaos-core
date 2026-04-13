import type { TacticalMapSurface } from "./tacticalMaps";

export interface StructuredBoardLayout {
  elevations: number[][];
  surfaces: Record<string, TacticalMapSurface>;
}

interface SeededRng {
  nextFloat(): number;
  nextInt(min: number, max: number): number;
  pick<T>(values: readonly T[]): T;
}

function createSeededRng(seed: string): SeededRng {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  let state = hash >>> 0;
  const nextUint = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };

  return {
    nextFloat(): number {
      return nextUint() / 0xffffffff;
    },
    nextInt(min: number, max: number): number {
      if (max <= min) {
        return min;
      }
      return min + Math.floor(this.nextFloat() * (max - min + 1));
    },
    pick<T>(values: readonly T[]): T {
      return values[this.nextInt(0, Math.max(0, values.length - 1))];
    },
  };
}

function clampElevation(elevation: number): number {
  return Math.max(-1, Math.min(2, Math.round(elevation)));
}

export function generateElevationMap(
  width: number,
  height: number,
  maxElevation = 3,
  seed?: number,
): number[][] {
  const elevations: number[][] = [];

  let rng = seed ?? Math.floor(Math.random() * 1000000);
  function random() {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  }

  for (let x = 0; x < width; x += 1) {
    elevations[x] = [];
    for (let y = 0; y < height; y += 1) {
      elevations[x][y] = Math.floor(random() * (maxElevation + 1));
    }
  }

  const smoothed: number[][] = [];
  for (let x = 0; x < width; x += 1) {
    smoothed[x] = [];
    for (let y = 0; y < height; y += 1) {
      let sum = elevations[x][y];
      let count = 1;

      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            sum += elevations[nx][ny];
            count += 1;
          }
        }
      }

      smoothed[x][y] = Math.round(sum / count);
    }
  }

  return smoothed;
}

function relaxElevationMap(grid: number[][], passes: number): void {
  const width = grid.length;
  const height = grid[0]?.length ?? 0;

  for (let pass = 0; pass < passes; pass += 1) {
    const next = grid.map((column) => [...column]);
    for (let x = 0; x < width; x += 1) {
      for (let y = 0; y < height; y += 1) {
        const neighbors = [
          grid[x - 1]?.[y],
          grid[x + 1]?.[y],
          grid[x]?.[y - 1],
          grid[x]?.[y + 1],
        ].filter((value): value is number => typeof value === "number");

        if (neighbors.length <= 0) {
          continue;
        }

        const average = neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length;
        const current = grid[x][y];
        if (current > average + 1) {
          next[x][y] = current - 1;
        } else if (current < average - 1) {
          next[x][y] = current + 1;
        }
      }
    }

    for (let x = 0; x < width; x += 1) {
      for (let y = 0; y < height; y += 1) {
        grid[x][y] = clampElevation(next[x][y]);
      }
    }
  }
}

function flattenSpawnEdges(grid: number[][]): void {
  const width = grid.length;
  const height = grid[0]?.length ?? 0;
  if (width <= 0 || height <= 0) {
    return;
  }

  for (let y = 0; y < height; y += 1) {
    grid[0][y] = 0;
    grid[width - 1][y] = 0;
  }
}

export function generateStructuredBoardLayout(
  width: number,
  height: number,
  seed: string,
  profile: "encounter" | "defense" = "encounter",
): StructuredBoardLayout {
  const rng = createSeededRng(`${seed}_${profile}_board`);
  const grid: number[][] = Array.from({ length: width }, () => Array.from({ length: height }, () => 0));

  const featureCount = Math.max(2, Math.min(6, Math.round((width + height) / 4)));
  for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
    const plateauWidth = rng.nextInt(2, Math.max(2, Math.min(width - 1, Math.ceil(width * 0.45))));
    const plateauHeight = rng.nextInt(2, Math.max(2, Math.min(height - 1, Math.ceil(height * 0.45))));
    const startX = rng.nextInt(0, Math.max(0, width - plateauWidth));
    const startY = rng.nextInt(0, Math.max(0, height - plateauHeight));
    const delta = rng.pick(profile === "defense" ? [1, 1, 1, -1] : [1, 1, -1]);

    for (let x = startX; x < startX + plateauWidth; x += 1) {
      for (let y = startY; y < startY + plateauHeight; y += 1) {
        const edgeDistance = Math.min(
          x - startX,
          startX + plateauWidth - 1 - x,
          y - startY,
          startY + plateauHeight - 1 - y,
        );
        const softenedDelta = edgeDistance <= 0 && delta > 0 ? 0 : delta;
        grid[x][y] = clampElevation(grid[x][y] + softenedDelta);
      }
    }
  }

  relaxElevationMap(grid, profile === "defense" ? 4 : 3);
  flattenSpawnEdges(grid);

  const baseSurface = rng.pick(
    profile === "defense"
      ? ["stone", "metal", "industrial"] as const
      : ["dirt", "grate", "industrial", "stone"] as const,
  );
  const highSurface = profile === "defense" ? "stone" : rng.pick(["stone", "ruin"] as const);
  const lowSurface = profile === "defense" ? "metal" : rng.pick(["dirt", "grate"] as const);

  const surfaces: Record<string, TacticalMapSurface> = {};
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const elevation = grid[x][y];
      surfaces[`${x},${y}`] =
        elevation >= 2
          ? highSurface
          : elevation <= -1
            ? lowSurface
            : baseSurface;
    }
  }

  return {
    elevations: grid,
    surfaces,
  };
}
