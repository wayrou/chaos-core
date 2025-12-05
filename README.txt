1. Initialize Tauri + TypeScript Project

Set up a fresh Tauri app with your chosen frontend stack (React or Svelte + TS). Confirm hot-reload, basic routing, and a simple “Hello, Chaos Core” screen.

2. Implement ScrollLink OS Boot & Shell Frame

Create the fake OS:

Boot screen (logo, fake logs, loading bar).

Main shell layout: top status bar, main window, and a terminal-style panel where all “apps” (Base Camp, Operation Map, Battle) live.

3. Define Core GameState & Data Types in TypeScript

Design the foundational interfaces:

GameState, Operation, Floor, RoomNode

Unit, Card, BattleState
Keep them in a dedicated core/ folder so logic stays decoupled from UI.

4. Build a Simple Global State Store

Use Zustand/Redux or a tiny custom store to:

Hold GameState

Dispatch actions like NEW_GAME, ENTER_ROOM, START_BATTLE
Ensure it’s serializable for saving/loading later.

5. Create the Main Menu & New Game Flow

Add:

Main menu (New Operation, Continue, Options).

“New Operation” sets up a default Operation Iron Gate run and sends you to the Operation Map.

6. Implement the Operation Floor Node Map (Static Layout)

Create:

One floor with a hardcoded graph of ~6 rooms.

Node map UI (simple circles + connecting lines).
Clicking a next-door node calls ENTER_ROOM(nodeId) and opens a placeholder “Room” view (e.g., “Battle Room”, “Shop Room”).

7. Design Minimal BattleState & Turn Order System

Implement:

Battle grid dimensions + tile array.

Player units + enemy units.

Basic turn order based on AGI or a simple queue.
Create pure functions like startBattleFromRoom(room, party) → BattleState.

8. Build the Tactical Grid Renderer (Placeholder Graphics)

Use <canvas> or a CSS grid of <div>s to:

Draw tiles as colored squares.

Draw units as simple shapes or letters (e.g., “A” for Aeriss).
Support hover / click detection for tiles and units.

9. Implement Movement & Basic Attack Actions

Add basic commands:

MOVE_UNIT with pathfinding or simple cardinal steps.

ATTACK with range 1, simple damage formula, and HP reduction.
Handle turn progression and victory/defeat states.

10. Add Card & Strain Systems (Core Chaos Core Identity)

Implement per-unit:

Deck, draw, hand, discard.

A small starting card pool (Attack, Move, Defend, Overcharge).
Add:

Strain accumulation per card.

A simple penalty when exceeding a strain threshold (e.g., temporary debuff or HP chip).

No limit to cards played per turn

10z. enemy AI and win conditions, reward screens where Wad (currency) and crafting resources are won after each encounter.
Resources:
There are four primary crafting resources:
Metal Scrap – Dropped by mechanical enemies and destructible map objects.
Wood – Found in crates, free-move zones, and certain enemy drops.
Chaos Shards – Dropped by magical enemies and rare dungeon nodes.
Steam Components – Found on mechanical weapons, miniboss drops, and specialized encounter rewards.

10za. Inventory System (Mass / Bulk / Power Overcapacity + Forward Locker & Base Storage)

A modular, expandable inventory system using three independent capacity stats and an overcapacity penalty system. Inventory UI supports drag-and-drop between Forward Locker and Base Camp Storage.

1. Core Inventory Concepts
Three Capacity Types

Each item has three attributes:

MASS (kg)

BULK (bu)

POWER (w)
These function like Tetris constraints but in abstract numeric form, not physical shapes.

The player’s Forward Locker has maximum capacities for each:

MASS Cap

BULK Cap

POWER Cap

These caps increase via the MULE System (Weight Class upgrades):
Class E → D → C → B → A → S

Resources:

Stack to 99

Have very low MASS/BULK/POWER, encouraging carrying many but not infinite.

Two Inventory Zones

Forward Locker = Items taken into the next run

Base Camp Storage = Safe, infinite storage; cannot be accessed during a run

Equipment auto-unequips if moved out of the Forward Locker.

2. Overcapacity Penalties

Players can exceed any limit, but each overage triggers a battle penalty:

MASS Overcapacity

All friendly units start battle with AGI_DOWN

(Scales with how overloaded the mass bar is)

BULK Overcapacity

Every attack from a friendly unit has X% chance to JAM

JAM effect and weapon interactions covered in 14b

POWER Overcapacity

Random POWER SURGE events during combat

Deals damage to all friendly units

Surge chance increases with % overload

3. UI Layout
Left Side: Capacity Bars

Three horizontal meters:

 MASS  │███████████░░░░░░│ 85 / 100 kg
 BULK  │███████░░░░░░░░░░│ 48 / 70 bu
 POWER │█████████████▒░░ │ 290 / 300 w


Color Codes:

White/Blue = normal

Yellow = nearing capacity (≥ 80%)

Red = overloaded (>100%)

Flashing Red = extreme overload or active power surge warning

Bars update dynamically as items are added/removed.


 

11a. Screen progression flow: "shell" screen (which will end up being base camp screen) -> start_op -> choose operation 
(current operation in the story, or a second option to start a custom operation with fully customizable settings) -> room layout / map with battle nodes, etc. -> going into node
Create the Base Camp Screen with different nodes: shop node, workshop node (add crafting in headline 11d), unit roster (unit customization added in 11b)

11b. Equipment
Decks, Equipment & Modules
Five equip slots per unit: Weapon, Chestpiece, Helmet, two Accessories.
Weapons are class-restricted; other gear is universal.
Modules: Found/crafted/bought upgrades that can be affixed to weapons that add new equipment cards to unit decks.
Decks can be modified at any time outside of a tactical battle encounter.

11c. Unit customization
unit roster, stats, and current decks.
Let the player swap cards in/out of unit decks by changing equipment
(equipment tied to cards, cards populate in unit decks based on / drawing from equipment they have)



11cx. Introduce weapon mechanics


11cy. (EXPERIMENTAL) Aesthetic overhaul to align with Ardycia aesthetic bible, less like a computer program and more like an actual game (while still retaining scrolllink terminal boot screen and flourish,
and acknowleding limitations before any actual art / character portraits are implemented into the game), make the battle grid feel at-home with players of final fantasy tactics advance as much as possible
with temp art / before real art is added.

11cz. Introduce unit facing



11d. Crafting
Crafting at base camp
Crafting provides players with a streamlined way to create and upgrade gear and cards using resources obtained during dungeon runs, free-move zones, and operations. 
Access Point:
Crafting is performed at the Workshop Node located in the Base Camp.
Recipe Categories:
Weapons – Craft basic-tier mechanical and non-mechanical weapons or upgrade existing weapons to +1 and +2 versions, providing minor stat boosts.
Armor – Craft helmets, chestpieces, and accessories, or upgrade existing ones.
Consumables – Craft utility items such as Smoke Bombs, Field Repairs (restore mechanical weapon heat), and Healing Kits.
Crafting Rules:
Recipes require exact resource matches; substitutions are not allowed.
Crafted gear is added directly to the player’s Equipment Pool for deck-building.
Consumables are single-use and are stored in a separate consumables inventory.
Example Recipes:
Iron Longsword – 5 Metal Scrap, 2 Wood
Steam Valve Wristguard – 3 Steam Components, 2 Metal Scrap
Healing Kit – 2 Wood, 1 Chaos Shard
Blazefang Saber +1 – 4 Steam Components, 3 Chaos Shards, original Blazefang Saber
Integration with Core Loop:
The Crafting System ties directly into the Base Camp Phase of the Core Loop. Players can decide whether to invest resources into crafting new equipment, upgrading current loadouts, or preparing consumables for the next operation.
Recipes are required to craft something- recipes can be found or bought and are learned immediately and permanently



11da. Gear Workbench & Card Slotting System

{Objective

Implement the Gear Workbench system that allows players to customize equipment by slotting cards from their Card Library into gear-specific free slots. This system enables true deckbuilding-style customization while keeping class + equipment identity intact. Includes new UI, new data structures, a compiling animation, .PAK pack card acquisition, and deck compilation functionality.

11da.1 — Extend Equipment Data Model

Modify all equipment definitions under equipmentData:

Add:

lockedCards: CardId[]    // Permanent, cannot be removed
freeSlots: number        // Usually 2–3
slottedCards: CardId[]   // Player-chosen cards


Ensure freeSlots and slottedCards are persisted in save data.

Validate that slottedCards.length <= freeSlots.

11da.2 — Implement Card Library System

Create a persistent, global cardLibrary state:

cardLibrary: {
   [cardId: string]: number;  // unlimited-use copies OK—count is cosmetic
}


Rules:

Cards do NOT occupy inventory space.

Cards may be collected from: packs, battle rewards, shops, crafting.

Card Library UI appears inside the Gear Workbench panel.

Player may search, filter by rarity/type, and drag cards from library into gear slots.

11da.3 — Create Gear Workbench Screen

Add GearWorkbenchScreen.ts with:

Layout

Left side:

Selected gear 3D/2D panel

Locked card icons

Free slots as drag targets

Right side:

Scrollable Card Library list

Filters (rarity, type, owned count)

Hover tooltips for card data

Bottom:

COMPILE GEAR button

BACK button to Base Camp or Loadout

Interactive logic

Drag card from library → drop into slot

Click slot to remove card

Slots visually highlight when a card is hovered

Library greys out cards already slotted if needed (but unlimited-use is allowed)

Live preview of resulting equipment card list

11da.4 — Deck Compiler Implementation

Add a helper function:

compileDeck(unitEquipment: Equipment[]): CardId[]


Rules:

Add all lockedCards across all equipped gear

Add all slottedCards across all equipped gear

Deck is a pure sum of cards; no additional sorting required

Returned deck is used during battle initialization for shuffle + draw

Include UI preview in Gear Workbench and Loadout screens:

GENERATED DECK:
Strike ×2
Lunge ×1
Steam Burst ×1
Overclock ×1

11da.5 — Add Compiling Animation

When COMPILE is pressed:

Lock UI

Show OS-like animation:

[COMPILING...]
→ Building Strike.exe
→ Installing Overclock.dll
→ Resolving Steam_Burst.pkg
→ Linking runtime dependencies
→ Compilation Successful ✔


Glow/scanline effect

Save changes to state

Return player to Gear view

11da.6 — Add .PAK Pack System for Card Acquisition

Create .PAK files as special loot items only used to generate cards:

.PAK types:

CORE.PAK (common/uncommon)

STEAM.PAK (mobility/steam tech)

VOID.PAK (chaos/mixed rarity)

TECH.PAK (offense/utility mix)

BOSS.PAK (rare/epic-only)

Opening .PAK:

Show "DECOMPILING…" animation

Reveal 3–5 cards

Add them to cardLibrary

Show rarity effect sparks

Confirm screen “ADD TO LIBRARY”

11da.7 — Battle Reward Updates

Each battle reward screen now optionally includes:

1 guaranteed common card

Chance for one uncommon

Low chance for rare or chaos card

Cards immediately added to library

Reward screen includes a new section:

CARD ACQUIRED:
 • Steam Burst (Common)

11da.8 — Shop Integration

Shop nodes gain:

“Buy single card” menu

“Buy .PAK file” menu

Card prices scale with rarity

Card preview tooltips appear on hover.

11da.9 — Loadout Screen Integration

Update Loadout screen to include:

Button: OPEN GEAR WORKBENCH

Hovering gear shows:

Locked cards

Slotted cards

Number of free slots remaining

Add generated deck preview under each unit.

11da.10 — Validation & Error Handling

Prevent COMPILE if slot count exceeded

Ensure empty slots are allowed

Ensure card library persists properly
}
-----------------------IMPLEMENTED UP TO HERE-----------------------------

12. Implement Save/Load via Rust Tauri Commands

In Rust:

save_game(json: String) → write to file.

load_game() → read from file, return JSON.
In TS:

Serialize GameState and call these commands.
Add a “Continue” button that loads the last save.

autosave feature

12b. Controller support

13. Add Simple Procedural Room Variants

Instead of a single static battle:

Define a handful of battle templates and enemy compositions.

When entering a “battle” node, randomly choose from small curated sets so runs feel different.

Event rooms with choices (“Sacrifice HP for a relic?”)

Random equipment rewards from battles

shop nodes (buying equipment) in dungeon runs randomly between battles

14. The class update

Implement classes and unlock conditions, changing class on unit management screen

You can change a unit's class at anytime on the class management screen, unlock branch classes per unit similar to final fantasy tactics series. 

Rolled instances of individual cards that you get from crafting, rewards or shops

14a. Unit leveling

Implement unit performance system

14az. Unit recruitment

Implement unit recruitment system

14b. The field update

Implement field system

15. Refine ScrollLink UI & Screen Transitions

Polish the OS feel:

Stylish transitions when switching between screens (Base Camp → Operation Map → Battle).

Subtle animations (cursor blink, flicker, etc.).



16. Establish Art Pipeline: Procreate → Game Sprites

Define 2D art flow:

Choose target sprite resolution (e.g., 32×32 or 48×48).

In Procreate: set up a sprite sheet template with grid.

Export as PNGs; in the app, load them and replace colored squares with character sprites.
Test one animated idle/walk cycle for Aeriss on the grid.

16b. Character portraits + dialogue 

17. Implement Basic Animation System for Units

Add:

State machine for units: idle, moving, attacking, hit, dead.

Simple frame-based animation on the grid.
Tie animations to events (MOVE_UNIT, ATTACK_RESOLVE).

18. Add Audio Layer (SFX + Skeleton for Music)

Integrate a lightweight audio system:

Hook up simple SFX: move, attack, hit, card play, UI clicks.

Create an API for background music, even if you just plug in temp tracks for now.

19. UX & Feedback Pass on Battles

Improve game feel:

Hover highlights, movement range previews, target indicators.

Damage numbers popping up, small screen shake on heavy hits.

Tooltips for tiles, units, and cards.

20. The story update

Implement all 5 operations fully

20a. Minigame update




