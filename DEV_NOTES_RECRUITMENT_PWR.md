# Development Notes: Unit Recruitment + Unit Performance Systems

## Overview
Implementation of the Unit Recruitment and Unit Performance (PWR & Affinity) systems as described in the GDD insert.

## Implementation Summary

### 1. Data Model Extensions

**Files Modified:**
- `src/core/types.ts`

**Changes:**
- Added `pwr?: number` field to `Unit` interface
- Added `affinities?: UnitAffinities` field to `Unit` interface
- Added `UnitAffinities` interface with 6 affinity types (Melee, Ranged, Magic, Support, Mobility, Survival)
- Added `RecruitmentCandidate` interface for candidate units
- Added `GUILD_ROSTER_LIMITS` constants (MAX_ACTIVE_PARTY: 10, MAX_TOTAL_MEMBERS: 30)
- Added `recruitmentCandidates?: RecruitmentCandidate[]` to `GameState`

### 2. PWR Calculation System

**Files Created:**
- `src/core/pwr.ts`

**Key Functions:**
- `calculatePWR(input: PWRCalculationInput): number` - Main PWR calculation
- `getPWRBand(pwr: number): PWRBand` - Returns band label (Rookie/Standard/Veteran/Elite/Paragon)
- `getPWRBandColor(pwr: number): string` - Returns color for UI display
- `updateUnitPWR(unitId, state, unitClassProgress)` - Updates PWR for a unit

**PWR Formula:**
- Base Stats: 40% weight (HP, ATK, DEF, AGI, ACC normalized)
- Class Ranks: 25% weight (sum of all class ranks)
- Gear Tier: 20% weight (equipment stat bonuses)
- Cards/Effects: 10% weight (number of equipped cards)
- Promotions: 5% weight (class tier bonus)

**PWR Bands:**
- Rookie: 0-50
- Standard: 51-100
- Veteran: 101-150
- Elite: 151-200
- Paragon: 201+

### 3. Affinity Tracking System

**Files Created:**
- `src/core/affinity.ts`
- `src/core/affinityBattle.ts`

**Key Functions:**
- `createDefaultAffinities(): UnitAffinities` - Creates empty affinities
- `recordMeleeAttack(unitId, state)` - Tracks melee attacks
- `recordRangedSkill(unitId, state)` - Tracks ranged skills
- `recordMagicSpell(unitId, state)` - Tracks magic spells
- `recordSupportAction(unitId, state)` - Tracks buffs/heals/shields
- `recordMobilityAction(unitId, state)` - Tracks movement/mobility skills
- `recordSurvival(unitId, damageTaken, operationCompleted, state)` - Tracks survival

**Affinity Gains:**
- Melee: +2 per attack
- Ranged: +2 per skill
- Magic: +2 per spell
- Support: +2 per action
- Mobility: +1 per action
- Survival: +5 per operation completed, +1 per 10 damage taken

**Integration Points:**
- `src/core/battle.ts` - `attackUnit()` tracks melee attacks
- `src/core/cardHandler.ts` - Card plays track appropriate affinities based on card type
- `src/ui/screens/BattleScreen.ts` - Survival tracking on battle victory

### 4. Recruitment System

**Files Created:**
- `src/core/recruitment.ts`
- `src/ui/screens/RecruitmentScreen.ts`

**Key Functions:**
- `generateCandidates(hub, existingRosterSize)` - Generates 3-6 candidates
- `hireCandidate(candidateId, candidates, state)` - Converts candidate to unit and adds to roster
- `getRosterSize(state)` - Returns current roster size
- `isRosterFull(state)` - Checks if roster is at capacity

**Candidate Generation:**
- Archetypes: Rookie, Standard, Veteran, Rare
- Base Camp: Better odds for higher tiers
- Operation Nodes: Limited pool, mostly Standard/Rookie
- Each candidate has: Name, Class, Stats, PWR, Affinities, Contract Cost, Traits

**Recruitment Flow:**
1. Player opens Tavern (Base Camp or Operation Node)
2. System generates candidate pool (3-6 candidates)
3. Player views candidates with stats, PWR, affinities, cost
4. Player hires candidates (if roster not full and has enough WAD)
5. Candidate converted to unit and added to roster

**Roster Limits:**
- Cannot recruit if roster is at 30/30 members
- Active Party can have up to 10 units
- Total Guild Members: 30 (Active Party + Reserves + Dispatched)

### 5. UI Integration

**Files Modified:**
- `src/ui/screens/BaseCampScreen.ts` - Added Tavern button
- `src/ui/screens/RosterScreen.ts` - Added PWR badges
- `src/ui/screens/UnitDetailScreen.ts` - Added PWR display
- `src/styles.css` - Added recruitment screen styles

**PWR Display:**
- Roster screen: Shows PWR value and band next to unit name
- Unit detail screen: Shows PWR in header with color-coded band
- Color coding matches PWR bands (Rookie=gray, Standard=green, Veteran=blue, Elite=purple, Paragon=yellow)

### 6. Initial State Updates

**Files Modified:**
- `src/core/initialState.ts`

**Changes:**
- Starter units now have `pwr` calculated on creation
- Starter units have default empty `affinities`
- `recruitmentCandidates` initialized as `undefined` (generated when Tavern opens)

## Future Extensibility

### Expeditions (Not Implemented)
- Interface ready for expedition system
- PWR and affinities can be used as inputs to expedition success calculations
- TODO stubs in recruitment service for expedition-related candidate generation

### Affinity Effects (Partially Implemented)
- Affinity tracking is fully implemented
- Affinity-based class grid discounts: **TODO** (requires class grid system extension)
- Affinity-based class unlock requirements: **TODO** (requires class unlock system extension)

**To Add Affinity Discounts:**
1. Extend class grid node definitions with `affinityDiscounts` array
2. Use `getAffinityDiscount()` from `affinity.ts` when calculating node costs
3. Display discount in class grid UI

**To Add Affinity Requirements:**
1. Extend `UnlockCondition` in `classes.ts` to include affinity thresholds
2. Update `isClassUnlocked()` to check affinity requirements
3. Display requirements in class unlock UI

## Testing Notes

**Manual Testing:**
1. Open Base Camp → Tavern → Verify candidates generate
2. Hire a candidate → Verify unit added to roster, WAD deducted
3. Try to hire when roster is full → Verify error message
4. Complete a battle → Verify affinities increment
5. Check roster → Verify PWR displays correctly
6. Check unit detail → Verify PWR and affinities display

**Known Limitations:**
- Affinity tracking for card types uses simple keyword matching (may need refinement)
- PWR calculation uses estimates for deck size (could be more accurate)
- Class grid discounts and affinity requirements not yet implemented
- Expedition system not implemented (future work)

## File Structure

```
src/
├── core/
│   ├── types.ts (extended)
│   ├── pwr.ts (new)
│   ├── affinity.ts (new)
│   ├── affinityBattle.ts (new)
│   ├── recruitment.ts (new)
│   └── initialState.ts (extended)
├── ui/screens/
│   ├── BaseCampScreen.ts (extended)
│   ├── RecruitmentScreen.ts (new)
│   ├── RosterScreen.ts (extended)
│   └── UnitDetailScreen.ts (extended)
└── styles.css (extended)
```

## Next Steps

1. **Affinity-Based Class Grid Discounts:**
   - Extend class grid node definitions
   - Integrate discount calculation
   - Update UI to show discounts

2. **Affinity-Based Class Unlocks:**
   - Extend unlock condition system
   - Add affinity checks to unlock logic
   - Update UI to show requirements

3. **Expedition System:**
   - Design expedition data structures
   - Implement expedition success calculations using PWR/affinities
   - Create expedition UI

4. **Testing & Polish:**
   - Add unit tests for PWR calculation
   - Add unit tests for affinity tracking
   - Refine affinity detection for card types
   - Add more candidate name variations


