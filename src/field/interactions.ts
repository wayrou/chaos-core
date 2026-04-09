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
import { showDialogue, showImportedDialogue } from "../ui/screens/DialogueScreen";
import { getGameState, updateGameState } from "../state/gameStore";
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
  loadCampaignProgress,
} from "../core/campaign";
import {
  abortOuterDeckExpedition,
  OUTER_DECK_HAVEN_EXIT_SPAWN_TILE,
  OUTER_DECK_OVERWORLD_ENTRY_SPAWN_TILE,
  OUTER_DECK_OVERWORLD_MAP_ID,
  beginOuterDeckExpedition,
  claimOuterDeckCompletion,
  getOuterDeckBranchEntrySubarea,
  getOuterDeckNpcEncounterDefinition,
  getOuterDeckOverworldReturnSpawn,
  getOuterDeckSubareaByMapId,
  getOuterDeckZoneLockedMessage,
  hasOuterDeckCacheBeenClaimed,
  isOuterDeckZoneUnlocked,
  isOuterDeckSubareaCleared,
  markOuterDeckCacheClaimed,
  markOuterDeckNpcEncounterSeen,
  setOuterDeckCurrentSubarea,
} from "../core/outerDecks";
import { createEmptyResourceWallet } from "../core/resources";
import { grantSessionResources } from "../core/session";
import { showAlertDialog } from "../ui/components/confirmDialog";
import { showSystemPing } from "../ui/components/systemPing";

function applyOuterDeckRewardBundle(
  rewardBundle: Record<string, unknown> | undefined,
): void {
  const wad = Math.max(0, Math.floor(Number(rewardBundle?.wad ?? 0)));
  const nextResources = createEmptyResourceWallet();
  ["metalScrap", "wood", "chaosShards", "steamComponents"].forEach((resourceKey) => {
    nextResources[resourceKey as keyof typeof nextResources] = Math.max(
      0,
      Math.floor(Number((rewardBundle?.resources as Record<string, unknown> | undefined)?.[resourceKey] ?? 0)),
    );
  });

  if (
    wad <= 0
    && Object.values(nextResources).every((amount) => Number(amount ?? 0) <= 0)
  ) {
    return;
  }

  updateGameState((state) => grantSessionResources(state, {
    wad,
    resources: nextResources,
  }));
}

function summarizeOuterDeckRewardBundle(
  rewardBundle: Record<string, unknown> | undefined,
): string {
  const parts: string[] = [];
  const wad = Math.max(0, Math.floor(Number(rewardBundle?.wad ?? 0)));
  if (wad > 0) {
    parts.push(`+${wad} WAD`);
  }

  const resources = rewardBundle?.resources as Record<string, unknown> | undefined;
  const labels: Record<string, string> = {
    metalScrap: "Metal Scrap",
    wood: "Wood",
    chaosShards: "Chaos Shards",
    steamComponents: "Steam Components",
  };

  Object.entries(labels).forEach(([resourceKey, label]) => {
    const amount = Math.max(0, Math.floor(Number(resources?.[resourceKey] ?? 0)));
    if (amount > 0) {
      parts.push(`+${amount} ${label}`);
    }
  });

  return parts.join(" | ");
}

/**
 * Handle interaction with a zone
 */
async function showFieldInteractionAlert(message: string): Promise<void> {
  await showAlertDialog({
    title: "FIELD NOTICE",
    message,
    mount: () => document.querySelector(".field-root"),
  });
}

function showFieldTravelPing(title: string, message: string, detail?: string): void {
  showSystemPing({
    type: "info",
    title,
    message,
    detail,
    durationMs: 2800,
    channel: "field-auto-travel",
    replaceChannel: true,
  });
}

export async function handleInteraction(
  zone: InteractionZone,
  map: FieldMap,
  onResume: () => void
): Promise<void> {
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
          await showFieldInteractionAlert("Ops Terminal failed to initialize. The atlas state may need to be regenerated.");
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
        await showFieldInteractionAlert(`PORT unlocks after Floor ${String(PORT_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      renderPortScreen("field");
      break;

    case "dispatch":
      if (!isDispatchNodeUnlocked()) {
        await showFieldInteractionAlert(`DISPATCH unlocks after Floor ${String(DISPATCH_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
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
        await showFieldInteractionAlert(`BLACK MARKET unlocks after Floor ${String(BLACK_MARKET_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      renderBlackMarketScreen("field");
      break;

    case "stable":
      if (!isStableNodeUnlocked()) {
        await showFieldInteractionAlert(`STABLE unlocks after Floor ${String(STABLE_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      renderStableScreen("field");
      break;

    case "schema":
      if (!isSchemaNodeUnlocked()) {
        await showFieldInteractionAlert(`S.C.H.E.M.A. comes online after Floor ${String(SCHEMA_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      renderSchemaScreen("field");
      break;

    case "foundry-annex":
      if (!isFoundryAnnexUnlocked()) {
        await showFieldInteractionAlert(`FOUNDRY + ANNEX comes online after Floor ${String(FOUNDRY_ANNEX_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
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

      if (zone.metadata?.handlerId === "outer_deck_enter_overworld") {
        const { renderFieldScreen, setNextFieldSpawnOverrideTile } = await import("./FieldScreen");
        try {
          setNextFieldSpawnOverrideTile(OUTER_DECK_OVERWORLD_MAP_ID, OUTER_DECK_OVERWORLD_ENTRY_SPAWN_TILE);
          renderFieldScreen(OUTER_DECK_OVERWORLD_MAP_ID);
        } catch (error) {
          console.error("[FIELD] Failed to enter Outer Deck overworld:", error);
          showFieldTravelPing("TRAVEL BLOCKED", "Outer Deck route failed to initialize.");
          onResume();
        }
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_return_to_haven") {
        const nextState = abortOuterDeckExpedition(getGameState());
        updateGameState(() => nextState);
        const { renderFieldScreen, setNextFieldSpawnOverrideTile } = await import("./FieldScreen");
        try {
          setNextFieldSpawnOverrideTile("base_camp", OUTER_DECK_HAVEN_EXIT_SPAWN_TILE);
          renderFieldScreen("base_camp");
        } catch (error) {
          console.error("[FIELD] Failed to return from Outer Decks:", error);
          showFieldTravelPing("RETURN BLOCKED", "HAVEN access failed to resolve.");
          onResume();
        }
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_branch_gate") {
        const zoneId = zone.metadata?.zoneId as any;
        if (!zoneId) {
          onResume();
          break;
        }

        if (!isOuterDeckZoneUnlocked(zoneId, loadCampaignProgress())) {
          showFieldTravelPing(
            "GATE SEALED",
            typeof zone.metadata?.lockedMessage === "string" ? zone.metadata.lockedMessage : getOuterDeckZoneLockedMessage(zoneId),
            "Advance deeper in theater operations to unlock this route.",
          );
          onResume();
          break;
        }

        const nextState = beginOuterDeckExpedition(getGameState(), zoneId);
        updateGameState(() => nextState);

        const { renderFieldScreen, setNextFieldSpawnOverrideTile } = await import("./FieldScreen");
        try {
          const entrySubarea = getOuterDeckBranchEntrySubarea(zoneId);
          setNextFieldSpawnOverrideTile(entrySubarea.mapId, { x: 3, y: 6, facing: "east" });
          renderFieldScreen(entrySubarea.mapId as any);
        } catch (error) {
          console.error("[FIELD] Failed to enter Outer Deck branch:", error);
          showFieldTravelPing("TRAVEL BLOCKED", "The branch route failed to initialize.");
          onResume();
        }
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_transition") {
        const state = getGameState();
        const currentSubarea = getOuterDeckSubareaByMapId(state, String(map.id));
        const targetSubareaId = typeof zone.metadata?.targetSubareaId === "string"
          ? zone.metadata.targetSubareaId
          : "";
        if (!currentSubarea || !targetSubareaId) {
          onResume();
          break;
        }

        if (currentSubarea.enemyCount > 0 && !isOuterDeckSubareaCleared(state, currentSubarea.id)) {
          showFieldTravelPing(
            "ROUTE BLOCKED",
            "Clear the current subarea before advancing deeper into the Outer Decks.",
          );
          onResume();
          break;
        }

        const nextState = setOuterDeckCurrentSubarea(state, targetSubareaId);
        updateGameState(() => nextState);

        const { renderFieldScreen, setNextFieldSpawnOverrideTile } = await import("./FieldScreen");
        try {
          const targetSubarea = getGameState().outerDecks?.activeExpedition?.subareas.find((subarea) => subarea.id === targetSubareaId) ?? null;
          const targetMapId = targetSubarea?.mapId ?? targetSubareaId;
          const returning = currentSubarea.returnToSubareaId === targetSubareaId;
          setNextFieldSpawnOverrideTile(targetMapId, returning
            ? { x: 18, y: 6, facing: "west" }
            : { x: 3, y: 6, facing: "east" });
          renderFieldScreen(targetMapId as any);
        } catch (error) {
          console.error("[FIELD] Failed to transition Outer Deck subarea:", error);
          showFieldTravelPing("ROUTE BLOCKED", "The next subarea failed to initialize.");
          onResume();
        }
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_cache") {
        const state = getGameState();
        const currentSubarea = getOuterDeckSubareaByMapId(state, String(map.id));
        const cacheId = typeof zone.metadata?.cacheId === "string" ? zone.metadata.cacheId : "";
        if (!currentSubarea || !cacheId) {
          onResume();
          break;
        }

        if (currentSubarea.enemyCount > 0 && !isOuterDeckSubareaCleared(state, currentSubarea.id)) {
          await showFieldInteractionAlert("Hostiles remain in the chamber. Secure the area before opening the cache.");
          onResume();
          break;
        }

        if (hasOuterDeckCacheBeenClaimed(state, cacheId)) {
          onResume();
          break;
        }

        applyOuterDeckRewardBundle(zone.metadata?.rewardBundle as Record<string, unknown> | undefined);
        updateGameState((prev) => markOuterDeckCacheClaimed(prev, cacheId));
        showSystemPing({
          type: "success",
          title: "OUTER DECK CACHE",
          message: currentSubarea.title,
          detail: summarizeOuterDeckRewardBundle(zone.metadata?.rewardBundle as Record<string, unknown> | undefined),
          channel: "outer-deck-cache",
          replaceChannel: true,
        });
        onResume();
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_npc") {
        const encounterId = typeof zone.metadata?.npcEncounterId === "string" ? zone.metadata.npcEncounterId : "";
        if (!encounterId) {
          onResume();
          break;
        }

        const encounter = getOuterDeckNpcEncounterDefinition(encounterId as any);
        updateGameState((prev) => markOuterDeckNpcEncounterSeen(prev, encounter.id));
        showDialogue(encounter.name, encounter.lines, onResume, encounter.id);
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_completion") {
        applyOuterDeckRewardBundle(zone.metadata?.rewardBundle as Record<string, unknown> | undefined);
        const completionResult = claimOuterDeckCompletion(getGameState());
        updateGameState(() => completionResult.state);

        const { renderFieldScreen, setNextFieldSpawnOverrideTile } = await import("./FieldScreen");
        try {
          const zoneId = zone.metadata?.zoneId as any;
          const returnSpawn = zoneId ? getOuterDeckOverworldReturnSpawn(zoneId) : OUTER_DECK_OVERWORLD_ENTRY_SPAWN_TILE;
          setNextFieldSpawnOverrideTile(OUTER_DECK_OVERWORLD_MAP_ID, returnSpawn);
          renderFieldScreen(OUTER_DECK_OVERWORLD_MAP_ID);
          showSystemPing({
            type: "success",
            title: "OUTER DECK SECURED",
            message: completionResult.awardedRecipeId
              ? `Recovered ${completionResult.awardedRecipeId.replace(/^recipe_/, "").replace(/_/g, " ").toUpperCase()}.`
              : "Recovery node secured and rewards transferred to HAVEN.",
            detail: summarizeOuterDeckRewardBundle(zone.metadata?.rewardBundle as Record<string, unknown> | undefined),
            channel: "outer-deck-complete",
            replaceChannel: true,
          });
        } catch (error) {
          console.error("[FIELD] Failed to return to Outer Deck overworld:", error);
          showFieldTravelPing("RETURN BLOCKED", "Recovery route failed to initialize.");
          onResume();
        }
        break;
      }

      if (zone.metadata?.handlerId === "weaponsmith_workshop") {
        import("../ui/screens/WeaponsmithScreen").then(({ renderWeaponsmithScreen }) => {
          renderWeaponsmithScreen("field");
        });
        break;
      }

      if (typeof zone.metadata?.lockedMessage === "string") {
        await showFieldInteractionAlert(zone.metadata.lockedMessage);
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
