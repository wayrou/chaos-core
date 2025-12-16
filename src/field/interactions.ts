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
      // Show tavern dialogue first, then allow access to recruitment
      import("../ui/screens/TavernDialogueScreen").then(m => {
        m.renderTavernDialogueScreen("base_camp_tavern", "Base Camp Tavern", "field");
      });
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

