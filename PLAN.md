# Implementation Plan: Branching Floor Maps & Key Room Capture System

## Overview

This plan covers the implementation of branching, forward-only dungeon floor maps and an enhanced Key Room capture system with territory control mechanics for Chaos Core.

## Current State Analysis

### Already Implemented (Solid Foundation):
1. **Node Map Generator** (`src/core/nodeMapGenerator.ts`):
   - Three branching templates: `split_rejoin`, `risk_detour`, `forked_corridor`
   - 2 Key Rooms per floor generation (`ensureKeyRooms`)
   - Seeded RNG for deterministic generation
   - Node position data (x, y) for rendering

2. **Campaign Manager** (`src/core/campaignManager.ts`):
   - `getAvailableNextNodes()` - forward-only movement helper
   - `nodeMapByFloor` storage per floor
   - `clearedNodeIds` tracking
   - Run seed (`rngSeed`) for determinism
   - Retry support (keeps `pendingBattle`)

3. **Key Room System** (`src/core/keyRoomSystem.ts`):
   - 5 facility types with config (supply_depot, medical_ward, armory, command_center, mine)
   - `captureKeyRoom()`, `generateKeyRoomResources()`, `applyKeyRoomPassiveEffects()`
   - `rollKeyRoomAttack()` with base 10% + modifiers
   - `defendKeyRoom()`, `delayKeyRoomDefense()`, `abandonKeyRoom()`
   - `grantFloorResources()` at floor completion

4. **UI Screens**:
   - `FacilitySelectionScreen.ts` - facility choice UI
   - `DefenseDecisionScreen.ts` - defend/delay/abandon UI
   - `OperationMapScreen.ts` - roguelike map with branching connections

### What Needs Enhancement:
1. **Defense Battle Implementation** - "Survive X turns" win condition doesn't exist yet
2. **Attack Roll Determinism** - Currently uses `Math.random()`, needs seeded RNG
3. **Visual Map Improvements** - Better node positioning for branching patterns
4. **Defense Battle Trigger** - "Defend" choice doesn't actually start a battle

---

## Implementation Plan

### Part 1: Enhance Node Map Generator (Improvements)

#### Task 1.1: Improve Node Positioning for Visual Clarity
**File:** `src/core/nodeMapGenerator.ts`

Changes:
- Adjust node `position.x` to represent depth (column) and `position.y` for vertical spread
- Ensure nodes at same depth are visually distinct (different y values)
- Add spacing constants for cleaner rendering

```typescript
// Constants for positioning
const NODE_X_SPACING = 1;  // Horizontal spacing between depths
const NODE_Y_SPACING = 1;  // Vertical spacing between parallel nodes
```

#### Task 1.2: Add Missing Node Types
**File:** `src/core/nodeMapGenerator.ts`

Ensure the generator can produce all node types appropriately:
- `key_room` (already implemented)
- `elite` (already in rollNodeType)
- `treasure` (already implemented)

**No changes needed** - existing implementation covers this.

---

### Part 2: Implement Defense Battle System

#### Task 2.1: Add Defense Battle State to Campaign Types
**File:** `src/core/campaign.ts`

Add to `ActiveRunState`:
```typescript
// Defense Battle State
pendingDefenseBattle?: {
  keyRoomId: string;
  nodeId: string;
  turnsToSurvive: number;
  encounterSeed: string;
};
```

#### Task 2.2: Add Survive-X-Turns Win Condition to Battle System
**File:** `src/core/battle.ts`

Changes:
1. Add new fields to `BattleState`:
```typescript
// Defense battle objective
defenseObjective?: {
  type: "survive_turns";
  turnsRequired: number;
  turnsRemaining: number;
};
```

2. Modify `evaluateBattleOutcome()`:
```typescript
// Check defense objective BEFORE checking if all enemies are dead
if (state.defenseObjective?.type === "survive_turns") {
  if (state.defenseObjective.turnsRemaining <= 0) {
    // VICTORY - survived required turns
    return { ...state, phase: "victory", ... };
  }
}
// ... existing enemy check ...
```

3. Modify `advanceTurn()` to decrement defense turns:
```typescript
// At end of turn cycle (when nextIndex wraps to 0)
if (nextIndex === 0 && newState.defenseObjective?.type === "survive_turns") {
  newState = {
    ...newState,
    defenseObjective: {
      ...newState.defenseObjective,
      turnsRemaining: newState.defenseObjective.turnsRemaining - 1,
    },
  };
}
```

#### Task 2.3: Create Defense Battle Generator
**File:** `src/core/defenseBattleGenerator.ts` (NEW)

Create function to generate defense encounters:
```typescript
export function createDefenseBattle(
  gameState: GameState,
  keyRoomId: string,
  turnsToSurvive: number,
  encounterSeed: string
): BattleState
```

Features:
- Generates stronger enemy waves than normal battles
- Sets `defenseObjective` on battle state
- Uses deterministic seeding

#### Task 2.4: Update Defense Decision Screen to Start Battle
**File:** `src/ui/screens/DefenseDecisionScreen.ts`

Change `handleDefenseDecision("defend")` to:
1. Call `prepareDefenseBattle()` in campaign manager
2. Create battle from defense encounter
3. Navigate to `BattleScreen`

#### Task 2.5: Create Defense Battle Preparation
**File:** `src/core/campaignManager.ts`

Add function:
```typescript
export function prepareDefenseBattle(keyRoomId: string): CampaignProgress
```

This should:
- Generate defense encounter using seeded RNG
- Store in `pendingDefenseBattle`
- Clear `pendingDefenseDecision`

#### Task 2.6: Update BattleScreen for Defense Objectives
**File:** `src/ui/screens/BattleScreen.ts`

Add:
- Defense objective display: "SURVIVE X TURNS REMAINING"
- Visual indicator when defense is active
- Victory handling for defense completion

---

### Part 3: Fix Determinism in Key Room Attacks

#### Task 3.1: Make Attack Roll Deterministic
**File:** `src/core/keyRoomSystem.ts`

Change `rollKeyRoomAttack()` to use seeded RNG:
```typescript
export function rollKeyRoomAttack(): CampaignProgress | null {
  const activeRun = getActiveRun();
  if (!activeRun) return null;

  // Use seeded RNG based on run seed + nodes cleared
  const attackSeed = `${activeRun.rngSeed}_attack_${activeRun.nodesCleared}`;
  const rng = createSeededRNG(attackSeed);

  // ... rest of function using rng.nextFloat() instead of Math.random() ...
}
```

---

### Part 4: Handle Battle Victory/Defeat Callbacks

#### Task 4.1: Add Key Room Battle Victory Handler
**File:** `src/ui/screens/BattleScreen.ts` or new handler file

After key room capture battle victory:
1. Check `window.__isKeyRoomCapture` flag
2. Navigate to `FacilitySelectionScreen`
3. Clear flags

After defense battle victory:
1. Check if `defenseObjective` was present
2. Call `clearDefenseBattle()` in keyRoomSystem
3. Navigate back to OperationMapScreen

#### Task 4.2: Update Victory Screen Flow
**File:** `src/ui/screens/RewardScreen.ts` or battle victory handler

Add routing logic:
```typescript
if (window.__isKeyRoomCapture) {
  // Show facility selection after key room capture
  renderFacilitySelectionScreen(window.__keyRoomNodeId);
} else if (window.__isDefenseBattle) {
  // Handle defense victory
  clearDefenseBattle(window.__defenseKeyRoomId);
  renderOperationMapScreen();
} else {
  // Normal battle victory
  markRoomVisited(...);
  renderOperationMapScreen();
}
```

---

### Part 5: Persistence & Save System Integration

#### Task 5.1: Ensure All State is Persisted
**File:** `src/core/campaign.ts`

Verify `ActiveRunState` includes all necessary fields:
- `keyRoomsByFloor` ✓ (exists)
- `pendingDefenseDecision` ✓ (exists)
- `pendingDefenseBattle` (add - Task 2.1)

The campaign progress is already saved via `saveCampaignProgress()` after every state change.

#### Task 5.2: Test Retry Safety
Verify that on battle loss:
1. `pendingBattle` is preserved (for normal/key room battles)
2. `pendingDefenseBattle` is preserved (for defense battles)
3. No regeneration of node maps or attack rolls

---

### Part 6: UI Polish

#### Task 6.1: Add Key Room Status to Map
**File:** `src/ui/screens/OperationMapScreen.ts`

Show captured key room status on the floor map:
- Icon overlay for captured rooms
- Facility type indicator
- "Under Attack" warning indicator

#### Task 6.2: Add Defense Objective UI to Battle
**File:** `src/ui/screens/BattleScreen.ts`

Add prominent display:
```html
<div class="defense-objective">
  <div class="defense-title">DEFEND THE FACILITY</div>
  <div class="defense-turns">SURVIVE: {turnsRemaining} TURNS</div>
</div>
```

#### Task 6.3: Add Key Room Resource Preview
**File:** `src/ui/screens/OperationMapScreen.ts`

Show accumulated resources in control panel:
```html
<div class="key-room-summary">
  <div class="key-room-count">Captured: 2 Key Rooms</div>
  <div class="key-room-resources">Stored: 50 WAD, 20 Metal Scrap...</div>
</div>
```

---

## Implementation Order (Recommended)

### Phase 1: Core Defense Battle Mechanics
1. Task 2.1 - Add defense battle state types
2. Task 2.2 - Add survive-X-turns win condition
3. Task 2.3 - Create defense battle generator
4. Task 2.5 - Add campaign manager function

### Phase 2: UI Integration
5. Task 2.4 - Update DefenseDecisionScreen
6. Task 2.6 - Update BattleScreen for defense
7. Task 4.1 - Add battle victory handlers
8. Task 4.2 - Update victory screen flow

### Phase 3: Determinism Fixes
9. Task 3.1 - Make attack roll deterministic

### Phase 4: Polish
10. Task 6.1 - Map key room status
11. Task 6.2 - Defense objective UI
12. Task 6.3 - Resource preview

### Phase 5: Testing & Verification
13. Task 5.1 - Verify persistence
14. Task 5.2 - Test retry safety

---

## Acceptance Criteria Checklist

- [ ] Floor maps generate with branching directed paths (already works)
- [ ] Forward-only movement enforced (already works via `getAvailableNextNodes`)
- [ ] 2 key rooms per floor (already works)
- [ ] Facility selection after capture (already works)
- [ ] Resource generation after room cleared (already works)
- [ ] Attack roll on key rooms (already works, needs determinism fix)
- [ ] Defend/Delay/Abandon UI (already works)
- [ ] **Defense battle with survive-X-turns** (needs implementation)
- [ ] **Defense battle victory clears attack** (needs implementation)
- [ ] **Deterministic attack rolls** (needs fix)
- [ ] State persists through save/load (should work, needs verification)
- [ ] Retry-safe (no regeneration) (should work, needs verification)
- [ ] Floor completion grants stored resources (already works)

---

## Files to Create/Modify

### New Files:
- `src/core/defenseBattleGenerator.ts` - Defense encounter generation

### Files to Modify:
- `src/core/campaign.ts` - Add `pendingDefenseBattle` type
- `src/core/battle.ts` - Add `defenseObjective`, modify win condition
- `src/core/keyRoomSystem.ts` - Fix RNG determinism
- `src/core/campaignManager.ts` - Add `prepareDefenseBattle()`
- `src/ui/screens/DefenseDecisionScreen.ts` - Trigger actual battle
- `src/ui/screens/BattleScreen.ts` - Display defense objective, handle victory
- `src/ui/screens/OperationMapScreen.ts` - Show key room status

---

## Risk Assessment

**Low Risk:**
- Node map generation (already working well)
- Key room capture flow (already working)
- Facility selection (already working)

**Medium Risk:**
- Defense battle win condition (new logic in critical battle system)
- Battle victory routing (multiple code paths to handle)

**Mitigation:**
- Thorough testing of defense battle flow
- Ensure existing battle flow unaffected
- Add clear logging for debugging
