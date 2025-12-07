// ============================================================================
// FIELD SYSTEM - INTERACTION HANDLING
// ============================================================================

import { InteractionZone, FieldMap } from "./types";
import { renderShopScreen } from "../ui/screens/ShopScreen";
import { renderWorkshopScreen } from "../ui/screens/WorkshopScreen";
import { renderRosterScreen } from "../ui/screens/RosterScreen";
import { renderInventoryScreen } from "../ui/screens/InventoryScreen";
import { renderOperationSelectScreen } from "../ui/screens/OperationSelectScreen";
import { renderFieldScreen } from "./FieldScreen";

/**
 * Handle interaction action - opens appropriate UI or performs action
 * Note: When UI screens are closed, they should return to Field Mode by calling renderFieldScreen again
 */
export function handleInteraction(
  zone: InteractionZone,
  map: FieldMap,
  onResume: () => void
): void {
  console.log(`[FIELD] Handling interaction: ${zone.action} (${zone.label})`);
  
  switch (zone.action) {
    case "shop":
      // Pass "field" as return destination so back button returns to field mode
      renderShopScreen("field");
      break;
      
    case "workshop":
      renderWorkshopScreen("field");
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
      
    case "free_zone_entry":
      // Switch to different map
      if (zone.metadata?.targetMap) {
        // Import dynamically to avoid circular dependency
        import("./FieldScreen").then(({ renderFieldScreen }) => {
          renderFieldScreen(zone.metadata.targetMap as "base_camp" | "free_zone_1");
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
      console.log("[FIELD] Custom interaction:", zone.metadata);
      onResume();
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

