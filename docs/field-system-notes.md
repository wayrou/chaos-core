# Field System - Developer Notes

## Overview

The Field System implements a top-down exploration mode where the player (Aeriss) can walk around Base Camp and Free Zones, interact with stations, and explore the world.

## Architecture

The Field System is organized in `src/field/`:

- **types.ts** - Type definitions for maps, tiles, objects, interactions, and player state
- **maps.ts** - Map definitions (Base Camp, Free Zones)
- **player.ts** - Player avatar movement, collision detection (AABB)
- **interactions.ts** - Interaction zone handling and UI integration
- **FieldScreen.ts** - Main screen renderer and game loop
- **field.css** - Field-specific styles

## How to Enter Field Mode

1. From Base Camp Screen, click the "FIELD MODE" button
2. Or programmatically: `import { renderFieldScreen } from "./field/FieldScreen"; renderFieldScreen("base_camp");`

## Controls

- **WASD** - Move player avatar (top-down, smooth movement)
- **E** - Interact with nearby interaction zones
- **ESC** - Exit Field Mode (returns to Base Camp)

## Map System

### Base Camp Map

- 20x15 tile grid
- Walkable floor tiles with wall boundaries
- Station objects: Shop, Workshop, Roster, Loadout, Ops Terminal
- Interaction zones in front of each station

### Free Zone Map

- 15x12 tile grid
- Placeholder exploration area with resources
- Exit zone to return to Base Camp

### Adding New Maps

1. Create map definition in `src/field/maps.ts`:
   ```typescript
   function createMyMap(): FieldMap {
     // Define tiles, objects, interaction zones
   }
   ```
2. Register in maps registry:
   ```typescript
   maps.set("my_map_id", createMyMap());
   ```
3. Load with: `renderFieldScreen("my_map_id")`

## Modifying Maps

Edit `src/field/maps.ts`:

- **Tiles**: Set `walkable: true/false` to control collision
- **Objects**: Add visual placeholders for stations/resources
- **Interaction Zones**: Define where player can interact and what action to trigger

## Interaction System

### Current Integrations

- **Shop** → Opens `renderShopScreen()`
- **Workshop** → Opens `renderWorkshopScreen()`
- **Roster** → Opens `renderRosterScreen()`
- **Loadout** → Opens `renderInventoryScreen()`
- **Ops Terminal** → Opens `renderOperationSelectScreen()`

### Adding New Interactions

1. Add interaction zone to map definition:
   ```typescript
   {
     id: "interact_mything",
     x: 5, y: 5,
     width: 2, height: 1,
     action: "my_action",
     label: "MY THING",
   }
   ```

2. Handle in `src/field/interactions.ts`:
   ```typescript
   case "my_action":
     renderMyScreen();
     break;
   ```

### Returning to Field Mode

When a UI screen closes, it should call:
```typescript
import { renderFieldScreen } from "../../field/FieldScreen";
renderFieldScreen("base_camp"); // or current map ID
```

**TODO**: Add "Back to Field Mode" buttons to Shop, Workshop, etc. screens.

## Player Movement

- Smooth top-down movement (no grid snapping)
- AABB collision detection against non-walkable tiles
- Speed: 120 pixels/second
- Collision checks tile boundaries and map edges

## Placeholder Art

- Player avatar: Blue circle with "A" (placeholder sprite)
- Stations: Colored rectangles with text labels
- Resources: Green circles
- Tiles: Colored squares (floor/wall/grass variants)

**TODO**: Replace with actual sprites/art assets.

## Future Enhancements

1. **Real-time Combat**: When encountering enemies in Free Zones
   - TODO: Implement combat system integration
   - Reference: GDD "Field System" section

2. **Resource Collection**: Interact with resources to collect materials
   - TODO: Wire to inventory system
   - Reference: GDD resource types (Metal Scrap, Wood, Chaos Shards, Steam Components)

3. **Map Transitions**: Seamless switching between Base Camp and Free Zones
   - Partially implemented (free_zone_entry action)
   - TODO: Add transition animations

4. **Save/Load**: Persist player position and current map
   - TODO: Add to GameState and save system

5. **Visual Polish**:
   - Replace placeholder sprites
   - Add animations
   - Improve tile rendering

## Troubleshooting

- **Player stuck**: Check tile `walkable` property in map definition
- **Interaction not working**: Verify interaction zone coordinates overlap with player position
- **Screen not returning to field**: Ensure UI screens call `renderFieldScreen()` on close

## Testing

1. Launch dev build: `pnpm tauri dev` (or your project's dev command)
2. Navigate: Main Menu → New Operation → Base Camp → Field Mode
3. Test movement: WASD keys
4. Test interactions: Walk to stations, press E
5. Test exit: ESC key

