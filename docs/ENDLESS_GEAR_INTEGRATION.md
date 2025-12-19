# Endless Gear Integration Summary

## Completed Integration

### 1. Dismantle Logic ✅
**File**: `src/core/endlessGear/dismantleEndlessGear.ts`

- `dismantleEndlessGear()`: Returns 50-75% of input materials (randomized)
- `dismantleAndReturnMaterials()`: Dismantles gear and adds materials to inventory
- `canDismantleGear()`: Checks if gear can be dismantled (endless crafted only)

**Usage**:
```typescript
import { dismantleAndReturnMaterials } from "./core/endlessGear/dismantleEndlessGear";

const result = dismantleAndReturnMaterials(endlessGear);
// Materials automatically added to inventory
// Gear removed from equipmentById, equipmentPool, and gearSlots
```

### 2. UI Integration ✅
**File**: `src/ui/screens/GearWorkbenchScreen.ts`

Added "ENDLESS CRAFT" tab to Gear Workbench with:
- Chassis selection (all unlocked chassis)
- Material selection (3 materials required)
  - Metal Scrap, Wood, Chaos Shards, Steam Components
  - Shows available quantities
  - Add/remove buttons
- Recipe cost display (with insufficient material highlighting)
- Preview panel (shows deterministic preview with fixed seed)
- Craft button (disabled until chassis + 3 materials selected)

**Features**:
- Material selection UI with add/remove buttons
- Real-time cost calculation
- Preview generation (uses fixed seed for consistency)
- Automatic inventory integration
- Success/error logging to workbench console

### 3. Unit Tests ✅
**File**: `src/core/endlessGear/__tests__/endlessGear.test.ts`

Tests cover:
- **Reproducibility**: Same recipe + seed = identical output
- **Non-determinism**: Same recipe without seed = different outputs
- **Bias validation**: Metal-heavy recipes have higher avg stability than chaos-heavy
- **Chassis compatibility**: Generated gear respects chassis constraints
- **Stability clamping**: Always 0-100
- **Card/Mod validation**: Only uses existing IDs
- **Edge cases**: Empty pools handled gracefully

## How to Use

### Crafting Endless Gear

1. Open Gear Workbench from Base Camp
2. Click "ENDLESS CRAFT" tab
3. Select a chassis (must be unlocked)
4. Select 3 materials (click + to add, - to remove)
5. Review preview (shows likely outcome)
6. Click "CRAFT ENDLESS GEAR"
7. Materials deducted, gear added to inventory

### Dismantling Endless Gear

```typescript
import { dismantleAndReturnMaterials, canDismantleGear } from "./core/endlessGear/dismantleEndlessGear";

if (canDismantleGear(gear)) {
  const result = dismantleAndReturnMaterials(gear);
  // Returns 50-75% of original materials
  // Gear removed from inventory
}
```

### Testing

Run tests with:
```bash
npm test -- endlessGear
```

Or run specific test:
```bash
npm test -- endlessGear.test.ts
```

## Files Modified

1. **`src/ui/screens/GearWorkbenchScreen.ts`**
   - Added "endless" tab type
   - Added `endlessChassisId` and `endlessMaterials` to state
   - Added `renderEndlessCraftTab()` function
   - Added `attachEndlessCraftListeners()` function
   - Added endless tab button to UI
   - Integrated with crafting system

## Files Created

1. **`src/core/endlessGear/dismantleEndlessGear.ts`** - Dismantling logic
2. **`src/core/endlessGear/__tests__/endlessGear.test.ts`** - Unit tests
3. **`docs/ENDLESS_GEAR_INTEGRATION.md`** - This file

## Next Steps (Optional Future Enhancements)

1. **Field Mod Integration**: Apply field mods to equipment (currently stored but not applied)
2. **Dismantle UI**: Add dismantle button to gear editor for endless gear
3. **Seed Input**: Allow players to input custom seed for reproducibility
4. **Bias Visualization**: Show material bias effects more clearly in UI
5. **Loot Integration**: Hook `generateEndlessLoot()` into battle rewards

## Known Limitations

1. Field mods are stored in `fieldMods` array but not yet applied to equipment effects
2. Dismantle function exists but no UI button yet (can be called programmatically)
3. Preview uses fixed seed - actual craft will be different (by design)
4. Tests require Jest setup (may need configuration)

## Debugging

Use `explainEndlessGear()` to see full bias breakdown:

```typescript
import { explainEndlessGear } from "./core/endlessGear/generateEndlessGear";

console.log(explainEndlessGear(generatedGear));
// Prints: bias report, chosen rolls, stability range, etc.
```

