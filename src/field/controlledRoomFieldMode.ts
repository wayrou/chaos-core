// ============================================================================
// CONTROLLED ROOM FIELD MODE ENTRY (Headline 14e)
// Functions for entering and managing controlled room field mode
// ============================================================================

import { getControlledRoom } from "../core/controlledRoomsSystem";
import { renderFieldScreen } from "./FieldScreen";
import { FieldMapId } from "./types";
import { ControlledRoomType } from "../core/campaign";

// Store which controlled room we're currently visiting
let currentControlledRoomNodeId: string | null = null;

/**
 * Enter field mode for a controlled room
 * @param nodeId - The room node ID from the dungeon map
 */
export function enterControlledRoomFieldMode(nodeId: string): void {
  const room = getControlledRoom(nodeId);
  if (!room) {
    console.error(`[CONTROLLEDROOMFIELD] Room ${nodeId} not found`);
    alert("Room not found. It may have been abandoned.");
    return;
  }

  // Store current room context
  currentControlledRoomNodeId = nodeId;

  // Map room type to field map ID
  const fieldMapId = getFieldMapIdForRoomType(room.roomType);

  console.log(`[CONTROLLEDROOMFIELD] Entering field mode for ${room.roomType} (node: ${nodeId})`);

  // Enter field mode
  renderFieldScreen(fieldMapId);
}

/**
 * Get the currently visited controlled room node ID
 */
export function getCurrentControlledRoomNodeId(): string | null {
  return currentControlledRoomNodeId;
}

/**
 * Clear the current controlled room context (on exit)
 */
export function clearControlledRoomContext(): void {
  currentControlledRoomNodeId = null;
}

/**
 * Map room type to field map ID
 */
function getFieldMapIdForRoomType(roomType: ControlledRoomType): FieldMapId {
  const mapping: Record<ControlledRoomType, FieldMapId> = {
    supply_depot: "controlled_supply_depot",
    medical_ward: "controlled_medical_ward",
    armory: "controlled_armory",
    command_center: "controlled_command_center",
    mine: "controlled_mine",
    outpost: "controlled_outpost",
  };
  return mapping[roomType];
}
