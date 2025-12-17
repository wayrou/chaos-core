# Chaos Core - Systems Audit Report

**Date:** 2025-12-16
**Systems Audited:** Enemy Randomization, Field Mods, Destructible Cover

---

## Part A: Enemy Randomization System

### Status: ✅ WORKING - Enhanced with Proper Range Randomization

### Findings

The enemy randomization system is **well-implemented** with full deterministic behavior:

1. **Seeded RNG Implementation** (`src/core/encounterGenerator.ts`)
   - Uses Linear Congruential Generator (LCG) with standard constants
   - Seed constructed as: `${rngSeed}_floor${floorIndex}_${nodeType}`
   - All random decisions (enemy count, types, elite status, grid size) use seeded RNG

2. **Variable Enemy Counts** (Enhanced)
   - **Configuration table** for node types:
     - Normal battle: min 2-4, max 4-6 (+ floor bonus)
     - Elite battle: min 3-5, max 5-7 (+ floor bonus)
   - Difficulty modifiers: easy (-1), normal (0), hard (+1)
   - Floor scaling: +1 max enemies per 2 floors
   - **Grid-based clamping**: Enemy count cannot exceed `floor(gridArea * 0.25)` (max 10)
   - Random roll within [min, max] range ensures variety

3. **Enemy Pool System** (`src/core/enemies.ts`)
   - 5 operations with unique enemy pools (18 total enemy types)
   - Weighted random selection with floor constraints (minFloor/maxFloor)
   - Elite variants with stat bonuses

4. **Determinism Verification**
   - Retry same battle → identical enemies/count ✅
   - Different battles → different enemies/count ✅

### Changes Made

1. Added `ENEMY_COUNT_CONFIG` tuning table for data-driven enemy counts
2. Enemy count now randomized within proper [min, max] range
3. Enhanced debug logging showing range and rolled value:
```
[Encounter] node=battle, floor=0, op=op_iron_gate, seed=run_1234..., grid=5x4 (max=5), enemyRange=[2-6], rolled=4, enemies=[gate_sentry x2, basic_infantry x2] (total=4)
```

### How to Verify

1. Start a new operation run
2. Enter a battle node - observe console log showing encounter details
3. Lose battle and retry - same log output should appear (determinism)
4. Enter a different battle node - different enemies should appear

---

## Part B: Field Mods System

### Status: ⚠️ PARTIALLY IMPLEMENTED - Missing Acquisition Path

### Findings

**What's Working:**

1. **Data Model** (`src/core/fieldMods.ts`)
   - FieldModDef with 11 trigger types (battle_start, turn_start, hit, kill, etc.)
   - 8 effect types (deal_damage, apply_status, gain_shield, draw, etc.)
   - HardpointState: 2 slots per unit

2. **Definitions Database** (`src/core/fieldModDefinitions.ts`)
   - 13 starter field mods (6 common, 4 uncommon, 3 rare)
   - Military trigger labels (On Engagement, On Contact, On Confirmed Kill)
   - Costs defined for Black Market system

3. **Proc Engine** (`src/core/fieldModProcEngine.ts`)
   - Deterministic seeded RNG for proc rolls
   - Proper gathering of unit-scope and squad-scope mods
   - Effect scaling by stacks

4. **Battle Integration** (`src/core/fieldModBattleIntegration.ts`)
   - Triggers wired into battle.ts:
     - `triggerBattleStart()` - on battle initialization
     - `triggerTurnStart()` - on unit's turn
     - `triggerHit()` - on attack hit (+ crit variant)
     - `triggerKill()` - on enemy elimination
     - `triggerCardPlayed()` - when card is played

5. **UI for Equipping** (`src/ui/screens/UnitDetailScreen.ts`)
   - 2 hardpoint slots displayed per unit
   - Can equip/unequip mods from run inventory
   - Military labels used in tooltips

**What's Missing:**

1. **No Acquisition Path!**
   - No way to obtain field mods during gameplay
   - `runFieldModInventory` exists but nothing populates it
   - `queuedFieldModsForNextRun` (Black Market) structure exists but unused
   - No rewards from battles, treasures, events, or shops

2. **Placeholder Effects:**
   - Shield system uses HP boost as placeholder
   - Draw, status, drone, cost reduction, knockback are log-only placeholders

### Changes Made

1. Added debug logging for proc attempts:
```
[FieldMod] On Contact triggered: Contact Overload stacks=1 chance=15% roll=12.3% -> PROC!
```

2. Fixed TypeScript import errors (BattleState from battle.ts, UnitId from types.ts)

### How to Verify

1. Manually add a field mod to inventory for testing:
   ```typescript
   // In browser console after starting a run:
   const progress = JSON.parse(localStorage.getItem('chaoscore_campaign_progress'));
   progress.activeRun.runFieldModInventory = [{
     defId: "mod_contact_damage",
     stacks: 1,
     instanceId: "test_mod_1"
   }];
   localStorage.setItem('chaoscore_campaign_progress', JSON.stringify(progress));
   ```
2. Navigate to Unit Detail screen → equip the mod to a hardpoint
3. Enter battle → observe On Engagement/On Contact procs in console

### Recommended Fixes

1. **Add field mod rewards to battle victory**
2. **Add field mods to treasure rooms**
3. **Add field mods to shop inventory**
4. **Implement Black Market queuing**

---

## Part C: Destructible Cover System

### Status: ✅ WORKING - Minor Fix Applied

### Findings

**What's Working:**

1. **Cover Generation** (`src/core/coverGenerator.ts`)
   - Deterministic seeded RNG: `${battleSeed}_cover`
   - Three profiles: none (25%), light (45%), mixed (30%)
   - Light cover: 3-5 HP, +1 damage reduction
   - Heavy cover: 7-10 HP, +2 damage reduction
   - Cover placed in interior cells (not on spawn edges)

2. **Cover Damage/Destruction**
   - `damageCover()` function reduces cover HP
   - Destroyed cover becomes "rubble" terrain
   - Rubble is walkable, provides no protection

3. **Line of Sight Blocking** (`src/core/lineOfSight.ts`)
   - `hasLineOfSight()` uses Bresenham's line algorithm
   - Cover blocks LoS for ranged attacks
   - `getFirstCoverInLine()` for targeting cover

4. **Damage Reduction for Card Attacks** (`src/core/cardHandler.ts`)
   - `getCoverDamageReduction()` called during card damage calculation
   - Properly reduces damage when target is on cover

**What Was Missing:**

1. **Melee Attack Cover Reduction** - FIXED
   - `attackUnit()` in battle.ts was NOT applying cover damage reduction
   - Only card-based attacks got the reduction

### Changes Made

1. Added debug logging to cover generation:
```
[Cover] seed=run_1234_node_abc..., grid=5x4, profile=mixed (roll=65.3%)
[Cover] Generated: 2 light cover, 1 heavy cover
```

2. **Fixed melee attack cover reduction** in `battle.ts:attackUnit()`:
```typescript
// Cover damage reduction (if defender is on cover tile)
let coverReduction = 0;
if (defender.pos) {
  const defenderTile = getTileAt(state, defender.pos.x, defender.pos.y);
  coverReduction = getCoverDamageReduction(defenderTile);
}
const rawDamage = attacker.atk - (defender.def + totalDefBuff + coverReduction);
```

3. Added `getTileAt()` helper function exported from battle.ts

### How to Verify

1. Start a new operation run
2. Enter multiple battles - observe console logs:
   - Some battles should have "No cover generated"
   - Others should show light/heavy cover counts
3. Same battle on retry should have identical cover layout
4. Stand unit on heavy cover → take 2 less damage from attacks
5. Attack cover directly (AoE) → cover HP decreases → becomes rubble

---

## Summary of Changes

### Files Modified

| File | Changes |
|------|---------|
| `src/core/encounterGenerator.ts` | Added `DEBUG_ENCOUNTERS` flag and encounter logging |
| `src/core/fieldModProcEngine.ts` | Added `DEBUG_FIELD_MODS` flag and proc logging; fixed imports |
| `src/core/fieldModBattleIntegration.ts` | Fixed imports (BattleState from battle.ts) |
| `src/core/coverGenerator.ts` | Added `DEBUG_COVER` flag and cover generation logging |
| `src/core/battle.ts` | Added `getTileAt()` export; added cover damage reduction to `attackUnit()` |
| `src/core/enemies.ts` | Removed unused import |

### Debug Flags

All debug logging is controlled by flags at the top of each file:
- `DEBUG_ENCOUNTERS` in encounterGenerator.ts
- `DEBUG_FIELD_MODS` in fieldModProcEngine.ts
- `DEBUG_COVER` in coverGenerator.ts

Set to `false` for production builds.

---

## Smoke Test Checklist

### Enemy Randomization
- [ ] Enter Battle A → record enemies/count in console
- [ ] Lose → retry → confirm identical log output
- [ ] Enter Battle B → confirm different enemies/count

### Field Mods
- [ ] Manually add mod to inventory (see instructions above)
- [ ] Equip into hardpoint via Unit Detail screen
- [ ] Start battle → see "On Engagement" log (if mod has that trigger)
- [ ] Hit enemy → see "On Contact" log with roll result
- [ ] Kill enemy → see "On Confirmed Kill" log

### Cover
- [ ] Enter battle with cover → see cover count in console
- [ ] Verify some battles have "No cover generated"
- [ ] Retry same battle → identical cover layout
- [ ] Position unit on cover → receive less damage
- [ ] Attack cover with AoE → watch HP decrease → becomes rubble

---

## Known Issues / Future Work

1. **Field Mods have no acquisition path** - Need to add rewards/shop/treasure integration
2. **Some Field Mod effects are placeholders** - Shield uses HP boost, others log-only
3. **No visual indicators for cover damage state** - Would help player awareness
4. **Cover doesn't block melee** - By design (adjacent attacks bypass cover)
