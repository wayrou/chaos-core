# Controlled Rooms System (Headline 14e)

## Overview

The Controlled Rooms system provides **persistent room control across floors within an operation**. Unlike Key Rooms (which only persist within a single floor), Controlled Rooms remain accessible throughout the entire operation, allowing players to build fortifications, manage threat levels, and gain strategic benefits across multiple floors.

## Purpose

- Establish persistent strategic positions across an operation
- Build and upgrade fortifications over time
- Manage threat levels and defend against attacks
- Gain distance-penalized benefits (resources, healing, combat bonuses)
- Create a "base-building lite" layer within roguelike operations

## Key Differences from Key Rooms

| Feature | Key Rooms | Controlled Rooms |
|---------|-----------|------------------|
| **Persistence** | Single floor only | Entire operation |
| **Benefits** | Resources at floor end | Continuous benefits with distance penalty |
| **Attacks** | Random chance per room clear | Time-based threat accumulation |
| **Fortification** | None | Physical upgrades (barricades, turrets, walls, generator) |
| **Field Mode** | No | Yes - visit and build in field mode |
| **Upkeep** | None | Resource cost per time step |

---

## Architecture

### Core Components

1. **`src/core/campaign.ts`** - Data model and types
2. **`src/core/controlledRoomsSystem.ts`** - Core logic and mechanics
3. **`src/core/campaignManager.ts`** - Time step integration
4. **`src/ui/screens/ControlledRoomsWindowScreen.ts`** - Management UI
5. **`src/field/controlledRoomMaps.ts`** - Field map generators
6. **`src/field/controlledRoomFieldMode.ts`** - Field mode entry
7. **`src/field/interactions.ts`** - Fortification handlers

### Data Model

```typescript
export interface ControlledRoomState {
  nodeId: string;              // Room node ID from dungeon map
  floorIndex: number;          // Which floor (0-based)
  roomType: ControlledRoomType; // Facility type
  status: ControlledRoomStatus; // controlled | under_attack | fortifying | lost
  threatLevel: number;         // 0-100, influences attack chance
  fortificationLevel: number;  // 0-3, calculated from upgrades
  upkeepCost: Partial<Record<ResourceType, number>>; // Per-time-step cost
  timeControlled: number;      // How many opTimeSteps held
  lastVisited: number;         // Last opTimeStep player visited
  upgrades: {
    barricades: number;        // 0-3
    turrets: number;           // 0-2
    reinforcedWalls: boolean;
    powerGenerator: boolean;
  };
}
```

---

## Room Types

### 1. Supply Depot
- **Description**: Generates resources continuously. Low threat generation.
- **Base Upkeep**: 2 Metal Scrap, 5 WAD per time step
- **Threat Increase**: +3 per time step
- **Benefit**: Resource bonus (5 Metal Scrap, 10 WAD per room clear)

### 2. Medical Ward
- **Description**: Provides healing between battles. Minimal threat.
- **Base Upkeep**: 8 WAD per time step
- **Threat Increase**: +2 per time step
- **Benefit**: Healing bonus (10% HP per battle)

### 3. Armory
- **Description**: Provides combat bonuses. Moderate threat.
- **Base Upkeep**: 3 Metal Scrap, 10 WAD per time step
- **Threat Increase**: +5 per time step
- **Benefit**: Combat bonus (+5 ATK/DEF)

### 4. Command Center
- **Description**: Reveals map information. Moderate threat.
- **Base Upkeep**: 12 WAD per time step
- **Threat Increase**: +5 per time step
- **Benefit**: Map reveal (additional nodes visible)

### 5. Mine
- **Description**: High resource generation. **HIGH THREAT**.
- **Base Upkeep**: 5 Metal Scrap, 3 Wood, 15 WAD per time step
- **Threat Increase**: +10 per time step
- **Benefit**: High resource bonus (15 Metal Scrap, 10 Wood, 25 WAD)

### 6. Outpost
- **Description**: Generic controlled position. Low upkeep, low threat.
- **Base Upkeep**: 3 WAD per time step
- **Threat Increase**: +2 per time step
- **Benefit**: None (placeholder)

---

## Time Step Mechanics

### What is a Time Step?

`opTimeStep` is a discrete counter that advances whenever:
1. A room is cleared on the dungeon floor map
2. The player advances to the next floor

### Time Step Effects

Every time step advancement triggers:
- **Threat increase** for all controlled rooms (reduced by fortification level)
- **Attack roll** against a random controlled room (weighted by threat)
- **Upkeep cost deduction** (placeholder - not yet implemented)

### Attack Roll Formula

```typescript
attackChance = baseChance + (roomCount * perRoomBonus) + (avgThreat * perThreatPoint)
attackChance = Math.min(attackChance, maxChance)

// Configuration:
baseChance = 0.05 (5%)
perRoomBonus = 0.03 (3% per room)
perThreatPoint = 0.002 (0.2% per threat point)
maxChance = 0.40 (40% cap)
```

**Example**: 3 controlled rooms with average threat of 50:
- Base: 5%
- Rooms: 3 × 3% = 9%
- Threat: 50 × 0.2% = 10%
- **Total**: 24% chance of attack per time step

### Determinism

All attack rolls use seeded RNG: `opSeed + opTimeStep`
- Same seed + same time step = same attack result
- Retry-safe (no scumming)
- Reproducible for testing

---

## Fortification System

### Fortification Level Calculation

| Level | Requirements |
|-------|-------------|
| **0** | No upgrades |
| **1** | 1+ barricade |
| **2** | 2+ barricades, 1+ turret, reinforced walls |
| **3** | 3 barricades, 2 turrets, reinforced walls, power generator |

### Upgrade Costs

| Upgrade | Cost | Effect |
|---------|------|--------|
| **Barricade** (3 slots) | 5 Metal Scrap, 3 Wood | +1 toward fortification level |
| **Turret** (2 slots) | 10 Metal Scrap, 5 Steam Components | Defensive firepower + fort level |
| **Reinforced Walls** | 15 Metal Scrap, 10 Wood | Required for Level 2+ |
| **Power Generator** | 20 Metal Scrap, 10 Steam Components | Required for Level 3 |

### Fortification Benefits

1. **Threat Reduction**: Each fort level reduces threat increase by 2/step
   - Level 0 room with +10 base threat → +10/step
   - Level 3 room with +10 base threat → +4/step (minimum 1)

2. **Defense Battle Difficulty** (future): Higher fort = easier defense

3. **Attack Resistance** (future): Higher fort = lower chance of breach

---

## Distance Penalty Model (Model A)

Benefits from controlled rooms are penalized by floor distance:

| Distance | Multiplier | Example (100 Resource Bonus) |
|----------|-----------|------------------------------|
| **Same floor** | 100% | 100 resources |
| **1 floor away** | 85% | 85 resources |
| **2 floors away** | 70% | 70 resources |
| **3+ floors away** | 0% | No benefit |

**Rationale**: Encourages strategic placement and creates tension between floor progression and benefit retention.

---

## Field Mode Integration

### Entering Field Mode

1. Open Controlled Rooms window from dungeon floor map
2. Click "VISIT (Field Mode)" on a room (only available on current floor)
3. Enters field map specific to room type

### Field Map Layout

Each controlled room type has a unique 16×12 field map with:
- **Visual objects** matching room theme (crates, weapon racks, medical equipment, etc.)
- **9 interaction zones**:
  - 3 barricade build points (top of map)
  - 2 turret install points (bottom sides)
  - 1 wall reinforcement point (center)
  - 1 generator install point (back corner)
  - 1 exit point (bottom center)

### Building Fortifications

1. Walk to interaction zone
2. Press **Space** or **Enter** to interact
3. Confirm dialog shows cost and effect
4. Resources deducted (placeholder)
5. Upgrade applied immediately
6. Fortification level recalculated automatically

### Quick Reinforce Option

Available in Controlled Rooms window (not field mode):
- **Cost**: 5 WAD
- **Effect**: −10 Threat
- **Use case**: Quick threat management without visiting
- **Limitation**: Only available when threat < 30 (not during emergency)

---

## Attack & Defense System

### Attack Trigger

When an attack roll succeeds:
1. Random room selected (weighted by threat level)
2. Room status → `under_attack`
3. Player receives notification (future: interrupts floor progression)
4. Defense decision required

### Defense Options

1. **Defend Now**: Launch defense battle in field mode
2. **Delay Defense**: Room status → `controlled`, threat remains high, −50% output until defended
3. **Abandon**: Remove room from roster permanently

### Defense Battle (Future Implementation)

- Takes place **in the controlled room's field map**
- Enemy waves spawn at breach points
- Survive until waves cleared
- Fortifications affect:
  - Enemy spawn rate
  - Barricade durability
  - Turret AI support
  - Breach point count

---

## Benefits System

### Aggregated Benefits

Benefits are calculated each room clear and applied to:
- **Resource Generation**: Bonus resources granted
- **Healing**: HP restored to party after battles
- **Combat Bonuses**: Temporary buffs applied before battles
- **Map Reveal**: Additional nodes visible on floor map

### Example Calculation

**Setup**:
- Supply Depot on Floor 1 (generates 5 Metal, 10 WAD)
- Player on Floor 2 (1 floor away = 85% multiplier)

**Result**:
- Metal Scrap: `floor(5 * 0.85)` = 4
- WAD: `floor(10 * 0.85)` = 8

### Multiple Rooms

Benefits stack additively:
- Room 1: +10 WAD (100%)
- Room 2: +10 WAD (85%)
- Room 3: +10 WAD (70%)
- **Total**: 25.5 WAD (rounded to 25)

---

## UI Components

### Controlled Rooms Window

**Location**: Dungeon floor map → "🏰 CONTROLLED ROOMS" button

**Features**:
- Summary bar: Total rooms, current floor, time step counter
- Floor-grouped room list
- Distance indicators (100%/85%/70%/No Benefits)
- Room cards showing:
  - Room type, status, threat level (color-coded)
  - Fortification level with icon (🔴 0, 🟠 1, 🟡 2, 🟢 3)
  - Upgrade progress (🛡️ Barricades, 🔫 Turrets, 🧱 Walls, ⚡ Generator)
  - Time controlled counter
- Action buttons:
  - VISIT (Field Mode) - Current floor only
  - DEFEND NOW / DELAY DEFENSE - Under attack only
  - QUICK REINFORCE - Low threat only
  - ABANDON - Always available

### Room Card Status Colors

- **Controlled** (Blue/Teal): Normal operational status
- **Under Attack** (Red, pulsing): Requires immediate attention
- **Fortifying** (Gold): Upgrades in progress (future)
- **Lost** (Grayscale, 50% opacity): Abandoned or fallen

### Threat Level Indicators

- **0-39**: 🟢 Green (Low)
- **40-69**: 🟠 Orange (Medium)
- **70-100**: 🔴 Red (High, blinking)

---

## Testing Procedures

### Quick Test

1. Start new operation from Base Camp
2. Clear first battle → `opTimeStep` = 1
3. (Future) Capture Key Room → Convert to Controlled Room
4. Click "🏰 CONTROLLED ROOMS" → Verify room appears
5. Click "VISIT (Field Mode)" → Enter field map
6. Walk to barricade point → Press Space → Confirm build
7. Exit field mode → Verify fortification level increased
8. Clear another room → `opTimeStep` = 2, threat increased
9. Repeat until attack triggers
10. Verify "DEFEND NOW" and "DELAY DEFENSE" options appear

### Attack Roll Test

```typescript
// In browser console:
import { rollControlledRoomAttack } from "./src/core/controlledRoomsSystem";

// Manually trigger attack (dev only)
rollControlledRoomAttack();
```

### Distance Penalty Test

1. Capture room on Floor 1
2. Advance to Floor 2
3. Clear room → Check resource benefit (should be 85%)
4. Advance to Floor 3
5. Clear room → Check resource benefit (should be 70%)
6. Advance to Floor 4
7. Clear room → Check resource benefit (should be 0%)

### Fortification Calculation Test

1. Controlled room with 0 upgrades → Fort Level 0
2. Build 1 barricade → Fort Level 1
3. Build 2nd barricade + 1 turret + reinforce walls → Fort Level 2
4. Build 3rd barricade + 2nd turret + install generator → Fort Level 3

---

## Implementation Status

### ✅ Completed (v1.0)

**Part A - Data Model & Persistence**:
- ✅ ControlledRoomState types in campaign.ts
- ✅ opTimeStep and opSeed in ActiveRunState
- ✅ Time step advancement in campaignManager.ts
- ✅ Deterministic attack rolls with seeded RNG
- ✅ Distance penalty calculation

**Part B - Management UI**:
- ✅ ControlledRoomsWindowScreen.ts
- ✅ Floor-grouped room display
- ✅ Room cards with status/threat/fort/upgrades
- ✅ Action buttons (Visit/Defend/Delay/Quick Reinforce/Abandon)
- ✅ Empty state message
- ✅ Comprehensive CSS styling

**Part C - Field Mode & Fortifications**:
- ✅ 6 distinct field maps (controlledRoomMaps.ts)
- ✅ Room-specific visual objects
- ✅ 9 interaction zones per map
- ✅ Field mode entry (enterControlledRoomFieldMode)
- ✅ Fortification interaction handlers
- ✅ Auto-calculation of fortification levels
- ✅ Upgrade cost confirmation dialogs
- ✅ Exit back to operation map

### 🚧 Pending (v2.0+)

**Part D - Defense Gameplay**:
- ⏳ Defense battle system in field mode
- ⏳ Enemy wave spawning logic
- ⏳ Fortification effects on defense battles
- ⏳ Breach point mechanics
- ⏳ Victory/defeat handling

**Part E - Resource Integration**:
- ⏳ Resource deduction on upgrades (currently placeholder)
- ⏳ Upkeep cost deduction per time step
- ⏳ Insufficient resource warnings
- ⏳ Resource recovery on abandon

**Part F - Benefits Application**:
- ⏳ Resource bonus application after room clears
- ⏳ Healing bonus application after battles
- ⏳ Combat bonus buffs before battles
- ⏳ Map reveal integration

**Part G - Polish & Features**:
- ⏳ NPC dialogue barks based on room status
- ⏳ Attack notification interrupts
- ⏳ Fortifying animation/status
- ⏳ Room upgrade visual feedback
- ⏳ Stats tracking (total resources generated, defenses won, etc.)

---

## Performance Notes

- Controlled room maps are generated on demand and cached
- Attack rolls only happen after time step advancement (not every frame)
- Field map rendering uses same system as Base Camp (no overhead)
- Distance penalty calculations are O(n) where n = controlled room count (negligible)

---

## Code Style

### Logging Prefix

Use `[CONTROLLEDROOMS]` for all console logs:
```typescript
console.log("[CONTROLLEDROOMS] Captured room supply_depot at node_123");
```

### Function Naming

- **Core system**: `captureRoom()`, `upgradeControlledRoom()`, `rollControlledRoomAttack()`
- **UI handlers**: `handleVisitRoom()`, `handleBuildBarricade()`, `handleAbandonRoom()`
- **Field mode**: `enterControlledRoomFieldMode()`, `clearControlledRoomContext()`

### Guards & Validation

Always validate room existence before operations:
```typescript
const room = getControlledRoom(nodeId);
if (!room) {
  console.error(`[CONTROLLEDROOMS] Room ${nodeId} not found`);
  alert("Room not found!");
  return;
}
```

---

## Common Issues & Debugging

### Issue: Controlled room doesn't appear in window

**Check**:
1. Is `activeRun.controlledRooms` populated?
2. Is room capture function called correctly?
3. Check browser console for `[CONTROLLEDROOMS]` logs

**Fix**: Verify `captureRoom()` was called with correct nodeId and roomType

### Issue: Fortification level not updating after upgrade

**Check**:
1. Was `upgradeControlledRoom()` called successfully?
2. Check `calculateFortificationLevel()` logic
3. Verify upgrade counts in room.upgrades

**Fix**: Fortification level is auto-calculated in `upgradeControlledRoom()` - ensure function completes without errors

### Issue: Field mode not entering

**Check**:
1. Is button only appearing on current floor?
2. Check `enterControlledRoomFieldMode()` logs
3. Verify field map ID exists in types.ts

**Fix**: Ensure room type maps to valid FieldMapId in controlledRoomFieldMode.ts

### Issue: Distance penalty not applying

**Check**:
1. Call `getControlledRoomBenefitMultiplier(roomFloorIndex, currentFloorIndex)`
2. Verify floor indices are correct
3. Check benefits aggregation in `getAggregatedControlledRoomBenefits()`

**Fix**: Distance penalty only applies when benefits are actually granted (future implementation)

---

## Future Enhancements (v3+)

- [ ] Controlled room upgrades persist between operations (unlock system)
- [ ] Room specialization trees (upgrade paths)
- [ ] NPC assignments to rooms (crew management)
- [ ] Room-specific events and incidents
- [ ] Co-op defense battles (2-player)
- [ ] Controlled room leaderboards (total rooms held, longest control time)
- [ ] Visual upgrades on field maps (show built barricades/turrets)
- [ ] Animated defense battles with particle effects
- [ ] Controlled room questline (story integration)

---

**Last Updated**: 2025-12-17
**Version**: 1.0
**Status**: Core implementation complete, defense gameplay pending
**Related Systems**: Key Rooms, Field Mode, Campaign System, Resource Management
**Files**: 7 new files, 5 modified files, ~1900 lines of code
