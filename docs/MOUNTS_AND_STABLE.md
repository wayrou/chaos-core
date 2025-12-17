# Mounts and Stable System

## Overview

The Mounts and Stable system allows players to assign mounts to units, providing movement bonuses and mount-specific combat cards. Mounts have condition that degrades with use and can be repaired at the Stable.

## Unlocking the Stable

### Default Unlock
- **Stable unlocks** after completing Operation 2 (op_black_spire)
- Check campaign progress: `completedOperations` includes `"op_black_spire"`

### Debug Unlock (Testing)
- Set `DEBUG_STABLE_UNLOCK = true` in `src/core/mountSystem.ts` (line ~30)
- Or manually unlock via console:
  ```javascript
  import { unlockStable } from "./core/mountSystem";
  unlockStable();
  ```

## Mount Classes and Unlocks

### Light Mounts
- **Unlock**: When Stable unlocks
- **Examples**: Light Steed, Light Runner
- **Cards**: Light Charge, Light Retreat

### Heavy Mounts
- **Unlock**: After completing Operation 3 (op_ghost_run)
- **Examples**: Heavy Charger, Warhorse
- **Cards**: Heavy Trample, Heavy Charge

### Support Mounts
- **Unlock**: After capturing a Medical Ward controlled room
- **Examples**: Support Pack, Medic Mount
- **Cards**: Support Aid, Supply

## Mount Management

### Assigning Mounts
1. Go to Base Camp → Stable
2. Select a unit from "UNIT ASSIGNMENTS"
3. Choose a mount from the dropdown (only available mounts with condition > 0)
4. Mount is now assigned to that unit

### Mount Condition
- **Range**: 0-100%
- **At 0%**: Mount cannot be used until repaired
- **Low condition** (< 50%): Increased forced dismount chance
- **Condition loss**:
  - 1 point per 5 damage taken (minimum 1 point)
  - 5 points on forced dismount

### Repairing Mounts
1. Go to Stable
2. Find mount in "MOUNT INVENTORY"
3. Click "REPAIR" button
4. Cost: 5 Metal Scrap per 10 condition points needed
5. Example: Repairing from 50% to 100% costs 25 Metal Scrap

## Mount Gear

Each mount has 1-2 gear slots (varies by mount class).

### Available Gear
- **Reinforced Saddle**: Reduces condition loss by 20%
- **Sturdy Stirrups**: Reduces forced dismount chance by 15%
- **Light Barding**: Reduces condition loss by 10%, reduces dismount chance by 10%
- **Medical Pack**: Reduces condition loss by 15% (Support mounts only)

### Equipping Gear
1. Go to Stable
2. Find mount in "MOUNT INVENTORY"
3. Select gear from dropdown (if slots available)
4. Gear effects apply immediately

## Battle Integration

### Grid Size Gating
Mounts are only usable on larger grids:

**Allowed Grids:**
- 6×4
- 6×5
- 8×6
- Any grid with area ≥ 24

**Forbidden Grids:**
- 4×3
- 5×4
- Any grid flagged "Confined/Interior"

### Auto-Dismount
- If battle occurs on a forbidden grid and unit has a mount equipped:
  - Unit auto-dismounts before battle
  - **No condition penalty**
  - Mount cards do not appear in deck

### Mount Cards in Battle
- When mounted on an allowed grid:
  - Mount-specific cards are injected into unit's deck
  - Cards appear in hand/draw pile as normal
  - Cards are removed if unit is forcibly dismounted mid-battle

### Forced Dismount
- **Chance increases** as condition decreases:
  - 75%+ condition: 0% chance
  - 50% condition: ~12.5% chance
  - 25% condition: ~18.75% chance
  - 0% condition: 100% chance (but mount unusable)
- **Gear resistance**: Reduces forced dismount chance
- **On forced dismount**:
  - Mount loses 5 condition points
  - Mount cards removed from deck immediately
  - Unit continues battle on foot

## Forward Stable (Controlled Room)

### Unlocking
- Forward Stable becomes available as a controlled room type **after Stable is unlocked**
- Capture a Key Room and select "Forward Stable" as the facility type

### Benefits
- **Condition Loss Reduction**: 25% reduction in mount condition loss during operation
- **Limited Repairs**: Allows mount repair during operation (implementation pending)
- **Improved Reliability**: Mounts more reliable deeper into dungeon

### Upkeep
- **Base Upkeep**: 3 Metal Scrap, 8 WAD per time step
- **Threat Increase**: +4 per time step

## Testing Steps

### 1. Unlock Stable
- Complete Operation 2, OR
- Set debug flag `DEBUG_STABLE_UNLOCK = true` in `mountSystem.ts`
- Verify: Stable button appears in Base Camp

### 2. Assign Mount to Unit
- Go to Stable
- Select a unit
- Choose a mount from dropdown
- Verify: Unit shows mount assignment

### 3. Test Grid Gating - Large Grid
- Assign mount to unit
- Start battle on 6×4 or larger grid
- Verify: Unit starts mounted, mount cards appear in deck/hand

### 4. Test Grid Gating - Small Grid
- Assign mount to unit
- Start battle on 4×3 or 5×4 grid
- Verify: Unit auto-dismounts, no mount cards, no condition penalty

### 5. Test Condition Loss
- Assign mount to unit (100% condition)
- Start battle on large grid
- Take significant damage (e.g., 20+ damage)
- Verify: Mount condition decreases (check console logs: `[MOUNT] Condition -X due to damage`)

### 6. Test Forced Dismount
- Lower mount condition to < 50% (via damage or manual edit)
- Start battle on large grid
- Take damage
- Verify: Chance of forced dismount, mount cards removed if dismounted

### 7. Test Repair
- Lower mount condition (e.g., to 50%)
- Go to Stable
- Click "REPAIR" on mount
- Verify: Condition restored to 100%, Metal Scrap deducted

### 8. Test Support Mount Unlock
- Capture a Medical Ward controlled room
- Verify: Support mounts become available in Stable dropdown
- Check console: `[MOUNT] Support mounts unlocked (Medical Ward captured)`

### 9. Test Forward Stable
- Unlock Stable
- Capture a Key Room
- Select "Forward Stable" as facility type
- Verify: Forward Stable appears in Controlled Rooms window
- Start battle with mounted unit
- Take damage
- Verify: Condition loss is reduced (check console: `[reduction: X% from Forward Stable]`)

### 10. Test Mount Gear
- Go to Stable
- Find mount with available gear slots
- Equip gear (e.g., Reinforced Saddle)
- Start battle, take damage
- Verify: Condition loss is reduced (check console logs for gear reduction)

## Console Logging

The mount system logs important events to console:

- `[MOUNT] Stable unlocked`
- `[MOUNT] {unit} mounted on {mount} - injected {N} cards`
- `[MOUNT] {unit} auto-dismounted: grid {W}x{H} too small`
- `[MOUNT] Condition -{X} due to damage ({old}% -> {new}%)`
- `[MOUNT] Forced dismount roll: chance={X}% roll={Y}% -> DISMOUNTED/STAY MOUNTED`
- `[MOUNT] Support mounts unlocked (Medical Ward captured)`

## Data Model

### Mount Instance
```typescript
{
  id: "mount_light_steed",
  condition: 85,
  gear: ["mount_gear_saddle"]
}
```

### Unit Mount Assignment
```typescript
{
  equippedMountId: "mount_light_steed"
}
```

### Battle Unit State
```typescript
{
  equippedMountId: "mount_light_steed",
  isMounted: true  // Only true if grid allows and condition > 0
}
```

## Known Issues / Future Work

- Forward Stable limited repair feature not yet implemented
- Mount gear UI could be improved (remove gear button)
- Mount cards need proper card handler integration for move effects
- Support mount unlock check runs on every room capture (could be optimized)

