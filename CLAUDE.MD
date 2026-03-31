# CLAUDE.MD - Chaos Core Project Guide

## Project Overview

**Chaos Core** is a tactical RPG built with Tauri + TypeScript, featuring a card-based combat system with strain mechanics on a tactical grid battlefield. The game draws heavy inspiration from Final Fantasy Tactics Advance while incorporating unique deck-building and equipment customization systems.

## Tech Stack

- **Framework**: Tauri 2.x (Rust backend + TypeScript frontend)
- **Build Tool**: Vite 6.x
- **Language**: TypeScript 5.6.2
- **UI**: Vanilla TypeScript with custom rendering
- **State Management**: Custom game store (`src/state/gameStore.ts`)

## Project Structure

```
chaos-core/
├── src/
│   ├── core/              # Core game logic (state-agnostic)
│   │   ├── battle.ts      # Battle system and turn order
│   │   ├── cardEffects.ts # Card effect implementations
│   │   ├── cardHandler.ts # Card drawing and playing logic
│   │   ├── crafting.ts    # Crafting recipes and system
│   │   ├── equipment.ts   # Equipment definitions and data
│   │   ├── gearWorkbench.ts # Gear customization system
│   │   ├── inventory.ts   # Inventory and capacity management
│   │   ├── ops.ts         # Operation/dungeon definitions
│   │   ├── saveSystem.ts  # Save/load functionality
│   │   ├── settings.ts    # Game settings
│   │   ├── types.ts       # Core TypeScript interfaces
│   │   ├── weaponSystem.ts # Weapon mechanics
│   │   └── workshop.ts    # Workshop/crafting interface
│   ├── state/
│   │   └── gameStore.ts   # Global game state management
│   ├── ui/
│   │   ├── components/    # Reusable UI components
│   │   └── screens/       # Full-screen views
│   │       ├── BaseCampScreen.ts
│   │       ├── BattleScreen.ts
│   │       ├── GearWorkbenchScreen.ts
│   │       ├── InventoryScreen.ts
│   │       ├── MainMenuScreen.ts
│   │       ├── OperationMapScreen.ts
│   │       ├── RosterScreen.ts
│   │       ├── ScrollLinkBoot.ts  # Boot screen
│   │       ├── ScrollLinkShell.ts # Main shell/OS
│   │       ├── SettingsScreen.ts
│   │       ├── ShopScreen.ts
│   │       └── WorkshopScreen.ts
│   └── main.ts            # Entry point
├── src-tauri/             # Rust backend code
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Core Game Systems

### 1. Battle System (`src/core/battle.ts`)
- **Grid-based tactical combat** with customizable battlefield dimensions
- **Turn order system** based on unit AGI stats
- **Card-driven actions** - units play cards to perform actions
- **Strain mechanics** - cards accumulate strain with penalties for exceeding thresholds
- **Win/loss conditions** with rewards (Wad currency + crafting resources)

### 2. Card System (`src/core/cardHandler.ts`, `src/core/cardEffects.ts`)
- Each unit has: deck, draw pile, hand, discard pile
- **Card types**: Attack, Move, Defend, Overcharge, and more
- **Strain cost** per card - no limit on cards played per turn
- Cards are tied to equipment (weapons, armor, accessories)
- **Deck compilation**: Combines locked cards (from equipment) + slotted cards (player choice)

### 3. Equipment System (`src/core/equipment.ts`)
- **Five equipment slots per unit**: Weapon, Helmet, Chestpiece, Accessory1, Accessory2
- Weapons are class-restricted; other gear is universal
- Equipment provides both locked cards and free slots for customization
- **Modules**: Upgradeable components that add new cards to equipment

### 4. Gear Workbench (`src/core/gearWorkbench.ts`)
- **Card slotting system**: Slot cards from Card Library into equipment free slots
- **Card Library**: Global, persistent collection of all acquired cards
- **Deck compiler**: Generates final deck from locked + slotted cards
- **Compiling animation**: OS-themed visual feedback
- **.PAK system**: Loot packs that grant multiple cards

### 5. Inventory System (`src/core/inventory.ts`)
- **Three capacity types**: MASS (kg), BULK (bu), POWER (w)
- **Two zones**: Forward Locker (taken into runs) vs Base Camp Storage (infinite, safe)
- **Overcapacity penalties**:
  - MASS overload → AGI_DOWN debuff
  - BULK overload → JAM chance on attacks
  - POWER overload → Random POWER SURGE damage events
- **MULE System**: Upgrade weight classes (E → D → C → B → A → S)

### 6. Crafting System (`src/core/crafting.ts`, `src/core/workshop.ts`)
- **Workshop Node** in Base Camp
- **Recipe categories**: Weapons, Armor, Consumables
- **Four primary resources**:
  - Metal Scrap (mechanical enemies, destructible objects)
  - Wood (crates, free-move zones)
  - Chaos Shards (magical enemies, rare nodes)
  - Steam Components (mechanical weapons, minibosses)
- Recipes must be learned before use (found/bought, permanent)

### 7. Save System (`src/core/saveSystem.ts`)
- Rust Tauri commands: `save_game(json)`, `load_game()`
- Serialized GameState with autosave functionality
- Controller support with settings persistence

### 8. ScrollLink OS Theme
- **Boot sequence** (`ScrollLinkBoot.ts`): Logo, fake logs, loading bar
- **Shell interface** (`ScrollLinkShell.ts`): Status bar, main window, terminal panel
- **OS-themed transitions**: All screens treated as "apps" within the shell

## Key Data Structures

### GameState (`src/core/types.ts`)
```typescript
interface GameState {
  screen: string;
  operationId: string | null;
  currentFloorIndex: number;
  visitedRooms: RoomId[];
  currentRoomId: RoomId | null;
  battleState: BattleState | null;
  party: Unit[];
  resources: { wad, metalScrap, wood, chaosShards, steamComponents };
  forwardLocker: InventoryItem[];
  baseStorage: InventoryItem[];
  capacityLimits: { mass, bulk, power };
  cardLibrary: Record<CardId, number>;
  knownRecipes: RecipeId[];
  settings: GameSettings;
}
```

### Unit (`src/core/types.ts`)
```typescript
interface Unit {
  id: UnitId;
  name: string;
  isEnemy: boolean;
  hp: number;
  maxHp: number;
  agi: number;
  pos: { x: number; y: number } | null;
  hand: CardId[];
  drawPile: CardId[];
  discardPile: CardId[];
  strain: number;
  unitClass?: string;
  loadout?: {
    weapon: string | null;
    helmet: string | null;
    chestpiece: string | null;
    accessory1: string | null;
    accessory2: string | null;
  };
  buffs?: Array<{ type, amount, duration }>;
}
```

### Card (`src/core/types.ts`)
```typescript
interface Card {
  id: CardId;
  name: string;
  description: string;
  strainCost: number;
  targetType: "enemy" | "self" | "tile";
  range?: number;
  effects: CardEffect[];
}
```

## Development Roadmap

Current implementation status: **Through Headline 12bza**

### Completed
- ✅ Tauri + TypeScript setup
- ✅ ScrollLink OS boot & shell
- ✅ Core GameState & types
- ✅ Global state store
- ✅ Main menu & new game flow
- ✅ Operation floor map (static)
- ✅ Battle system with turn order
- ✅ Tactical grid renderer
- ✅ Movement & attack actions
- ✅ Card & strain systems
- ✅ Enemy AI & win conditions
- ✅ Reward screens with resources
- ✅ Inventory system (mass/bulk/power + overcapacity)
- ✅ Base Camp with shop/workshop/roster nodes
- ✅ Equipment system (5 slots)
- ✅ Unit customization & deck building
- ✅ Weapon mechanics
- ✅ Unit facing
- ✅ Crafting system
- ✅ Gear Workbench & card slotting
- ✅ Card Library & .PAK system
- ✅ Save/load system
- ✅ Controller support
- ✅ Settings screen
- ✅ Logo & navigation

### In Progress / Next Steps (Headline 13+)
- 🔄 Procedural room variants
- 🔄 Event rooms with choices
- 🔄 Multi-floor navigation (3-5 floors per operation)
- 🔄 Random equipment rewards
- 🔄 Shop nodes in dungeon runs
- ⏳ Class system & unlocks
- ⏳ Unit leveling & performance tracking
- ⏳ Unit recruitment
- ⏳ Field system
- ⏳ UI polish & transitions
- ⏳ Art pipeline (Procreate → sprites)
- ⏳ Character portraits & dialogue
- ⏳ Animation system
- ⏳ Audio (SFX + music)
- ⏳ UX improvements (tooltips, damage numbers, previews)
- ⏳ Story update (5 full operations)
- ⏳ Minigame update
- ⏳ Multiplayer update

## Aesthetic Guidelines

**"Ardycia Aesthetic Bible"** - See `Ardycia aesthetic bible.txt`

Key principles:
- Less "computer program", more "actual game"
- Retain ScrollLink terminal boot screen as flourish
- Battle grid should feel at-home for Final Fantasy Tactics Advance players
- Work within limitations before character portraits/art are implemented
- Temp art should still capture the tactical RPG feel

## Development Guidelines

### When Implementing Features
1. **Core logic first** - Implement in `src/core/` as pure functions
2. **State integration** - Wire up to `gameStore.ts`
3. **UI last** - Create screen in `src/ui/screens/`
4. **Maintain separation** - Keep game logic decoupled from UI rendering

### Code Organization
- **Pure functions** in `src/core/` should not depend on UI or DOM
- **State mutations** should go through the game store
- **Screen files** handle rendering and user interaction
- **Type definitions** belong in `src/core/types.ts`

### Testing Battle Changes
1. Start game → New Operation
2. Navigate to battle node on map
3. Test combat mechanics
4. Verify reward screen
5. Return to Base Camp

### Crafting & Equipment Testing
1. Base Camp → Workshop for crafting
2. Base Camp → Roster for loadout changes
3. Gear Workbench for card slotting
4. Verify deck compilation
5. Test in battle

## Common Tasks

### Adding a New Card
1. Define card in equipment data or card library
2. Add effect handler in `src/core/cardEffects.ts`
3. Update card rendering in battle UI
4. Test in deck compilation

### Adding a New Equipment Piece
1. Add definition to `src/core/equipment.ts`
2. Specify locked cards and free slots
3. Add to loot tables or crafting recipes
4. Test in loadout screen

### Adding a New Crafting Recipe
1. Add to recipe definitions in `src/core/crafting.ts`
2. Specify resource requirements
3. Test in workshop UI

### Modifying Battle Mechanics
1. Update logic in `src/core/battle.ts`
2. Test turn order, damage calculations, etc.
3. Update battle screen rendering if needed
4. Verify AI behavior still works

## Running the Project

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build TypeScript + Vite
npm run build

# Run Tauri app
npm run tauri dev

# Build Tauri app
npm run tauri build
```

## Important Files to Know

- **Entry point**: `src/main.ts`
- **State management**: `src/state/gameStore.ts`
- **Type definitions**: `src/core/types.ts`
- **Initial state**: `src/core/initialState.ts`
- **Battle logic**: `src/core/battle.ts`
- **Equipment data**: `src/core/equipment.ts`
- **Crafting recipes**: `src/core/crafting.ts`
- **Detailed roadmap**: `README.txt`

## Notes for AI Assistants

- This is an active game development project with a detailed roadmap
- Implementation is currently at **Headline 12bza** (see README.txt)
- The project follows a strict separation between core logic and UI
- ScrollLink OS theming is a core aesthetic element
- Strain mechanics and deck-building are central to gameplay identity
- Equipment drives card availability (not standalone card collection)
- Inventory uses three-axis capacity system (MASS/BULK/POWER)
- All game screens operate within the ScrollLink shell interface
- Controller support is a first-class feature
- Save system uses Tauri's Rust backend for file I/O

## Quick Reference

**Start a battle**: Main Menu → New Operation → Operation Map → Battle Node
**Access crafting**: Base Camp → Workshop Node
**Modify loadout**: Base Camp → Roster Node → Unit → Equipment
**Customize gear**: Loadout Screen → Gear Workbench
**Manage inventory**: Base Camp → Inventory (Forward Locker ↔ Base Storage)
**Change settings**: Main Menu → Settings (or pause during gameplay)

---

*Last Updated: 2025-12-06*
*Current Branch: clever-hertz*
*Implementation Status: Headline 12bza Complete*
