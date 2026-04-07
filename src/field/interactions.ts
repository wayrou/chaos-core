// ============================================================================
// FIELD SYSTEM - INTERACTION HANDLING
// ============================================================================

import { InteractionZone, FieldMap } from "./types";
import { renderShopScreen } from "../ui/screens/ShopScreen";

import { renderRosterScreen } from "../ui/screens/RosterScreen";
import { renderInventoryScreen } from "../ui/screens/InventoryScreen";
import { renderOperationSelectScreen } from "../ui/screens/OperationSelectScreen";
import { renderQuestBoardScreen } from "../ui/screens/QuestBoardScreen";
import { renderTavernDialogueScreen } from "../ui/screens/TavernDialogueScreen";
import { renderGearWorkbenchScreen } from "../ui/screens/GearWorkbenchScreen";
import { renderPortScreen } from "../ui/screens/PortScreen";
import { renderQuartersScreen } from "../ui/screens/QuartersScreen";
import { renderBlackMarketScreen } from "../ui/screens/BlackMarketScreen";
import { renderStableScreen } from "../ui/screens/StableScreen";
import { renderDispatchScreen } from "../ui/screens/DispatchScreen";
import { renderSchemaScreen } from "../ui/screens/SchemaScreen";
import { renderFoundryAnnexScreen } from "../ui/screens/FoundryAnnexScreen";
import { showImportedDialogue } from "../ui/screens/DialogueScreen";
import { getGameState } from "../state/gameStore";
import {
  BLACK_MARKET_UNLOCK_FLOOR_ORDINAL,
  DISPATCH_UNLOCK_FLOOR_ORDINAL,
  FOUNDRY_ANNEX_UNLOCK_FLOOR_ORDINAL,
  PORT_UNLOCK_FLOOR_ORDINAL,
  SCHEMA_UNLOCK_FLOOR_ORDINAL,
  STABLE_UNLOCK_FLOOR_ORDINAL,
  isBlackMarketNodeUnlocked,
  isDispatchNodeUnlocked,
  isFoundryAnnexUnlocked,
  isPortNodeUnlocked,
  isSchemaNodeUnlocked,
  isStableNodeUnlocked,
} from "../core/campaign";

/**
 * Handle interaction with a zone
 */
export function handleInteraction(
  zone: InteractionZone,
  map: FieldMap,
  onResume: () => void
): void {
  switch (zone.action) {
    case "shop":
      renderShopScreen("field");
      break;



    case "roster":
      renderRosterScreen("field");
      break;

    case "loadout":
      renderInventoryScreen("field");
      break;

    case "ops_terminal":
      import("../ui/screens/CommsArrayScreen").then(async ({ openSharedCoopOperationsEntry }) => {
        try {
          const handledByCoop = await openSharedCoopOperationsEntry();
          if (handledByCoop) {
            return;
          }
          renderOperationSelectScreen("field");
        } catch (error) {
          console.error("[FIELD] Ops Terminal failed to open:", error);
          alert("Ops Terminal failed to initialize. The atlas state may need to be regenerated.");
          onResume();
        }
      });
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
      renderTavernDialogueScreen("base_camp_tavern", "Tavern", "field");
      break;

    case "gear_workbench":
      renderGearWorkbenchScreen(undefined, undefined, "field");
      break;

    case "port":
      if (!isPortNodeUnlocked()) {
        alert(`PORT unlocks after Floor ${String(PORT_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      renderPortScreen("field");
      break;

    case "dispatch":
      if (!isDispatchNodeUnlocked()) {
        alert(`DISPATCH unlocks after Floor ${String(DISPATCH_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      renderDispatchScreen("field");
      break;

    case "quarters":
      // Switch to quarters field map
      import("./FieldScreen").then(({ renderFieldScreen }) => {
        renderFieldScreen("quarters");
      });
      break;

    case "black_market":
      if (!isBlackMarketNodeUnlocked()) {
        alert(`BLACK MARKET unlocks after Floor ${String(BLACK_MARKET_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      renderBlackMarketScreen("field");
      break;

    case "stable":
      if (!isStableNodeUnlocked()) {
        alert(`STABLE unlocks after Floor ${String(STABLE_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      renderStableScreen("field");
      break;

    case "schema":
      if (!isSchemaNodeUnlocked()) {
        alert(`S.C.H.E.M.A. comes online after Floor ${String(SCHEMA_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      renderSchemaScreen("field");
      break;

    case "foundry-annex":
      if (!isFoundryAnnexUnlocked()) {
        alert(`FOUNDRY + ANNEX comes online after Floor ${String(FOUNDRY_ANNEX_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      renderFoundryAnnexScreen("field");
      break;

    case "comms-array":
      import("../ui/screens/CommsArrayScreen").then(({ renderCommsArrayScreen }) => {
        renderCommsArrayScreen("field");
      });
      break;

    case "mini_core":
      console.log("[FIELD] Mini Core interaction triggered");
      onResume();
      break;

    case "fcp_test":
      // CURSOR_PROOF_FCP_SPAWN_FIX: Open test FCP field map to test spawn bug
      const fcpTestMap = zone.metadata?.targetMap || "keyroom_test_fcp";
      import("./FieldScreen").then(({ renderFieldScreen }) => {
        renderFieldScreen(fcpTestMap as any);
      });
      break;


    case "base_camp_entry":
      if (typeof map.id === "string" && map.id.startsWith("keyroom_")) {
        import("./FieldScreen").then(({ exitFieldMode }) => {
          exitFieldMode(true);
        });
        break;
      }

      // Switch to base camp map
      const baseCampTarget = zone.metadata?.targetMap || "base_camp";
      const mapRef = map; // Capture map reference to avoid ReferenceError in promise
      import("./FieldScreen").then(({ renderFieldScreen, storeInteractionZonePosition }) => {
        if (baseCampTarget === "base_camp" && mapRef.id === "quarters") {
          // Spawn beside the quarters interaction on return
          const tileSize = 64;
          const spawnTileX = 23;
          const spawnTileY = 14;
          storeInteractionZonePosition(
            "interact_quarters",
            spawnTileX * tileSize + tileSize / 2,
            spawnTileY * tileSize + tileSize / 2
          );
        }
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
      if (zone.metadata?.dialogueId) {
        const resumeAfterDialogue = () => {
          if (zone.metadata?.handlerId === "open_board") {
            renderQuestBoardScreen("field");
            return;
          }
          onResume();
        };

        const opened = showImportedDialogue(String(zone.metadata.dialogueId), resumeAfterDialogue, zone.label);
        if (opened) {
          break;
        }
      }

      if (zone.metadata?.handlerId === "open_board") {
        renderQuestBoardScreen("field");
        break;
      }

      if (zone.metadata?.handlerId === "lobby_skirmish_console") {
        import("../ui/screens/CommsArrayScreen").then(({ openCurrentLobbySkirmish, renderCommsArrayScreen }) => {
          const lobby = getGameState().lobby;
          if (lobby?.activity.kind === "skirmish") {
            openCurrentLobbySkirmish();
            return;
          }
          renderCommsArrayScreen("field");
        });
        break;
      }

      if (zone.metadata?.handlerId === "lobby_ops_table") {
        import("../ui/screens/CommsArrayScreen").then(({ renderCommsArrayScreen }) => {
          renderCommsArrayScreen("field");
        });
        break;
      }

      if (typeof zone.metadata?.lockedMessage === "string") {
        alert(zone.metadata.lockedMessage);
        onResume();
        break;
      }

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
      } else if (zone.metadata?.placeholder) {
        // Handle placeholder interactions (coming soon features)
        console.log(`[FIELD] Placeholder interaction: ${zone.label}`);
        onResume();
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
