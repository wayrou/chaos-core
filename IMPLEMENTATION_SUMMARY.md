# Implementation Summary - Features 15a-15e

## Completed Features

### 15a) Auto-battle toggle per friendly unit ✅
- Added `autoBattle: boolean` field to `BattleUnitState` interface
- Added toggle button in unit panel: "AUTO: ON/OFF"
- Implemented `performAutoBattleTurn()` function in `src/core/battle.ts`
- Auto-battle logic: scores cards, prefers attack cards targeting enemies, moves toward nearest enemy if no playable card
- Auto-battle triggers when unit becomes active and `autoBattle === true`
- Delay of 250ms to allow UI to update first

### 15b) Support >2 units per side + party-based placement selection ✅
- Updated grid size calculation: random between 4x3 and 8x6 (was 6x6 to 12x12)
- Max deploy formula: `clamp(floor(gridArea * 0.25), 3, 10)` (already existed, documented)
- Updated placement UI to show full party list with selection
- Added `removePlacedUnit()` and `setPlacementSelectedUnit()` functions
- Placement UI shows all party units with "PLACED" or "AVAILABLE" status
- Click unit in list to select, then click tile to place
- Click placed unit on grid to remove it

### 15c) Deck reshuffle when deck can't draw a full hand ✅
- Updated `drawCardsForTurn()` to reshuffle when `deck.length < handSize` (not just when empty)
- Reshuffles discard into deck before drawing
- Logs debug message when reshuffle happens

### 15d) Auto-equip gear per unit in unit management screen ✅
- Added "AUTO EQUIP" button in unit detail screen equipment section
- Implemented `autoEquipUnit()` function
- Scoring: `ATK*3 + DEF*2 + AGI*1 + ACC*1`
- Respects weapon type restrictions per class
- Fills slots in priority: weapon → helmet → chestpiece → accessories

### 15e) Card visuals: paper / computer punch-card aesthetic ✅
- Updated `.battle-cardui` CSS with:
  - Paper texture gradient overlay
  - Subtle dot-matrix pattern
  - Punch holes along left edge (using `::before` pseudo-element)
  - Text shadow for dot-matrix text effect
  - Inset border for ink bleed effect

## Files Modified

1. `src/core/battle.ts`
   - Added `autoBattle` field to `BattleUnitState`
   - Added `DEBUG_BATTLE` constant
   - Updated `drawCardsForTurn()` for reshuffle logic
   - Updated grid size calculation (4x3 to 8x6)
   - Added `performAutoBattleTurn()` function
   - Added `removePlacedUnit()` and `setPlacementSelectedUnit()` functions

2. `src/ui/screens/BattleScreen.ts`
   - Added auto-battle toggle button in `renderUnitPanel()`
   - Added auto-battle toggle handler in `attachBattleListeners()`
   - Added auto-battle check when unit becomes active
   - Updated `renderPlacementUI()` to show full party list
   - Updated placement click handler for selection and removal
   - Imported new functions from battle.ts

3. `src/ui/screens/UnitDetailScreen.ts`
   - Added "AUTO EQUIP" button in equipment section
   - Added `autoEquipUnit()` function
   - Imported `CLASS_WEAPON_RESTRICTIONS`

4. `src/styles.css`
   - Updated `.battle-cardui` with punch-card aesthetic
   - Added `.battle-cardui::before` for punch holes
   - Updated `.card-name` with text shadow effect

## How to Test

1. **Auto-battle (15a)**:
   - Start a battle
   - Click "AUTO: OFF" button for a friendly unit → should toggle to "ON"
   - When that unit's turn comes, it should automatically take actions
   - Verify it plays cards or moves toward enemies

2. **>2 units per side (15b)**:
   - Start battles multiple times, verify grid sizes vary between 4x3 and 8x6
   - In placement phase, verify party list shows all units
   - Click a unit in the list, then click a placement tile → unit should place
   - Click a placed unit on grid → should remove it
   - Verify max deploy count matches formula

3. **Deck reshuffle (15c)**:
   - Play cards until deck has <5 cards
   - End turn → should reshuffle discard into deck before drawing
   - Check console for "RESHUFFLE" debug message

4. **Auto-equip (15d)**:
   - Go to unit detail screen
   - Click "AUTO EQUIP" button
   - Verify gear is equipped based on scoring (ATK*3 + DEF*2 + AGI*1 + ACC*1)
   - Verify weapon type restrictions are respected

5. **Card visuals (15e)**:
   - View cards in battle hand
   - Verify cards have:
     - Paper texture appearance
     - Punch holes along left edge
     - Dot-matrix text effect
     - Subtle ink bleed effect

## Notes

- Auto-battle logic is simplified and may need refinement for better card selection
- Placement UI selection state is stored in `placementState.selectedUnitId`
- Auto-equip respects class weapon restrictions
- Card CSS punch-card aesthetic is subtle to maintain readability



