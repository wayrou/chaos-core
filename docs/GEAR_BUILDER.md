# Gear Builder System

## Overview

The Gear Builder is a v1 system that allows players to create new equipment items by combining **Chassis** (foundation) and **Doctrine** (behavior/intent) layers. Built gear can then be customized with cards in the Customize Gear tab.

## Architecture

### Three-Layer Model

1. **Chassis** (foundation) - Defines base properties: logistics footprint, stability, card slots
2. **Doctrine** (behavior bias) - Defines intent and tradeoffs: stability modifier, strain/proc biases
3. **Field Modifications** (future) - Currently locked/placeholder

### Data Files

- `src/data/gearChassis.ts` - Chassis definitions registry
- `src/data/gearDoctrines.ts` - Doctrine definitions registry
- `src/core/gearBuilder.ts` - Build logic and validation

## How to Build Gear

1. Open Gear Workbench from Base Camp
2. Click **"BUILD GEAR"** tab
3. Select slot type (Weapon / Helmet / Chestpiece / Accessory)
4. Select a Chassis (must be unlocked)
5. Select a Doctrine (must be unlocked)
6. Review build summary (costs, stability, logistics)
7. Click **"BUILD"** button
8. Materials are deducted and gear is added to inventory
9. Switch to **"CUSTOMIZE GEAR"** tab to slot cards

## Building Costs

Build cost = Chassis base cost + Doctrine modifier

Required materials:
- Metal Scrap
- Wood
- Chaos Shards
- Steam Components

Costs are displayed in the build summary panel and insufficient materials are highlighted in red.

## Gear Metadata

Built gear stores:
- `chassisId: string` - Which chassis was used
- `doctrineId: string` - Which doctrine was used
- `stability: number` (0-100) - Final stability (chassis base + doctrine modifier)
- `builderVersion: number` - For migration safety (currently 1)

## Stability System

Stability is calculated as: `chassis.baseStability + doctrine.stabilityModifier`, clamped to 0-100.

For v1, stability is stored and displayed but has minimal mechanical effects. A tooltip indicates: "Lower stability increases jam/strain volatility (future)."

Future expansion: Stability below 30 could add small jam chance if jam system exists.

## Unlocking System

Unlocks are stored in GameState:
- `unlockedChassisIds: string[]`
- `unlockedDoctrineIds: string[]`

### Starter Unlocks

By default, players start with:
- **Chassis**: Standard Rifle, Standard Helmet, Standard Chestplate, Utility Module
- **Doctrines**: Balanced, Skirmish, Sustain

### Adding New Chassis/Doctrines

1. Add definition to `ALL_CHASSIS` array in `src/data/gearChassis.ts` or `ALL_DOCTRINES` in `src/data/gearDoctrines.ts`
2. Add unlock ID to starter unlocks in `src/core/initialState.ts` (for default unlocks)
3. Or add unlock hook for rewards/story progression (future)

## Integration with Customize Gear

Built gear:
- Appears in equipment inventory (`equipmentById` and `equipmentPool`)
- Can be equipped to units via loadout system
- Respects `maxCardSlots` from chassis when slotting cards
- Shows stability in gear editor (if built gear)

The `getDefaultGearSlots` function checks for `chassisId` metadata and uses `maxCardSlots` from the chassis definition.

## Adding New Chassis

Edit `src/data/gearChassis.ts`:

```typescript
{
  id: "chassis_my_new_chassis",
  name: "My New Chassis",
  slotType: "weapon", // or "helmet" | "chestpiece" | "accessory"
  baseMassKg: 10,
  baseBulkBu: 15,
  basePowerW: 8,
  baseStability: 75,
  maxCardSlots: 4,
  description: "Description text",
  buildCost: {
    metalScrap: 20,
    wood: 5,
    chaosShards: 1,
    steamComponents: 3,
  },
}
```

## Adding New Doctrines

Edit `src/data/gearDoctrines.ts`:

```typescript
{
  id: "doctrine_my_new_doctrine",
  name: "My New Doctrine",
  shortDescription: "Brief description",
  intentTags: ["assault", "control"],
  stabilityModifier: -5, // -20 to +20 typical
  strainBias: 0.1, // Optional: affects strain costs
  procBias: 0.05, // Optional: affects proc chances
  buildCostModifier: {
    metalScrap: 3,
    wood: 1,
    chaosShards: 1,
    steamComponents: 2,
  },
  doctrineRules: "Text description of effects (v1: text only)",
  description: "Full description",
}
```

## Smoke Test Steps

1. Start new game
2. Open Gear Workbench
3. Verify two tabs: "BUILD GEAR" and "CUSTOMIZE GEAR"
4. Click "BUILD GEAR" tab
5. Select "WEAPON" slot type
6. Verify chassis list shows unlocked chassis
7. Select a chassis (e.g., "Standard Rifle Chassis")
8. Select a doctrine (e.g., "Balanced Doctrine")
9. Verify summary shows item name, stability, costs
10. If materials insufficient, verify "INSUFFICIENT MATERIALS" button state
11. If materials sufficient, click "BUILD"
12. Verify materials deducted
13. Verify console shows "GEAR FABRICATED" message
14. Switch to "CUSTOMIZE GEAR" tab
15. Verify built gear appears in equipment list (if equipped to unit)
16. Select built gear
17. Verify max card slots match chassis definition
18. Verify stability displays in gear editor

## Debug: Unlock All

For testing, unlock all chassis/doctrines by modifying `createNewGameState()` in `src/core/initialState.ts`:

```typescript
unlockedChassisIds: getAllChassisIds(),
unlockedDoctrineIds: getAllDoctrineIds(),
```

Import the helper functions from the data files.

## Future Enhancements

- Field Modifications layer (currently locked/placeholder)
- Stability mechanical effects
- Unlock hooks for rewards/story progression
- Enhanced card filtering by chassis `allowedCardTags`
- More chassis/doctrine variety
