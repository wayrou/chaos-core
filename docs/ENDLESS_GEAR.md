# Endless Gear & Endless Crafting System

## Overview

The Endless Gear system provides procedural gear generation with material-based biases. Players can craft gear using a Chassis + 3 Materials recipe, where materials influence the resulting doctrine, field mods, stability, and slot locks.

## Architecture

### Core Components

1. **RNG System** (`src/core/rng.ts`)
   - Seeded random number generator (Mulberry32)
   - Deterministic and reproducible
   - Supports seed derivation for independent streams

2. **Type Definitions** (`src/core/endlessGear/types.ts`)
   - `EndlessRecipe`: Chassis + Materials + optional seed
   - `GeneratedGear`: Equipment with provenance metadata
   - `BiasReport`: Tracks how materials influenced generation

3. **Bias Configuration** (`src/core/endlessGear/biasConfig.ts`)
   - Material biases: How each material affects outcomes
   - Chassis base configs: Per-chassis generation rules

4. **Generation Pipeline** (`src/core/endlessGear/generateEndlessGear.ts`)
   - `generateEndlessGearFromRecipe()`: Main generation function
   - `generateEndlessLoot()`: Loot drop generation
   - `explainEndlessGear()`: Debug explanation

5. **Crafting Integration** (`src/core/endlessGear/craftEndlessGear.ts`)
   - `craftEndlessGear()`: Validate and generate
   - `addEndlessGearToInventory()`: Add to player inventory
   - `getEndlessRecipeCost()`: Calculate material costs

## How It Works

### Generation Algorithm

1. **Load Chassis Config**: Get base stability range and allowed tags
2. **Compute Bias Report**: Aggregate material biases
   - Doctrine tag weights (which doctrines are more likely)
   - Mod tag weights (which mods are more likely)
   - Stability range adjustments
3. **Roll Doctrine**: Weighted selection based on material biases
4. **Roll Field Mods**: 0-2 mods, weighted by tag pools
5. **Roll Stability**: Within biased range, clamped to 0-100
6. **Determine Slot Locks**: Based on chassis config + material modifiers
7. **Select Locked Cards**: Random cards from catalog (if any)
8. **Create Equipment**: Build equipment object with provenance

### Material Biases

Each material has:
- **Doctrine Tag Weights**: Boosts certain intent tags (assault, skirmish, etc.)
- **Mod Tag Weights**: Boosts mods with certain tags (damage, defense, etc.)
- **Stability Modifier**: Direct adjustment to stability
- **Stability Range Shift**: Adjusts min/max range
- **Slot Lock Modifiers**: Affects chance of locked slots
- **Locked Card Modifiers**: Affects number of locked cards

Example:
- `metal_scrap`: +5 stability, boosts assault/suppression doctrines, damage/defense mods
- `chaos_shard`: -10 stability, boosts control/sustain doctrines, proc/utility mods

### Reproducibility

- If a seed is provided, same recipe + seed = identical output
- If no seed, generates random seed and stores it on the gear
- Use `explainEndlessGear()` to see the bias breakdown

## Usage

### Crafting Endless Gear

```typescript
import { craftEndlessGear, addEndlessGearToInventory } from "./core/endlessGear/craftEndlessGear";
import { createGenerationContext } from "./core/endlessGear/generateEndlessGear";

const recipe = {
  chassisId: "chassis_standard_rifle",
  materials: ["metal_scrap", "metal_scrap", "chaos_shard"],
  seed: 12345, // Optional
};

const result = craftEndlessGear(recipe, gameState);
if (result.success && result.equipment) {
  // Deduct materials
  // ... (handled in UI)
  
  // Add to inventory
  addEndlessGearToInventory(result.equipment, gameState);
}
```

### Generating Loot

```typescript
import { generateEndlessLoot, createGenerationContext } from "./core/endlessGear/generateEndlessGear";

const ctx = createGenerationContext();
const loot = generateEndlessLoot(ctx, {
  slotType: "weapon", // Optional filter
  seed: 67890, // Optional
});
```

### Debugging

```typescript
import { explainEndlessGear } from "./core/endlessGear/generateEndlessGear";

const explanation = explainEndlessGear(generatedGear);
console.log(explanation);
// Prints bias report, chosen rolls, etc.
```

## Tuning Biases

Edit `src/core/endlessGear/biasConfig.ts`:

### Material Biases

```typescript
metal_scrap: {
  doctrineTagWeights: {
    assault: 1.5,  // 50% boost to assault doctrines
    suppression: 1.2,
  },
  modTagWeights: {
    damage: 1.3,
    defense: 1.1,
  },
  stabilityModifier: 5,  // +5 to stability
  stabilityRangeShift: { min: 0, max: 10 },
  slotLockChanceModifier: -0.05,  // 5% less chance of locked slots
}
```

### Chassis Configs

```typescript
chassis_standard_rifle: {
  baseStabilityRange: { min: 60, max: 80 },
  allowedDoctrineTags: ["assault", "skirmish", "suppression"],
  allowedModTags: ["damage", "proc", "utility"],
  baseSlotLockChance: 0.1,  // 10% base chance
  maxLockedSlots: 1,
  baseLockedCardCount: 0,
  maxLockedCards: 1,
}
```

## Reproducing Items

To reproduce an item:
1. Get the seed from `gear.provenance.seed`
2. Get the recipe from `gear.provenance.recipe`
3. Call `generateEndlessGearFromRecipe(recipe, ctx)` with the same seed

```typescript
const gear = generateEndlessGearFromRecipe(
  { chassisId: "...", materials: [...], seed: 12345 },
  ctx
);
// Same seed = same output
```

## File List

### New Files
- `src/core/rng.ts` - Seeded RNG utilities
- `src/core/endlessGear/types.ts` - Type definitions
- `src/core/endlessGear/biasConfig.ts` - Bias configuration
- `src/core/endlessGear/generateEndlessGear.ts` - Generation pipeline
- `src/core/endlessGear/craftEndlessGear.ts` - Crafting integration
- `docs/ENDLESS_GEAR.md` - This documentation

### Modified Files
- None (system is self-contained)

## Risks & Edge Cases

### Handled
1. **Empty Doctrine Pool**: Falls back to balanced doctrine or first available
2. **Empty Mod Pool**: Uses all mods if chassis restrictions yield none
3. **Invalid Chassis**: Validates before generation
4. **Insufficient Materials**: Validates before crafting
5. **Stability Clamping**: Always clamped to 0-100
6. **Seed Reproducibility**: Same seed + recipe = same output

### Future Considerations
1. **Field Mod Integration**: Field mods are stored in `fieldMods` array but not yet applied to equipment (system exists but needs integration)
2. **Locked Cards**: Locked cards are stored but UI needs to show them as locked
3. **Dismantling**: Returns fraction of materials (not yet implemented)
4. **Save/Load**: Provenance is stored on gear, should persist through saves

## Testing

### Unit Tests Needed
1. Same recipe + seed = identical output (snapshot test)
2. Same recipe without seed = different outputs (probabilistic)
3. Material biases shift outcomes (chaos-heavy vs metal-heavy)
4. Generated gear respects chassis compatibility
5. No unknown card/mod IDs
6. Stability always clamped

### Manual Testing
1. Craft 20 items with same recipe + seed → all identical
2. Craft 20 items with same recipe, no seed → some variation
3. Craft with metal-heavy recipe → higher avg stability
4. Craft with chaos-heavy recipe → lower avg stability, more locked cards

## Integration Points

### UI Integration (TODO)
- Add "Endless Craft" tab to Gear Workbench
- Material selector (3 materials)
- Preview showing likely outcomes
- Craft button

### Inventory
- Gear saved with `provenance` metadata
- Labeled as "[Endless]" in name
- Shows stability prominently

### Dismantling (TODO)
- Return 50-75% of input materials
- Optional: contribute to "doctrine research" if system exists

