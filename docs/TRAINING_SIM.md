# Training Sim System

## Overview

The Training Sim is a fully functional offline battle practice mode accessible from the **Comms Array** node in Base Camp. It allows players to configure and launch custom single-battle encounters vs bots with **no rewards** and **no progression impact**.

## Purpose

- Practice tactical combat mechanics
- Test unit loadouts and strategies
- Learn card interactions and battle flow
- Experiment with different enemy compositions
- Safe environment for experimentation (no consequences)

## Architecture

### Components

1. **Comms Array Screen** (`CommsArrayScreen.ts`)
   - Base Camp node interaction
   - Multiplayer hub (placeholder for future online features)
   - Training Sim entry point

2. **Training Sim Setup Screen** (`TrainingSimSetupScreen.ts`)
   - Battle configuration UI
   - Enemy composition selection
   - Grid size and cover options
   - Difficulty settings

3. **Battle System Integration**
   - Uses existing `createBattleFromEncounter()` function
   - `isTrainingSim` flag prevents rewards/progression
   - Custom result screen with "Run Again" option

### Data Flow

```
Base Camp → Comms Array → Training Sim Setup → Battle → Results → (Loop or Exit)
```

## Configuration Options

### Grid Size
- **4x3**: Small skirmish (max 3 enemies)
- **5x4**: Medium encounter (max 5 enemies)
- **6x3**: Wide battlefield (max 4 enemies)
- **6x4**: Standard grid (max 6 enemies)
- **8x6**: Large engagement (max 10 enemies)

**Enemy Count Limit**: `Math.max(3, Math.min(10, Math.floor(gridArea * 0.25)))`

### Enemy Roster Presets

1. **Random (Balanced)**
   - Mixed enemy types (Infantry, Scout, Sentry)
   - Balanced distribution

2. **All Grunts**
   - All Basic Infantry units
   - Good for testing basic combat

3. **Ranged Focus**
   - 70% Snipers, 30% Infantry
   - Tests positioning against ranged threats

4. **Mixed (2 types)**
   - 50% Infantry, 50% Scouts
   - Balance between melee and mobility

### Cover Profile

- **None**: No cover tiles
- **Light**: Sparse light cover only
- **Mixed**: Light + Heavy cover
- **Random**: Procedurally generated cover

### Difficulty

- **Easy**: Enemy stats -1
- **Standard**: Normal enemy stats
- **Hard**: Enemy stats +1

## Guards & Safety

### Reward Prevention

**Guard Location**: `BattleScreen.ts` - `claimRewardsBtn.onclick`

```typescript
const isTrainingSim = (localBattleState as any).isTrainingSim || false;
if (isTrainingSim) {
  console.log("[TRAININGSIM] Skipping rewards (Training Sim mode)");
  // Skip all reward logic
  return;
}
```

### No Progression Impact

Training Sim battles:
- ❌ Do NOT grant WAD or resources
- ❌ Do NOT add cards to Card Library
- ❌ Do NOT update quest progress
- ❌ Do NOT affect operation/run state
- ❌ Do NOT trigger field mod rewards
- ❌ Do NOT modify key room capture state
- ❌ Do NOT affect unit XP or leveling (future feature)

### Active Run Prevention

**Guard Location**: `TrainingSimSetupScreen.ts` - `renderTrainingSimSetupScreen()`

```typescript
const activeRun = (window as any).__campaignState?.activeRun;
if (activeRun) {
  // Show blocked message:
  // "Finish or abandon current operation before entering Training Sim."
}
```

Players cannot enter Training Sim while an operation is in progress.

## Battle Launch Flow

1. **Configuration** → Player selects settings
2. **Validation** → Enemy count <= max for grid size
3. **Encounter Generation** → `generateEncounterFromConfig(config)`
4. **Battle Creation** → `createBattleFromEncounter(state, encounter, simSeed)`
5. **Flag Assignment** → `battle.isTrainingSim = true`
6. **Launch** → `renderBattleScreen()`

### Encounter Generation

```typescript
function generateEncounterFromConfig(config: TrainingSimConfig): EncounterDefinition {
  // Map preset → enemy IDs
  // Apply difficulty level mod
  // Return encounter with grid dimensions
}
```

## Result Screen

### Victory

```
┌─────────────────────────────────┐
│  TRAINING SIM COMPLETE          │
│                                 │
│  Simulated engagement concluded.│
│  No rewards issued.             │
│                                 │
│  [RUN AGAIN]  [BACK TO COMMS]  │
└─────────────────────────────────┘
```

### Defeat

```
┌─────────────────────────────────┐
│  TRAINING SIM FAILED            │
│                                 │
│  Simulated engagement failed.   │
│  No rewards issued.             │
│                                 │
│  [RUN AGAIN]  [BACK TO COMMS]  │
└─────────────────────────────────┘
```

**Actions**:
- **Run Again**: Returns to Training Sim Setup (preserves last config)
- **Back to Comms Array**: Returns to Comms Array screen

## Testing Procedure

### Quick Test

1. Start game → New Game
2. Navigate to Base Camp (field mode)
3. Interact with **Comms Array** node (position: x:19, y:3)
4. Click **Training Sim**
5. Configure battle:
   - Grid: 6x4
   - Enemies: 3
   - Roster: Random
   - Cover: Mixed
   - Difficulty: Standard
6. Click **Launch Sim**
7. Complete battle (win or lose)
8. Verify "No rewards issued" message
9. Check inventory - no resources added
10. Click **Run Again** or **Back to Comms Array**

### Full Test Matrix

| Test Case | Grid | Enemies | Roster | Expected |
|-----------|------|---------|--------|----------|
| Min Size | 4x3 | 1 | All Grunts | Passes validation |
| Max Size | 8x6 | 10 | Random | Passes validation |
| Over Limit | 6x4 | 15 | Mixed | Clamped to max (6) |
| Ranged Test | 6x4 | 5 | Ranged Focus | 3-4 Snipers spawn |
| No Cover | 8x6 | 5 | Random | No cover tiles generated |
| Active Run Block | - | - | - | Shows "Operation in progress" |

### Reward Guard Test

1. Launch Training Sim
2. Win battle
3. Open browser console
4. Verify log: `[TRAININGSIM] Skipping rewards (Training Sim mode)`
5. Check `gameState.wad` before and after - must be unchanged
6. Check `gameState.resources` before and after - must be unchanged
7. Check `gameState.cardLibrary` before and after - must be unchanged

### Active Run Block Test

1. Start a new operation from Ops Terminal
2. Enter first battle node
3. Abandon battle → Return to Base Camp
4. Access Comms Array → Training Sim
5. Should show: "Finish or abandon current operation before entering Training Sim."
6. Abandon run from operation map
7. Re-access Training Sim → Should work normally

## Known Limitations (v1)

- No enemy AI difficulty scaling (uses standard AI)
- No custom enemy composition (limited to presets)
- Cover generation is basic (not fully customizable)
- No save/load of favorite configs
- No battle history/stats tracking

## Future Enhancements (v2+)

- [ ] Custom enemy composition builder
- [ ] Save/load training scenarios
- [ ] Battle replay system
- [ ] Performance stats tracking
- [ ] Leaderboards (local/online)
- [ ] AI difficulty presets
- [ ] Boss encounter practice mode
- [ ] Co-op training (2-player local)

## Implementation Files

### Core Files
- `src/ui/screens/CommsArrayScreen.ts` - Multiplayer hub UI
- `src/ui/screens/TrainingSimSetupScreen.ts` - Configuration screen
- `src/ui/screens/BattleScreen.ts` - Battle system integration (guards + result screen)

### Map/Interaction Files
- `src/field/maps.ts` - Comms Array node definition
- `src/field/interactions.ts` - Comms Array action handler

### Styling
- `src/styles.css` - Comms Array + Training Sim styles

## Debugging

### Enable Debug Logs

Training Sim logs use the `[TRAININGSIM]` prefix:

```typescript
console.log("[TRAININGSIM] Launching sim with config:", config);
console.log("[TRAININGSIM] Skipping rewards (Training Sim mode)");
```

Filter browser console: `/TRAININGSIM/`

### Common Issues

**Issue**: Training Sim button does nothing
- **Check**: Comms Array node interaction handler registered
- **Fix**: Verify `interactions.ts` has `case "comms_array"`

**Issue**: Rewards still granted after Training Sim
- **Check**: `isTrainingSim` flag set on battle state
- **Fix**: Verify `launchTrainingSim()` sets `(battle as any).isTrainingSim = true`

**Issue**: Can't enter Training Sim
- **Check**: Active run state
- **Fix**: Abandon current operation or complete it

**Issue**: Enemy count validation fails
- **Check**: Grid size and max enemy calculation
- **Fix**: Ensure `enemyCount <= maxEnemies` before launch

## Performance Notes

- Training Sim uses same battle engine as normal encounters
- No additional memory overhead (single battle instance)
- Cover generation is deterministic per seed
- Enemy composition is pre-generated (no runtime randomization)

## Code Style

- Use `isTrainingSim` boolean flag for all guards
- Always check flag before reward/progression logic
- Log Training Sim actions with `[TRAININGSIM]` prefix
- Keep Training Sim code isolated from campaign logic

---

**Last Updated**: 2025-12-17
**Version**: 1.0
**Status**: Fully Implemented
**Related Systems**: Battle System, Comms Array, Field Mode
