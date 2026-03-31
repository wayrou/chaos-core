# Supply Chain System v1

## Overview

The Supply Chain system manages supply flow through dungeon floors, allowing enemies to attack supply links and requiring players to manage supply priority profiles.

## Core Concepts

### Sources, Links, Sinks

- **Sources**: Start node provides baseline supply power (100 units). Forward Command Posts (if secured) contribute additional source power.
- **Links**: Existing dungeon graph edges. Each edge has:
  - `integrity` (0-100): Affects bandwidth multiplier
  - `lastAttackedStep`: When the link was last attacked
  - `isThreatened`: UI flag for damaged links (< 50 integrity)
- **Sinks**: Demand increases with each cleared room (10 units per room).

### Supply Flow Computation

Flow is computed using a forward propagation algorithm:

1. **Build depth map**: BFS from start node assigns depth to each node
2. **Propagate supply**: Starting from sources, distribute supply potential forward
3. **Apply profile weights**: Each profile modifies how flow splits at branches
4. **Apply decay**: Flow decays by 15% per depth level
5. **Apply integrity**: Final flow = base flow * (integrity / 100)

### Supply Priority Profiles

- **Balanced**: Equal split across all branches
- **Forward Push**: Bias toward deeper nodes (main path) - weight 0.5 to 2.0 based on depth ratio
- **Defensive Hold**: Bias toward key rooms (2.0x weight) vs normal nodes (0.8x)
- **Consolidation**: Bias toward nodes with fewer outgoing connections (reduces flow to dead-ends)

### Link Attack System

After each room clear:
- Attack chance: `baseChance * depthMultiplier * stepMultiplier` (capped at 60%)
- Base chance: 15%
- Depth multiplier: 1 + (floorIndex * 0.1)
- Step multiplier: 1 + (supplyStep * 0.05)

Attack selection:
- Weighted by flow (higher flow = more likely target)
- Damage: 10-25 points (random, deterministic via RNG seed)

Determinism:
- Uses `operationSeed + supplyStep` for RNG
- Same seed/step → same link attacked, same damage

### Supply Health Tiers

- **Stable**: totalFlow >= demand
- **Strained**: totalFlow >= demand * 0.7
- **Critical**: totalFlow < demand * 0.7

Effects (v1 minimal):
- Strained: Slightly increases link attack chance
- Critical: Further increases link attack chance, shows prominent warning

## Testing

### Quick Test Steps

1. **Start an operation** - Supply state initializes automatically
2. **Enable Supply Overlay** - Click "OVERLAY OFF" button in Supply Chain panel
3. **Clear a room** - Supply step advances, link attacks may occur
4. **Change profile** - Select different profile from dropdown, observe flow changes
5. **Check warnings** - Clear many rooms to trigger Strained/Critical status

### Expected Behavior

- All edges should show with thickness proportional to flow when overlay is ON
- Damaged links (< 60 integrity) show orange dashed lines
- Critical links (< 30 integrity) show red dashed lines with pulse animation
- High flow edges (> 40) show green glow
- Profile changes immediately update flow distribution
- Link attacks occur deterministically (same seed/step = same result)

### Debugging

- Check browser console for `[SUPPLY]` logs
- Supply state is stored on `operation.supplyState`
- Flow cache is in `supplyState.flowCache`
- Edge integrity is in `supplyState.edgeState[edgeId].integrity`
