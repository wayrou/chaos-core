# Quest System - Developer Notes

## Overview

The Quest System provides a data-driven quest board where players can accept, track, and complete quests for rewards. Quests integrate with existing gameplay systems (battles, resource collection, node clearing) to track progress automatically.

## Architecture

The Quest System is organized in `src/quests/`:

- **types.ts** - Type definitions for quests, objectives, rewards, and quest state
- **questData.ts** - Quest database with all available quest definitions
- **questManager.ts** - Quest state management (accept, update progress, complete)
- **questRewards.ts** - Reward payout system

## Quest Data Model

### Quest Structure

```typescript
interface Quest {
  id: QuestId;
  title: string;
  description: string;
  questType: "hunt" | "escort" | "exploration" | "delivery" | "collection" | "clear";
  difficultyTier: 1 | 2 | 3 | 4 | 5;
  objectives: QuestObjective[];
  rewards: QuestReward;
  status: "available" | "active" | "completed" | "failed";
}
```

### Objective Types

- `kill_enemies` - Defeat X enemies in battle
- `kill_specific_enemy` - Defeat a specific enemy type (e.g., "boss")
- `clear_node` - Clear a specific node or floor
- `collect_item` - Collect X items
- `collect_resource` - Collect X of a resource type (metalScrap, wood, etc.)
- `reach_location` - Reach a specific location
- `talk_to_npc` - Interact with an NPC
- `complete_battle` - Complete X battles
- `spend_wad` - Spend X WAD
- `craft_item` - Craft X items

### Reward Types

- `wad` - Currency reward
- `xp` - Experience points (distributed to party)
- `resources` - Metal Scrap, Wood, Chaos Shards, Steam Components
- `items` - Consumables or other items
- `cards` - Card IDs to add to library
- `equipment` - Equipment IDs (TODO: integrate with equipment system)
- `unitRecruit` - Unit ID to recruit (TODO: integrate with recruitment)

## How to Use

### Accessing the Quest Board

1. **From Field Mode**: Walk to the Quest Board station in Base Camp and press E
2. **From Base Camp Screen**: (TODO: Add button if needed)

### Accepting Quests

1. Open Quest Board
2. Navigate to "Available" tab
3. Click "ACCEPT QUEST" on any quest
4. Quest moves to "Active" tab and starts tracking progress

### Quest Progress

Quest progress updates automatically when:
- **Battles are won**: Updates `kill_enemies` and `complete_battle` objectives
- **Resources are collected**: Updates `collect_resource` objectives
- **Nodes are cleared**: Updates `clear_node` objectives (TODO: integrate with operation map)

### Completing Quests

When all objectives are complete:
- Quest automatically moves to "Completed" status
- Rewards are granted immediately
- Quest is removed from active list

## Adding New Quests

Edit `src/quests/questData.ts`:

```typescript
export const QUEST_DATABASE: Record<string, Quest> = {
  quest_my_new_quest: {
    id: "quest_my_new_quest",
    title: "My New Quest",
    description: "Do something interesting.",
    questType: "hunt",
    difficultyTier: 2,
    objectives: [
      {
        id: "obj_kill",
        type: "kill_enemies",
        target: 5,
        current: 0,
        required: 5,
        description: "Defeat 5 enemies",
      },
    ],
    rewards: {
      wad: 100,
      xp: 200,
    },
    status: "available",
  },
};
```

## Integrating Quest Progress Updates

### Battle Completion

Quest progress is automatically updated in `BattleScreen.ts` when rewards are claimed:
- Enemy kills → `updateQuestProgress("kill_enemies", count, count)`
- Resource collection → `updateQuestProgress("collect_resource", resourceType, amount)`

### Manual Updates

To update quest progress from other systems:

```typescript
import { updateQuestProgress } from "../quests/questManager";

// Update kill count
updateQuestProgress("kill_enemies", 1, 1);

// Update resource collection
updateQuestProgress("collect_resource", "metalScrap", 5);

// Update node clearing
updateQuestProgress("clear_node", "floor_1", 1);
```

## Save/Load

Quest state is automatically saved and loaded with game state:
- Active quests and their progress
- Completed quest IDs
- Failed quest IDs

The quest state is stored in `GameState.quests`.

## Configuration

Edit `src/quests/questManager.ts`:
- `MAX_ACTIVE_QUESTS` - Maximum number of active quests (default: 5)

## Future Enhancements

- **Quest UI Overlay**: Show active quests in a HUD overlay during gameplay
- **Quest Refresh**: Automatic quest refresh system (per run, per day, etc.)
- **Quest Chains**: Sequential quests that unlock after completion
- **Daily/Weekly Quests**: Time-limited quests
- **Quest Givers**: NPCs that provide quests
- **Quest Difficulty Scaling**: Dynamic reward scaling based on player level
- **Unit XP Integration**: Properly integrate XP rewards with unit leveling system
- **Equipment Rewards**: Integrate equipment rewards with equipment system
- **Unit Recruitment**: Integrate unit recruitment rewards

## Troubleshooting

### Quest not updating progress
- Check that `updateQuestProgress` is being called with correct objective type and target
- Verify quest is in "active" status
- Check console for quest manager logs

### Quest not completing
- Verify all objectives have `current >= required`
- Check that `completeQuest` is being called in `questManager.ts`

### Rewards not granted
- Check `grantQuestRewards` function in `questRewards.ts`
- Verify reward types are supported
- Check console for reward payout logs

