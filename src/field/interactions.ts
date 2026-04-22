// ============================================================================
// FIELD SYSTEM - INTERACTION HANDLING
// ============================================================================

import { InteractionZone, FieldMap } from "./types";
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
  OUTER_DECK_OPEN_WORLD_TILE_SIZE,
  OUTER_DECK_OVERWORLD_ENTRY_SPAWN_TILE,
  OUTER_DECK_OVERWORLD_MAP_ID,
  beginOuterDeckExpedition,
  claimOuterDeckCompletion,
  grantOuterDeckInteriorCacheReward,
  getOuterDeckInteriorRoomKey,
  getOuterDeckBranchEntrySubarea,
  getOuterDeckNpcEncounterDefinition,
  getOuterDeckOverworldReturnSpawn,
  getOuterDeckSubareaByMapId,
  getOuterDeckZoneLockedMessage,
  hasOuterDeckCacheBeenClaimed,
  isOuterDeckMechanicResolved,
  isOuterDeckZoneUnlocked,
  isOuterDeckSubareaCleared,
  markOuterDeckCacheClaimed,
  markOuterDeckNpcEncounterSeen,
  parseOuterDeckInteriorMapId,
  prepareOuterDeckOpenWorldEntry,
  resolveOuterDeckMechanic,
  setOuterDeckCurrentSubarea,
  setOuterDeckOpenWorldPlayerWorldPosition,
} from "../core/outerDecks";
import { createEmptyResourceWallet, getResourceEntries } from "../core/resources";
import { grantSessionResources } from "../core/session";
import { getCurrentOpsTerminalAtlasFloor } from "../core/opsTerminalAtlas";
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

function isCurrentOuterDeckInteriorRoomCleared(map: FieldMap): boolean {
  const ref = parseOuterDeckInteriorMapId(String(map.id));
  if (!ref) {
    return true;
  }
  const roomKey = getOuterDeckInteriorRoomKey(ref);
  return Boolean(getGameState().outerDecks?.openWorld?.clearedInteriorRoomKeys?.includes(roomKey));
}

function summarizeOuterDeckInteriorReward(result: ReturnType<typeof grantOuterDeckInteriorCacheReward>): string {
  const parts = [
    result.gearReward ? `Gear: ${result.gearReward.name}` : "",
    result.fieldMod ? `Field Mod: ${result.fieldMod.name}` : "",
    result.wad > 0 ? `+${result.wad} WAD` : "",
    ...getResourceEntries(result.resources, { keys: ["metalScrap", "wood", "chaosShards", "steamComponents"] })
      .map((entry) => `+${entry.amount} ${entry.label}`),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : "Cache already secured.";
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

async function renderFieldShopScreen(): Promise<void> {
  const { renderShopScreen } = await import("../ui/screens/ShopScreen");
  renderShopScreen("field");
}

async function renderFieldMerchantShopScreen(floorOrdinal: number): Promise<void> {
  const { renderMerchantShopScreen } = await import("../ui/screens/ShopScreen");
  renderMerchantShopScreen("field", floorOrdinal);
}

async function renderFieldRosterScreen(): Promise<void> {
  const { renderRosterScreen } = await import("../ui/screens/RosterScreen");
  renderRosterScreen("field");
}

async function renderFieldLoadoutScreen(): Promise<void> {
  const { renderInventoryScreen } = await import("../ui/screens/InventoryScreen");
  renderInventoryScreen("field");
}

async function renderFieldOperationSelectScreen(): Promise<void> {
  const { renderOperationSelectScreen } = await import("../ui/screens/OperationSelectScreen");
  renderOperationSelectScreen("field");
}

async function renderFieldQuestBoardScreen(): Promise<void> {
  const { renderQuestBoardScreen } = await import("../ui/screens/QuestBoardScreen");
  renderQuestBoardScreen("field");
}

async function renderFieldTavernScreen(): Promise<void> {
  const { renderTavernDialogueScreen } = await import("../ui/screens/TavernDialogueScreen");
  renderTavernDialogueScreen("base_camp_tavern", "Tavern", "field");
}

async function renderFieldGearWorkbenchScreen(): Promise<void> {
  const { renderGearWorkbenchScreen } = await import("../ui/screens/GearWorkbenchScreen");
  renderGearWorkbenchScreen(undefined, undefined, "field");
}

async function renderFieldPortScreen(): Promise<void> {
  const { renderPortScreen } = await import("../ui/screens/PortScreen");
  renderPortScreen("field");
}

async function renderFieldDispatchScreen(): Promise<void> {
  const { renderDispatchScreen } = await import("../ui/screens/DispatchScreen");
  renderDispatchScreen("field");
}

async function renderFieldQuartersScreen(action?: string): Promise<void> {
  const { renderQuartersScreen } = await import("../ui/screens/QuartersScreen");
  renderQuartersScreen("field", action as any);
}

async function renderFieldBlackMarketScreen(): Promise<void> {
  const { renderBlackMarketScreen } = await import("../ui/screens/BlackMarketScreen");
  renderBlackMarketScreen("field");
}

async function renderFieldStableScreen(): Promise<void> {
  const { renderStableScreen } = await import("../ui/screens/StableScreen");
  renderStableScreen("field");
}

async function renderFieldSchemaScreen(): Promise<void> {
  const { renderSchemaScreen } = await import("../ui/screens/SchemaScreen");
  renderSchemaScreen("field");
}

async function renderFieldFoundryAnnexScreen(): Promise<void> {
  const { renderFoundryAnnexScreen } = await import("../ui/screens/FoundryAnnexScreen");
  renderFoundryAnnexScreen("field");
}

async function showFieldDialogue(
  title: string,
  lines: string[],
  onResume: () => void,
  dialogueId?: string,
): Promise<void> {
  const { showDialogue } = await import("../ui/screens/DialogueScreen");
  showDialogue(title, lines, onResume, dialogueId);
}

async function showImportedFieldDialogue(
  dialogueId: string,
  onResume: () => void,
  label: string,
): Promise<boolean> {
  const { showImportedDialogue } = await import("../ui/screens/DialogueScreen");
  return showImportedDialogue(dialogueId, onResume, label);
}

export async function handleInteraction(
  zone: InteractionZone,
  map: FieldMap,
  onResume: () => void,
  beforeScreenOpen?: () => void,
): Promise<void> {
  const openScreen = (renderScreen: () => void): void => {
    beforeScreenOpen?.();
    renderScreen();
  };
  const openScreenAsync = (renderScreen: () => Promise<void>): void => {
    beforeScreenOpen?.();
    void renderScreen().catch((error) => {
      console.error("[FIELD] Failed to open field interaction screen:", error);
      onResume();
    });
  };

  switch (zone.action) {
    case "shop":
      openScreenAsync(renderFieldShopScreen);
      break;



    case "roster":
      openScreenAsync(renderFieldRosterScreen);
      break;

    case "loadout":
      openScreenAsync(renderFieldLoadoutScreen);
      break;

    case "ops_terminal":
      import("../ui/screens/CommsArrayScreen").then(async ({ openSharedCoopOperationsEntry }) => {
        try {
          const handledByCoop = await openSharedCoopOperationsEntry(beforeScreenOpen);
          if (handledByCoop) {
            return;
          }
          openScreenAsync(renderFieldOperationSelectScreen);
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
        openScreenAsync(renderFieldQuestBoardScreen);
      } catch (error) {
        console.error("[FIELD] Error rendering quest board:", error);
        onResume();
      }
      break;

    case "tavern":
      // Go directly to recruitment screen (no intro dialogue)
      openScreenAsync(renderFieldTavernScreen);
      break;

    case "gear_workbench":
      openScreenAsync(renderFieldGearWorkbenchScreen);
      break;

    case "port":
      if (!isPortNodeUnlocked()) {
        await showFieldInteractionAlert(`PORT unlocks after Floor ${String(PORT_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      openScreenAsync(renderFieldPortScreen);
      break;

    case "dispatch":
      if (!isDispatchNodeUnlocked()) {
        await showFieldInteractionAlert(`DISPATCH unlocks after Floor ${String(DISPATCH_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      openScreenAsync(renderFieldDispatchScreen);
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
      openScreenAsync(renderFieldBlackMarketScreen);
      break;

    case "stable":
      if (!isStableNodeUnlocked()) {
        await showFieldInteractionAlert(`STABLE unlocks after Floor ${String(STABLE_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      openScreenAsync(renderFieldStableScreen);
      break;

    case "schema":
      if (!isSchemaNodeUnlocked()) {
        await showFieldInteractionAlert(`S.C.H.E.M.A. comes online after Floor ${String(SCHEMA_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      openScreenAsync(renderFieldSchemaScreen);
      break;

    case "foundry-annex":
      if (!isFoundryAnnexUnlocked()) {
        await showFieldInteractionAlert(`FOUNDRY + ANNEX comes online after Floor ${String(FOUNDRY_ANNEX_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`);
        onResume();
        break;
      }
      openScreenAsync(renderFieldFoundryAnnexScreen);
      break;

    case "comms-array":
      import("../ui/screens/CommsArrayScreen").then(({ renderHavenCommsArrayScreen }) => {
        openScreen(() => renderHavenCommsArrayScreen("field"));
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
            openScreenAsync(renderFieldQuestBoardScreen);
            return;
          }
          onResume();
        };

        const opened = await showImportedFieldDialogue(String(zone.metadata.dialogueId), resumeAfterDialogue, zone.label);
        if (opened) {
          break;
        }
      }

      if (zone.metadata?.handlerId === "open_board") {
        openScreenAsync(renderFieldQuestBoardScreen);
        break;
      }

      if (zone.metadata?.handlerId === "lobby_skirmish_console") {
        import("../ui/screens/CommsArrayScreen").then(({ renderLobbySkirmishConsoleScreen }) => {
          const lobby = getGameState().lobby;
          if (lobby) {
            openScreen(() => renderLobbySkirmishConsoleScreen("field"));
            return;
          }
          openScreen(() => renderLobbySkirmishConsoleScreen("field"));
        });
        break;
      }

      if (zone.metadata?.handlerId === "lobby_ops_table") {
        import("../ui/screens/CommsArrayScreen").then(({ renderMultiplayerCommsArrayScreen }) => {
          openScreen(() => renderMultiplayerCommsArrayScreen("field"));
        });
        break;
      }

      if (zone.metadata?.handlerId === "lobby_ready_bench") {
        showFieldTravelPing(
          "READY BENCH",
          "Operators resting here are auto-added when the host starts a Co-Op operation.",
        );
        onResume();
        break;
      }

      if (zone.metadata?.handlerId === "lobby_lounge_bench") {
        showFieldTravelPing(
          "LOUNGE BENCH",
          "Operators resting here stay out of automatic Co-Op launch selection.",
        );
        onResume();
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_enter_overworld") {
        const { renderFieldScreen } = await import("./FieldScreen");
        try {
          const apronFloorOrdinal = getCurrentOpsTerminalAtlasFloor().floorOrdinal;
          updateGameState((state) => prepareOuterDeckOpenWorldEntry(state, apronFloorOrdinal));
          renderFieldScreen(OUTER_DECK_OVERWORLD_MAP_ID);
        } catch (error) {
          console.error("[FIELD] Failed to enter Apron overworld:", error);
          showFieldTravelPing("TRAVEL BLOCKED", "Apron route failed to initialize.");
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
          console.error("[FIELD] Failed to return from the Apron:", error);
          showFieldTravelPing("RETURN BLOCKED", "HAVEN access failed to resolve.");
          onResume();
        }
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_traveling_merchant") {
        const floorOrdinal = Math.max(
          1,
          Math.floor(Number(zone.metadata?.floorOrdinal ?? getGameState().outerDecks?.openWorld?.floorOrdinal ?? 1)),
        );
        openScreenAsync(() => renderFieldMerchantShopScreen(floorOrdinal));
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_embedded_corridor_cache") {
        const floorOrdinal = Math.max(1, Math.floor(Number(zone.metadata?.floorOrdinal ?? getGameState().outerDecks?.openWorld?.floorOrdinal ?? 1)));
        const chunkX = Math.trunc(Number(zone.metadata?.chunkX ?? 0));
        const chunkY = Math.trunc(Number(zone.metadata?.chunkY ?? 0));
        const depth = Math.max(0, Math.floor(Number(zone.metadata?.depth ?? 0)));
        const enemyKeys = Array.isArray(zone.metadata?.enemyKeys)
          ? zone.metadata.enemyKeys.map((entry) => String(entry))
          : [];
        const defeatedEnemyKeys = getGameState().outerDecks?.openWorld?.defeatedEnemyKeys ?? [];
        const hostilesRemain = Boolean(zone.metadata?.requiresClear)
          && enemyKeys.some((key) => !defeatedEnemyKeys.includes(key));
        if (hostilesRemain) {
          await showFieldInteractionAlert("Hostiles remain in the corridor. Secure the cave before opening the cache.");
          onResume();
          break;
        }

        const reward = grantOuterDeckInteriorCacheReward(getGameState(), {
          floorOrdinal,
          chunkX,
          chunkY,
          depth,
        });
        updateGameState(() => reward.state);

        const { renderFieldScreen } = await import("./FieldScreen");
        renderFieldScreen(map.id);
        showSystemPing({
          type: reward.granted ? "success" : "info",
          title: reward.granted ? "APRON CACHE SECURED" : "CACHE ALREADY SECURED",
          message: reward.gearReward?.name ?? "Recovered cache",
          detail: summarizeOuterDeckInteriorReward(reward),
          durationMs: 5200,
          channel: "outer-deck-embedded-corridor-cache",
          replaceChannel: true,
        });
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_interior_entry") {
        const targetMapId = typeof zone.metadata?.targetMapId === "string" ? zone.metadata.targetMapId : "";
        if (!targetMapId) {
          onResume();
          break;
        }

        const returnWorldTileX = Number(zone.metadata?.returnWorldTileX);
        const returnWorldTileY = Number(zone.metadata?.returnWorldTileY);
        const returnFacing = zone.metadata?.returnFacing === "north"
          || zone.metadata?.returnFacing === "south"
          || zone.metadata?.returnFacing === "east"
          || zone.metadata?.returnFacing === "west"
          ? zone.metadata.returnFacing
          : "south";
        if (Number.isFinite(returnWorldTileX) && Number.isFinite(returnWorldTileY)) {
          updateGameState((state) => setOuterDeckOpenWorldPlayerWorldPosition(
            state,
            (returnWorldTileX + 0.5) * OUTER_DECK_OPEN_WORLD_TILE_SIZE,
            (returnWorldTileY + 0.5) * OUTER_DECK_OPEN_WORLD_TILE_SIZE,
            returnFacing,
          ));
        }

        const { renderFieldScreen, setNextFieldSpawnOverrideTile } = await import("./FieldScreen");
        try {
          setNextFieldSpawnOverrideTile(targetMapId, { x: 2, y: 8, facing: "east" });
          renderFieldScreen(targetMapId as any);
        } catch (error) {
          console.error("[FIELD] Failed to enter Apron interior:", error);
          showFieldTravelPing("TRAVEL BLOCKED", "The corridor entrance failed to initialize.");
          onResume();
        }
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_interior_transition") {
        const targetMapId = typeof zone.metadata?.targetMapId === "string" ? zone.metadata.targetMapId : "";
        if (!targetMapId) {
          onResume();
          break;
        }

        if (zone.metadata?.requiresClear && !isCurrentOuterDeckInteriorRoomCleared(map)) {
          showFieldTravelPing(
            "ROUTE BLOCKED",
            "Clear the corridor before pushing deeper.",
          );
          onResume();
          break;
        }

        const direction = String(zone.metadata?.direction ?? "deeper");
        const { renderFieldScreen, setNextFieldSpawnOverrideTile } = await import("./FieldScreen");
        try {
          setNextFieldSpawnOverrideTile(targetMapId, direction === "back"
            ? { x: 19, y: 8, facing: "west" }
            : { x: 2, y: 8, facing: "east" });
          renderFieldScreen(targetMapId as any);
        } catch (error) {
          console.error("[FIELD] Failed to move through Apron interior:", error);
          showFieldTravelPing("ROUTE BLOCKED", "The next corridor failed to initialize.");
          onResume();
        }
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_interior_exit") {
        const { renderFieldScreen } = await import("./FieldScreen");
        try {
          renderFieldScreen(OUTER_DECK_OVERWORLD_MAP_ID);
        } catch (error) {
          console.error("[FIELD] Failed to leave Apron interior:", error);
          showFieldTravelPing("RETURN BLOCKED", "The surface route failed to initialize.");
          onResume();
        }
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_interior_cache") {
        const ref = parseOuterDeckInteriorMapId(String(map.id));
        if (!ref) {
          onResume();
          break;
        }

        if (zone.metadata?.requiresClear && !isCurrentOuterDeckInteriorRoomCleared(map)) {
          await showFieldInteractionAlert("Hostiles remain in the corridor. Secure the area before opening the cache.");
          onResume();
          break;
        }

        const reward = grantOuterDeckInteriorCacheReward(getGameState(), ref);
        updateGameState(() => reward.state);

        const { renderFieldScreen } = await import("./FieldScreen");
        renderFieldScreen(map.id);
        showSystemPing({
          type: reward.granted ? "success" : "info",
          title: reward.granted ? "APRON CACHE SECURED" : "CACHE ALREADY SECURED",
          message: reward.gearReward?.name ?? "Recovered cache",
          detail: summarizeOuterDeckInteriorReward(reward),
          durationMs: 5200,
          channel: "outer-deck-interior-cache",
          replaceChannel: true,
        });
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
          console.error("[FIELD] Failed to enter Apron branch:", error);
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

        const advancing = currentSubarea.advanceToSubareaId === targetSubareaId;
        if (
          advancing
          && currentSubarea.requiredMechanicId
          && !isOuterDeckMechanicResolved(state, currentSubarea.requiredMechanicId)
        ) {
          showFieldTravelPing(
            "SYSTEM OFFLINE",
            currentSubarea.requiredMechanicHint ?? "Restore the route controls before advancing.",
          );
          onResume();
          break;
        }

        if (currentSubarea.enemyCount > 0 && !isOuterDeckSubareaCleared(state, currentSubarea.id)) {
          showFieldTravelPing(
            "ROUTE BLOCKED",
            "Clear the current subarea before advancing deeper into the Apron.",
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
          const returning = !advancing && currentSubarea.returnToSubareaId === targetSubareaId;
          setNextFieldSpawnOverrideTile(targetMapId, returning
            ? { x: 18, y: 6, facing: "west" }
            : { x: 3, y: 6, facing: "east" });
          renderFieldScreen(targetMapId as any);
        } catch (error) {
          console.error("[FIELD] Failed to transition Apron subarea:", error);
          showFieldTravelPing("ROUTE BLOCKED", "The next subarea failed to initialize.");
          onResume();
        }
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_mechanic") {
        const state = getGameState();
        const currentSubarea = getOuterDeckSubareaByMapId(state, String(map.id));
        const mechanicId = typeof zone.metadata?.mechanicId === "string" ? zone.metadata.mechanicId : "";
        if (!currentSubarea || !mechanicId) {
          onResume();
          break;
        }

        if (isOuterDeckMechanicResolved(state, mechanicId as any)) {
          onResume();
          break;
        }

        updateGameState((prev) => resolveOuterDeckMechanic(prev, mechanicId as any));
        showSystemPing({
          type: "success",
          title: "ROUTE RESTORED",
          message: typeof zone.metadata?.mechanicLabel === "string" ? zone.metadata.mechanicLabel : currentSubarea.gateVerb,
          detail: currentSubarea.requiredMechanicHint ?? "The route is now active.",
          channel: "outer-deck-mechanic",
          replaceChannel: true,
        });
        onResume();
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
          title: "APRON CACHE",
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
        await showFieldDialogue(encounter.name, encounter.lines, onResume, encounter.id);
        break;
      }

      if (zone.metadata?.handlerId === "outer_deck_completion") {
        const state = getGameState();
        const currentSubarea = getOuterDeckSubareaByMapId(state, String(map.id));
        if (currentSubarea?.enemyCount && !isOuterDeckSubareaCleared(state, currentSubarea.id)) {
          showFieldTravelPing(
            "NODE CONTESTED",
            "Defeat the elite defenders before securing the recovery node.",
          );
          onResume();
          break;
        }

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
            title: "APRON ROUTE SECURED",
            message: completionResult.awardedRecipeId
              ? `Recovered ${completionResult.awardedRecipeId.replace(/^recipe_/, "").replace(/_/g, " ").toUpperCase()}.`
              : "Recovery node secured and rewards transferred to HAVEN.",
            detail: summarizeOuterDeckRewardBundle(zone.metadata?.rewardBundle as Record<string, unknown> | undefined),
            channel: "outer-deck-complete",
            replaceChannel: true,
          });
        } catch (error) {
          console.error("[FIELD] Failed to return to Apron overworld:", error);
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
            openScreenAsync(() => renderFieldQuartersScreen(String(quartersAction)));
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
