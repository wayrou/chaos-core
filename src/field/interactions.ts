// ============================================================================
// FIELD SYSTEM - INTERACTION HANDLING
// ============================================================================

import { InteractionZone, FieldMap } from "./types";
import { renderShopScreen } from "../ui/screens/ShopScreen";
import { renderCraftingScreen } from "../ui/screens/WorkshopScreen";
import { renderRosterScreen } from "../ui/screens/RosterScreen";
import { renderInventoryScreen } from "../ui/screens/InventoryScreen";
import { renderOperationSelectScreen } from "../ui/screens/OperationSelectScreen";
import { renderQuestBoardScreen } from "../ui/screens/QuestBoardScreen";
import { renderRecruitmentScreen } from "../ui/screens/RecruitmentScreen";
import { renderGearWorkbenchScreen } from "../ui/screens/GearWorkbenchScreen";
import { renderPortScreen } from "../ui/screens/PortScreen";
import { renderQuartersScreen } from "../ui/screens/QuartersScreen";
import { renderBlackMarketScreen } from "../ui/screens/BlackMarketScreen";
import { renderCommsArrayScreen } from "../ui/screens/CommsArrayScreen";
import { renderStableScreen } from "../ui/screens/StableScreen";

/**
 * Handle interaction action - opens appropriate UI or performs action
 * Note: When UI screens are closed, they should return to Field Mode by calling renderFieldScreen again
 */
export function handleInteraction(
  zone: InteractionZone,
  _map: FieldMap,
  onResume: () => void
): void {
  console.log(`[FIELD] Handling interaction: ${zone.action} (${zone.label})`);

  switch (zone.action) {
    case "shop":
      // Pass "field" as return destination so back button returns to field mode
      renderShopScreen("field");
      break;
      
    case "workshop":
      renderCraftingScreen("field");
      break;
      
    case "roster":
      renderRosterScreen("field");
      break;
      
    case "loadout":
      renderInventoryScreen("field");
      break;
      
    case "ops_terminal":
      renderOperationSelectScreen("field");
      break;
      
    case "quest_board":
      console.log("[FIELD] Quest Board interaction triggered");
      try {
        renderQuestBoardScreen("field");
      } catch (error) {
        console.error("[FIELD] Error rendering quest board:", error);
        onResume();
      }
      break;
      
    case "tavern":
      // Go directly to recruitment screen (no intro dialogue)
      renderRecruitmentScreen("field");
      break;
      
    case "gear_workbench":
      renderGearWorkbenchScreen(undefined, undefined, "field");
      break;
      
    case "port":
      renderPortScreen("field");
      break;
      
    case "quarters":
      // Switch to quarters field map
      import("./FieldScreen").then(({ renderFieldScreen }) => {
        renderFieldScreen("quarters");
      });
      break;
      
    case "black_market":
      renderBlackMarketScreen("field");
      break;

    case "comms_array":
      renderCommsArrayScreen("field");
      break;

    case "stable":
      renderStableScreen("field");
      break;

    case "base_camp_entry":
      // Switch to base camp map
      const baseCampTarget = zone.metadata?.targetMap || "base_camp";
      import("./FieldScreen").then(({ renderFieldScreen }) => {
        renderFieldScreen(baseCampTarget as "base_camp" | "free_zone_1" | "quarters");
      });
      break;
      
    case "free_zone_entry":
      // Switch to different map
      const targetMap = zone.metadata?.targetMap;
      if (targetMap) {
        // Import dynamically to avoid circular dependency
        import("./FieldScreen").then(({ renderFieldScreen }) => {
          renderFieldScreen(targetMap as "base_camp" | "free_zone_1" | "quarters");
        });
      } else {
        // Default: switch to base camp
        import("./FieldScreen").then(({ renderFieldScreen }) => {
          renderFieldScreen("base_camp");
        });
      }
      break;
      
    case "custom":
      // Custom interactions can be handled via metadata
      const quartersAction = zone.metadata?.quartersAction;
      if (quartersAction) {
        // Handle quarters-specific actions
        switch (quartersAction) {
          case "mailbox":
          case "bunk":
          case "pinboard":
          case "footlocker":
          case "sable":
            // Open quarters screen with specific panel
            renderQuartersScreen("field", quartersAction as any);
            break;
          default:
            onResume();
        }
      } else {
        console.log("[FIELD] Custom interaction:", zone.metadata);
        onResume();
      }
      break;

    // Controlled Room fortification actions (Headline 14e)
    case "build_barricade":
      handleBuildBarricade(zone, onResume);
      break;

    case "install_turret":
      handleInstallTurret(zone, onResume);
      break;

    case "reinforce_walls":
      handleReinforceWalls(zone, onResume);
      break;

    case "install_generator":
      handleInstallGenerator(zone, onResume);
      break;

    case "exit_controlled_room":
      handleExitControlledRoom(onResume);
      break;

    default:
      console.warn(`[FIELD] Unknown interaction action: ${zone.action}`);
      onResume();
  }
}

/**
 * Get interaction zone by ID
 */
export function getInteractionZone(
  map: FieldMap,
  zoneId: string
): InteractionZone | null {
  return map.interactionZones.find((z) => z.id === zoneId) || null;
}



// ============================================================================
// CONTROLLED ROOM FORTIFICATION HANDLERS (Headline 14e)
// ============================================================================

/**
 * Handle build barricade interaction
 */
function handleBuildBarricade(zone: InteractionZone, onResume: () => void): void {
  const nodeId = zone.metadata?.nodeId;
  const barricadeSlot = zone.metadata?.barricadeSlot;

  if (!nodeId) {
    console.error("[FIELD] Missing nodeId in barricade interaction");
    onResume();
    return;
  }

  import("../core/controlledRoomsSystem").then(({ getControlledRoom, upgradeControlledRoom }) => {
    const room = getControlledRoom(nodeId);
    if (!room) {
      console.error(`[FIELD] Room ${nodeId} not found`);
      alert("Room not found!");
      onResume();
      return;
    }

    const currentBarricades = room.upgrades.barricades;
    if (currentBarricades >= 3) {
      alert("All barricade slots are already built!");
      onResume();
      return;
    }

    // Check if this specific slot is already built
    if (barricadeSlot && currentBarricades >= barricadeSlot) {
      alert(`Barricade ${barricadeSlot} is already built!`);
      onResume();
      return;
    }

    const confirmed = confirm(`Build Barricade ${barricadeSlot || currentBarricades + 1}?\n\nCost: 5 Metal Scrap, 3 Wood\nIncreases fortification level.`);
    if (!confirmed) {
      onResume();
      return;
    }

    // TODO: Check and deduct resources
    try {
      upgradeControlledRoom(nodeId, "barricade", { metalScrap: 5, wood: 3 });
      alert(`Barricade ${barricadeSlot || currentBarricades + 1} built successfully!`);
    } catch (error) {
      alert(`Failed to build barricade: ${error}`);
    }

    onResume();
  });
}

/**
 * Handle install turret interaction
 */
function handleInstallTurret(zone: InteractionZone, onResume: () => void): void {
  const nodeId = zone.metadata?.nodeId;
  const turretSlot = zone.metadata?.turretSlot;

  if (!nodeId) {
    console.error("[FIELD] Missing nodeId in turret interaction");
    onResume();
    return;
  }

  import("../core/controlledRoomsSystem").then(({ getControlledRoom, upgradeControlledRoom }) => {
    const room = getControlledRoom(nodeId);
    if (!room) {
      console.error(`[FIELD] Room ${nodeId} not found`);
      alert("Room not found!");
      onResume();
      return;
    }

    const currentTurrets = room.upgrades.turrets;
    if (currentTurrets >= 2) {
      alert("All turret slots are already installed!");
      onResume();
      return;
    }

    // Check if this specific slot is already installed
    if (turretSlot && currentTurrets >= turretSlot) {
      alert(`Turret ${turretSlot} is already installed!`);
      onResume();
      return;
    }

    const confirmed = confirm(`Install Turret ${turretSlot || currentTurrets + 1}?\n\nCost: 10 Metal Scrap, 5 Steam Components\nProvides defensive firepower.`);
    if (!confirmed) {
      onResume();
      return;
    }

    // TODO: Check and deduct resources
    try {
      upgradeControlledRoom(nodeId, "turret", { metalScrap: 10, steamComponents: 5 });
      alert(`Turret ${turretSlot || currentTurrets + 1} installed successfully!`);
    } catch (error) {
      alert(`Failed to install turret: ${error}`);
    }

    onResume();
  });
}

/**
 * Handle reinforce walls interaction
 */
function handleReinforceWalls(zone: InteractionZone, onResume: () => void): void {
  const nodeId = zone.metadata?.nodeId;

  if (!nodeId) {
    console.error("[FIELD] Missing nodeId in walls interaction");
    onResume();
    return;
  }

  import("../core/controlledRoomsSystem").then(({ getControlledRoom, upgradeControlledRoom }) => {
    const room = getControlledRoom(nodeId);
    if (!room) {
      console.error(`[FIELD] Room ${nodeId} not found`);
      alert("Room not found!");
      onResume();
      return;
    }

    if (room.upgrades.reinforcedWalls) {
      alert("Walls are already reinforced!");
      onResume();
      return;
    }

    const confirmed = confirm(`Reinforce Walls?\n\nCost: 15 Metal Scrap, 10 Wood\nSignificantly increases fortification level.`);
    if (!confirmed) {
      onResume();
      return;
    }

    // TODO: Check and deduct resources
    try {
      upgradeControlledRoom(nodeId, "walls", { metalScrap: 15, wood: 10 });
      alert("Walls reinforced successfully!");
    } catch (error) {
      alert(`Failed to reinforce walls: ${error}`);
    }

    onResume();
  });
}

/**
 * Handle install generator interaction
 */
function handleInstallGenerator(zone: InteractionZone, onResume: () => void): void {
  const nodeId = zone.metadata?.nodeId;

  if (!nodeId) {
    console.error("[FIELD] Missing nodeId in generator interaction");
    onResume();
    return;
  }

  import("../core/controlledRoomsSystem").then(({ getControlledRoom, upgradeControlledRoom }) => {
    const room = getControlledRoom(nodeId);
    if (!room) {
      console.error(`[FIELD] Room ${nodeId} not found`);
      alert("Room not found!");
      onResume();
      return;
    }

    if (room.upgrades.powerGenerator) {
      alert("Generator is already installed!");
      onResume();
      return;
    }

    const confirmed = confirm(`Install Power Generator?\n\nCost: 20 Metal Scrap, 10 Steam Components\nMaximizes fortification level and provides power.`);
    if (!confirmed) {
      onResume();
      return;
    }

    // TODO: Check and deduct resources
    try {
      upgradeControlledRoom(nodeId, "generator", { metalScrap: 20, steamComponents: 10 });
      alert("Generator installed successfully!");
    } catch (error) {
      alert(`Failed to install generator: ${error}`);
    }

    onResume();
  });
}

/**
 * Handle exit controlled room back to operation map
 */
function handleExitControlledRoom(onResume: () => void): void {
  import("./controlledRoomFieldMode").then(({ clearControlledRoomContext }) => {
    clearControlledRoomContext();

    // Return to operation map screen
    import("../ui/screens/OperationMapScreen").then(({ renderOperationMapScreen }) => {
      renderOperationMapScreen();
    });
  });
}
